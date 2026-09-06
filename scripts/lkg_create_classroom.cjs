#!/usr/bin/env node
/**
 * Create an LKG classroom with content, quizzes, and assignments via the gateway.
 *
 * - Logs in as the teacher.
 * - Publishes the 10 LKG quizzes (so students can play them inside the class).
 * - Creates an `instant` (immediately active) LKG classroom that attaches all 10
 *   learning-content items + all 10 quizzes + a couple of kid-friendly assignments.
 * - Idempotent: skips creation if a classroom with the same title already exists.
 *
 * Usage:  node scripts/lkg_create_classroom.cjs
 * Env:    GATEWAY (default http://localhost:4000), LOGIN_ID, LOGIN_PW,
 *         CLASS_TITLE, PUBLISH (set "0" to skip publishing quizzes)
 */
const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@els.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';
const CLASS_TITLE = process.env.CLASS_TITLE || 'LKG Daily Learning Class';
const PUBLISH = process.env.PUBLISH !== '0';

// 10 LKG quizzes (from lkg_quiz_upload_result.json)
const QUIZ_IDS = require('./lkg_quiz_upload_result.json').createdQuizzes.map((q) => q.quizId);

// 10 LKG learning_contents (org 8ba8388f) — fixed IDs from the DB
const CONTENT_IDS = [
  '9b7d9a5d-b665-48f7-8924-7f4b5478eaa9', // Mathematics - Numbers and Counting
  '0f25e529-1cb5-49f5-9671-8463f08de3c2', // Mathematics - Shapes and Comparison
  'bebf531e-d4ae-471f-9b81-d25ecdca02ac', // English - Alphabet and Phonics
  '1dd3f060-2a1f-4b5a-b766-917dffc898bd', // English - Simple Words
  '7c44d2b3-fc5b-4c56-8c3a-3879b2e5e52e', // EVS - Animals and Homes
  '40e619d7-16e6-4e4b-b317-7bb22b86dc61', // EVS - Plants and Helpers
  'ae68c5a0-5714-45bf-b4e3-951af9c6af7d', // GK - Colours and Objects
  '06ecf78f-2563-4e8e-816a-8f42188f18ef', // GK - Transport and Festivals
  '9977430e-9123-4751-8327-024d456e896a', // Moral Values - Sharing and Caring
  'ebd5a137-e809-4c2a-bf2f-ae06f7862eea', // Moral Values - Honesty and Respect
];

const ASSIGNMENTS = [
  {
    title: 'Draw your favourite animal',
    description: 'A fun drawing activity for little learners.',
    instructions: 'Draw and colour your favourite animal. Ask a grown-up to help you say its name and the sound it makes!',
    isTimeBound: false,
  },
  {
    title: 'Count things at home',
    description: 'Practise counting with family.',
    instructions: 'Find 5 round things at home (like a ball or a roti) and count them out loud with your family.',
    isTimeBound: false,
  },
];

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function reason(r) {
  const j = r && r.json;
  if (!j) return `status ${r ? r.status : '??'}`;
  if (j.errors) return `status ${r.status}: ${JSON.stringify(j.errors).slice(0, 240)}`;
  return `status ${r.status}: ${j.message || JSON.stringify(j).slice(0, 200)}`;
}

async function main() {
  // 1. login
  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json?.accessToken) { console.error(`Login failed: ${reason(login)}`); process.exit(1); }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID} (role ${login.json.user?.activeRole})`);

  // 2. publish quizzes so students can play them
  if (PUBLISH) {
    let pub = 0;
    for (const id of QUIZ_IDS) {
      const r = await http('PATCH', `${GATEWAY}/quizzes/${id}/publish`, token, { isPublished: true });
      if (r.ok) pub++; else console.warn(`  ! publish ${id}: ${reason(r)}`);
    }
    console.log(`Published quizzes: ${pub}/${QUIZ_IDS.length}`);
  }

  // 3. idempotency: skip if a classroom with this title already exists
  const existing = await http('GET', `${GATEWAY}/classrooms?class_level=LKG&limit=500`, token);
  const dup = existing.ok && (existing.json?.classrooms || []).find((c) => c.title === CLASS_TITLE);
  if (dup) {
    console.log(`Classroom "${CLASS_TITLE}" already exists -> ${dup.id} (skipping create)`);
    return;
  }

  // 4. create classroom (instant => active now; LKG students see it immediately)
  const body = {
    title: CLASS_TITLE,
    description: 'A playful daily class covering Maths, English, EVS, GK and Moral Values for LKG.',
    scheduleType: 'instant',
    durationMinutes: 45,
    classLevel: 'LKG',
    contentIds: CONTENT_IDS,
    quizIds: QUIZ_IDS,
    assignments: ASSIGNMENTS,
  };
  const created = await http('POST', `${GATEWAY}/classrooms`, token, body);
  if (!created.ok || !created.json?.classroom?.id) {
    console.error(`Create classroom failed: ${reason(created)}`);
    process.exit(1);
  }
  const c = created.json.classroom;
  console.log(`\n✓ Classroom created -> ${c.id}`);
  console.log(`  title:   ${c.title}`);
  console.log(`  status:  ${c.status}  (${c.scheduleType})`);
  console.log(`  level:   ${c.classLevel}`);
  console.log(`  content: ${created.json.contents?.length || 0}`);
  console.log(`  quizzes: ${created.json.quizzes?.length || 0}`);
  console.log(`  assignments: ${created.json.assignments?.length || 0}`);

  fs.writeFileSync(
    path.join(__dirname, 'lkg_classroom_result.json'),
    JSON.stringify({ classroomId: c.id, ...created.json }, null, 2),
  );
  console.log(`\nReport written to scripts/lkg_classroom_result.json`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
