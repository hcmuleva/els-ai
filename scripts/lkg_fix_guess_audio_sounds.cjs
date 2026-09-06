/**
 * Point each guess_audio question's prompt at a short local clip in
 * /media/sounds (instead of the long 6-minute SoundHelix song). The two
 * questions whose correct answer had no available clip (phonics "A sound" and
 * "Train") are re-themed to animal sounds we actually have. Correct answers:
 * cow / cat / dog / drum — all distinct, all short, all local.
 *
 * Idempotent. Usage: node scripts/lkg_fix_guess_audio_sounds.cjs
 */
const { Pool } = require('pg');

// keyed by quiz title -> new prompt audio + options (overwrites options)
const PLAN = {
  'LKG English - Alphabet and Phonics': {
    title: 'Which farm animal sound is this?',
    instruction: 'Listen and choose the right animal.',
    audio: '/media/sounds/cow.mp3',
    options: [
      { id: 'opt_cow', label: 'Cow', is_correct: true },
      { id: 'opt_horse', label: 'Horse', is_correct: false },
      { id: 'opt_duck', label: 'Duck', is_correct: false },
    ],
  },
  'LKG English - Simple Words': {
    title: 'Which pet sound is this?',
    instruction: 'Listen and choose the right animal.',
    audio: '/media/sounds/cat.mp3',
    options: [
      { id: 'opt_cat', label: 'Cat', is_correct: true },
      { id: 'opt_dog', label: 'Dog', is_correct: false },
      { id: 'opt_lion', label: 'Lion', is_correct: false },
    ],
  },
  'LKG General Knowledge - Colours and Objects': {
    title: 'Which animal sound is this?',
    instruction: 'Listen and choose the right animal.',
    audio: '/media/sounds/dog.mp3',
    options: [
      { id: 'opt_dog', label: 'Dog', is_correct: true },
      { id: 'opt_cat', label: 'Cat', is_correct: false },
      { id: 'opt_cow', label: 'Cow', is_correct: false },
    ],
  },
  'LKG General Knowledge - Transport and Festivals': {
    title: 'Which festival sound is this?',
    instruction: 'Listen and choose what you hear.',
    audio: '/media/sounds/drum.mp3',
    options: [
      { id: 'opt_drum', label: 'Drum', is_correct: true },
      { id: 'opt_train', label: 'Train', is_correct: false },
      { id: 'opt_bell', label: 'Bell', is_correct: false },
    ],
  },
};

async function main() {
  const pool = new Pool({ user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'els_ai_db' });
  let updated = 0;
  try {
    for (const [quizTitle, spec] of Object.entries(PLAN)) {
      const rows = (await pool.query(
        `SELECT x.id, x.question_data FROM quiz_questions x JOIN quizzes q ON q.id = x.quiz_id
          WHERE q.title = $1 AND x.question_type = 'guess_audio'`,
        [quizTitle],
      )).rows;
      if (!rows.length) { console.log(`! no guess_audio row for "${quizTitle}"`); continue; }
      for (const row of rows) {
        const meta = (row.question_data && row.question_data._meta) || undefined;
        const newData = meta ? { _meta: meta, options: spec.options } : { options: spec.options };
        await pool.query(
          `UPDATE quiz_questions SET question_title = $1, question_instruction = $2, question_audio = $3, question_data = $4::jsonb WHERE id = $5`,
          [spec.title, spec.instruction, spec.audio, JSON.stringify(newData), row.id],
        );
        updated++;
        console.log(`  ✓ ${quizTitle} -> ${spec.title}  (${spec.audio})`);
      }
    }
    console.log(`\nDone. updated=${updated}`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
