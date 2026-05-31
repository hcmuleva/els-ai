const fs = require('fs');

async function main() {
  const data = fs.readFileSync('/home/dhruv/work-dhruv/hph/els-ai/els-ai/dump/els_ai_db_dump_20260531_010555.sql', 'utf8');
  
  const regex = /([^\t\n]+)\t+([^\t\n]+)\t+([^\t\n]+)\t+youtube_url\t+([^\t\n]*)\t+(https:\/\/www\.youtube\.com[^\t\n]+)\t+([^\t\n]*)\t+([^\t\n]+)\t+([^\t\n]+)\t+([^\t\n]+)\t+([^\t\n]+)/g;
  
  let match;
  const uniqueUrls = new Map();
  
  while ((match = regex.exec(data)) !== null) {
    const url = match[5];
    const title = match[9]; // Title is usually before quiz_id
    if (!uniqueUrls.has(url)) {
      uniqueUrls.set(url, { title, count: 0 });
    }
    uniqueUrls.get(url).count++;
  }

  console.log(`Found ${uniqueUrls.size} unique YouTube URLs.`);
  
  const deadUrls = [];
  
  for (const [url, info] of uniqueUrls.entries()) {
    try {
      // Check oembed to see if video exists
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!res.ok) {
        console.log(`DEAD: ${url} (Title: ${info.title})`);
        deadUrls.push({ url, title: info.title });
      } else {
        console.log(`OK: ${url}`);
      }
    } catch (e) {
      console.log(`ERROR: ${url} - ${e.message}`);
    }
  }

  console.log(`\nFound ${deadUrls.length} dead URLs.`);
}

main().catch(console.error);
