import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const PID_FILE = path.join(LOGS_DIR, 'services.pid');

const SERVICES = [
  { name: 'auth-service', dir: 'backend/auth-service', port: 4101 },
  { name: 'quiz-service', dir: 'backend/quiz-service', port: 4002 },
  { name: 'media-service', dir: 'backend/media-service', port: 4004 },
  { name: 'ai-service', dir: 'backend/ai-service', port: 4003 },
  { name: 'gateway', dir: 'backend/gateway', port: 4000 },
];

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function loadPids() {
  if (!fs.existsSync(PID_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function savePids(pids) {
  ensureLogsDir();
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2), 'utf8');
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getListeningPids(port) {
  try {
    const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();

    if (!output) return [];

    return [...new Set(output.split('\n').map((line) => Number(line.trim())).filter((pid) => Number.isInteger(pid) && pid > 0))];
  } catch {
    return [];
  }
}

async function terminatePid(pid) {
  if (!isProcessRunning(pid)) return;

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return;
    }
  }

  await sleep(1200);

  if (!isProcessRunning(pid)) return;

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      return;
    }
  }

  await sleep(400);
}

async function freePort(port, serviceName) {
  const listeners = getListeningPids(port).filter((pid) => pid !== process.pid);
  if (listeners.length === 0) return;

  console.log(`⚠️  Port ${port} is in use. Reclaiming it for ${serviceName}...`);
  for (const pid of listeners) {
    console.log(`   Killing PID ${pid} on port ${port}`);
    await terminatePid(pid);
  }

  const remaining = getListeningPids(port);
  if (remaining.length > 0) {
    throw new Error(`Could not free port ${port}. Still used by: ${remaining.join(', ')}`);
  }
}

async function startAll() {
  console.log('\n🚀 Starting all ELS-AI microservices...\n');
  ensureLogsDir();

  const pids = loadPids();
  let alreadyRunning = false;

  for (const [name, pid] of Object.entries(pids)) {
    if (isProcessRunning(pid)) {
      console.log(`⚠️  ${name} is already running with PID ${pid}`);
      alreadyRunning = true;
    }
  }

  if (alreadyRunning) {
    console.log('\n⚠️  Existing ELS services detected. Stopping them first...\n');
    await stopAll();
    await sleep(1500);
  }

  const newPids = {};

  for (const service of SERVICES) {
    await freePort(service.port, service.name);

    const logFilePath = path.join(LOGS_DIR, `${service.name}.log`);
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    console.log(`📦 Starting ${service.name} (port ${service.port})...`);
    
    // Spawn using npm run dev in the respective service folder
    const child = spawn('npm', ['run', 'dev'], {
      cwd: path.join(ROOT_DIR, service.dir),
      shell: true,
      env: { ...process.env, PORT: String(service.port) },
    });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.unref();

    newPids[service.name] = child.pid;
    console.log(`   └─ Spawned with PID: ${child.pid} -> Logs: logs/${service.name}.log`);
  }

  savePids(newPids);

  // Give processes 2 seconds to initialize, then verify
  await sleep(2500);

  console.log('\n📊 Startup Verification:');
  let successCount = 0;
  for (const service of SERVICES) {
    const listeners = getListeningPids(service.port);
    if (listeners.length > 0) {
      console.log(`   ✅ ${service.name} is running (Port: ${service.port}, PID: ${listeners[0]})`);
      successCount++;
    } else {
      console.log(`   ❌ ${service.name} failed to start. Check logs/${service.name}.log`);
    }
  }

  if (successCount === SERVICES.length) {
    console.log('\n✨ All services successfully started in the background!');
    console.log('   API Gateway is listening at: http://localhost:4000\n');
  } else {
    console.log('\n⚠️  Some services failed to start. Run "npm run services:status" or check logs/ for details.\n');
  }
}

async function stopAll() {
  console.log('\n🛑 Stopping all ELS-AI microservices...\n');
  const pids = loadPids();

  if (Object.keys(pids).length === 0) {
    console.log('ℹ️  No registered running services found.');
    return;
  }

  for (const [name, pid] of Object.entries(pids)) {
    if (isProcessRunning(pid)) {
      console.log(`   Stopping ${name} (PID: ${pid})...`);
      try {
        await terminatePid(pid);
      } catch (err) {
        console.log(`   ⚠️ Failed to kill ${name} (PID: ${pid}): ${err.message}`);
      }
    } else {
      console.log(`   ℹ️  ${name} (PID: ${pid}) was already stopped.`);
    }
  }

  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }

  console.log('\n✨ All services stopped.\n');
}

function showStatus() {
  console.log('\n🖥️  ELS-AI Services Status:\n');
  const pids = loadPids();

  if (Object.keys(pids).length === 0) {
    console.log('   All services are stopped.');
    return;
  }

  for (const service of SERVICES) {
    const pid = pids[service.name];
    const listeners = getListeningPids(service.port);
    if (listeners.length > 0) {
      const displayPid = listeners[0].toString().padEnd(6);
      console.log(`   ● ${service.name.padEnd(15)} RUNNING   (PID: ${displayPid} | Port: ${service.port})`);
    } else if (pid && isProcessRunning(pid)) {
      console.log(`   ◐ ${service.name.padEnd(15)} STARTING  (PID: ${pid.toString().padEnd(6)} | Port: ${service.port})`);
    } else {
      console.log(`   ○ ${service.name.padEnd(15)} STOPPED`);
    }
  }
  console.log('');
}

async function main() {
  const command = process.argv[2];

  if (command === 'start') {
    await startAll();
  } else if (command === 'stop') {
    await stopAll();
  } else if (command === 'restart') {
    await stopAll();
    await sleep(1500);
    await startAll();
  } else if (command === 'status') {
    showStatus();
  } else {
    console.log('Usage: node scripts/manage-services.js [start|stop|restart|status]');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
