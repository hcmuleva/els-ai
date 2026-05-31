/**
 * Creates a classroom that includes the four sections of topic
 * "संस्कार शिविर नंबर -१" (798d80a6-94d6-4a4b-a145-b57ef3719e4f).
 *
 * Steps:
 *  1) Login as teacher@els.ai.
 *  2) For each section in Shivir_part1.json, ensure a learning_contents
 *     item exists under the topic (POST /content/items) — each item
 *     bundles all 4 YouTube videos for that section as sub-sections.
 *  3) Reuse the 4 quizIds previously created (read from
 *     scripts/create_sanskar_shivir_content_result.json).
 *  4) POST /classrooms with the contentIds + quizIds.
 *
 * Run: node scripts/create_sanskar_shivir_classroom.cjs
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:4000';
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@els.ai';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'welcome';

const SHIVIR_JSON = path.resolve(__dirname, '..', 'Shivir_part1.json');
const PRIOR_RESULT = path.resolve(__dirname, 'create_sanskar_shivir_content_result.json');

const TOPIC_ID = '798d80a6-94d6-4a4b-a145-b57ef3719e4f';
const TOPIC_TITLE = 'संस्कार शिविर नंबर -१';
const CLASS_LEVEL = '10';
const SUBJECT = 'Computer Applications / IT';

const CLASSROOM_TITLE = `${TOPIC_TITLE} — Live Class`;
const CLASSROOM_DESC = 'Live classroom covering all four sections of Sanskar Shivir Number 1: Baal Gopal, NatKhat Gopal, NandGopal, GwalGopal.';

async function jfetch(token, url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GATEWAY}${url}`, { ...options, headers });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}: ${body.message || JSON.stringify(body)}`);
    err.status = res.status; err.body = body;
    throw err;
  }
  return body;
}

async function login() {
  const res = await fetch(`${GATEWAY}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: TEACHER_EMAIL, password: TEACHER_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { token: json.accessToken, user: json.user };
}

async function ensureContentItemForSection(token, section) {
  const list = await jfetch(token, `/content/items?topic_id=${TOPIC_ID}&limit=300`);
  const existing = (list.items || []).find((it) => it.title === section.name);
  if (existing) {
    console.log(`  content already exists for ${section.name}: ${existing.id}`);
    return existing.id;
  }
  const subSections = section.videos.map((v, i) => ({
    title: v.title,
    contentType: 'youtube_url',
    externalUrl: v.watchUrl,
  }));
  const created = await jfetch(token, '/content/items', {
    method: 'POST',
    body: JSON.stringify({
      classLevel: CLASS_LEVEL,
      subject: SUBJECT,
      topicId: TOPIC_ID,
      title: section.name,
      sections: subSections,
    }),
  });
  console.log(`  content created for ${section.name}: ${created.id} (${subSections.length} sub-sections)`);
  return created.id;
}

async function main() {
  const shivir = JSON.parse(fs.readFileSync(SHIVIR_JSON, 'utf8'));
  const prior = JSON.parse(fs.readFileSync(PRIOR_RESULT, 'utf8'));
  console.log(`▶ Sanskar Shivir classroom seeder`);

  const { token, user } = await login();
  console.log(`  logged in as ${user.email} (org=${user.organizationId})`);

  const contentIds = [];
  for (const section of shivir.sections) {
    const id = await ensureContentItemForSection(token, section);
    contentIds.push(id);
  }

  const quizIds = prior.sections.map((s) => s.quizId);
  console.log(`  reusing quizIds: ${quizIds.join(', ')}`);

  const startTime = new Date(Date.now() + 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const classroom = await jfetch(token, '/classrooms', {
    method: 'POST',
    body: JSON.stringify({
      title: CLASSROOM_TITLE,
      description: CLASSROOM_DESC,
      scheduleType: 'scheduled',
      startTime,
      endTime,
      durationMinutes: 60,
      classLevel: CLASS_LEVEL,
      status: 'active',
      contentIds,
      quizIds,
      assignments: [],
    }),
  });

  const room = classroom.classroom || classroom;
  const summary = {
    classroomId: room.id,
    classroomTitle: room.title,
    topicId: TOPIC_ID,
    classLevel: CLASS_LEVEL,
    scheduleType: classroom.scheduleType,
    startTime,
    endTime,
    contentIds,
    quizIds,
  };
  const out = path.resolve(__dirname, 'create_sanskar_shivir_classroom_result.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`\n✔ Done. Summary written to ${out}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('\n✖ Failed:', err);
  if (err.body) console.error('  body:', JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
