/**
 * Attach each LKG topic's quiz to its content's final section as a
 * "Quick Challenge" (story-style per-section quiz).
 *
 * For every topic in lkg_topic_content_result.json:
 *   1. GET  {GATEWAY}/topics/{topicId}/details   -> content item id + sections
 *   2. GET  {GATEWAY}/content/items/{contentId}  -> full sections payload
 *   3. set quizId on the LAST section (the "Classroom Activity" lesson)
 *   4. PUT  {GATEWAY}/content/items/{contentId}  -> persists section.quiz_id
 *
 * Idempotent: re-running just re-sets the same quizId. Retries 2x per call.
 *
 * Usage:  node scripts/lkg_attach_section_quizzes.cjs
 * Env:    GATEWAY, LOGIN_ID, LOGIN_PW
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@els.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';
const RESULT = path.join(__dirname, 'lkg_topic_content_result.json');
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
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function withRetry(label, fn) {
  let last;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const r = await fn();
    if (r.ok) return r;
    last = r;
    if (attempt < RETRIES) {
      console.warn(`  ! ${label} failed (status ${r.status}), retry ${attempt + 1}/${RETRIES}`);
      await sleep(400 * (attempt + 1));
    }
  }
  return last;
}

function errReason(r) {
  if (!r) return 'no response';
  if (r.json && r.json.message) return `${r.status}: ${r.json.message}`;
  return `${r.status}`;
}

// map a GET-section back into a PUT-section payload
function toPutSection(s) {
  const out = { contentType: s.contentType };
  if (s.title) out.title = s.title;
  if (s.mediaUrl) out.mediaUrl = s.mediaUrl;
  if (s.externalUrl) out.externalUrl = s.externalUrl;
  if (s.textContent) out.textContent = s.textContent;
  if (s.quizId) out.quizId = s.quizId;
  return out;
}

async function main() {
  const result = JSON.parse(fs.readFileSync(RESULT, 'utf8'));
  const topics = (result.topics || []).filter((t) => t.topicId && t.quizId);
  console.log(`Topics with a quiz to attach: ${topics.length}\n`);

  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json || !login.json.accessToken) {
    console.error(`Login failed: ${errReason(login)}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID}\n`);

  const report = { attempted: 0, attached: 0, failures: [], items: [] };

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    report.attempted++;
    console.log(`[${i + 1}/${topics.length}] ${t.subject} / ${t.title}`);

    const details = await http('GET', `${GATEWAY}/topics/${t.topicId}/details`, token);
    const contentItem =
      details.ok && details.json && Array.isArray(details.json.contentItems)
        ? details.json.contentItems[0]
        : null;
    if (!contentItem || !contentItem.id) {
      report.failures.push({ topic: t.title, reason: `no content item (${errReason(details)})` });
      console.error('  x no content item found');
      continue;
    }
    const contentId = contentItem.id;

    const full = await http('GET', `${GATEWAY}/content/items/${contentId}`, token);
    const sections = full.ok && full.json && Array.isArray(full.json.sections) ? full.json.sections : [];
    if (sections.length === 0) {
      report.failures.push({ topic: t.title, reason: `no sections (${errReason(full)})` });
      console.error('  x no sections');
      continue;
    }

    // attach to the last section (the closing "Classroom Activity" lesson)
    const targetIdx = sections.length - 1;
    const putSections = sections.map((s, idx) => {
      const ps = toPutSection(s);
      ps.quizId = idx === targetIdx ? t.quizId : null;
      return ps;
    });

    const put = await withRetry('attach quiz', () =>
      http('PUT', `${GATEWAY}/content/items/${contentId}`, token, {
        classLevel: full.json.classLevel,
        subject: full.json.subject,
        title: full.json.title,
        sections: putSections,
      }),
    );
    if (put && put.ok) {
      report.attached++;
      report.items.push({
        topic: t.title,
        contentId,
        section: sections[targetIdx].title || `Section ${targetIdx + 1}`,
        quizId: t.quizId,
      });
      console.log(`  ✓ quiz ${t.quizId} attached to "${sections[targetIdx].title || 'last section'}"`);
    } else {
      report.failures.push({ topic: t.title, reason: errReason(put) });
      console.error(`  x attach failed: ${errReason(put)}`);
    }
  }

  const out = path.join(__dirname, 'lkg_section_quiz_attach_result.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nDone. attached=${report.attached}/${report.attempted}, failures=${report.failures.length}`);
  console.log(`Report: ${out}`);
  if (report.failures.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
