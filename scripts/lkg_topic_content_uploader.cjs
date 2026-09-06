#!/usr/bin/env node
/**
 * LKG topic + content connector.
 *
 * Completes the connection that the quiz uploader did not: it creates a
 * content_topic per job from handoff.learningContent, fills the topic with its
 * content as sections (summary text + each YouTube link + classroom activity),
 * and links the already-created quiz to that topic (sets quizzes.topic_id).
 *
 * Run AFTER scripts/lkg_quiz_uploader.cjs (uses its result file to map
 * quiz title -> quizId; falls back to the teacher library if absent).
 *
 *   topic    : POST   {GATEWAY}/topics
 *   sections : PUT    {GATEWAY}/topics/{topicId}/sections
 *   link quiz: PUT    {GATEWAY}/topics/{topicId}/quizzes  { quizIds: [quizId] }
 *
 * Idempotent: existing topics (by class/subject/title) are reused, not duplicated.
 *
 * Usage:  node scripts/lkg_topic_content_uploader.cjs
 * Env:    GATEWAY, LOGIN_ID, LOGIN_PW, HANDOFF (same defaults as the quiz uploader)
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@els.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';
const HANDOFF =
  process.env.HANDOFF ||
  '/Users/Harish.Muleva/project/DEVX/logico-els/samples/lkg_agent_handoff.json';
const QUIZ_RESULT = path.join(__dirname, 'lkg_quiz_upload_result.json');

const RETRIES = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function withRetry(label, fn) {
  let last;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const r = await fn();
    if (r.ok) return { ...r, attempts: attempt + 1 };
    last = r;
    if (attempt < RETRIES) {
      console.warn(`  ! ${label} failed (status ${r.status}), retry ${attempt + 1}/${RETRIES} ...`);
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

// Build topic sections from learningContent: summary (text) + each youtube link + activity (text).
function buildSections(lc) {
  const sections = [];
  if (lc.summary && lc.summary.trim()) {
    sections.push({ title: 'Summary', contentType: 'text', textContent: lc.summary.trim() });
  }
  (lc.youtubeLinks || []).forEach((url, i) => {
    if (url && String(url).trim()) {
      sections.push({
        title: `Watch & Learn ${i + 1}`,
        contentType: 'youtube_url',
        externalUrl: String(url).trim(),
      });
    }
  });
  if (lc.classroomActivity && lc.classroomActivity.trim()) {
    sections.push({
      title: 'Classroom Activity',
      contentType: 'text',
      textContent: lc.classroomActivity.trim(),
    });
  }
  return sections;
}

async function main() {
  if (!fs.existsSync(HANDOFF)) {
    console.error(`Handoff file not found: ${HANDOFF}`);
    process.exit(1);
  }
  const handoff = JSON.parse(fs.readFileSync(HANDOFF, 'utf8'));
  const jobs = handoff.apiJobs || [];

  // quiz title -> quizId map from the quiz uploader result
  const titleToQuizId = {};
  if (fs.existsSync(QUIZ_RESULT)) {
    const r = JSON.parse(fs.readFileSync(QUIZ_RESULT, 'utf8'));
    (r.createdQuizzes || []).forEach((q) => {
      titleToQuizId[q.title] = q.quizId;
    });
  }

  console.log(`Handoff: ${HANDOFF}`);
  console.log(`Gateway: ${GATEWAY}`);
  console.log(`Jobs: ${jobs.length}\n`);

  // login
  const login = await http('POST', `${GATEWAY}/auth/login`, null, {
    identifier: LOGIN_ID,
    password: LOGIN_PW,
  });
  if (!login.ok || !login.json || !login.json.accessToken) {
    console.error(`Login failed: ${errReason(login)}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID}\n`);

  // Fallback map: quiz title -> id from teacher library (covers re-runs)
  const lib = await http('GET', `${GATEWAY}/quizzes/teacher/library?class_level=LKG&limit=500`, token);
  if (lib.ok && lib.json && Array.isArray(lib.json.quizzes)) {
    lib.json.quizzes.forEach((q) => {
      if (!titleToQuizId[q.title]) titleToQuizId[q.title] = q.id;
    });
  }

  const report = {
    topicsAttempted: 0,
    topicsCreated: 0,
    topicsReused: 0,
    sectionsSetForTopics: 0,
    quizzesLinked: 0,
    failures: [],
    topics: [],
  };

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const lc = job.learningContent || {};
    const subject = lc.subject || (job.quiz && job.quiz.subject);
    const topicTitle = lc.topic || (job.quiz && job.quiz.title);
    const classLevel = (job.quiz && job.quiz.classLevel) || handoff.meta?.grade || 'LKG';
    const quizTitle = job.quiz && job.quiz.title;
    const quizId = titleToQuizId[quizTitle];

    report.topicsAttempted++;
    console.log(`[${i + 1}/${jobs.length}] Topic: ${subject} / ${topicTitle}`);

    if (!subject || !topicTitle) {
      report.failures.push({
        stage: 'topic',
        title: topicTitle,
        reason: 'missing subject or topic title in learningContent',
        payload: snippet(lc),
      });
      console.error('  x missing subject/topic');
      continue;
    }

    // 1. create topic (reuse on duplicate)
    let topicId = null;
    const createTopic = await withRetry('create topic', () =>
      http('POST', `${GATEWAY}/topics`, token, {
        classLevel,
        subject,
        title: topicTitle,
        isGlobal: false,
      }),
    );
    if (createTopic.ok && createTopic.json && createTopic.json.id) {
      topicId = createTopic.json.id;
      report.topicsCreated++;
      console.log(`  ✓ topic created -> ${topicId}`);
    } else if (
      createTopic.status === 400 &&
      createTopic.json &&
      /already exists/i.test(createTopic.json.message || '')
    ) {
      // find the existing topic id
      const found = await http(
        'GET',
        `${GATEWAY}/topics?class_level=${encodeURIComponent(classLevel)}&subject=${encodeURIComponent(
          subject,
        )}&search=${encodeURIComponent(topicTitle)}&limit=50`,
        token,
      );
      const match =
        found.ok && found.json && Array.isArray(found.json.topics)
          ? found.json.topics.find((t) => String(t.title).toLowerCase() === topicTitle.toLowerCase())
          : null;
      if (match) {
        topicId = match.id;
        report.topicsReused++;
        console.log(`  - topic already existed -> ${topicId} (reusing)`);
      }
    }
    if (!topicId) {
      report.failures.push({
        stage: 'topic',
        title: topicTitle,
        reason: errReason(createTopic),
        payload: snippet({ classLevel, subject, title: topicTitle }),
      });
      console.error(`  x topic create failed: ${errReason(createTopic)}`);
      continue;
    }

    // 2. content (creates learning_contents + sections, assigned to topic so it
    //    renders in /topics/:id/details). This is what the app actually displays.
    const sections = buildSections(lc);
    if (sections.length) {
      const contentRes = await withRetry('create content', () =>
        http('POST', `${GATEWAY}/content/items`, token, {
          classLevel,
          subject,
          topicId,
          title: topicTitle,
          sections,
          isGlobal: false,
        }),
      );
      if (contentRes.ok && contentRes.json && contentRes.json.id) {
        report.sectionsSetForTopics++;
        console.log(`  ✓ content created (${sections.length} sections) -> ${contentRes.json.id}`);
      } else {
        report.failures.push({
          stage: 'content',
          title: topicTitle,
          reason: errReason(contentRes),
          payload: snippet({ topicId, sections }),
        });
        console.error(`  x content failed: ${errReason(contentRes)}`);
      }
    }

    // 3. link quiz -> topic
    if (quizId) {
      const linkRes = await withRetry('link quiz', () =>
        http('PUT', `${GATEWAY}/topics/${topicId}/quizzes`, token, { quizIds: [quizId] }),
      );
      if (linkRes.ok) {
        report.quizzesLinked++;
        console.log(`  ✓ quiz linked: ${quizId}`);
      } else {
        report.failures.push({
          stage: 'link',
          title: topicTitle,
          reason: errReason(linkRes),
          payload: snippet({ topicId, quizId }),
        });
        console.error(`  x link failed: ${errReason(linkRes)}`);
      }
    } else {
      report.failures.push({
        stage: 'link',
        title: topicTitle,
        reason: `no quizId found for quiz title "${quizTitle}" (run quiz uploader first)`,
        payload: snippet({ quizTitle }),
      });
      console.warn(`  ! no quizId for "${quizTitle}" - skipped link`);
    }

    report.topics.push({ topicId, subject, title: topicTitle, sections: sections.length, quizId: quizId || null });
    console.log('');
  }

  console.log('\n══════════════════ FINAL REPORT (topics + content) ══════════════════');
  console.log(`Topics attempted   : ${report.topicsAttempted}`);
  console.log(`Topics created     : ${report.topicsCreated}`);
  console.log(`Topics reused      : ${report.topicsReused}`);
  console.log(`Topics w/ sections : ${report.sectionsSetForTopics}`);
  console.log(`Quizzes linked     : ${report.quizzesLinked}`);
  console.log(`Failures           : ${report.failures.length}`);
  if (report.failures.length) {
    console.log('\n-- Failures --');
    for (const f of report.failures) {
      console.log(`  [${f.stage}] ${f.title}: ${f.reason}`);
      console.log(`     payload: ${f.payload}`);
    }
  }

  const outPath = path.join(__dirname, 'lkg_topic_content_result.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
