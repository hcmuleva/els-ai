import pg from 'pg';
const { Client } = pg;

async function seed() {
  const client = new Client({
    host: "127.0.0.1",
    port: 5544,
    database: "els_ai_db",
    user: "postgres",
    password: "postgres"
  });

  await client.connect();

  const orgId = "7de05a79-4c21-4471-a293-d3ca0abdbb2f";
  const teacherId = "2bbb46e2-ac0f-4e6b-8f4b-a2619986b461";
  const evsSubjectId = "d2986149-3c6c-4cb3-9cb6-1897a84519b6"; // Class 1 EVS

  console.log("Seeding demonstration topic...");

  // 1. Insert content_topics
  const topicRes = await client.query(
    `INSERT INTO content_topics (organization_id, class_level, subject_id, title, cover_image, created_by, is_global)
     VALUES ($1, '1', $2, $3, $4, $5, true)
     ON CONFLICT (organization_id, class_level, subject_id, title)
     DO UPDATE SET updated_at = NOW(), cover_image = EXCLUDED.cover_image
     RETURNING id`,
    [
      orgId,
      evsSubjectId,
      "Wonders of the Solar System & Space",
      "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=800&q=80",
      teacherId
    ]
  );
  const topicId = topicRes.rows[0].id;
  console.log("Created Topic ID:", topicId);

  // 2. Insert learning_contents
  const contentRes = await client.query(
    `INSERT INTO learning_contents (organization_id, class_level, subject_id, title, content_type, media_url, external_url, text_content, created_by, is_global)
     VALUES ($1, '1', $2, $3, 'links', $4, $4, $5, $6, true)
     RETURNING id`,
    [
      orgId,
      evsSubjectId,
      "The Solar System: Planets & Stars",
      "https://www.youtube.com/watch?v=libKVRa01L8",
      "Comprehensive interactive lesson on the Solar System, orbital scales, and astronaut briefing.",
      teacherId
    ]
  );
  const contentId = contentRes.rows[0].id;
  console.log("Created Learning Content ID:", contentId);

  // 3. Insert topic_content_assignments
  await client.query(
    `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
     VALUES ($1, $2, 0)
     ON CONFLICT (topic_id, content_id) DO NOTHING`,
    [topicId, contentId]
  );

  // 4. Clean and insert learning_content_sections
  await client.query(`DELETE FROM learning_content_sections WHERE content_id = $1`, [contentId]);

  const textBody = `# 🚀 Mission Briefing: Our Solar System

Welcome junior astronauts! Let's explore our planetary neighborhood circling the Sun.

## 🪐 The Eight Planets
1. **Mercury** – Closest to the Sun and the smallest.
2. **Venus** – Super hot with thick clouds.
3. **Earth** – Our blue planet, full of water and living things! 🌍
4. **Mars** – The Red Planet with rusty dust and craters.
5. **Jupiter** – The giant with the Great Red Spot!
6. **Saturn** – Crowned with bright, icy rings.
7. **Uranus** – The sideways spinning ice world.
8. **Neptune** – Windy, chilly, and deep ocean blue.

---

### 💡 Quick Memory Trick
> **M**y **V**ery **E**ducated **M**other **J**ust **S**erved **U**s **N**oodles!

\`\`\`science
Sun ☀️ ➔ Mercury ➔ Venus ➔ Earth ➔ Mars ➔ Jupiter ➔ Saturn ➔ Uranus ➔ Neptune
\`\`\`

<div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; padding: 12px; border-radius: 8px;">
  <p style="margin: 0; color: #1E40AF; font-weight: bold;">🌟 Did You Know?</p>
  <p style="margin: 4px 0 0; color: #1E3A8A;">The Sun is so huge that over <strong>one million Earths</strong> could fit inside it!</p>
</div>`;

  // Section 1: Links (YouTube Video)
  await client.query(
    `INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url)
     VALUES ($1, 1, 'Planets Exploration Video', 'links', 'https://www.youtube.com/watch?v=libKVRa01L8', 'https://www.youtube.com/watch?v=libKVRa01L8')`,
    [contentId]
  );

  // Section 2: File Upload (High-res Infographic Image)
  await client.query(
    `INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url)
     VALUES ($1, 2, 'Solar System Orbital Chart', 'file_upload', 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80')`,
    [contentId]
  );

  // Section 3: Text (Rich Markdown + HTML)
  await client.query(
    `INSERT INTO learning_content_sections (content_id, section_order, title, content_type, text_content)
     VALUES ($1, 3, 'Astronaut Guide & Planet Facts', 'text', $2)`,
    [contentId, textBody]
  );

  // 5. Clean and insert topic_content_sections
  await client.query(`DELETE FROM topic_content_sections WHERE topic_id = $1`, [topicId]);
  await client.query(
    `INSERT INTO topic_content_sections (topic_id, section_order, title, content_type, media_url, external_url)
     VALUES ($1, 1, 'Planets Exploration Video', 'links', 'https://www.youtube.com/watch?v=libKVRa01L8', 'https://www.youtube.com/watch?v=libKVRa01L8')`,
    [topicId]
  );
  await client.query(
    `INSERT INTO topic_content_sections (topic_id, section_order, title, content_type, media_url, external_url)
     VALUES ($1, 2, 'Solar System Orbital Chart', 'file_upload', 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80')`,
    [topicId]
  );
  await client.query(
    `INSERT INTO topic_content_sections (topic_id, section_order, title, content_type, text_content)
     VALUES ($1, 3, 'Astronaut Guide & Planet Facts', 'text', $2)`,
    [topicId, textBody]
  );

  console.log("Successfully seeded topic with all 3 unified content types!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
