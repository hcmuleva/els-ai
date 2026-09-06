/**
 * Replace the cloned 2nd-topic quiz in each subject with brand-new,
 * topic-specific questions (Option A). Same question type at each sort_order as
 * the existing rows, so we UPDATE in place (keeping ids, points, timing, _meta,
 * and the topic/section links). Reuses local artwork only — no downloads.
 *
 * Idempotent. Usage:  node scripts/lkg_author_topic2_questions.cjs
 */

const { Pool } = require('pg');

const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// Each entry: sort_order -> { type, title, instruction, audio, data }
// `data` must NOT include _meta (preserved from the existing row).
const PLAN = {
  // Mathematics - Shapes and Comparison
  '5ee076f6-30af-466e-be8c-845ec6c3fe16': {
    subject: 'Mathematics / Shapes and Comparison',
    questions: {
      1: { type: 'fill_blank', title: 'Fill the shape', instruction: 'Pick the missing word.',
        data: { hint: 'Look at a wheel.', answer: 'circle', options: ['circle', 'square', 'triangle', 'star'], sentence: 'A ball is round like a ___' } },
      2: { type: 'guess_image', title: 'Find the square', instruction: 'Tap the square.',
        data: { options: [
          { id: 'opt_circle', image: '/media/images/circle.svg', label: 'Circle', is_correct: false },
          { id: 'opt_square', image: '/media/images/square.svg', label: 'Square', is_correct: true },
          { id: 'opt_triangle', image: '/media/images/triangle.svg', label: 'Triangle', is_correct: false },
          { id: 'opt_rectangle', image: '/media/images/rectangle.svg', label: 'Rectangle', is_correct: false },
        ], prompt_image: '/media/images/square.svg' } },
      3: { type: 'single_choice', title: 'Which shape has three sides?', instruction: 'Choose one.',
        data: { options: [
          { id: 'opt_triangle', image: '/media/images/triangle.svg', label: 'Triangle', is_correct: true },
          { id: 'opt_circle', image: '/media/images/circle.svg', label: 'Circle', is_correct: false },
          { id: 'opt_square', image: '/media/images/square.svg', label: 'Square', is_correct: false },
        ] } },
      4: { type: 'drag_drop_match', title: 'Match the shapes', instruction: 'Drag each shape to its name.',
        data: { drag_items: [
          { id: 'd_circle', image: '/media/images/circle.svg', label: 'Circle' },
          { id: 'd_square', image: '/media/images/square.svg', label: 'Square' },
          { id: 'd_triangle', image: '/media/images/triangle.svg', label: 'Triangle' },
        ], drop_targets: [
          { id: 't_circle', label: 'Circle' }, { id: 't_square', label: 'Square' }, { id: 't_triangle', label: 'Triangle' },
        ], match_rules: [
          { drag_item_id: 'd_circle', drop_target_id: 't_circle' },
          { drag_item_id: 'd_square', drop_target_id: 't_square' },
          { drag_item_id: 'd_triangle', drop_target_id: 't_triangle' },
        ] } },
      5: { type: 'memory_match', title: 'Match the shape pairs', instruction: 'Flip cards and match the shapes.',
        data: { grid: '2x2', clickLimit: 10, pairs: [
          { id: 1, label: 'Circle', imageUrl: '/media/images/circle.svg' },
          { id: 2, label: 'Square', imageUrl: '/media/images/square.svg' },
        ] } },
    },
  },

  // English - Simple Words
  '27544d16-ec5a-4529-85aa-42bd31868291': {
    subject: 'English / Simple Words',
    questions: {
      1: { type: 'guess_audio', title: 'What word do you hear?', instruction: 'Listen and choose.', audio: SAMPLE_AUDIO,
        data: { options: [
          { id: 'opt_cat', label: 'Cat', is_correct: true },
          { id: 'opt_dog', label: 'Dog', is_correct: false },
          { id: 'opt_sun', label: 'Sun', is_correct: false },
        ] } },
      2: { type: 'fill_blank', title: 'Pick the opposite', instruction: 'Pick the missing word.',
        data: { hint: 'Not big.', answer: 'small', options: ['small', 'tall', 'long', 'fast'], sentence: 'The opposite of big is ___' } },
      3: { type: 'single_choice', title: 'Which animal word starts with D?', instruction: 'Choose one.',
        data: { options: [
          { id: 'opt_dog', image: '/media/pictures/dog.png', label: 'Dog', is_correct: true },
          { id: 'opt_cat', image: '/media/pictures/cat.png', label: 'Cat', is_correct: false },
          { id: 'opt_owl', image: '/media/pictures/owl.png', label: 'Owl', is_correct: false },
        ] } },
      4: { type: 'drag_drop_match', title: 'Match word to picture', instruction: 'Drag each animal to its name.',
        data: { drag_items: [
          { id: 'd_cat', image: '/media/pictures/cat.png', label: 'Cat' },
          { id: 'd_dog', image: '/media/pictures/dog.png', label: 'Dog' },
          { id: 'd_fish', image: '/media/pictures/fish.png', label: 'Fish' },
        ], drop_targets: [
          { id: 't_cat', label: 'Cat' }, { id: 't_dog', label: 'Dog' }, { id: 't_fish', label: 'Fish' },
        ], match_rules: [
          { drag_item_id: 'd_cat', drop_target_id: 't_cat' },
          { drag_item_id: 'd_dog', drop_target_id: 't_dog' },
          { drag_item_id: 'd_fish', drop_target_id: 't_fish' },
        ] } },
      5: { type: 'jigsaw', title: 'Build the cat picture', instruction: 'Drag pieces to rebuild the picture.',
        data: { image: '/media/pictures/cat.png', gridSize: '2x2', clickLimit: 10, difficulty: 'easy' } },
    },
  },

  // EVS - Plants and Helpers
  'f1b6e4e0-169e-4f32-a796-bd3abfdb1265': {
    subject: 'EVS / Plants and Helpers',
    questions: {
      1: { type: 'guess_image', title: 'Find the flower', instruction: 'Tap the flower.',
        data: { options: [
          { id: 'opt_flower', image: '/media/images/flower.svg', label: 'Flower', is_correct: true },
          { id: 'opt_star', image: '/media/images/star.svg', label: 'Star', is_correct: false },
          { id: 'opt_ball', image: '/media/images/ball.svg', label: 'Ball', is_correct: false },
        ], prompt_image: '/media/images/flower.svg' } },
      2: { type: 'true_false', title: 'Plants give us air', instruction: 'Choose True or False.',
        data: { options: [
          { id: 'opt_true', label: 'True', is_correct: true },
          { id: 'opt_false', label: 'False', is_correct: false },
        ] } },
      3: { type: 'drag_drop_match', title: 'Match the helper', instruction: 'Drag each helper to their name.',
        data: { drag_items: [
          { id: 'd_doctor', image: '/media/images/doctor.svg', label: 'Doctor' },
          { id: 'd_farmer', image: '/media/images/farmer.svg', label: 'Farmer' },
          { id: 'd_postman', image: '/media/images/postman.svg', label: 'Postman' },
        ], drop_targets: [
          { id: 't_doctor', label: 'Doctor' }, { id: 't_farmer', label: 'Farmer' }, { id: 't_postman', label: 'Postman' },
        ], match_rules: [
          { drag_item_id: 'd_doctor', drop_target_id: 't_doctor' },
          { drag_item_id: 'd_farmer', drop_target_id: 't_farmer' },
          { drag_item_id: 'd_postman', drop_target_id: 't_postman' },
        ] } },
      4: { type: 'single_choice', title: 'Who grows our food?', instruction: 'Choose one.',
        data: { options: [
          { id: 'opt_farmer', image: '/media/images/farmer.svg', label: 'Farmer', is_correct: true },
          { id: 'opt_doctor', image: '/media/images/doctor.svg', label: 'Doctor', is_correct: false },
          { id: 'opt_postman', image: '/media/images/postman.svg', label: 'Postman', is_correct: false },
        ] } },
      5: { type: 'memory_match', title: 'Match the garden fruits', instruction: 'Flip cards and match the fruits.',
        data: { grid: '2x2', clickLimit: 10, pairs: [
          { id: 1, label: 'Cherry', imageUrl: '/media/memory-assets/cherry-svgrepo-com.svg' },
          { id: 2, label: 'Grape', imageUrl: '/media/memory-assets/grape-svgrepo-com.svg' },
        ] } },
    },
  },

  // General Knowledge - Transport and Festivals
  '9675eec6-48bd-4f79-a82f-43b112d81259': {
    subject: 'General Knowledge / Transport and Festivals',
    questions: {
      1: { type: 'multi_choice', title: 'Choose the vehicles', instruction: 'Pick all the vehicles.',
        data: { options: [
          { id: 'opt_bus', label: 'Bus', is_correct: true },
          { id: 'opt_train', label: 'Train', is_correct: true },
          { id: 'opt_dog', label: 'Dog', is_correct: false },
          { id: 'opt_mango', label: 'Mango', is_correct: false },
        ] } },
      2: { type: 'guess_audio', title: 'Which festival sound is this?', instruction: 'Listen and choose.', audio: SAMPLE_AUDIO,
        data: { options: [
          { id: 'opt_drum', label: 'Drum', is_correct: true },
          { id: 'opt_train', label: 'Train', is_correct: false },
          { id: 'opt_bell', label: 'Bell', is_correct: false },
        ] } },
      3: { type: 'jigsaw', title: 'Make the festival star puzzle', instruction: 'Drag pieces to rebuild the star.',
        data: { image: '/media/images/star.svg', gridSize: '2x2', clickLimit: 10, difficulty: 'easy' } },
      4: { type: 'fill_blank', title: 'Fill the transport word', instruction: 'Pick the missing word.',
        data: { hint: 'Cars and buses use it.', answer: 'road', options: ['road', 'sky', 'water', 'tree'], sentence: 'A bus runs on the ___' } },
      5: { type: 'true_false', title: 'We fly kites on festivals', instruction: 'Choose True or False.',
        data: { options: [
          { id: 'opt_true', label: 'True', is_correct: true },
          { id: 'opt_false', label: 'False', is_correct: false },
        ] } },
    },
  },

  // Moral Values - Honesty and Respect
  '45578aba-3bad-41e4-bbf3-c7a3de764105': {
    subject: 'Moral Values / Honesty and Respect',
    questions: {
      1: { type: 'single_choice', title: 'What should you say to elders?', instruction: 'Choose one.',
        data: { options: [
          { id: 'opt_namaste', image: '/media/images/namaste.svg', label: 'Say Namaste', is_correct: true },
          { id: 'opt_shout', image: '/media/images/loudspeaker.svg', label: 'Shout', is_correct: false },
          { id: 'opt_ignore', image: '/media/images/no-entry.svg', label: 'Ignore', is_correct: false },
        ] } },
      2: { type: 'true_false', title: 'We should always tell lies', instruction: 'Choose True or False.',
        data: { options: [
          { id: 'opt_true', label: 'True', is_correct: false },
          { id: 'opt_false', label: 'False', is_correct: true },
        ] } },
      3: { type: 'drag_drop_match', title: 'Match the kind act', instruction: 'Drag each action to what it shows.',
        data: { drag_items: [
          { id: 'd_namaste', image: '/media/images/namaste.svg', label: 'Namaste' },
          { id: 'd_share', image: '/media/images/crayon.svg', label: 'Share' },
          { id: 'd_help', image: '/media/images/older-woman.svg', label: 'Help' },
        ], drop_targets: [
          { id: 't_respect', label: 'Respect' }, { id: 't_share', label: 'Sharing' }, { id: 't_help', label: 'Helping' },
        ], match_rules: [
          { drag_item_id: 'd_namaste', drop_target_id: 't_respect' },
          { drag_item_id: 'd_share', drop_target_id: 't_share' },
          { drag_item_id: 'd_help', drop_target_id: 't_help' },
        ] } },
      4: { type: 'memory_match', title: 'Match daily good habits', instruction: 'Flip cards and match the habits.',
        data: { grid: '2x2', clickLimit: 10, pairs: [
          { id: 1, label: 'Good Morning', imageUrl: '/media/images/sun.svg' },
          { id: 2, label: 'School Bag', imageUrl: '/media/images/backpack.svg' },
        ] } },
      5: { type: 'guess_image', title: 'Which child is helping?', instruction: 'Tap the helpful action.',
        data: { options: [
          { id: 'opt_help', image: '/media/images/older-woman.svg', label: 'Helping', is_correct: true },
          { id: 'opt_push', image: '/media/images/collision.svg', label: 'Pushing', is_correct: false },
          { id: 'opt_litter', image: '/media/images/wastebasket.svg', label: 'Littering', is_correct: false },
        ], prompt_image: '/media/images/older-woman.svg' } },
    },
  },
};

