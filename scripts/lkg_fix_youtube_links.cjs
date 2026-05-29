#!/usr/bin/env node
/**
 * Replaces YouTube *search* fallback links (youtube.com/results?search_query=...)
 * stored on LKG topic content with real video watch URLs.
 *
 * For every LKG content item it reads the current sections, swaps any matched
 * search link for the mapped video URL, and PUTs the corrected sections back via
 * the content-service (PUT /content/items/:contentId).
 *
 * Usage: node scripts/lkg_fix_youtube_links.cjs
 * Env:   GATEWAY, LOGIN_ID, LOGIN_PW (same defaults as the other LKG scripts)
 */

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@els.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';

// search-query keyword (as stored in the URL) -> real YouTube video URL
const REPLACEMENTS = [
  ['animals+and+their+homes', 'https://www.youtube.com/watch?v=Iido68T4czc'],
  ['pet+animals', 'https://www.youtube.com/watch?v=dXZEye_gTSE'],
  ['plants+for+kids', 'https://www.youtube.com/watch?v=A-xScqCN0GA'],
  ['community+helpers', 'https://www.youtube.com/watch?v=BzzFRQsmb74'],
  ['colours+for+kids', 'https://www.youtube.com/watch?v=ybt2jhCQ3lA'],
  ['transport+name', 'https://www.youtube.com/watch?v=NYLHPHOVqek'],
  ['sharing+is+caring', 'https://www.youtube.com/watch?v=hVT-BXw4hEM'],
  ['kindness+story', 'https://www.youtube.com/watch?v=FRm-_kt_osY'],
  ['honesty+story', 'https://www.youtube.com/watch?v=BGlHu7gufhc'],
  ['respect+for+elders', 'https://www.youtube.com/watch?v=EM7URPzyjRY'],
];

function mapSearchUrl(url) {
  if (!url || !url.includes('/results?search_query=')) return null;
  const lower = url.toLowerCase();
  for (const [needle, video] of REPLACEMENTS) {
    if (lower.includes(needle)) return video;
  }
  return null;
}

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

async function main() {
  const login = await http('POST', `${GATEWAY}/auth/login`, null, {
    identifier: LOGIN_ID,
    password: LOGIN_PW,
  });
  if (!login.ok || !login.json || !login.json.accessToken) {
    console.error('Login failed:', login.status, JSON.stringify(login.json));
    process.exit(1);
  }
  const token = login.json.accessToken;
  console.log(`Logged in as ${LOGIN_ID}\n`);

  const topicsRes = await http('GET', `${GATEWAY}/topics?class_level=LKG&limit=300`, token);
  const topics =
    topicsRes.ok && topicsRes.json && Array.isArray(topicsRes.json.topics)
      ? topicsRes.json.topics
      : [];
  console.log(`LKG topics: ${topics.length}\n`);

  let itemsChecked = 0;
  let itemsUpdated = 0;
  let linksReplaced = 0;
  const failures = [];

  for (const topic of topics) {
    const details = await http('GET', `${GATEWAY}/topics/${topic.id}/details`, token);
    const items =
      details.ok && details.json && Array.isArray(details.json.contentItems)
        ? details.json.contentItems
        : [];

    for (const item of items) {
      itemsChecked++;
      const sections = Array.isArray(item.sections) ? item.sections : [];
      let changed = 0;
      const newSections = sections.map((s) => {
        const replacement = s.contentType === 'youtube_url' ? mapSearchUrl(s.externalUrl) : null;
        if (replacement) {
          changed++;
          return {
            title: s.title || undefined,
            contentType: 'youtube_url',
            externalUrl: replacement,
          };
        }
        // preserve section as-is, only the fields the schema accepts
        const out = { contentType: s.contentType };
        if (s.title) out.title = s.title;
        if (s.mediaUrl) out.mediaUrl = s.mediaUrl;
        if (s.externalUrl) out.externalUrl = s.externalUrl;
        if (s.textContent) out.textContent = s.textContent;
        return out;
      });

      if (changed === 0) continue;

      const put = await http('PUT', `${GATEWAY}/content/items/${item.id}`, token, {
        classLevel: item.classLevel || topic.classLevel,
        subject: item.subject || topic.subject,
        title: item.title,
        sections: newSections,
      });
      if (put.ok) {
        itemsUpdated++;
        linksReplaced += changed;
        console.log(`✓ ${topic.subject} / ${topic.title}: replaced ${changed} search link(s)`);
      } else {
        failures.push({ topic: topic.title, contentId: item.id, status: put.status, body: put.json });
        console.error(`x ${topic.subject} / ${topic.title}: PUT failed ${put.status} ${JSON.stringify(put.json)}`);
      }
    }
  }

  console.log('\n══════════════ REPORT ══════════════');
  console.log(`Content items checked : ${itemsChecked}`);
  console.log(`Content items updated : ${itemsUpdated}`);
  console.log(`Search links replaced : ${linksReplaced}`);
  console.log(`Failures              : ${failures.length}`);
  if (failures.length) console.log(JSON.stringify(failures, null, 2));
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
