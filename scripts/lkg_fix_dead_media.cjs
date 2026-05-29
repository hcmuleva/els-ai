/**
 * Replace dead production media URLs (media.els-ai.in, unreachable in local
 * deployment) inside the 10 LKG quizzes:
 *   - image files  -> labeled placeholder via placehold.co (label from filename)
 *   - audio files  -> a working public sample mp3
 *
 * Rewrites both quiz_questions.question_data (jsonb, deep) and the
 * quiz_questions.question_audio column. Idempotent.
 *
 * Usage:  node scripts/lkg_fix_dead_media.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DEAD_HOST = 'media.els-ai.in';
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const AUD_EXT = /\.(mp3|wav|m4a|aac|ogg)$/i;

const QUIZ_IDS = (() => {
  const f = path.join(__dirname, 'lkg_quiz_upload_result.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return (j.createdQuizzes || []).map((q) => q.quizId).filter(Boolean);
})();

function labelFromUrl(url) {
  const clean = url.split('?')[0].split('#')[0];
  const base = clean.substring(clean.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
  const words = base.replace(/[-_]+/g, ' ').trim();
  const titled = words.replace(/\b\w/g, (m) => m.toUpperCase());
  return titled || 'Image';
}

function placeholderFor(url) {
  const label = labelFromUrl(url);
  return `https://placehold.co/400x400/EEF2FF/4338CA?text=${encodeURIComponent(label)}`;
}

function isDead(v) {
  return typeof v === 'string' && v.includes(DEAD_HOST);
}

function rewriteString(v) {
  if (!isDead(v)) return { value: v, changed: false };
  if (AUD_EXT.test(v.split('?')[0])) return { value: SAMPLE_AUDIO, changed: true };
  if (IMG_EXT.test(v.split('?')[0])) return { value: placeholderFor(v), changed: true };
  // unknown extension on dead host -> treat as image placeholder
  return { value: placeholderFor(v), changed: true };
}

function deepRewrite(node, counter) {
  if (Array.isArray(node)) {
    return node.map((x) => deepRewrite(x, counter));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(node)) out[k] = deepRewrite(val, counter);
    return out;
  }
  if (typeof node === 'string') {
    const r = rewriteString(node);
    if (r.changed) counter.n++;
    return r.value;
  }
  return node;
}

async function main() {
  if (QUIZ_IDS.length === 0) {
    console.error('No LKG quiz IDs found.');
    process.exit(1);
  }
  const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });
  const report = { quizzes: QUIZ_IDS.length, questionsScanned: 0, questionsUpdated: 0, imageOrFieldReplacements: 0, audioColumnFixed: 0 };

  try {
    const rows = (await pool.query(
      'SELECT id, question_data, question_audio FROM quiz_questions WHERE quiz_id = ANY($1::uuid[])',
      [QUIZ_IDS],
    )).rows;

    for (const row of rows) {
      report.questionsScanned++;
      const counter = { n: 0 };
      const newData = deepRewrite(row.question_data, counter);

      let newAudio = row.question_audio;
      let audioFixed = false;
      if (isDead(row.question_audio)) {
        const r = rewriteString(row.question_audio);
        newAudio = r.value;
        audioFixed = r.changed;
      }

      if (counter.n > 0 || audioFixed) {
        await pool.query(
          'UPDATE quiz_questions SET question_data = $1::jsonb, question_audio = $2 WHERE id = $3',
          [JSON.stringify(newData), newAudio, row.id],
        );
        report.questionsUpdated++;
        report.imageOrFieldReplacements += counter.n;
        if (audioFixed) report.audioColumnFixed++;
      }
    }

    // sanity: any dead host left?
    const left = (await pool.query(
      `SELECT COUNT(*)::int n FROM quiz_questions
       WHERE quiz_id = ANY($1::uuid[])
         AND (question_data::text LIKE '%${DEAD_HOST}%' OR COALESCE(question_audio,'') LIKE '%${DEAD_HOST}%')`,
      [QUIZ_IDS],
    )).rows[0].n;
    report.deadHostRemaining = left;

    const out = path.join(__dirname, 'lkg_fix_dead_media_result.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nReport: ${out}`);
    if (left > 0) { console.error(`WARNING: ${left} questions still reference ${DEAD_HOST}`); process.exitCode = 1; }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
