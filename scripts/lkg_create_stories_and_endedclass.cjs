#!/usr/bin/env node
/**
 * Creates, via the gateway:
 *   1. One ENDED LKG classroom (instant -> ended) with content + quizzes + an assignment.
 *   2. Five LKG stories, each with sections + a brand-new story quiz (3 questions):
 *        - 2 ended, 1 current (live), 2 upcoming (scheduled on future days).
 *
 * Story quizzes become kind='story' automatically when attached to a section.
 * Idempotent: skips a story/classroom whose title already exists.
 *
 * Usage:  node scripts/lkg_create_stories_and_endedclass.cjs
 * Env:    GATEWAY (default http://localhost:4000), LOGIN_ID, LOGIN_PW
 */
const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@els.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';

const QUIZ_IDS = require('./lkg_quiz_upload_result.json').createdQuizzes.map((q) => q.quizId);
const CONTENT_IDS = [
  '9b7d9a5d-b665-48f7-8924-7f4b5478eaa9',
  'bebf531e-d4ae-471f-9b81-d25ecdca02ac',
  '7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e',
];

const sc = (opts) => ({ options: opts.map((o) => ({ id: 'opt_' + o.k, label: o.l, is_correct: !!o.c })) });
const tf = (correct) => ({ options: [
  { id: 'opt_true', label: 'True', is_correct: correct },
  { id: 'opt_false', label: 'False', is_correct: !correct },
] });

