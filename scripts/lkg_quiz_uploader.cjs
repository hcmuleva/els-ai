#!/usr/bin/env node
/**
 * LKG quiz/question uploader.
 *
 * Executes the handoff contract in lkg_agent_handoff.json:
 *   step 1: POST {GATEWAY}/quizzes            (body = job.quiz)
 *   step 2: POST {GATEWAY}/quizzes/{id}/questions (body = each job.questions[i])
 *
 * - Strict validation against contracts.apiCreateQuizRequiredFields /
 *   contracts.apiCreateQuestionRequiredFields.
 * - Preserves sortOrder exactly.
 * - Retries each failed call 2 extra times, then logs the error and continues.
 * - Folds learningContent (topic/summary/youtube/activity) into quiz.theme so the
 *   topic/content stays connected to the quiz without a breaking schema change.
 * - Strips null-valued optional fields (e.g. questionAudio) the backend zod schema
 *   would otherwise reject.
 * - Skips quizzes whose title already exists for the org (idempotent re-runs).
 *
 * Usage:
 *   node scripts/lkg_quiz_uploader.cjs
 * Env overrides:
 *   GATEWAY   (default http://localhost:4000)
 *   LOGIN_ID  (default teacher@els.ai)
 *   LOGIN_PW  (default welcome)
 *   HANDOFF   (default the samples path below)
 *   PUBLISH   (set to "1" to publish each quiz after questions are added)
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@els.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';
const PUBLISH = process.env.PUBLISH === '1';
const HANDOFF =
  process.env.HANDOFF ||
  '/Users/Harish.Muleva/project/DEVX/logico-els/samples/lkg_agent_handoff.json';

const RETRIES = 2; // extra attempts after the first try

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

// Retry wrapper: first attempt + RETRIES retries.
async function withRetry(label, fn) {
  let last;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const r = await fn();
    if (r.ok) return { ...r, attempts: attempt + 1 };
    last = r;
    if (attempt < RETRIES) {
      console.warn(
        `  ! ${label} failed (status ${r.status}), retry ${attempt + 1}/${RETRIES} ...`,
      );
      await sleep(400 * (attempt + 1));
    }
  }
  return { ...last, attempts: RETRIES + 1 };
}

function snippet(obj, max = 240) {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(obj);
  }
}

function errReason(r) {
  if (!r || !r.json) return `status ${r ? r.status : '??'}`;
  const j = r.json;
  if (j.errors) return `status ${r.status}: ${snippet(j.errors, 200)}`;
  if (j.message) return `status ${r.status}: ${j.message}`;
  return `status ${r.status}: ${snippet(j, 160)}`;
}

// Build the quiz POST body. Required: title, quizType. Connect topic/content via theme.
function buildQuizBody(job) {
  const q = job.quiz || {};
  const theme =
    q.theme && typeof q.theme === 'object' && !Array.isArray(q.theme) ? { ...q.theme } : {};
  if (job.learningContent) theme.learningContent = job.learningContent;
  return {
    title: q.title,
    description: q.description,
    classLevel: q.classLevel,
    subject: q.subject,
    quizType: q.quizType,
    difficultyLevel: q.difficultyLevel,
    backgroundMusicUrl: q.backgroundMusicUrl,
    theme,
    isPublished: Boolean(q.isPublished),
    isAiGenerated: Boolean(q.isAiGenerated),
    isGlobal: Boolean(q.isGlobal),
  };
}

// Build the question POST body, omitting null/undefined optional fields the schema rejects.
function buildQuestionBody(q) {
  const body = {
    questionType: q.questionType,
    questionData: q.questionData,
  };
  if (typeof q.questionTitle === 'string') body.questionTitle = q.questionTitle;
  if (typeof q.questionInstruction === 'string')
    body.questionInstruction = q.questionInstruction;
  if (typeof q.questionAudio === 'string' && q.questionAudio.trim())
    body.questionAudio = q.questionAudio;
  if (typeof q.timeLimitSeconds === 'number') body.timeLimitSeconds = q.timeLimitSeconds;
  if (typeof q.points === 'number') body.points = q.points;
  if (typeof q.sortOrder === 'number') body.sortOrder = q.sortOrder; // preserved exactly
  return body;
}

// ── Validation against contracts ────────────────────────────────────────────
function validateQuiz(quiz, required) {
  const missing = [];
  for (const f of required) {
    const v = quiz ? quiz[f] : undefined;
    if (v === undefined || v === null || v === '') missing.push(f);
  }
  return missing;
}
function validateQuestion(q, required) {
  const missing = [];
  for (const f of required) {
    const v = q ? q[f] : undefined;
    if (v === undefined || v === null || (typeof v === 'string' && v === '')) missing.push(f);
  }
  return missing;
}

async function main() {
  if (!fs.existsSync(HANDOFF)) {
    console.error(`Handoff file not found: ${HANDOFF}`);
    process.exit(1);
  }
  const handoff = JSON.parse(fs.readFileSync(HANDOFF, 'utf8'));
  const contracts = handoff.contracts || {};
  const reqQuiz = contracts.apiCreateQuizRequiredFields || ['title', 'quizType'];
  const reqQuestion = contracts.apiCreateQuestionRequiredFields || [
    'questionType',
    'questionData',
  ];
  const jobs = handoff.apiJobs || [];

  console.log(`Handoff: ${HANDOFF}`);
  console.log(`Gateway: ${GATEWAY}`);
  console.log(`Jobs: ${jobs.length}\n`);

  // 1. Login
  const login = await http('POST', `${GATEWAY}/auth/login`, null, {
    identifier: LOGIN_ID,
    password: LOGIN_PW,
  });
  if (!login.ok || !login.json || !login.json.accessToken) {
    console.error(`Login failed for ${LOGIN_ID}: ${errReason(login)}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID} (role: ${login.json.user && login.json.user.activeRole})\n`);

  // 2. Existing quizzes (drafts + published) for dedupe by title
  const existing = await http(
    'GET',
    `${GATEWAY}/quizzes/teacher/library?class_level=LKG&limit=500`,
    token,
  );
  const existingTitles = new Set(
    existing.ok && existing.json && Array.isArray(existing.json.quizzes)
      ? existing.json.quizzes.map((q) => String(q.title))
      : [],
  );

  const report = {
    quizzesAttempted: 0,
    quizzesCreated: 0,
    quizzesSkipped: 0,
    questionsAttempted: 0,
    questionsCreated: 0,
    failures: [],
    createdQuizzes: [],
  };

  // 3. Execute jobs
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const quiz = job.quiz || {};
    const title = quiz.title || `(job ${i + 1})`;
    report.quizzesAttempted++;
    console.log(`[${i + 1}/${jobs.length}] ${title}`);

    // strict validation
    const missingQ = validateQuiz(quiz, reqQuiz);
    if (missingQ.length) {
      console.error(`  x skipped - missing quiz fields: ${missingQ.join(', ')}`);
      report.failures.push({
        stage: 'quiz',
        title,
        reason: `missing required fields: ${missingQ.join(', ')}`,
        payload: snippet(quiz),
      });
      continue;
    }

    if (existingTitles.has(title)) {
      console.warn(`  - skipped - quiz already exists for org`);
      report.quizzesSkipped++;
      continue;
    }

    // step 1: create quiz
    const quizBody = buildQuizBody(job);
    const created = await withRetry('create quiz', () =>
      http('POST', `${GATEWAY}/quizzes`, token, quizBody),
    );
    if (!created.ok || !created.json || !created.json.id) {
      console.error(`  x quiz create failed: ${errReason(created)}`);
      report.failures.push({
        stage: 'quiz',
        title,
        reason: errReason(created),
        payload: snippet(quizBody),
      });
      continue;
    }
    const quizId = created.json.id;
    report.quizzesCreated++;
    existingTitles.add(title);
    console.log(`  ✓ quiz created -> ${quizId}`);

    // step 2: create questions (preserve given order / sortOrder)
    const questions = Array.isArray(job.questions) ? job.questions : [];
    let qCreated = 0;
    for (const q of questions) {
      report.questionsAttempted++;
      const missingQQ = validateQuestion(q, reqQuestion);
      if (missingQQ.length) {
        console.error(
          `    x question (sortOrder ${q.sortOrder}) missing: ${missingQQ.join(', ')}`,
        );
        report.failures.push({
          stage: 'question',
          title,
          sortOrder: q.sortOrder,
          reason: `missing required fields: ${missingQQ.join(', ')}`,
          payload: snippet(q),
        });
        continue;
      }
      const qBody = buildQuestionBody(q);
      const qres = await withRetry(`question sortOrder ${q.sortOrder}`, () =>
        http('POST', `${GATEWAY}/quizzes/${quizId}/questions`, token, qBody),
      );
      if (!qres.ok || !qres.json || !qres.json.id) {
        console.error(
          `    x question (sortOrder ${q.sortOrder}) failed: ${errReason(qres)}`,
        );
        report.failures.push({
          stage: 'question',
          title,
          sortOrder: q.sortOrder,
          questionType: q.questionType,
          reason: errReason(qres),
          payload: snippet(qBody),
        });
        continue;
      }
      qCreated++;
      report.questionsCreated++;
    }
    console.log(`  ✓ questions created: ${qCreated}/${questions.length}`);
    report.createdQuizzes.push({ quizId, title, questions: qCreated });

    // optional publish
    if (PUBLISH) {
      const pub = await withRetry('publish', () =>
        http('PATCH', `${GATEWAY}/quizzes/${quizId}/publish`, token, { isPublished: true }),
      );
      console.log(`  ${pub.ok ? '✓ published' : `x publish failed: ${errReason(pub)}`}`);
    }
    console.log('');
  }

  // 4. Final report
  console.log('\n══════════════════ FINAL REPORT ══════════════════');
  console.log(`Quizzes attempted : ${report.quizzesAttempted}`);
  console.log(`Quizzes created   : ${report.quizzesCreated}`);
  console.log(`Quizzes skipped   : ${report.quizzesSkipped} (already existed)`);
  console.log(`Questions attempted: ${report.questionsAttempted}`);
  console.log(`Questions created  : ${report.questionsCreated}`);
  console.log(`Failures          : ${report.failures.length}`);
  if (report.failures.length) {
    console.log('\n-- Failures --');
    for (const f of report.failures) {
      console.log(
        `  [${f.stage}] ${f.title}${f.sortOrder ? ` (sortOrder ${f.sortOrder})` : ''}: ${f.reason}`,
      );
      console.log(`     payload: ${f.payload}`);
    }
  }

  const outPath = path.join(__dirname, 'lkg_quiz_upload_result.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
