const fs = require('fs');
let content = fs.readFileSync('backend/quiz-service/src/routes/quizzes.ts', 'utf8');

// Inside fetchClassroomResources:
// Add sectionsResult query using contentIds
const fetchSectionsPatch = `
  const contentIds = contentsResult.rows.map((row: any) => row.id as string).filter(Boolean);
  let sectionsGroupedByContentId: Record<string, any[]> = {};
  if (contentIds.length > 0) {
    const sectionsResult = await db.query(
      \`SELECT id, content_id, section_order, title, content_type, media_url, external_url, text_content
       FROM learning_content_sections
       WHERE content_id = ANY($1::uuid[])
       ORDER BY content_id, section_order ASC\`,
      [contentIds]
    );
    for (const row of sectionsResult.rows) {
      const cId = row.content_id as string;
      if (!sectionsGroupedByContentId[cId]) sectionsGroupedByContentId[cId] = [];
      sectionsGroupedByContentId[cId].push({
        id: row.id,
        sectionOrder: Number(row.section_order),
        title: row.title || undefined,
        contentType: row.content_type,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
        externalUrl: row.external_url || undefined,
        textContent: row.text_content || undefined,
      });
    }
  }

  const contentRows = await Promise.all(
`;

content = content.replace(/const contentRows = await Promise\.all\(/, fetchSectionsPatch);

// Then map the sections into the content rows
content = content.replace(
  /createdAt: row\.created_at as string,\n    \}\)\),/g,
  'createdAt: row.created_at as string,\n      sections: sectionsGroupedByContentId[row.id as string] || [],\n    })),'
);

fs.writeFileSync('backend/quiz-service/src/routes/quizzes.ts', content);
console.log('Patched fetchClassroomResources');
