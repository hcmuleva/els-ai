/**
 * Seeds a Class 4 "Video Section Builder" demo:
 *   • one YouTube learning_content (The Water Cycle)
 *   • three time-bounded video_sections
 *   • one quiz per section (with questions), attached to the section
 *
 * Safe to run repeatedly: if the demo content already exists it exits without
 * creating duplicates. Also applies migration 0022 (idempotent) if the
 * video_sections tables are missing.
 *
 * Usage:  node scripts/seed_video_section_demo.cjs
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });

// ── Demo fixtures (resolved from the live DB during inspection) ─────────────
const ORG_ID = '8ba8388f-9907-486c-9883-3784c2f2f34e'; // ELS ACADEMY
const SUBJECT_ID = '6cfba8ae-9bd0-4eb5-8b69-2b79f82eb164'; // Class 4 - Environmental Studies (EVS)
const CREATED_BY = '2bb3d34c-4eae-46bd-8f24-cf1c9096ac70'; // ELS Teacher
const CLASS_LEVEL = '4';
const VIDEO_URL = 'https://www.youtube.com/watch?v=ncORPosDrjI'; // The Water Cycle | Dr. Binocs Show
const VIDEO_DURATION = 210; // seconds (whole video is ~3.5 min)
const CONTENT_TITLE = 'The Water Cycle - Interactive Video Lesson (Demo)';
const TOPIC_TITLE = 'Water & Weather (Video Lessons)';

const SECTIONS = [
  {
    title: 'Evaporation',
    description: 'How the Sun turns water from oceans and rivers into water vapour.',
    startTime: 0,
    endTime: 60,
    learningObjective: 'Understand that heat from the Sun causes water to evaporate into vapour.',
    quizTitle: 'Evaporation Quick Check',
    questions: [
      {
        type: 'single_choice',
        title: 'What makes water from oceans and rivers turn into water vapour?',
        options: [
          { label: 'Heat from the Sun', correct: true },
          { label: 'Cold wind', correct: false },
          { label: 'Moonlight', correct: false },
          { label: 'Darkness', correct: false },
        ],
      },
      {
        type: 'true_false',
        title: 'Evaporation changes liquid water into water vapour.',
        options: [
          { label: 'True', correct: true },
          { label: 'False', correct: false },
        ],
      },
    ],
  },
  {
    title: 'Condensation & Clouds',
    description: 'How rising water vapour cools down and forms clouds.',
    startTime: 60,
    endTime: 130,
    learningObjective: 'Explain how water vapour condenses into droplets that form clouds.',
    quizTitle: 'Clouds & Condensation Quiz',
    questions: [
      {
        type: 'single_choice',
        title: 'When water vapour cools high in the sky, the tiny droplets form ____.',
        options: [
          { label: 'Clouds', correct: true },
          { label: 'Rocks', correct: false },
          { label: 'Sand', correct: false },
          { label: 'Fire', correct: false },
        ],
      },
      {
        type: 'true_false',
        title: 'Condensation is when water vapour turns back into tiny water droplets.',
        options: [
          { label: 'True', correct: true },
          { label: 'False', correct: false },
        ],
      },
    ],
  },
  {
    title: 'Precipitation & Collection',
    description: 'How water falls back to Earth and collects in oceans, rivers and lakes.',
    startTime: 130,
    endTime: 200,
    learningObjective: 'Identify precipitation and where water collects to repeat the cycle.',
    quizTitle: 'Rain & Collection Quiz',
    questions: [
      {
        type: 'single_choice',
        title: 'What do we call water falling from clouds as rain, snow, or hail?',
        options: [
          { label: 'Precipitation', correct: true },
          { label: 'Evaporation', correct: false },
          { label: 'Reflection', correct: false },
          { label: 'Rotation', correct: false },
        ],
      },
      {
        type: 'single_choice',
        title: 'Where does most of the rain water finally collect?',
        options: [
          { label: 'Oceans, rivers and lakes', correct: true },
          { label: 'In the clouds forever', correct: false },
          { label: 'On the Moon', correct: false },
          { label: 'Inside the Sun', correct: false },
        ],
      },
    ],
  },
];

function buildQuestionData(options) {
  return {
    options: options.map((o, i) => ({ id: `o${i + 1}`, label: o.label, is_correct: o.correct })),
  };
}

async function ensureTables(client) {
  const t = await client.query("SELECT to_regclass('public.video_sections') AS vs");
  if (t.rows[0].vs) return;
  console.log('• video_sections table missing — applying migration 0022 …');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0022_video_sections.sql'), 'utf8');
  await client.query(sql);
  console.log('  ✓ migration 0022 applied');
}

// Ensures the demo content is assigned to a Class 4 EVS topic so it appears in
// the student subject/topic content page.
async function ensureTopicAssignment(client, contentId) {
  const found = await client.query(
    'SELECT id FROM content_topics WHERE organization_id = $1 AND class_level = $2 AND subject_id = $3 AND title = $4',
    [ORG_ID, CLASS_LEVEL, SUBJECT_ID, TOPIC_TITLE],
  );
  let topicId;
  if (found.rowCount > 0) {
    topicId = found.rows[0].id;
  } else {
    const t = await client.query(
      `INSERT INTO content_topics (organization_id, class_level, subject_id, title, created_by, is_global)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
      [ORG_ID, CLASS_LEVEL, SUBJECT_ID, TOPIC_TITLE, CREATED_BY],
    );
    topicId = t.rows[0].id;
  }
  await client.query(
    `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
     VALUES ($1, $2, 0) ON CONFLICT (topic_id, content_id) DO NOTHING`,
    [topicId, contentId],
  );
  console.log(`  ✓ topic "${TOPIC_TITLE}" (${topicId}) -> demo content assigned`);
  return topicId;
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureTables(client);

    const existing = await client.query(
      'SELECT id FROM learning_contents WHERE organization_id = $1 AND title = $2',
      [ORG_ID, CONTENT_TITLE],
    );
    if (existing.rowCount > 0) {
      const contentId = existing.rows[0].id;
      console.log(`• Demo content already exists (content_id=${contentId}); ensuring topic assignment.`);
      await ensureTopicAssignment(client, contentId);
      console.log('\n✅ Done (topic assignment ensured).');
      return;
    }

    await client.query('BEGIN');

    const contentRes = await client.query(
      `INSERT INTO learning_contents
         (organization_id, class_level, subject_id, title, content_type, external_url, created_by, is_global, video_duration)
       VALUES ($1, $2, $3, $4, 'youtube_url', $5, $6, false, $7)
       RETURNING id`,
      [ORG_ID, CLASS_LEVEL, SUBJECT_ID, CONTENT_TITLE, VIDEO_URL, CREATED_BY, VIDEO_DURATION],
    );
    const contentId = contentRes.rows[0].id;

    // Mirror the video as a normal content section so it also shows in the
    // standard content viewer.
    await client.query(
      `INSERT INTO learning_content_sections (content_id, section_order, title, content_type, external_url)
       VALUES ($1, 1, $2, 'youtube_url', $3)`,
      [contentId, 'The Water Cycle', VIDEO_URL],
    );

    let order = 0;
    for (const sec of SECTIONS) {
      order += 1;

      const quizRes = await client.query(
        `INSERT INTO quizzes
           (organization_id, title, description, class_level, subject_id, quiz_type, difficulty_level, theme, total_questions, is_published, is_ai_generated, created_by, is_global, kind)
         VALUES ($1, $2, $3, $4, $5, 'single_choice', 'easy', '{}'::jsonb, $6, true, false, $7, false, 'subject')
         RETURNING id`,
        [ORG_ID, sec.quizTitle, `Quick challenge for: ${sec.title}`, CLASS_LEVEL, SUBJECT_ID, sec.questions.length, CREATED_BY],
      );
      const quizId = quizRes.rows[0].id;

      let qOrder = 0;
      for (const q of sec.questions) {
        qOrder += 1;
        await client.query(
          `INSERT INTO quiz_questions
             (quiz_id, question_type, question_title, question_instruction, time_limit_seconds, points, sort_order, question_data)
           VALUES ($1, $2, $3, $4, 30, 10, $5, $6)`,
          [quizId, q.type, q.title, 'Choose the correct answer.', qOrder, buildQuestionData(q.options)],
        );
      }

      await client.query(
        `INSERT INTO video_sections
           (content_id, organization_id, title, description, start_time, end_time, learning_objective, age_group, category, difficulty, quiz_id, status, section_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '5-10', 'Environmental Studies', 'easy', $8, 'published', $9)`,
        [contentId, ORG_ID, sec.title, sec.description, sec.startTime, sec.endTime, sec.learningObjective, quizId, order],
      );

      console.log(`  ✓ section "${sec.title}" (${sec.startTime}-${sec.endTime}s) + quiz "${sec.quizTitle}" (${sec.questions.length} Qs)`);
    }

    await client.query('COMMIT');

    await ensureTopicAssignment(client, contentId);

    console.log('\n✅ Demo created successfully');
    console.log('   Organization : ELS ACADEMY');
    console.log('   Class        : 4');
    console.log('   Subject      : Environmental Studies (EVS)');
    console.log('   Video        : The Water Cycle | The Dr. Binocs Show');
    console.log(`   Video URL    : ${VIDEO_URL}`);
    console.log(`   Content ID   : ${contentId}`);
    console.log('   Sections     : Evaporation, Condensation & Clouds, Precipitation & Collection (each with a quiz)');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Seed failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
