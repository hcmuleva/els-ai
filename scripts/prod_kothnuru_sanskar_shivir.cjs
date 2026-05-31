/**
 * Production seeder for Kothnuru org on https://emeelan.in/els-ai/api
 *
 * Steps (all idempotent — re-runs reuse what already exists by title):
 *   1) admin@kothnuru.ai → ensure subject (classLevel=ANY, title="संस्कार शिविर")
 *   2) teacher@kothnuru.ai → ensure topic "संस्कार शिविर नंबर -१" (classLevel=ANY)
 *   3) Save 4 topic sections (one per Gopal, primary YouTube URL each)
 *   4) Create 4 quizzes (5 questions each, verbatim from Shivir_part1.json)
 *   5) Attach quizzes to topic
 *   6) Create 4 multi-section learning_contents items linked to the topic
 *   7) Create classroom (instant, status=active) referencing the 4 contentIds
 *      and the 4 quizIds
 *
 * Run: node scripts/prod_kothnuru_sanskar_shivir.cjs
 *
 * Override env if desired:
 *   PROD_API, ADMIN_EMAIL, ADMIN_PASSWORD, TEACHER_EMAIL, TEACHER_PASSWORD
 */

const fs = require('fs');
const path = require('path');

const API = process.env.PROD_API || 'https://emeelan.in/els-ai/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kothnuru.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'welcome';
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@kothnuru.ai';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'welcome';

const SHIVIR_JSON = path.resolve(__dirname, '..', 'Shivir_part1.json');

const CLASS_LEVEL = 'ANY';
const SUBJECT_TITLE = 'संस्कार शिविर';
const TOPIC_TITLE = 'संस्कार शिविर नंबर -१';
const CLASSROOM_TITLE = `${TOPIC_TITLE} — Live Class`;
const CLASSROOM_DESC = 'Live classroom for all class levels covering Sanskar Shivir Number 1 sections.';

async function jfetch(token, url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${url}`, { ...options, headers });
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

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (!res.ok) throw new Error(`Login (${email}) failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { token: json.accessToken, user: json.user };
}

function quizTypeFor(qType) {
  if (qType === 'SCQ') return 'single_choice';
  if (qType === 'MCQ') return 'multi_choice';
  if (qType === 'TF') return 'true_false';
  throw new Error(`Unsupported quiz q type: ${qType}`);
}

function buildQuestionPayload(q, sortOrder) {
  const isCorrect = (label) => {
    if (q.type === 'MCQ') return Array.isArray(q.answer) && q.answer.includes(label);
    return label === q.answer;
  };
  return {
    questionType: quizTypeFor(q.type),
    questionTitle: q.question,
    questionInstruction:
      q.type === 'TF' ? 'Select True or False.' :
      q.type === 'MCQ' ? 'Select all correct options.' :
      'Choose the correct option.',
    timeLimitSeconds: 30,
    points: 10,
    sortOrder,
    questionData: {
      options: q.options.map((label, i) => ({
        id: `opt-${i + 1}`,
        label,
        is_correct: isCorrect(label),
      })),
    },
  };
}

async function ensureSubject(adminToken) {
  const catalog = await jfetch(adminToken, '/catalog/subjects?limit=300');
  const items = catalog.items || [];
  const existing = items.find((it) => String(it.classLevel || '').toUpperCase() === CLASS_LEVEL && it.title === SUBJECT_TITLE);
  if (existing) {
    console.log(`  subject already exists: ${existing.id} (${SUBJECT_TITLE} @ ${CLASS_LEVEL})`);
    return existing.id;
  }
  const created = await jfetch(adminToken, '/users/subjects', {
    method: 'POST',
    body: JSON.stringify({
      classLevel: CLASS_LEVEL,
      title: SUBJECT_TITLE,
      description: 'Sanskar Shivir program — open to all class levels.',
      iconImage: 'symbol:sparkles',
      iconBgColor: '#FFE8D6',
    }),
  });
  const subjectId = created.id || (created.subject && created.subject.id);
  console.log(`  subject created: ${subjectId} (${SUBJECT_TITLE} @ ${CLASS_LEVEL})`);
  return subjectId;
}

async function ensureTopic(teacherToken) {
  const list = await jfetch(teacherToken, `/topics?class_level=${encodeURIComponent(CLASS_LEVEL)}&subject=${encodeURIComponent(SUBJECT_TITLE)}&limit=300`);
  const existing = (list.topics || []).find((t) => t.title === TOPIC_TITLE);
  if (existing) {
    console.log(`  topic already exists: ${existing.id} (${existing.title})`);
    return existing;
  }
  const created = await jfetch(teacherToken, '/topics', {
    method: 'POST',
    body: JSON.stringify({ title: TOPIC_TITLE, classLevel: CLASS_LEVEL, subject: SUBJECT_TITLE }),
  });
  console.log(`  topic created: ${created.id} (${created.title})`);
  return created;
}

