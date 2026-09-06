/**
 * Point LKG memory_match questions at the real memory-game artwork in
 * assets/memory-assets (served at /media/memory-assets/<file>.svg), exactly the
 * catalog the in-app memory creator uses (frontend/src/data/memoryAssets.ts).
 *
 * Each pair's imageUrl is set to a catalog asset:
 *   - matched by the pair label when an asset of that name exists (Apple, Banana, ...)
 *   - otherwise a distinct kid-friendly asset is assigned so the matching game
 *     still renders real images (labels like "Please"/"Circle" have no artwork).
 * Labels are left unchanged (the card shows the image, not the label).
 *
 * Idempotent. Usage:  node scripts/lkg_map_memory_assets.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const QUIZ_IDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lkg_quiz_upload_result.json'), 'utf8'),
).createdQuizzes.map((q) => q.quizId);

// Parse the shared catalog so we stay in sync with the app.
const CATALOG = (() => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'frontend', 'src', 'data', 'memoryAssets.ts'),
    'utf8',
  );
  const re = /\{\s*id:\s*'([^']+)',\s*filename:\s*'[^']+',\s*label:\s*'([^']+)',\s*mediaPath:\s*'([^']+)'\s*\}/g;
  const list = [];
  let m;
  while ((m = re.exec(src))) list.push({ id: m[1], label: m[2], mediaPath: m[3] });
  return list;
})();

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

const BY_KEY = (() => {
  const map = {};
  for (const a of CATALOG) {
    map[norm(a.id)] = a.mediaPath;
    map[norm(a.label)] = a.mediaPath;
  }
  return map;
})();

// Ordered kid-friendly fallback pool (ids must exist in the catalog).
const FALLBACK_IDS = ['cat', 'dog', 'cow', 'lion', 'elephant', 'fish', 'owl', 'frog', 'tiger', 'monkey', 'panda', 'rabbit', 'duck', 'pig', 'penguin', 'butterfly', 'whale', 'turtle', 'giraffe', 'hippo'];
const FALLBACK = FALLBACK_IDS.map((id) => CATALOG.find((a) => a.id === id)).filter(Boolean).map((a) => a.mediaPath);

function assetForLabel(label) {
  return BY_KEY[norm(label)] || null;
}

async function main() {
  if (CATALOG.length === 0) { console.error('Could not parse memory asset catalog.'); process.exit(1); }
  const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });
  const report = { catalog: CATALOG.length, questionsScanned: 0, questionsUpdated: 0, assignments: [] };

  try {
    const rows = (await pool.query(
      "SELECT id, question_title, question_data FROM quiz_questions WHERE quiz_id = ANY($1::uuid[]) AND question_type = 'memory_match'",
      [QUIZ_IDS],
    )).rows;

    for (const row of rows) {
      report.questionsScanned++;
      const data = row.question_data;
      const pairs = Array.isArray(data.pairs) ? data.pairs : [];
      const used = new Set();
      let changed = false;
      let fbIdx = 0;

      for (const pair of pairs) {
        let asset = assetForLabel(pair.label);
        if (asset && used.has(asset)) asset = null; // keep images distinct within a question
        if (!asset) {
          while (fbIdx < FALLBACK.length && used.has(FALLBACK[fbIdx])) fbIdx++;
          asset = FALLBACK[fbIdx] || FALLBACK[0];
          fbIdx++;
        }
        used.add(asset);
        if (pair.imageUrl !== asset) {
          pair.imageUrl = asset;
          changed = true;
        }
        report.assignments.push({ q: row.question_title, label: pair.label, asset });
      }

      if (changed) {
        await pool.query('UPDATE quiz_questions SET question_data = $1::jsonb WHERE id = $2', [JSON.stringify(data), row.id]);
        report.questionsUpdated++;
      }
    }

    const out = path.join(__dirname, 'lkg_map_memory_assets_result.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`catalog assets: ${report.catalog}`);
    console.log(`memory questions updated: ${report.questionsUpdated}/${report.questionsScanned}\n`);
    const seen = new Set();
    for (const a of report.assignments) {
      const k = `${a.q} | ${a.label} -> ${a.asset.replace('/media/memory-assets/', '')}`;
      if (!seen.has(k)) { console.log('  ' + k); seen.add(k); }
    }
    console.log(`\nReport: ${out}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
