const fs = require('fs');
let content = fs.readFileSync('backend/quiz-service/src/routes/quizzes.ts', 'utf8');

// 1. SELECT id, content_id... -> SELECT id, content_id, section_order, title, content_type
content = content.replace(
  /SELECT id, content_id, section_order, content_type/g,
  'SELECT id, content_id, section_order, title, content_type'
);

// 2. Map title
content = content.replace(
  /sectionOrder: Number\(row.section_order \|\| 0\),/g,
  'sectionOrder: Number(row.section_order || 0),\n        title: (row.title as string | null) || undefined,'
);

// 3. Fallback sections without title -> with title: undefined
content = content.replace(
  /sectionOrder: 1,\n(.*?)contentType: row.content_type/g,
  'sectionOrder: 1,\n$1title: undefined,\n$1contentType: row.content_type'
);

// 4. INSERT 1
content = content.replace(
  /INSERT INTO learning_content_sections \(content_id, section_order, content_type, media_url, external_url, text_content\)\n(.*?)VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)`,\n(.*?)\[created\.id, i \+ 1, section\.contentType, section\.mediaUrl, section\.externalUrl, section\.textContent\]/g,
  'INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url, text_content)\n$1VALUES ($1, $2, $3, $4, $5, $6, $7)`,\n$2[created.id, i + 1, section.title, section.contentType, section.mediaUrl, section.externalUrl, section.textContent]'
);

// 5. INSERT 2
content = content.replace(
  /INSERT INTO learning_content_sections \(content_id, section_order, content_type, media_url, external_url, text_content\)\n(.*?)VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)`,\n(.*?)\[contentId, i \+ 1, section\.contentType, section\.mediaUrl, section\.externalUrl, section\.textContent\]/g,
  'INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url, text_content)\n$1VALUES ($1, $2, $3, $4, $5, $6, $7)`,\n$2[contentId, i + 1, section.title, section.contentType, section.mediaUrl, section.externalUrl, section.textContent]'
);

// 6. SELECT id, section_order... -> title
content = content.replace(
  /SELECT id, section_order, content_type/g,
  'SELECT id, section_order, title, content_type'
);

// 7. Map title for single topic
content = content.replace(
  /sectionOrder: sec.section_order as number,\n(.*?)contentType: sec.content_type as string,/g,
  'sectionOrder: sec.section_order as number,\n$1title: (sec.title as string | null) || undefined,\n$1contentType: sec.content_type as string,'
);


fs.writeFileSync('backend/quiz-service/src/routes/quizzes.ts', content);
console.log('Patched quizzes.ts');
