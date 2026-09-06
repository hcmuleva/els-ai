/**
 * Bulk-creates "Sanskar Shivir" classrooms for LKG → Class 4.
 *
 * For each class level we create 6 scheduled classrooms (today + next 5 days,
 * all upcoming). Every classroom gets its OWN unique set of content and its
 * OWN unique quiz — no content/question is reused across the 6 classrooms of
 * the same class:
 *   - Content: one learning content per subject (11 core subjects), taking a
 *     different item per day from each subject's topic.
 *   - Quiz: a per-classroom quiz "Sanskar_Shivir_<Class>_<DDMon>_Quiz" with 10
 *     questions mixed across subjects, consumed without repeats across the
 *     class's 6 quizzes (cloned via the question-reuse API from each subject's
 *     "Auto Seed Quiz").
 *   - Alignment: each day's content and its quiz questions come from the SAME
 *     subject and the SAME topic.
 *
 * All work is done through the API gateway as teacher@els.ai.
 *
 * Run: node scripts/create_weekly_classrooms.cjs
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:4000';
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'teacher@els.ai';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'welcome';

// Class levels exactly as stored in the DB, with a filename-safe label.
const CLASSES = [
  { level: 'LKG', label: 'LKG' },
  { level: 'UKG', label: 'UKG' },
  { level: '1', label: 'Class1' },
  { level: '2', label: 'Class2' },
  { level: '3', label: 'Class3' },
  { level: '4', label: 'Class4' },
];

// 11 core subjects present for every class above.
const SUBJECTS = [
  'creativity',
  'dharm',
  'diy',
  'do_you_know',
  'how_things_works',
  'how_to_think',
  'jr_scientist',
  'memory_development',
  'puzzle',
  'story',
  'tips_tricks',
];

const QUIZ_SUBJECT = 'do_you_know'; // subject_id anchor for the combined quiz
const QUIZ_QUESTION_COUNT = 10;
const DAYS = 6; // 6 classrooms per class: today + next 5 days
const DURATION_MINUTES = 45;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(d) {
  return `${String(d.getDate()).padStart(2, '0')}${MON[d.getMonth()]}`;
}

async function jfetch(token, url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GATEWAY}${url}`, { ...options, headers });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${options.method || 'GET'} ${url}: ${body.message || JSON.stringify(body)}`);
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

// Remove any previously-seeded classrooms + combined quiz for this class so
// re-running the script does not create duplicates.
async function cleanupPrevious(token, classLevel, label) {
  const prefix = `Sanskar_Shivir_${label}_`;
  // Classrooms (active/scheduled list)
  const list = await jfetch(token, `/classrooms?class_level=${encodeURIComponent(classLevel)}&search=${encodeURIComponent(prefix)}&limit=500`);
  let delRooms = 0;
  for (const room of list.classrooms || []) {
    if (typeof room.title === 'string' && room.title.startsWith(prefix)) {
      await jfetch(token, `/classrooms/${room.id}`, { method: 'DELETE' });
      delRooms += 1;
    }
  }
  // Per-classroom quizzes (titles start with the same prefix).
  const lib = await jfetch(token, `/quizzes/teacher/library?class_level=${encodeURIComponent(classLevel)}&search=${encodeURIComponent(prefix)}&limit=200`);
  let delQuiz = 0;
  for (const q of lib.quizzes || []) {
    if (typeof q.title === 'string' && q.title.startsWith(prefix)) {
      await jfetch(token, `/quizzes/${q.id}`, { method: 'DELETE' });
      delQuiz += 1;
    }
  }
  if (delRooms || delQuiz) console.log(`    cleaned up ${delRooms} classrooms, ${delQuiz} quizzes`);
}

// Resolve, per subject, the seed quiz + its topic + its question ids.
// The subject's "Auto Seed Quiz" carries topic_id, and that same topic owns
// the subject's content — so content and questions stay aligned by topic.
async function resolveSubjectTopics(token, classLevel) {
  const lib = await jfetch(token, `/quizzes/teacher/library?class_level=${encodeURIComponent(classLevel)}&search=${encodeURIComponent('Auto Seed Quiz')}&limit=50`);
  const seedBySubject = {};
  for (const q of lib.quizzes || []) {
    if (q.subject && !seedBySubject[q.subject] && /Auto Seed Quiz/i.test(q.title)) seedBySubject[q.subject] = q.id;
  }

  const map = {};
  for (const subject of SUBJECTS) {
    const seedQuizId = seedBySubject[subject];
    if (!seedQuizId) { console.warn(`    ! no seed quiz for ${classLevel}/${subject}`); continue; }
    const detail = await jfetch(token, `/quizzes/${seedQuizId}`);
    const topicId = detail.topic_id || null;

    // Distinct contents (one per day) from the SAME topic as the questions.
    let contentIds = [];
    if (topicId) {
      const cr = await jfetch(token, `/content/items?topic_id=${encodeURIComponent(topicId)}&limit=${DAYS}`);
      contentIds = (cr.items || []).map((it) => it.id);
    }
    if (!contentIds.length) {
      const cr = await jfetch(token, `/content/items?class_level=${encodeURIComponent(classLevel)}&subject=${encodeURIComponent(subject)}&limit=${DAYS}`);
      contentIds = (cr.items || []).map((it) => it.id);
    }

    map[subject] = {
      seedQuizId,
      topicId,
      questionIds: (detail.questions || []).map((q) => q.id),
      contentIds,
    };
  }
  return map;
}

// One unique content per subject for a given day index (drawn from the same
// topic as that subject's questions). Returns 11 content ids.
function pickDayContentIds(subjectMap, dayIndex) {
  const ids = [];
  for (const subject of SUBJECTS) {
    const list = (subjectMap[subject] && subjectMap[subject].contentIds) || [];
    if (list.length) ids.push(list[dayIndex % list.length]);
    else console.warn(`    ! no content for ${subject} (day ${dayIndex + 1})`);
  }
  return ids;
}

// Create one quiz with 10 questions mixed across subjects, consuming from the
// shared per-subject question queues so no question repeats across the class's
// quizzes.
async function makeDayQuiz(token, classLevel, title, queues) {
  const quiz = await jfetch(token, '/quizzes', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: `Mixed-subject Sanskar Shivir quiz (10 questions across all subjects).`,
      classLevel,
      subject: QUIZ_SUBJECT,
      quizType: 'single_choice',
      difficultyLevel: 'easy',
      isPublished: true,
    }),
  });
  const quizId = quiz.id;

  const sources = [];
  let idx = 0;
  while (sources.length < QUIZ_QUESTION_COUNT && SUBJECTS.some((s) => queues[s] && queues[s].length)) {
    const subject = SUBJECTS[idx % SUBJECTS.length];
    const queue = queues[subject];
    if (queue && queue.length) sources.push(queue.shift());
    idx += 1;
  }

  let added = 0;
  for (const sourceQuestionId of sources) {
    await jfetch(token, `/quizzes/${quizId}/questions/reuse`, {
      method: 'POST',
      body: JSON.stringify({ sourceQuestionId }),
    });
    added += 1;
  }
  return { quizId, questionCount: added };
}

// For one class: create DAYS classrooms, each with unique content + unique quiz.
async function createClassForClass(token, classLevel, label, subjectMap) {
  // Shared, consumable question queues (no repeats across the class's quizzes).
  const queues = {};
  for (const subject of SUBJECTS) {
    queues[subject] = subjectMap[subject] ? [...subjectMap[subject].questionIds] : [];
  }

  const rooms = [];
  const base = Date.now() + 60 * 60 * 1000; // first class starts +1h (all upcoming)
  for (let i = 0; i < DAYS; i += 1) {
    const start = new Date(base + i * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + DURATION_MINUTES * 60 * 1000);
    const dayTag = fmtDay(start);
    const title = `Sanskar_Shivir_${label}_${dayTag}`;

    const contentIds = pickDayContentIds(subjectMap, i);
    const { quizId, questionCount } = await makeDayQuiz(token, classLevel, `${title}_Quiz`, queues);

    const created = await jfetch(token, '/classrooms', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: `Sanskar based holistic learning classroom for ${label} on ${dayTag}.`,
        scheduleType: 'scheduled',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes: DURATION_MINUTES,
        classLevel,
        status: 'active',
        contentIds,
        quizIds: [quizId],
        assignments: [],
      }),
    });
    const room = created.classroom || created;
    rooms.push({ id: room.id, title, startTime: start.toISOString(), quizId, questionCount, contentIds });
    console.log(`    ${title} -> room ${room.id} | quiz ${quizId} (${questionCount} q) | ${contentIds.length} contents`);
  }
  return rooms;
}

async function main() {
  console.log('▶ Weekly Sanskar Shivir classroom seeder');
  const { token, user } = await login();
  console.log(`  logged in as ${user.email} (org=${user.organizationId})`);

  const summary = [];
  for (const { level, label } of CLASSES) {
    console.log(`\n── ${label} (${level}) ──`);
    await cleanupPrevious(token, level, label);
    const subjectMap = await resolveSubjectTopics(token, level);
    const rooms = await createClassForClass(token, level, label, subjectMap);
    summary.push({ classLevel: level, label, classrooms: rooms });
  }

  const out = path.resolve(__dirname, 'create_weekly_classrooms_result.json');
  fs.writeFileSync(out, JSON.stringify({ createdAt: new Date().toISOString(), createdBy: user.email, classes: summary }, null, 2));
  console.log(`\n✔ Done. ${summary.length} classes, ${summary.reduce((n, c) => n + c.classrooms.length, 0)} classrooms.`);
  console.log(`  Summary written to ${out}`);
}

main().catch((err) => {
  console.error('\n✖ Failed:', err.message);
  if (err.body) console.error('  body:', JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