async function setSections(teacherToken, topicId, sections) {
  const payload = {
    sections: sections.map((s) => ({
      title: s.name,
      contentType: 'youtube_url',
      externalUrl: s.videos[0].watchUrl,
    })),
  };
  const res = await jfetch(teacherToken, `/topics/${topicId}/sections`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  console.log(`  sections saved: ${res.sections.length}`);
}

async function ensureQuizForSection(teacherToken, topicId, section) {
  const existingList = await jfetch(teacherToken, `/quizzes/teacher/library?status=all&limit=500`);
  const wanted = `${TOPIC_TITLE} — ${section.name} Quiz`;
  const existing = (existingList.quizzes || []).find((q) => q.title === wanted);
  if (existing) {
    console.log(`  quiz already exists: ${existing.id} (${wanted})`);
    return existing.id;
  }
  const quiz = await jfetch(teacherToken, '/quizzes', {
    method: 'POST',
    body: JSON.stringify({
      title: wanted,
      description: `Auto-created for section ${section.name}`,
      classLevel: CLASS_LEVEL,
      subject: SUBJECT_TITLE,
      quizType: 'single_choice',
      isPublished: true,
    }),
  });
  console.log(`  quiz created: ${quiz.id} (${quiz.title})`);
  for (let i = 0; i < section.quiz.length; i += 1) {
    await jfetch(teacherToken, `/quizzes/${quiz.id}/questions`, {
      method: 'POST',
      body: JSON.stringify(buildQuestionPayload(section.quiz[i], i + 1)),
    });
  }
  console.log(`     added ${section.quiz.length} questions`);
  return quiz.id;
}

async function attachQuizzes(teacherToken, topicId, quizIds) {
  await jfetch(teacherToken, `/topics/${topicId}/quizzes`, {
    method: 'PUT',
    body: JSON.stringify({ quizIds }),
  });
  console.log(`  attached ${quizIds.length} quizzes to topic`);
}

async function ensureContentItem(teacherToken, topicId, section) {
  const list = await jfetch(teacherToken, `/content/items?topic_id=${topicId}&limit=300`);
  const existing = (list.items || []).find((it) => it.title === section.name);
  if (existing) {
    console.log(`  content already exists: ${existing.id} (${section.name})`);
    return existing.id;
  }
  const subSections = section.videos.map((v) => ({
    title: v.title,
    contentType: 'youtube_url',
    externalUrl: v.watchUrl,
  }));
  const created = await jfetch(teacherToken, '/content/items', {
    method: 'POST',
    body: JSON.stringify({
      classLevel: CLASS_LEVEL,
      subject: SUBJECT_TITLE,
      topicId,
      title: section.name,
      sections: subSections,
    }),
  });
  console.log(`  content created: ${created.id} (${section.name}, ${subSections.length} sub-sections)`);
  return created.id;
}

async function createClassroom(teacherToken, contentIds, quizIds) {
  const list = await jfetch(teacherToken, `/classrooms?limit=200`);
  const existing = (list.classrooms || list.items || []).find((c) => c.title === CLASSROOM_TITLE);
  if (existing) {
    console.log(`  classroom already exists: ${existing.id} (${existing.title})`);
    return existing.id;
  }
  const created = await jfetch(teacherToken, '/classrooms', {
    method: 'POST',
    body: JSON.stringify({
      title: CLASSROOM_TITLE,
      description: CLASSROOM_DESC,
      scheduleType: 'instant',
      durationMinutes: 60,
      classLevel: CLASS_LEVEL,
      status: 'active',
      contentIds,
      quizIds,
      assignments: [],
    }),
  });
  const room = created.classroom || created;
  console.log(`  classroom created: ${room.id} (${room.title})`);
  return room.id;
}

async function main() {
  const shivir = JSON.parse(fs.readFileSync(SHIVIR_JSON, 'utf8'));
  console.log(`▶ Sanskar Shivir prod seeder for Kothnuru @ ${API}`);

  console.log('  • logging in admin');
  const adminAuth = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log(`    admin org=${adminAuth.user.organizationId}`);

  console.log('  • ensuring subject');
  await ensureSubject(adminAuth.token);

  console.log('  • logging in teacher');
  const teacherAuth = await login(TEACHER_EMAIL, TEACHER_PASSWORD);
  console.log(`    teacher org=${teacherAuth.user.organizationId}`);
  if (teacherAuth.user.organizationId !== adminAuth.user.organizationId) {
    throw new Error('Admin and teacher belong to different orgs!');
  }

  console.log('  • ensuring topic');
  const topic = await ensureTopic(teacherAuth.token);

  console.log('  • saving topic sections');
  await setSections(teacherAuth.token, topic.id, shivir.sections);

  console.log('  • ensuring 4 quizzes (5 Qs each)');
  const quizIds = [];
  for (const sec of shivir.sections) {
    const id = await ensureQuizForSection(teacherAuth.token, topic.id, sec);
    quizIds.push(id);
  }

  console.log('  • attaching quizzes to topic');
  await attachQuizzes(teacherAuth.token, topic.id, quizIds);

  console.log('  • ensuring content items');
  const contentIds = [];
  for (const sec of shivir.sections) {
    const id = await ensureContentItem(teacherAuth.token, topic.id, sec);
    contentIds.push(id);
  }

  console.log('  • creating classroom (instant, active)');
  const classroomId = await createClassroom(teacherAuth.token, contentIds, quizIds);

  const summary = {
    api: API,
    org: 'Kothnuru',
    organizationId: teacherAuth.user.organizationId,
    classLevel: CLASS_LEVEL,
    subject: SUBJECT_TITLE,
    topicId: topic.id,
    topicTitle: TOPIC_TITLE,
    contentIds,
    quizIds,
    classroomId,
    classroomTitle: CLASSROOM_TITLE,
  };
  const out = path.resolve(__dirname, 'prod_kothnuru_sanskar_shivir_result.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`\n✔ Done. Summary written to ${out}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('\n✖ Failed:', err);
  if (err.body) console.error('  body:', JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
