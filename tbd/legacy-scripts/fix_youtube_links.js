import fs from 'fs';
import ytSearch from 'youtube-search-api';

const dumpFile = '/home/dhruv/work-dhruv/hph/els-ai/els-ai/dump/els_ai_db_dump_20260531_010555.sql';

const deadUrls = new Set([
  'https://www.youtube.com/watch?v=KxSEYA04Rvg&list=PLsWoRuvTLq-1ALHPvkvwHBZHkNAEPFYxb&index=2',
  'https://www.youtube.com/watch?v=IlFFt6arRcQ',
  'https://www.youtube.com/watch?v=H_Vgcjg8eJk',
  'https://www.youtube.com/watch?v=uS5IiKAh-bM',
  'https://www.youtube.com/watch?v=-QzIS_oUbBo',
  'https://www.youtube.com/watch?v=hVT-BXw4hEM',
  'https://www.youtube.com/watch?v=Q4xOMb_6FmI',
  'https://www.youtube.com/watch?v=qQbGPplWIOg',
  'https://www.youtube.com/watch?v=bbfubT_YXaQ',
  'https://www.youtube.com/watch?v=LXBOaBJYcQQ',
  'https://www.youtube.com/watch?v=eR2LGRf-V8M',
  'https://www.youtube.com/watch?v=1c5HY3z4k8E',
  'https://www.youtube.com/watch?v=ZJsSrxAZ7Vw',
  'https://www.youtube.com/watch?v=hUIFEIzljPM',
  'https://www.youtube.com/watch?v=raoP4cJ4nJI',
  'https://www.youtube.com/watch?v=GS2FTTtq05g',
  'https://www.youtube.com/watch?v=NLk5W9JC8N0',
  'https://www.youtube.com/watch?v=xAeM1Iex_TY',
  'https://www.youtube.com/watch?v=Re2C2hAFvCo',
  'https://www.youtube.com/watch?v=W23pwjrOFHM',
  'https://www.youtube.com/watch?v=ZG_qCK6cxJ4',
  'https://www.youtube.com/watch?v=zOI-3rFjXvU',
  'https://www.youtube.com/watch?v=mvpYUlyqamw',
  'https://www.youtube.com/watch?v=__1JbE-fKi4'
]);

async function search(query) {
  try {
    const res = await ytSearch.GetListByKeyword(query, false, 1, [{type: 'video'}]);
    if (res && res.items && res.items.length > 0) {
      return `https://www.youtube.com/watch?v=${res.items[0].id}`;
    }
  } catch (e) {
    console.error("Error searching for", query, e.message);
  }
  return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
}

async function main() {
  let sql = fs.readFileSync(dumpFile, 'utf8');
  let lines = sql.split('\n');
  
  // Build maps of IDs to Titles.
  let idToTitle = {};
  
  let inContents = false;
  let inTopics = false;
  for (let line of lines) {
    if (line.startsWith('COPY public.learning_contents ')) {
      inContents = true; continue;
    }
    if (line.startsWith('COPY public.topics ')) {
      inTopics = true; continue;
    }
    if (inContents && line === '\\.') inContents = false;
    if (inTopics && line === '\\.') inTopics = false;
    
    if (inContents) {
      let parts = line.split('\t');
      if (parts.length > 3) idToTitle[parts[0]] = parts[3] + " for kids";
    }
    if (inTopics) {
      let parts = line.split('\t');
      if (parts.length > 3) idToTitle[parts[0]] = parts[3] + " for kids";
    }
  }
  
  // Find replacements.
  let replacements = new Map();
  let inSections1 = false;
  let inSections2 = false;
  
  for (let line of lines) {
    let m;
    let queryRegex = /https:\/\/www\.youtube\.com\/results\?search_query=([^\s"\]]+)/g;
    while ((m = queryRegex.exec(line)) !== null) {
      let orig = m[0];
      let q = decodeURIComponent(m[1]).replace(/\+/g, ' ');
      if (!replacements.has(orig)) replacements.set(orig, q);
    }
    
    if (line.startsWith('COPY public.learning_content_sections ')) { inSections1 = true; continue; }
    if (line.startsWith('COPY public.topic_content_sections ')) { inSections2 = true; continue; }
    if (inSections1 && line === '\\.') inSections1 = false;
    if (inSections2 && line === '\\.') inSections2 = false;
    
    if (inSections1 || inSections2) {
      let parts = line.split('\t');
      // ID is 0, parent_id is 1, external_url is 5
      if (parts.length > 5) {
        let parent_id = parts[1];
        let url = parts[5];
        if (deadUrls.has(url)) {
          let title = idToTitle[parent_id] || "educational video for kids";
          if (!replacements.has(url)) {
            replacements.set(url, title);
          }
        }
      }
    }
  }
  
  console.log(`Need to resolve ${replacements.size} unique URLs.`);
  
  let resolvedMap = {};
  for (let [orig, query] of replacements.entries()) {
    console.log(`Searching for: ${query}`);
    let newUrl = await search(query);
    console.log(` -> ${newUrl}`);
    resolvedMap[orig] = newUrl;
    await new Promise(r => setTimeout(r, 500));
  }
  
  for (let [orig, newUrl] of Object.entries(resolvedMap)) {
    sql = sql.split(orig).join(newUrl);
  }
  
  fs.writeFileSync(dumpFile, sql, 'utf8');
  console.log("Done!");
}

main().catch(console.error);
