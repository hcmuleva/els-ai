/**
 * Create the "संस्कार शिविर नंबर -१" content via the running gateway:
 *   - 1 topic at classLevel=10, subject="Computer Applications / IT"
 *   - 4 topic content sections (one per Gopal)
 *   - 4 quizzes (single_choice / multi_choice / true_false) — 5 Qs each,
 *     reusing the questions from Shivir_part1.json verbatim
 *   - 4 quizzes attached to the topic
 *
 * Run: node scripts/create_sanskar_shivir_content.cjs
 *
 * Requires the gateway and downstream services to be running on
 * http://localhost:4000 (default ports).
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:4000';
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@els.ai';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'welcome';
const SHIVIR_JSON = path.resolve(__dirname, '..', 'Shivir_part1.json');

const TOPIC_TITLE = 'संस्कार शिविर नंबर -१';
const CLASS_LEVEL = '10';
const SUBJECT = 'Computer Applications / IT';

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
  const options = q.options.map((label, i) => ({
    id: `opt-${i + 1}`,
    label,
    is_correct: isCorrect(label),
  }));
  return {
    questionType: quizTypeFor(q.type),
    questionTitle: q.question,
    questionInstruction:
      q.type === 'TF'
        ? 'Select True or False.'
        : q.type === 'MCQ'
          ? 'Select all correct options.'
          : 'Choose the correct option.',
    timeLimitSeconds: 30,
    points: 10,
    sortOrder,
    questionData: { options },
  };
}

async function jfetch(token, url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GATEWAY}${url}`, { ...options, headers });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}: ${body.message || JSON.stringify(body)}`);
    err.status = res.status;
    err.body = body;
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

async function ensureTopic(token) {
  const list = await jfetch(token, `/topics?class_level=${encodeURIComponent(CLASS_LEVEL)}&subject=${encodeURIComponent(SUBJECT)}&limit=300`);
  const existing = (list.topics || []).find((t) => t.title === TOPIC_TITLE);
  if (existing) {
    console.log(`  topic already exists: ${existing.id} (${existing.title})`);
    return existing;
  }
  const created = await jfetch(token, '/topics', {
    method: 'POST',
    body: JSON.stringify({
      title: TOPIC_TITLE,
      classLevel: CLASS_LEVEL,
      subject: SUBJECT,
    }),
  });
  console.log(`  topic created: ${created.id} (${created.title})`);
  return created;
}

async function setSections(token, topicId, sections) {
  const payload = {
    sections: sections.map((s) => ({
      title: s.title,
      contentType: 'youtube_url',
      externalUrl: s.url,
    })),
  };
  const res = await jfetch(token, `/topics/${topicId}/sections`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  console.log(`  sections saved: ${res.sections.length}`);
  return res.sections;
}

async function createQuizWithQuestions(token, sectionName, questions) {
  const quiz = await jfetch(token, '/quizzes', {
    method: 'POST',
    body: JSON.stringify({
      title: `${TOPIC_TITLE} — ${sectionName} Quiz`,
      description: `Auto-created quiz for section ${sectionName}`,
      classLevel: CLASS_LEVEL,
      subject: SUBJECT,
      quizType: 'single_choice',
      isPublished: true,
    }),
  });
  console.log(`  quiz created: ${quiz.id} (${quiz.title})`);
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    await jfetch(token, `/quizzes/${quiz.id}/questions`, {
      method: 'POST',
      body: JSON.stringify(buildQuestionPayload(q, i + 1)),
    });
  }
  console.log(`     added ${questions.length} questions`);
  return quiz;
}

async function attachQuizzesToTopic(token, topicId, quizIds) {
  await jfetch(token, `/topics/${topicId}/quizzes`, {
    method: 'PUT',
    body: JSON.stringify({ quizIds }),
  });
  console.log(`  attached ${quizIds.length} quizzes to topic ${topicId}`);
}

async function main() {
  const shivir = JSON.parse(fs.readFileSync(SHIVIR_JSON, 'utf8'));
  console.log(`▶ Sanskar Shivir content seeder using ${SHIVIR_JSON}`);

  const { token, user } = await login();
  console.log(`  logged in as ${user.email} (org=${user.organizationId})`);

  const topic = await ensureTopic(token);

  const sectionEntries = shivir.sections.map((s) => ({
    name: s.name,
    id: s.id,
    title: s.name,
    url: s.videos[0].watchUrl,
    questions: s.quiz,
  }));

  await setSections(token, topic.id, sectionEntries);

  const quizIds = [];
  for (const sec of sectionEntries) {
    const quiz = await createQuizWithQuestions(token, sec.name, sec.questions);
    quizIds.push(quiz.id);
  }

  await attachQuizzesToTopic(token, topic.id, quizIds);

  const summary = {
    topicId: topic.id,
    topicTitle: TOPIC_TITLE,
    classLevel: CLASS_LEVEL,
    subject: SUBJECT,
    sections: sectionEntries.map((s, i) => ({ name: s.name, primaryUrl: s.url, quizId: quizIds[i] })),
  };
  const out = path.resolve(__dirname, 'create_sanskar_shivir_content_result.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`\n✔ Done. Summary written to ${out}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('\n✖ Failed:', err);
  if (err.body) console.error('  body:', JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