// Each story: cover (real /media picture), 1 intro section, 1 section with a quiz.
const STORIES = [
  {
    title: 'The Thirsty Crow', transition: 'ended',
    description: 'A clever crow finds a smart way to drink water.',
    cover: '/media/pictures/crow.png',
    intro: 'On a hot day, a thirsty crow looked everywhere for water. At last it found a pot with only a little water at the bottom.',
    body: 'The clever crow dropped small stones into the pot, one by one. The water rose up and up — and the happy crow had a lovely drink!',
    quiz: { title: 'The Thirsty Crow - Quick Quiz', questions: [
      { type: 'single_choice', title: 'What did the crow want?', data: sc([{ k: 'water', l: 'Water', c: true }, { k: 'toy', l: 'A toy' }, { k: 'food', l: 'Food' }]) },
      { type: 'single_choice', title: 'What did the crow drop in the pot?', data: sc([{ k: 'stones', l: 'Stones', c: true }, { k: 'leaves', l: 'Leaves' }, { k: 'sand', l: 'Sand' }]) },
      { type: 'true_false', title: 'The water rose up so the crow could drink.', data: tf(true) },
    ] },
  },
  {
    title: 'The Lion and the Mouse', transition: 'ended',
    description: 'A tiny mouse helps a mighty lion.',
    cover: '/media/pictures/lion.png',
    intro: 'A big lion was sleeping when a little mouse ran over him. The lion woke up, but kindly let the tiny mouse go.',
    body: 'Later, the lion was caught in a hunter\u2019s net. The little mouse chewed the net and set the lion free. Even small friends can help!',
    quiz: { title: 'The Lion and the Mouse - Quick Quiz', questions: [
      { type: 'single_choice', title: 'Who helped the lion?', data: sc([{ k: 'mouse', l: 'The mouse', c: true }, { k: 'bird', l: 'A bird' }, { k: 'fish', l: 'A fish' }]) },
      { type: 'true_false', title: 'The lion was kind and let the mouse go.', data: tf(true) },
      { type: 'single_choice', title: 'What did the mouse chew to free the lion?', data: sc([{ k: 'net', l: 'The net', c: true }, { k: 'tree', l: 'A tree' }, { k: 'grass', l: 'The grass' }]) },
    ] },
  },
  {
    title: 'The Wise Old Owl', transition: 'live',
    description: 'An owl who listens more and speaks less.',
    cover: '/media/pictures/owl.png',
    intro: 'High up in a big tree lived a wise old owl. All night the owl watched the quiet forest with its big round eyes.',
    body: 'The owl listened a lot and spoke a little. Because it listened so well, it learned many things. Good listeners learn the most!',
    quiz: { title: 'The Wise Old Owl - Quick Quiz', questions: [
      { type: 'single_choice', title: 'When does the owl stay awake?', data: sc([{ k: 'night', l: 'At night', c: true }, { k: 'noon', l: 'At noon' }, { k: 'breakfast', l: 'At breakfast' }]) },
      { type: 'true_false', title: 'The owl listens more and speaks less.', data: tf(true) },
      { type: 'single_choice', title: 'Where does the owl live?', data: sc([{ k: 'tree', l: 'In a tree', c: true }, { k: 'sea', l: 'In the sea' }, { k: 'ground', l: 'Under the ground' }]) },
    ] },
  },
  {
    title: 'The Happy Duck', transition: 'scheduled', scheduleInDays: 2,
    description: 'A cheerful duck and its favourite pond.',
    cover: '/media/pictures/duck.png',
    intro: 'A happy little duck loved its blue pond. Every morning it went, "Quack, quack!" and splashed in the cool water.',
    body: 'The duck taught its baby ducklings to swim in a line behind it. They paddled all day and had so much fun together.',
    quiz: { title: 'The Happy Duck - Quick Quiz', questions: [
      { type: 'single_choice', title: 'Where does the duck love to swim?', data: sc([{ k: 'pond', l: 'In the pond', c: true }, { k: 'sky', l: 'In the sky' }, { k: 'sand', l: 'In the sand' }]) },
      { type: 'single_choice', title: 'What sound does a duck make?', data: sc([{ k: 'quack', l: 'Quack', c: true }, { k: 'moo', l: 'Moo' }, { k: 'meow', l: 'Meow' }]) },
      { type: 'true_false', title: 'Ducks can swim in water.', data: tf(true) },
    ] },
  },
  {
    title: 'The Gentle Elephant', transition: 'scheduled', scheduleInDays: 4,
    description: 'A big, gentle elephant who loves bath time.',
    cover: '/media/pictures/elephant.png',
    intro: 'In the green forest lived a big, gentle elephant. It was the largest animal of all, but it had a very kind heart.',
    body: 'The elephant filled its long trunk with water and gave itself a splashy shower. Then it ate sweet leaves and fruits. What a happy day!',
    quiz: { title: 'The Gentle Elephant - Quick Quiz', questions: [
      { type: 'single_choice', title: 'What does the elephant use to take a bath?', data: sc([{ k: 'trunk', l: 'Its trunk', c: true }, { k: 'tail', l: 'Its tail' }, { k: 'ears', l: 'Its ears' }]) },
      { type: 'true_false', title: 'The elephant is a very big animal.', data: tf(true) },
      { type: 'single_choice', title: 'What does the elephant like to eat?', data: sc([{ k: 'leaves', l: 'Leaves and fruits', c: true }, { k: 'stones', l: 'Stones' }, { k: 'shoes', l: 'Shoes' }]) },
    ] },
  },
];

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}
const reason = (r) => { const j = r && r.json; if (!j) return `status ${r ? r.status : '??'}`; if (j.errors) return `status ${r.status}: ${JSON.stringify(j.errors).slice(0, 200)}`; return `status ${r.status}: ${j.message || JSON.stringify(j).slice(0, 160)}`; };

async function createStoryQuiz(token, quizDef) {
  const created = await http('POST', `${GATEWAY}/quizzes`, token, {
    title: quizDef.title, description: 'Story comprehension quiz for little learners.',
    classLevel: 'LKG', subject: 'Stories', quizType: 'single_choice', difficultyLevel: 'easy',
    isPublished: true, isAiGenerated: true, isGlobal: false,
  });
  if (!created.ok || !created.json?.id) throw new Error(`quiz create "${quizDef.title}": ${reason(created)}`);
  const quizId = created.json.id;
  let n = 0;
  for (let i = 0; i < quizDef.questions.length; i++) {
    const q = quizDef.questions[i];
    const r = await http('POST', `${GATEWAY}/quizzes/${quizId}/questions`, token, {
      questionType: q.type, questionTitle: q.title, questionInstruction: 'Choose your answer.',
      questionData: q.data, points: 10, timeLimitSeconds: 25, sortOrder: i + 1,
    });
    if (r.ok && r.json?.id) n++; else console.warn(`    ! question "${q.title}": ${reason(r)}`);
  }
  return { quizId, questions: n };
}