async function main() {
  const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });
  const report = { quizzes: 0, updated: 0, skipped: 0, mismatches: [] };
  try {
    for (const [quizId, spec] of Object.entries(PLAN)) {
      report.quizzes++;
      console.log(`\n${spec.subject}  (${quizId})`);
      const rows = (await pool.query(
        'SELECT id, sort_order, question_type, question_data FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order',
        [quizId],
      )).rows;
      const bySort = {};
      rows.forEach((r) => { bySort[r.sort_order] = r; });

      for (const [sortStr, q] of Object.entries(spec.questions)) {
        const sort = Number(sortStr);
        const row = bySort[sort];
        if (!row) { report.mismatches.push(`${quizId} sort ${sort}: no row`); console.log(`  ! sort ${sort}: no row`); continue; }
        if (row.question_type !== q.type) {
          report.mismatches.push(`${quizId} sort ${sort}: type ${row.question_type} != ${q.type}`);
          console.log(`  ! sort ${sort}: type mismatch (${row.question_type} != ${q.type}) — skipped`);
          report.skipped++;
          continue;
        }
        const meta = (row.question_data && row.question_data._meta) || undefined;
        const newData = meta ? { _meta: meta, ...q.data } : { ...q.data };
        await pool.query(
          `UPDATE quiz_questions
             SET question_title = $1, question_instruction = $2, question_audio = $3, question_data = $4::jsonb
           WHERE id = $5`,
          [q.title, q.instruction || null, q.audio || null, JSON.stringify(newData), row.id],
        );
        report.updated++;
        console.log(`  ✓ sort ${sort} [${q.type}] -> ${q.title}`);
      }
    }
    console.log(`\nDone. updated=${report.updated}, skipped=${report.skipped}, mismatches=${report.mismatches.length}`);
    if (report.mismatches.length) { console.log('mismatches:'); report.mismatches.forEach((m) => console.log('  ' + m)); process.exitCode = 1; }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
