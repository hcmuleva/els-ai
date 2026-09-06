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
  { name: 'core-api', dir: 'backend/core-api', port: 4020 },
  { name: 'workers', dir: 'backend/workers', port: null },
  { name: 'media-service', dir: 'backend/media-service', port: 4004 },
  { name: 'ai-service', dir: 'backend/ai-service', port: 4003 },
  { name: 'gateway', dir: 'backend/gateway', port: 4000 },
];

// Shared workspaces the services above import as @els-ai/*. Each one's
// package.json "main" points at "./dist/index.js", so it must be built
// before any service that imports it can resolve the module (even under
// `npm run dev` / tsx watch, since Node resolves dependencies through
// node_modules, not raw TS source). Order matters: db-runtime depends on
// db-tenant, so db-tenant must build first.
const SHARED_PACKAGES = [
  'backend/shared/event-bus',
  'backend/shared/internal-auth',
  'backend/shared/media-client',
  'backend/shared/db-tenant',
  'backend/shared/db-runtime',
];

function buildSharedPackages() {
  console.log('🔧 Building shared packages (@els-ai/*)...');
  for (const dir of SHARED_PACKAGES) {
    const pkgPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(path.join(pkgPath, 'package.json'))) continue;
    try {
      execSync('npm run build --if-present', { cwd: pkgPath, stdio: 'pipe' });
    } catch (err) {
      console.log(`   ⚠️  Failed to build ${dir}: ${err.message}`);
    }
  }
}

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
  if (!port) return;
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

  buildSharedPackages();

  const newPids = {};

  for (const service of SERVICES) {
    await freePort(service.port, service.name);

    const logFilePath = path.join(LOGS_DIR, `${service.name}.log`);
    // Open the log file's fd directly and hand it to the child's stdio so the
    // OS pipes output straight to disk. This (plus detached: true) lets the
    // child keep running, and this script exit cleanly, independent of each
    // other: piping through child.stdout/.stderr Node streams instead would
    // keep this script's event loop alive indefinitely waiting to pump them.
    const logFd = fs.openSync(logFilePath, 'a');

    console.log(`📦 Starting ${service.name} (port ${service.port})...`);
    
    // Spawn using npm run dev in the respective service folder.
    // detached: true puts the child in its own process group so it keeps
    // running independently of this script's process (terminatePid below
    // relies on this: it signals -pid, the process group, not just the pid).
    const child = spawn('npm', ['run', 'dev'], {
      cwd: path.join(ROOT_DIR, service.dir),
      shell: true,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, ...(service.port ? { PORT: String(service.port) } : {}) },
    });

    fs.closeSync(logFd);
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
    if (!service.port) {
      const pid = newPids[service.name];
      if (pid && isProcessRunning(pid)) {
        console.log(`   ✅ ${service.name} is running (no HTTP port, PID: ${pid})`);
        successCount++;
      } else {
        console.log(`   ❌ ${service.name} failed to start. Check logs/${service.name}.log`);
      }
      continue;
    }
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

const NAME_COL = Math.max(...SERVICES.map((s) => s.name.length)) + 2;

function showStatus() {
  console.log('\n🖥️  ELS-AI Services Status:\n');
  const pids = loadPids();

  for (const service of SERVICES) {
    const pid = pids[service.name];
    if (!service.port) {
      if (pid && isProcessRunning(pid)) {
        console.log(`   ● ${service.name.padEnd(NAME_COL)} RUNNING   (PID: ${pid.toString().padEnd(6)} | no HTTP port)`);
      } else {
        console.log(`   ○ ${service.name.padEnd(NAME_COL)} STOPPED`);
      }
      continue;
    }
    const listeners = getListeningPids(service.port);
    if (listeners.length > 0) {
      const displayPid = listeners[0].toString().padEnd(6);
      console.log(`   ● ${service.name.padEnd(NAME_COL)} RUNNING   (PID: ${displayPid} | Port: ${service.port})`);
    } else if (pid && isProcessRunning(pid)) {
      console.log(`   ◐ ${service.name.padEnd(NAME_COL)} STARTING  (PID: ${pid.toString().padEnd(6)} | Port: ${service.port})`);
    } else {
      console.log(`   ○ ${service.name.padEnd(NAME_COL)} STOPPED`);
    }
  }
  console.log('');
}

