/**
 * Generic image pipeline for the LKG quizzes:
 *   for every quiz image still showing a placeholder, resolve it to a real
 *   artwork file under assets/images (served at /media/images/<file>).
 *     1. if the target file already exists locally -> just map it
 *     2. else download a real SVG from a public icon source, save it, then map
 *
 * Matched by the option/pair label (or, for label-less prompt_image, by the
 * question title). Items with no rule are left as their placeholder.
 *
 * Idempotent. Re-runs reuse the already-downloaded local files.
 * Usage:  node scripts/lkg_fetch_map_images.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images');
const MEDIA_PREFIX = '/media/images';
const PLACEHOLDER_RE = /placehold\.co|media\.els-ai\.in/i;

const QUIZ_IDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lkg_quiz_upload_result.json'), 'utf8'),
).createdQuizzes.map((q) => q.quizId);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

// Resolution rules. `src` is downloaded into assets/images/<file>; `local` is an
// already-served path used as-is (no download). First matching rule wins.
const RULES = [
  // letters (exact)
  { exact: ['a'], file: 'letter-a.svg', src: 'https://api.iconify.design/mdi/alpha-a-box.svg?color=%234338CA' },
  { exact: ['b'], file: 'letter-b.svg', src: 'https://api.iconify.design/mdi/alpha-b-box.svg?color=%234338CA' },
  { exact: ['c'], file: 'letter-c.svg', src: 'https://api.iconify.design/mdi/alpha-c-box.svg?color=%234338CA' },
  // fruits / creatures
  { keys: ['apple'], file: 'apple.svg', src: 'https://api.iconify.design/noto/red-apple.svg' },
  { keys: ['banana'], file: 'banana.svg', src: 'https://api.iconify.design/noto/banana.svg' },
  { keys: ['ant'], file: 'ant.svg', src: 'https://api.iconify.design/noto/ant.svg' },
  // community helpers
  { keys: ['doctor'], file: 'doctor.svg', src: 'https://api.iconify.design/noto/health-worker.svg' },
  { keys: ['postman', 'postal', 'mail'], file: 'postman.svg', src: 'https://api.iconify.design/noto/postbox.svg' },
  { keys: ['farmer'], file: 'farmer.svg', src: 'https://api.iconify.design/noto/farmer.svg' },
  // shapes
  { keys: ['rectangle'], file: 'rectangle.svg', src: 'https://api.iconify.design/mdi/rectangle.svg?color=%234A90E2' },
  { keys: ['square'], file: 'square.svg', src: 'https://api.iconify.design/noto/orange-square.svg' },
  { keys: ['triangle'], file: 'triangle.svg', src: 'https://api.iconify.design/noto/red-triangle-pointed-up.svg' },
  { keys: ['circle'], file: 'circle.svg', src: 'https://api.iconify.design/noto/blue-circle.svg' },
  // counting cards
  { keys: ['star'], file: 'star.svg', src: 'https://api.iconify.design/noto/star.svg' },
  { keys: ['ball'], file: 'ball.svg', src: 'https://api.iconify.design/noto/soccer-ball.svg' },
  { keys: ['flower'], file: 'flower.svg', src: 'https://api.iconify.design/noto/cherry-blossom.svg' },
  // moral-value scenes (closest representative artwork)
  { keys: ['crayon', 'share'], file: 'crayon.svg', src: 'https://api.iconify.design/noto/crayon.svg' },
  { keys: ['pushfriend', 'push'], file: 'collision.svg', src: 'https://api.iconify.design/noto/collision.svg' },
  { keys: ['hidebag', 'hide', 'bag'], file: 'backpack.svg', src: 'https://api.iconify.design/noto/backpack.svg' },
  { keys: ['goodmorning', 'morning'], file: 'sun.svg', src: 'https://api.iconify.design/noto/sun.svg' },
  { keys: ['litter', 'waste', 'throwwaste'], file: 'wastebasket.svg', src: 'https://api.iconify.design/noto/wastebasket.svg' },
  { keys: ['grandmother', 'help'], file: 'older-woman.svg', src: 'https://api.iconify.design/noto/old-woman.svg' },
  { keys: ['namaste'], file: 'namaste.svg', src: 'https://api.iconify.design/noto/folded-hands.svg' },
  { keys: ['shout'], file: 'loudspeaker.svg', src: 'https://api.iconify.design/noto/loudspeaker.svg' },
  { keys: ['ignore'], file: 'no-entry.svg', src: 'https://api.iconify.design/noto/no-entry.svg' },
  // alphabet puzzle
  { keys: ['alphabet', 'abc'], file: 'abc.svg', src: 'https://api.iconify.design/noto/input-latin-uppercase.svg' },
  // respect / respectful action -> namaste artwork
  { keys: ['respect'], file: 'namaste.svg', src: 'https://api.iconify.design/noto/folded-hands.svg' },
  // flags -> reuse the flag artwork already shipped under assets/flags
  { keys: ['indianflag', 'india', 'flag'], local: '/media/flags/m/IN.svg' },
];

function ruleFor(text) {
  const n = norm(text);
  if (!n) return null;
  for (const r of RULES) {
    if (r.exact && r.exact.includes(n)) return r;
  }
  for (const r of RULES) {
    if (r.keys && r.keys.some((k) => n.includes(k))) return r;
  }
  return null;
}

const fileCache = new Map(); // file -> '/media/images/<file>' | null
const stats = { reused: [], downloaded: [], failed: [], localReuse: [] };

async function ensureRule(rule) {
  if (rule.local) { stats.localReuse.push(rule.local); return rule.local; }
  if (fileCache.has(rule.file)) return fileCache.get(rule.file);
  const dest = path.join(IMAGES_DIR, rule.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    stats.reused.push(rule.file);
    const p = `${MEDIA_PREFIX}/${rule.file}`;
    fileCache.set(rule.file, p);
    return p;
  }
  try {
    const res = await fetch(rule.src, { redirect: 'follow' });
    const body = await res.text();
    if (!res.ok || !/^\s*<(\?xml|svg)/i.test(body)) throw new Error(`bad response (${res.status})`);
    fs.writeFileSync(dest, body);
    stats.downloaded.push(`${rule.file}  <-  ${rule.src}`);
    const p = `${MEDIA_PREFIX}/${rule.file}`;
    fileCache.set(rule.file, p);
    return p;
  } catch (e) {
    stats.failed.push(`${rule.file} (${rule.src}): ${e.message}`);
    fileCache.set(rule.file, null);
    return null;
  }
}

async function walk(node, ctx) {
  if (Array.isArray(node)) { for (const x of node) await walk(x, ctx); return; }
  if (node && typeof node === 'object') {
    const imgKey = 'image' in node ? 'image' : 'imageUrl' in node ? 'imageUrl' : null;
    if (imgKey && typeof node[imgKey] === 'string' && PLACEHOLDER_RE.test(node[imgKey]) && node.label) {
      const rule = ruleFor(node.label);
      if (rule) {
        const mapped = await ensureRule(rule);
        if (mapped && node[imgKey] !== mapped) { node[imgKey] = mapped; ctx.changed = true; }
      } else ctx.unmatched.add(String(node.label));
    }
    for (const v of Object.values(node)) await walk(v, ctx);
  }
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });
  const report = { questionsScanned: 0, questionsUpdated: 0, unmatched: {} };
  try {
    const rows = (await pool.query(
      'SELECT id, question_title, question_data FROM quiz_questions WHERE quiz_id = ANY($1::uuid[])',
      [QUIZ_IDS],
    )).rows;

    for (const row of rows) {
      report.questionsScanned++;
      const ctx = { changed: false, unmatched: new Set() };
      const data = row.question_data;
      await walk(data, ctx);

      // label-less main image (prompt_image / jigsaw image): resolve from the title
      for (const key of ['prompt_image', 'image', 'imageUrl']) {
        if (typeof data[key] === 'string' && PLACEHOLDER_RE.test(data[key])) {
          const rule = ruleFor(row.question_title);
          if (rule) {
            const mapped = await ensureRule(rule);
            if (mapped && data[key] !== mapped) { data[key] = mapped; ctx.changed = true; }
          }
        }
      }

      if (ctx.changed) {
        await pool.query('UPDATE quiz_questions SET question_data = $1::jsonb WHERE id = $2', [JSON.stringify(data), row.id]);
        report.questionsUpdated++;
      }
      ctx.unmatched.forEach((u) => { report.unmatched[u] = (report.unmatched[u] || 0) + 1; });
    }

    const out = path.join(__dirname, 'lkg_fetch_map_images_result.json');
    fs.writeFileSync(out, JSON.stringify({ ...report, ...stats }, null, 2));
    console.log(`questions updated: ${report.questionsUpdated}/${report.questionsScanned}`);
    console.log(`\ndownloaded (${stats.downloaded.length}):`); stats.downloaded.forEach((s) => console.log('  ' + s));
    console.log(`reused local file (${stats.reused.length}):`); stats.reused.forEach((s) => console.log('  ' + s));
    if (stats.localReuse.length) { console.log(`reused existing served asset:`); [...new Set(stats.localReuse)].forEach((s) => console.log('  ' + s)); }
    if (stats.failed.length) { console.log(`\nFAILED downloads (left as placeholder):`); stats.failed.forEach((s) => console.log('  ' + s)); }
    const um = Object.keys(report.unmatched);
    if (um.length) { console.log(`\nno rule (left as placeholder): ${um.join(', ')}`); }
    console.log(`\nReport: ${out}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
