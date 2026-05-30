#!/usr/bin/env node
/* eslint-disable no-console */
// Migration runner. Reads /migrations/*.sql in order and applies anything
// that hasn't been recorded in schema_migrations. Each file runs as a single
// transaction inside its own statement block (BEGIN/COMMIT must be present in
// the file itself if grouping is required).

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'migrations');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(ROOT, 'backend/auth-service/.env'));
loadEnv(path.join(ROOT, '.env'));

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'els_ai_db',
});

function checksum(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 64);
}

async function ensureTrackerExists() {
  const r = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations'`);
  if (r.rowCount === 0) {
    const bootstrap = fs.readFileSync(path.join(MIGRATIONS_DIR, '0000_schema_migrations.sql'), 'utf8');
    await pool.query(bootstrap);
    console.log('[migrate] schema_migrations bootstrapped');
  }
}

async function loadAppliedVersions() {
  const r = await pool.query('SELECT version, checksum FROM schema_migrations');
  const out = new Map();
  for (const row of r.rows) out.set(row.version, row.checksum);
  return out;
}

function listMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
}

function parseVersion(filename) {
  return filename.slice(0, 4);
}

async function runMigration(file) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql      = fs.readFileSync(filePath, 'utf8');
  const version  = parseVersion(file);
  const sum      = checksum(sql);
  const start    = Date.now();
  console.log(`[migrate] applying ${file}`);
  await pool.query(sql);
  const duration = Date.now() - start;
  await pool.query(
    `INSERT INTO schema_migrations (version, filename, checksum, duration_ms)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (version) DO UPDATE SET
       checksum    = EXCLUDED.checksum,
       applied_at  = NOW(),
       duration_ms = EXCLUDED.duration_ms`,
    [version, file, sum, duration],
  );
  console.log(`[migrate] ${file} ok (${duration}ms)`);
}

async function main() {
  await ensureTrackerExists();
  const applied = await loadAppliedVersions();
  const files = listMigrationFiles().filter((f) => parseVersion(f) !== '0000'); // skip bootstrap

  let pending = 0;
  for (const file of files) {
    const version = parseVersion(file);
    const sql     = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const sum     = checksum(sql);
    const previous = applied.get(version);
    if (previous && previous === sum) {
      // already applied with same content
      continue;
    }
    if (previous && previous !== sum) {
      console.warn(`[migrate] WARN: checksum drift for ${file}; re-running.`);
    }
    pending += 1;
    await runMigration(file);
  }

  if (pending === 0) {
    console.log('[migrate] nothing to do — DB up to date.');
  } else {
    console.log(`[migrate] ${pending} migration(s) applied.`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('[migrate] FAILED:', err);
  await pool.end();
  process.exit(1);
});
