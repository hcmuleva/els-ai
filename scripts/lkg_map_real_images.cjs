/**
 * Remap LKG quiz images to the real local illustrations served by the gateway
 * from assets/pictures (reachable at /media/pictures/<file>).
 *
 * For every image-bearing object in question_data that also has a `label`,
 * the label is matched (directly or via a synonym map) against the available
 * picture files. On a match, the image/imageUrl is rewritten to
 * "/media/pictures/<file>". Items with no matching asset are left untouched
 * (they keep their placehold.co placeholder).
 *
 * Idempotent. Usage:  node scripts/lkg_map_real_images.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const PICTURES_DIR = path.join(__dirname, '..', 'assets', 'pictures');
const MEDIA_PREFIX = '/media/pictures';

// label synonyms -> picture stem (when the label name differs from the file)
const SYNONYMS = {
  bird: 'crow',
  mouse: 'rat',
  rabbit: 'ferret',
  snake: 'rattlesnake',
  hippo: 'hippopotamus',
  honeybee: 'bee',
};

const PLACEHOLDER_RE = /placehold\.co|media\.els-ai\.in/i;

const QUIZ_IDS = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'lkg_quiz_upload_result.json'), 'utf8'));
  return (j.createdQuizzes || []).map((q) => q.quizId).filter(Boolean);
})();

// available picture stems: { cow: 'cow.png', ... }
const STEMS = (() => {
  const map = {};
  for (const f of fs.readdirSync(PICTURES_DIR)) {
    const stem = f.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
    map[stem] = f;
  }
  return map;
})();

function normalizeLabel(label) {
  return String(label || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

function pictureForLabel(label) {
  let key = normalizeLabel(label);
  if (!key) return null;
  if (STEMS[key]) return STEMS[key];
  if (SYNONYMS[key] && STEMS[SYNONYMS[key]]) return STEMS[SYNONYMS[key]];
  if (key.endsWith('s') && STEMS[key.slice(0, -1)]) return STEMS[key.slice(0, -1)]; // simple plural
  return null;
}

// Derive a picture from free text (e.g. question title "Find the cow") by
// scanning each word against the available stems + synonyms.
function pictureFromText(text) {
  const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  for (const w of words) {
    const f = pictureForLabel(w);
    if (f) return f;
  }
  return null;
}

function deepMap(node, counter) {
  if (Array.isArray(node)) return node.map((x) => deepMap(x, counter));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = deepMap(v, counter);
    // if this object carries a label + an image field, try to map it
    const imgKey = 'image' in out ? 'image' : 'imageUrl' in out ? 'imageUrl' : null;
    if (imgKey && out.label) {
      const file = pictureForLabel(out.label);
      if (file) {
        const next = `${MEDIA_PREFIX}/${file}`;
        if (out[imgKey] !== next) {
          counter.mapped.push({ label: out.label, file });
          out[imgKey] = next;
        }
      } else {
        counter.unmatched.push(String(out.label));
      }
    }
    return out;
  }
  return node;
}

async function main() {
  const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });
  const report = { questionsScanned: 0, questionsUpdated: 0, mapped: [], unmatchedLabels: {} };
  try {
    const rows = (await pool.query(
      'SELECT id, question_title, question_data FROM quiz_questions WHERE quiz_id = ANY($1::uuid[])',
      [QUIZ_IDS],
    )).rows;

    for (const row of rows) {
      report.questionsScanned++;
      const counter = { mapped: [], unmatched: [] };
      const next = deepMap(row.question_data, counter);

      // label-less main image (prompt_image): derive from the question title
      if (next && typeof next === 'object' && typeof next.prompt_image === 'string' && PLACEHOLDER_RE.test(next.prompt_image)) {
        const file = pictureFromText(row.question_title);
        if (file) {
          next.prompt_image = `${MEDIA_PREFIX}/${file}`;
          counter.mapped.push({ label: `prompt:${row.question_title}`, file });
        }
      }

      if (counter.mapped.length) {
        await pool.query('UPDATE quiz_questions SET question_data = $1::jsonb WHERE id = $2', [JSON.stringify(next), row.id]);
        report.questionsUpdated++;
        report.mapped.push(...counter.mapped);
      }
      for (const u of counter.unmatched) report.unmatchedLabels[u] = (report.unmatchedLabels[u] || 0) + 1;
    }

    const out = path.join(__dirname, 'lkg_map_real_images_result.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`questions updated: ${report.questionsUpdated}/${report.questionsScanned}`);
    console.log(`\nMapped to real assets (${report.mapped.length}):`);
    const uniq = {};
    report.mapped.forEach((m) => { uniq[`${m.label} -> ${m.file}`] = (uniq[`${m.label} -> ${m.file}`] || 0) + 1; });
    Object.entries(uniq).forEach(([k, n]) => console.log(`  ${k}  x${n}`));
    console.log(`\nLeft as placeholder (no local asset):`);
    Object.entries(report.unmatchedLabels).sort().forEach(([k, n]) => console.log(`  ${k}  x${n}`));
    console.log(`\nReport: ${out}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