async function main() {
  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json?.accessToken) { console.error(`Login failed: ${reason(login)}`); process.exit(1); }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID}\n`);

  // ── 1. Ended classroom ────────────────────────────────────────────────
  const ENDED_TITLE = 'LKG Morning Class - Week 1';
  const exClass = await http('GET', `${GATEWAY}/classrooms?class_level=LKG&status=completed&limit=500`, token);
  const dupClass = exClass.ok && (exClass.json?.classrooms || []).find((c) => c.title === ENDED_TITLE);
  if (dupClass) {
    console.log(`Ended classroom "${ENDED_TITLE}" already exists -> ${dupClass.id} (skip)`);
  } else {
    const created = await http('POST', `${GATEWAY}/classrooms`, token, {
      title: ENDED_TITLE, description: 'A completed LKG class from last week.',
      scheduleType: 'instant', durationMinutes: 40, classLevel: 'LKG',
      contentIds: CONTENT_IDS, quizIds: QUIZ_IDS.slice(0, 3),
      assignments: [{ title: 'Bring a leaf to class', instructions: 'Find a green leaf outside and bring it to show your friends.', isTimeBound: false }],
    });
    if (!created.ok || !created.json?.classroom?.id) { console.error(`Ended class create failed: ${reason(created)}`); }
    else {
      const cid = created.json.classroom.id;
      const ended = await http('PATCH', `${GATEWAY}/classrooms/${cid}/end`, token, {});
      console.log(`✓ Ended classroom -> ${cid}  status=${ended.ok ? ended.json?.classroom?.status : 'end-failed: ' + reason(ended)}`);
    }
  }

  // ── 2. Stories ────────────────────────────────────────────────────────
  const existing = await http('GET', `${GATEWAY}/stories?class_level=LKG&limit=100`, token);
  const existingTitles = new Set(existing.ok ? (existing.json?.stories || []).map((s) => s.title) : []);

  // create the LIVE story first so "today" is free of conflicts when publishing
  const ordered = [...STORIES].sort((a, b) => (a.transition === 'live' ? -1 : b.transition === 'live' ? 1 : 0));

  for (const story of ordered) {
    console.log(`\n[${story.transition}] ${story.title}`);
    if (existingTitles.has(story.title)) { console.log('  - already exists, skipping'); continue; }

    // 2a. story quiz (new questions)
    const { quizId, questions } = await createStoryQuiz(token, story.quiz);
    console.log(`  ✓ story quiz -> ${quizId} (${questions} questions)`);

    // 2b. story shell
    const sCreated = await http('POST', `${GATEWAY}/stories`, token, {
      title: story.title, description: story.description, coverImageUrl: story.cover, classLevel: 'LKG',
    });
    if (!sCreated.ok || !sCreated.json?.story?.id) { console.error(`  x story create failed: ${reason(sCreated)}`); continue; }
    const storyId = sCreated.json.story.id;

    // 2c. sections (intro, then a section with the quiz)
    await http('POST', `${GATEWAY}/stories/${storyId}/sections`, token, {
      title: 'Once upon a time', bodyText: story.intro,
      media: [{ kind: 'image', url: story.cover, caption: story.title }], orderIndex: 0,
    });
    await http('POST', `${GATEWAY}/stories/${storyId}/sections`, token, {
      title: 'What happened next', bodyText: story.body, media: [], quizId, orderIndex: 1,
    });
    console.log(`  ✓ story -> ${storyId} (2 sections, quiz attached)`);

    // 2d. transition
    if (story.transition === 'ended') {
      const r = await http('PATCH', `${GATEWAY}/stories/${storyId}/end`, token, {});
      console.log(`  -> end: ${r.ok ? r.json?.story?.status : reason(r)}`);
    } else if (story.transition === 'live') {
      const r = await http('PATCH', `${GATEWAY}/stories/${storyId}/publish`, token, {});
      console.log(`  -> publish: ${r.ok ? r.json?.story?.status : reason(r)}`);
    } else if (story.transition === 'scheduled') {
      const when = new Date(Date.now() + (story.scheduleInDays || 2) * 86400000);
      when.setHours(9, 0, 0, 0);
      const r = await http('PATCH', `${GATEWAY}/stories/${storyId}/schedule`, token, { scheduledAt: when.toISOString() });
      console.log(`  -> schedule ${when.toISOString().slice(0, 10)}: ${r.ok ? r.json?.story?.status : reason(r)}`);
    }
    existingTitles.add(story.title);
  }

  console.log('\nDone.');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