async function healthCheckAll() {
  console.log('\n🩺 ELS-AI Services Health Check:\n');
  const pids = loadPids();
  for (const service of SERVICES) {
    if (!service.port) {
      const pid = pids[service.name];
      if (pid && isProcessRunning(pid)) {
        console.log(`   ✅ ${service.name.padEnd(NAME_COL)} no HTTP port → PID ${pid} alive`);
      } else {
        console.log(`   ❌ ${service.name.padEnd(NAME_COL)} no HTTP port → not running`);
      }
      continue;
    }
    const url = `http://localhost:${service.port}/health`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.text();
        console.log(`   ✅ ${service.name.padEnd(NAME_COL)} ${url} → 200 ${body.slice(0, 80)}`);
      } else {
        console.log(`   ⚠️  ${service.name.padEnd(NAME_COL)} ${url} → ${res.status}`);
      }
    } catch (err) {
      console.log(`   ❌ ${service.name.padEnd(NAME_COL)} ${url} → ${err.message || 'unreachable'}`);
    }
  }
  console.log('');
}

function tailLog(serviceName, lines = 50) {
  const match = SERVICES.find((s) => s.name === serviceName);
  if (!match) {
    console.log(`\n❌ Unknown service "${serviceName}". Known: ${SERVICES.map((s) => s.name).join(', ')}\n`);
    process.exit(1);
  }
  const logPath = path.join(LOGS_DIR, `${serviceName}.log`);
  if (!fs.existsSync(logPath)) {
    console.log(`\nℹ️  No log file yet at ${logPath}\n`);
    return;
  }
  try {
    const output = execSync(`tail -n ${lines} "${logPath}"`, { encoding: 'utf8' });
    console.log(`\n📜 Last ${lines} lines of ${serviceName}.log:\n`);
    console.log(output);
  } catch (err) {
    console.log(`Failed to tail log: ${err.message}`);
  }
}

async function restartOne(serviceName) {
  const service = SERVICES.find((s) => s.name === serviceName);
  if (!service) {
    console.log(`\n❌ Unknown service "${serviceName}". Known: ${SERVICES.map((s) => s.name).join(', ')}\n`);
    process.exit(1);
  }

  const pids = loadPids();
  const existingPid = pids[service.name];
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`   Stopping ${service.name} (PID: ${existingPid})...`);
    await terminatePid(existingPid);
  }
  await freePort(service.port, service.name);

  buildSharedPackages();

  ensureLogsDir();
  const logFilePath = path.join(LOGS_DIR, `${service.name}.log`);
  const logFd = fs.openSync(logFilePath, 'a');
  console.log(`📦 Restarting ${service.name} (port ${service.port})...`);
  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(ROOT_DIR, service.dir),
    shell: true,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ...(service.port ? { PORT: String(service.port) } : {}) },
  });
  fs.closeSync(logFd);
  child.unref();

  pids[service.name] = child.pid;
  savePids(pids);
  console.log(`   └─ Spawned with PID ${child.pid}`);
  await sleep(2000);

  if (!service.port) {
    if (isProcessRunning(child.pid)) {
      console.log(`   ✅ ${service.name} is up (no HTTP port)\n`);
    } else {
      console.log(`   ❌ ${service.name} did not stay running. Check logs/${service.name}.log\n`);
    }
    return;
  }

  const listeners = getListeningPids(service.port);
  if (listeners.length > 0) {
    console.log(`   ✅ ${service.name} is up on port ${service.port}\n`);
  } else {
    console.log(`   ❌ ${service.name} did not bind to port ${service.port}. Check logs/${service.name}.log\n`);
  }
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  if (command === 'start') {
    await startAll();
  } else if (command === 'stop') {
    await stopAll();
  } else if (command === 'restart') {
    if (arg) {
      await restartOne(arg);
    } else {
      await stopAll();
      await sleep(1500);
      await startAll();
    }
  } else if (command === 'status') {
    showStatus();
  } else if (command === 'health') {
    await healthCheckAll();
  } else if (command === 'logs') {
    if (!arg) {
      console.log('\nUsage: node scripts/manage-services.js logs <service-name> [lines=50]\n');
      console.log(`Known services: ${SERVICES.map((s) => s.name).join(', ')}\n`);
      process.exit(1);
    }
    const lines = Number(process.argv[4]) || 50;
    tailLog(arg, lines);
  } else if (command === 'list') {
    console.log('\n📋 ELS-AI Services Registry:\n');
    for (const s of SERVICES) {
      console.log(`   ${s.name.padEnd(NAME_COL)} dir=${s.dir.padEnd(28)} port=${s.port ?? 'n/a'}`);
    }
    console.log('');
  } else {
    console.log('\nUsage: node scripts/manage-services.js <command>\n');
    console.log('Commands:');
    console.log('  start                          start all services in background');
    console.log('  stop                           stop all services');
    console.log('  restart [service]              restart everything (or a single service)');
    console.log('  status                         show running/stopped status');
    console.log('  health                         hit each /health endpoint and report');
    console.log('  logs <service> [lines]         tail a service log (default 50 lines)');
    console.log('  list                           print the service registry\n');
    console.log(`Known services: ${SERVICES.map((s) => s.name).join(', ')}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
