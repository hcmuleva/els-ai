#!/usr/bin/env node
/**
 * Consolidate the ten per-standard "Kothnuru Global Class" classrooms into a
 * single classroom whose class_level = 'ANY' (visible to every student in the
 * Kothnuru org regardless of their own class_level).
 *
 * Steps:
 *   1. login as teacher@kothnuru.ai
 *   2. list the per-class classrooms titled "Kothnuru Global Class"
 *   3. aggregate their content_ids, quiz_ids, and assignment definitions
 *      (assignments are reproduced from the curriculum so we do not need any
 *       service-side bulk-move)
 *   4. POST a new classroom titled "Kothnuru Global Class" with class_level='ANY'
 *      attaching all collected content/quiz/assignment payload
 *   5. DELETE the ten old per-standard classrooms
 *
 * Idempotent: if an ANY classroom already exists, the script reuses it and just
 * deletes the leftover per-standard ones.
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@kothnuru.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';
const TITLE = 'Kothnuru Global Class';

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}
const reason = (r) => {
  const j = r && r.json;
  if (!j) return `status ${r ? r.status : '??'}`;
  if (j.errors) return `status ${r.status}: ${JSON.stringify(j.errors).slice(0, 240)}`;
  return `status ${r.status}: ${j.message || JSON.stringify(j).slice(0, 200)}`;
};

// 20 assignments (2 per class) - exact copies of the ones used by
// kothnuru_global_class_seed.cjs so the consolidated classroom keeps them all.
const ASSIGNMENTS_BY_CLASS = {
  '1': [
    { title: 'Class 1 - Trace numbers 1 to 50', description: 'Number tracing practice.', instructions: 'In your notebook, write the numbers from 1 to 50 neatly. Show your work to a parent.', isTimeBound: false },
    { title: 'Class 1 - Read five vowel words aloud', description: 'Vowel sounds practice.', instructions: 'Find five things at home whose name starts with a vowel (apple, egg, ice, orange, umbrella). Say each word out loud.', isTimeBound: false },
  ],
  '2': [
    { title: 'Class 2 - Solve 20 subtraction sums', description: 'Subtraction practice.', instructions: 'In your notebook, write and solve 20 subtraction problems with numbers up to 100.', isTimeBound: false },
    { title: 'Class 2 - Write 5 sentences about your family', description: 'Sentence writing practice.', instructions: 'Write 5 sentences about people in your family. Use a capital letter and a full stop in each.', isTimeBound: false },
  ],
  '4': [
    { title: 'Class 4 - Solve 15 division problems', description: 'Division practice.', instructions: 'Solve 15 division problems in your notebook (e.g., 12/3, 20/4, 36/6). Show all your work.', isTimeBound: false },
    { title: 'Class 4 - Write a paragraph using all three tenses', description: 'Tense practice.', instructions: 'Write a short 6-sentence paragraph about your day. Use past, present and future tenses.', isTimeBound: false },
  ],
  '5': [
    { title: 'Class 5 - Draw 4 types of angles', description: 'Geometry sketching.', instructions: 'Draw a right angle, an acute angle, an obtuse angle and a straight angle. Label each one.', isTimeBound: false },
    { title: 'Class 5 - Living vs non-living chart', description: 'Classification activity.', instructions: 'Make a chart with two columns - Living and Non-living. List 8 things in each column.', isTimeBound: false },
  ],
  '6': [
    { title: 'Class 6 - Convert 10 fractions to decimals', description: 'Number practice.', instructions: 'Convert these fractions to decimals: 1/2, 1/4, 3/4, 1/5, 2/5, 1/10, 3/10, 7/10, 1/100, 25/100.', isTimeBound: false },
    { title: 'Class 6 - Air investigation', description: 'Hands-on science.', instructions: 'Find 3 things at home that prove air is real (e.g. a balloon, a fan, a pinwheel). Describe each in 2 sentences.', isTimeBound: false },
  ],
  '8': [
    { title: 'Class 8 - Solve 10 simple equations', description: 'Algebra warm-up.', instructions: 'Solve: x+5=11, x-3=8, 2x=12, x+10=20, 3x=9, x-7=4, 4x=20, x+1=2, x-1=0, 5x=25.', isTimeBound: false },
    { title: 'Class 8 - Sound experiment', description: 'Hands-on science.', instructions: 'Stretch a rubber band between two fingers and pluck it. Note the sound. Make it tighter and pluck again. How does the sound change? Write 3 sentences.', isTimeBound: false },
  ],
  '9': [
    { title: 'Class 9 - Plot a shape on graph paper', description: 'Coordinate practice.', instructions: 'Plot the points (1,1), (1,4), (4,4), (4,1) and join them. Name the shape you see.', isTimeBound: false },
    { title: 'Class 9 - Find 5 forces around you', description: 'Force observation.', instructions: 'Find 5 examples of pushes or pulls at home (e.g., closing a door, picking up a glass). Write each example in 1 sentence.', isTimeBound: false },
  ],
  '10': [
    { title: 'Class 10 - Trig ratio practice', description: 'Trigonometry practice.', instructions: 'For a right triangle with opposite=4, adjacent=3, hypotenuse=5, find sin, cos and tan. Show your work.', isTimeBound: false },
    { title: 'Class 10 - Mirror experiment notebook', description: 'Light experiment.', instructions: 'Use a small mirror and a torch. Shine the torch at 3 different angles. Sketch the path of light each time.', isTimeBound: false },
  ],
  '11': [
    { title: 'Class 11 - Pattern practice', description: 'Sequences exercise.', instructions: 'Continue these patterns by 3 terms each: (a) 5, 10, 15, ... (b) 100, 90, 80, ... (c) 1, 4, 9, 16, ... For each, write the rule.', isTimeBound: false },
    { title: 'Class 11 - Inertia in everyday life', description: 'Physics observation.', instructions: 'Find 3 examples of inertia in daily life (e.g. seat belts, dust on a carpet that comes off when shaken). Explain each in 2 sentences.', isTimeBound: false },
  ],
  '12': [
    { title: 'Class 12 - Easy integration practice', description: 'Calculus practice.', instructions: 'Integrate: (a) integral of 5 dx, (b) integral of 3x dx, (c) integral of x^3 dx, (d) integral of (x + 2) dx. Show all steps.', isTimeBound: false },
    { title: 'Class 12 - Wave optics observation', description: 'Physics observation.', instructions: 'Look at a soap bubble for 2 minutes. Note 3 different colours you see. Explain in 3 sentences why these colours appear (interference).', isTimeBound: false },
  ],
};

// Pull from /classrooms/:id the attached content + quiz ids
async function getClassroomDetail(token, id) {
  const r = await http('GET', `${GATEWAY}/classrooms/${id}`, token);
  if (!r.ok) return { contentIds: [], quizIds: [] };
  const j = r.json || {};
  const contents = (j.contents || j.classroom?.contents || []).map((c) => c.id || c.contentId).filter(Boolean);
  const quizzes = (j.quizzes || j.classroom?.quizzes || []).map((q) => q.id || q.quizId).filter(Boolean);
  return { contentIds: contents, quizIds: quizzes };
}

async function main() {
  // 1. login
  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json?.accessToken) { console.error(`Login failed: ${reason(login)}`); process.exit(1); }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID}\n`);

  // 2. list every "Kothnuru Global Class" classroom across all class levels (or none filter)
  const all = await http('GET', `${GATEWAY}/classrooms?limit=500`, token);
  if (!all.ok) { console.error(`List classrooms failed: ${reason(all)}`); process.exit(1); }
  const classrooms = (all.json?.classrooms || []).filter((c) => c.title === TITLE);
  console.log(`Found ${classrooms.length} existing "${TITLE}" classroom(s):`);
  for (const c of classrooms) console.log(`  - ${c.id}  class_level=${c.classLevel}  status=${c.status}`);

  const byLevel = new Map(classrooms.map((c) => [c.classLevel, c]));
  const anyExisting = byLevel.get('ANY');
  const perStandard = classrooms.filter((c) => c.classLevel !== 'ANY');

  // 3. aggregate content + quiz ids from per-standard rooms (preserve order: by class)
  const contentIds = [];
  const quizIds = [];
  const ASSIGNMENT_LIST = [];
  const orderedLevels = ['1', '2', '4', '5', '6', '8', '9', '10', '11', '12'];
  for (const lvl of orderedLevels) {
    const room = byLevel.get(lvl);
    if (!room) {
      console.log(`  • class ${lvl}: no per-standard room found`);
      continue;
    }
    const detail = await getClassroomDetail(token, room.id);
    contentIds.push(...detail.contentIds);
    quizIds.push(...detail.quizIds);
    if (ASSIGNMENTS_BY_CLASS[lvl]) ASSIGNMENT_LIST.push(...ASSIGNMENTS_BY_CLASS[lvl]);
    console.log(`  • class ${lvl}: contents=${detail.contentIds.length} quizzes=${detail.quizIds.length}`);
  }
  console.log(`\nAggregated  contents: ${contentIds.length}  quizzes: ${quizIds.length}  assignments: ${ASSIGNMENT_LIST.length}`);

  // 4. create the consolidated ANY classroom (or skip if it already exists)
  let anyId = anyExisting?.id || null;
  if (anyId) {
    console.log(`\n- ANY-class classroom already exists -> ${anyId} (will not recreate)`);
  } else {
    const cls = await http('POST', `${GATEWAY}/classrooms`, token, {
      title: TITLE,
      description: 'A single global classroom for every student in the Kothnuru org. Combined content, quizzes and class-tagged assignments for Classes 1, 2, 4, 5, 6, 8, 9, 10, 11 and 12.',
      scheduleType: 'instant',
      durationMinutes: 90,
      classLevel: 'ANY',
      contentIds,
      quizIds,
      assignments: ASSIGNMENT_LIST,
    });
    if (cls.ok && cls.json?.classroom?.id) {
      anyId = cls.json.classroom.id;
      console.log(`\n✓ Consolidated classroom -> ${anyId}`);
      console.log(`  contents:    ${cls.json.contents?.length || 0}`);
      console.log(`  quizzes:     ${cls.json.quizzes?.length || 0}`);
      console.log(`  assignments: ${cls.json.assignments?.length || 0}`);
    } else {
      console.error(`x consolidated classroom create failed: ${reason(cls)}`);
      process.exit(1);
    }
  }

  // 5. delete the ten per-standard rooms
  let deleted = 0;
  for (const room of perStandard) {
    const d = await http('DELETE', `${GATEWAY}/classrooms/${room.id}`, token);
    if (d.ok) {
      deleted++;
      console.log(`  ✓ deleted per-standard room ${room.id} (class ${room.classLevel})`);
    } else {
      console.warn(`  ! delete ${room.id} (class ${room.classLevel}): ${reason(d)}`);
    }
  }

  console.log(`\n══════════════════ SUMMARY ══════════════════`);
  console.log(`Consolidated classroom: ${anyId}  (class_level = ANY)`);
  console.log(`Per-standard rooms deleted: ${deleted}/${perStandard.length}`);
  fs.writeFileSync(
    path.join(__dirname, 'kothnuru_global_consolidate_result.json'),
    JSON.stringify({ anyId, deleted, contents: contentIds, quizzes: quizIds, assignmentCount: ASSIGNMENT_LIST.length }, null, 2),
  );
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
