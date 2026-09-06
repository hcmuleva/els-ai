#!/usr/bin/env node
/**
 * Kothnuru "Global Class" seeder.
 *
 * Creates, for every class in [1, 2, 4, 5, 6, 8, 9, 10, 11, 12]:
 *   - 2 NEW learning_contents (each with summary + YouTube + activity);
 *     titles are prefixed "Class <N> - ..." so it is obvious which class.
 *   - 2 NEW quizzes (5 easy questions each) with the same "Class <N> - ..." prefix.
 *   - A classroom titled "Kothnuru Global Class" (instant, durationMinutes=60)
 *     attaching that class's 2 new contents + 2 new quizzes + 2 assignments
 *     written for that class level.
 *
 * The questions and content are intentionally easy / introductory so a student
 * who is new to the topic can answer without getting stuck.
 *
 * Idempotent: existing rows (by exact title within Kothnuru org) are skipped.
 *
 *   GATEWAY  default http://localhost:4000
 *   LOGIN_ID default teacher@kothnuru.ai
 *   LOGIN_PW default welcome
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@kothnuru.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';
const CLASSROOM_TITLE = 'Kothnuru Global Class';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}
const reason = (r) => {
  const j = r && r.json;
  if (!j) return `status ${r ? r.status : '??'}`;
  if (j.errors) return `status ${r.status}: ${JSON.stringify(j.errors).slice(0, 240)}`;
  return `status ${r.status}: ${j.message || JSON.stringify(j).slice(0, 200)}`;
};

const sc = (opts) => ({ options: opts.map((o) => ({ id: 'opt_' + o.k, label: o.l, is_correct: !!o.c })) });
const tf = (correct) => ({ options: [
  { id: 'opt_true', label: 'True', is_correct: correct },
  { id: 'opt_false', label: 'False', is_correct: !correct },
] });

// ───────────────────────── EASY-TO-UNDERSTAND CURRICULUM ─────────────────────────
// Every entry: 2 lessons + 2 assignments per class. All language is simple.
const CURRICULUM = {
  '1': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Place Value: Tens and Ones',
        summary: 'Numbers can be split into tens and ones. The number 23 has 2 tens and 3 ones. Tens are bundles of ten and ones are single units.',
        activity: 'Take 23 small sticks. Make 2 bundles of 10 sticks each. The 3 left over are the ones.',
        youtube: ['https://www.youtube.com/watch?v=uS5IiKAh-bM'],
        questions: [
          { type: 'single_choice', title: 'How many ones are in the number 14?', data: sc([{ k: '4', l: '4', c: true }, { k: '1', l: '1' }, { k: '14', l: '14' }, { k: '5', l: '5' }]) },
          { type: 'single_choice', title: 'How many tens are in the number 30?', data: sc([{ k: '3', l: '3', c: true }, { k: '0', l: '0' }, { k: '30', l: '30' }, { k: '10', l: '10' }]) },
          { type: 'true_false', title: 'The number 25 has 2 tens and 5 ones.', data: tf(true) },
          { type: 'single_choice', title: 'Which number has 4 tens and 2 ones?', data: sc([{ k: '42', l: '42', c: true }, { k: '24', l: '24' }, { k: '6', l: '6' }, { k: '402', l: '402' }]) },
          { type: 'true_false', title: 'A bundle of 10 sticks is called "one ten".', data: tf(true) },
        ],
      },
      {
        subject: 'English',
        topic: 'Vowels and Consonants',
        summary: 'The English alphabet has 26 letters. Five of them are vowels: A, E, I, O, U. The other 21 letters are consonants.',
        activity: 'Write your name. Circle the vowels in your name. How many vowels did you find?',
        youtube: ['https://www.youtube.com/watch?v=hUIFEIzljPM'],
        questions: [
          { type: 'single_choice', title: 'Which one is a vowel?', data: sc([{ k: 'a', l: 'A', c: true }, { k: 'b', l: 'B' }, { k: 'c', l: 'C' }, { k: 'd', l: 'D' }]) },
          { type: 'single_choice', title: 'How many vowels are in the English alphabet?', data: sc([{ k: '5', l: '5', c: true }, { k: '6', l: '6' }, { k: '21', l: '21' }, { k: '26', l: '26' }]) },
          { type: 'true_false', title: 'B is a consonant.', data: tf(true) },
          { type: 'single_choice', title: 'Pick the word that starts with a vowel.', data: sc([{ k: 'apple', l: 'Apple', c: true }, { k: 'cat', l: 'Cat' }, { k: 'dog', l: 'Dog' }, { k: 'sun', l: 'Sun' }]) },
          { type: 'true_false', title: 'O is a vowel.', data: tf(true) },
        ],
      },
    ],
    assignments: [
      { title: 'Trace numbers 1 to 50', description: 'Number tracing practice.', instructions: 'In your notebook, write the numbers from 1 to 50 neatly. Show your work to a parent.', isTimeBound: false },
      { title: 'Read five vowel words aloud', description: 'Vowel sounds practice.', instructions: 'Find five things at home whose name starts with a vowel (apple, egg, ice, orange, umbrella). Say each word out loud.', isTimeBound: false },
    ],
  },

  '2': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Subtraction up to 100',
        summary: 'Subtraction means taking away. If you have 12 apples and you eat 4, you have 8 left. We write this as 12 - 4 = 8.',
        activity: 'Get 20 small objects. Take away 7. Count what is left. Write the subtraction.',
        youtube: ['https://www.youtube.com/watch?v=raoP4cJ4nJI'],
        questions: [
          { type: 'single_choice', title: 'What is 15 - 7?', data: sc([{ k: '8', l: '8', c: true }, { k: '7', l: '7' }, { k: '9', l: '9' }, { k: '6', l: '6' }]) },
          { type: 'single_choice', title: 'What is 30 - 10?', data: sc([{ k: '20', l: '20', c: true }, { k: '10', l: '10' }, { k: '40', l: '40' }, { k: '30', l: '30' }]) },
          { type: 'single_choice', title: 'Riya has 18 sweets. She gives 5 to her friend. How many are left?', data: sc([{ k: '13', l: '13', c: true }, { k: '12', l: '12' }, { k: '23', l: '23' }, { k: '14', l: '14' }]) },
          { type: 'true_false', title: '20 - 5 equals 15.', data: tf(true) },
          { type: 'single_choice', title: 'What is 50 - 25?', data: sc([{ k: '25', l: '25', c: true }, { k: '15', l: '15' }, { k: '35', l: '35' }, { k: '75', l: '75' }]) },
        ],
      },
      {
        subject: 'English',
        topic: 'Reading Short Sentences',
        summary: 'A sentence is a group of words that tells a complete idea. It starts with a capital letter and ends with a full stop. Example: "The cat is happy."',
        activity: 'Write three short sentences about your family. Each sentence should start with a capital letter and end with a full stop.',
        youtube: ['https://www.youtube.com/watch?v=qD1pnquN_DM'],
        questions: [
          { type: 'single_choice', title: 'A sentence ends with which mark?', data: sc([{ k: 'fullstop', l: 'A full stop (.)', c: true }, { k: 'comma', l: 'A comma' }, { k: 'space', l: 'A space' }, { k: 'plus', l: 'A plus sign' }]) },
          { type: 'single_choice', title: 'A sentence starts with what kind of letter?', data: sc([{ k: 'capital', l: 'A capital letter', c: true }, { k: 'small', l: 'A small letter' }, { k: 'number', l: 'A number' }]) },
          { type: 'true_false', title: '"The dog runs fast." is a sentence.', data: tf(true) },
          { type: 'single_choice', title: 'Which is a complete sentence?', data: sc([{ k: 'cathappy', l: 'The cat is happy.', c: true }, { k: 'happy', l: 'happy.' }, { k: 'cat', l: 'cat the' }]) },
          { type: 'true_false', title: 'A sentence must have meaning.', data: tf(true) },
        ],
      },
    ],
    assignments: [
      { title: 'Solve 20 subtraction sums', description: 'Subtraction practice.', instructions: 'In your notebook, write and solve 20 subtraction problems with numbers up to 100.', isTimeBound: false },
      { title: 'Write 5 sentences about your family', description: 'Sentence writing practice.', instructions: 'Write 5 sentences about people in your family. Use a capital letter and a full stop in each.', isTimeBound: false },
    ],
  },

  '4': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Division Basics',
        summary: 'Division is sharing equally. If 12 sweets are shared by 3 friends, each friend gets 4 sweets. We write this as 12 / 3 = 4.',
        activity: 'Take 20 pebbles. Share them equally between 4 friends (or imagine 4 friends). How many does each get?',
        youtube: ['https://www.youtube.com/watch?v=KGMf314LUc0'],
        questions: [
          { type: 'single_choice', title: '12 / 3 = ?', data: sc([{ k: '4', l: '4', c: true }, { k: '3', l: '3' }, { k: '9', l: '9' }, { k: '15', l: '15' }]) },
          { type: 'single_choice', title: '20 / 5 = ?', data: sc([{ k: '4', l: '4', c: true }, { k: '5', l: '5' }, { k: '15', l: '15' }, { k: '25', l: '25' }]) },
          { type: 'single_choice', title: '24 sweets shared by 6 children. Each child gets:', data: sc([{ k: '4', l: '4', c: true }, { k: '6', l: '6' }, { k: '24', l: '24' }, { k: '3', l: '3' }]) },
          { type: 'true_false', title: 'Division is the opposite of multiplication.', data: tf(true) },
          { type: 'single_choice', title: '36 / 4 = ?', data: sc([{ k: '9', l: '9', c: true }, { k: '8', l: '8' }, { k: '12', l: '12' }, { k: '6', l: '6' }]) },
        ],
      },
      {
        subject: 'English',
        topic: 'Past, Present and Future Tense',
        summary: 'Tenses tell us when something happens. "I play" is present (now). "I played" is past (already happened). "I will play" is future (going to happen).',
        activity: 'Write three sentences: one for what you did yesterday, one for what you do now, and one for what you will do tomorrow.',
        youtube: ['https://www.youtube.com/watch?v=GS2FTTtq05g'],
        questions: [
          { type: 'single_choice', title: '"I played football yesterday." is in which tense?', data: sc([{ k: 'past', l: 'Past', c: true }, { k: 'present', l: 'Present' }, { k: 'future', l: 'Future' }]) },
          { type: 'single_choice', title: '"I will eat lunch." is in which tense?', data: sc([{ k: 'future', l: 'Future', c: true }, { k: 'past', l: 'Past' }, { k: 'present', l: 'Present' }]) },
          { type: 'true_false', title: '"She is reading a book." is present tense.', data: tf(true) },
          { type: 'single_choice', title: 'Which sentence is in past tense?', data: sc([{ k: 'walked', l: 'I walked to school.', c: true }, { k: 'walk', l: 'I walk to school.' }, { k: 'willwalk', l: 'I will walk to school.' }]) },
          { type: 'true_false', title: 'Future tense talks about something that has already happened.', data: tf(false) },
        ],
      },
    ],
    assignments: [
      { title: 'Solve 15 division problems', description: 'Division practice.', instructions: 'Solve 15 division problems in your notebook (e.g., 12/3, 20/4, 36/6). Show all your work.', isTimeBound: false },
      { title: 'Write a paragraph using all three tenses', description: 'Tense practice.', instructions: 'Write a short 6-sentence paragraph about your day. Use past, present and future tenses.', isTimeBound: false },
    ],
  },

  '5': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Lines and Angles (Easy Start)',
        summary: 'A line goes on and on. A line segment has two end points. An angle is formed when two lines meet at a point. A right angle is like the corner of a book - it is 90 degrees.',
        activity: 'Look around your room and find 5 right angles (book corners, table corners, door corners). Sketch each one.',
        youtube: ['https://www.youtube.com/watch?v=NLk5W9JC8N0'],
        questions: [
          { type: 'single_choice', title: 'A right angle is exactly:', data: sc([{ k: '90', l: '90 degrees', c: true }, { k: '45', l: '45 degrees' }, { k: '180', l: '180 degrees' }, { k: '60', l: '60 degrees' }]) },
          { type: 'single_choice', title: 'A line segment has:', data: sc([{ k: '2end', l: '2 end points', c: true }, { k: 'noend', l: 'No end points' }, { k: '1end', l: '1 end point' }, { k: '3end', l: '3 end points' }]) },
          { type: 'true_false', title: 'The corner of a book is a right angle.', data: tf(true) },
          { type: 'single_choice', title: 'When two lines meet at a point, they form:', data: sc([{ k: 'angle', l: 'An angle', c: true }, { k: 'circle', l: 'A circle' }, { k: 'square', l: 'A square' }]) },
          { type: 'true_false', title: 'An angle smaller than 90 degrees is called acute.', data: tf(true) },
        ],
      },
      {
        subject: 'Environmental Studies (EVS)',
        topic: 'Plants and Animals - Living Things',
        summary: 'Plants and animals are living things. They grow, eat, breathe and have babies. Plants make their own food using sunlight. Animals eat plants or other animals.',
        activity: 'Make two columns - "Plants" and "Animals". List 5 things in each column that you can see near your home.',
        youtube: ['https://www.youtube.com/watch?v=p51FiPO2_kQ'],
        questions: [
          { type: 'single_choice', title: 'Which one is a living thing?', data: sc([{ k: 'tree', l: 'A tree', c: true }, { k: 'rock', l: 'A rock' }, { k: 'cup', l: 'A cup' }, { k: 'pen', l: 'A pen' }]) },
          { type: 'single_choice', title: 'Plants make their own food using:', data: sc([{ k: 'sun', l: 'Sunlight, water and air', c: true }, { k: 'milk', l: 'Milk' }, { k: 'oil', l: 'Cooking oil' }]) },
          { type: 'true_false', title: 'Animals can grow and have babies.', data: tf(true) },
          { type: 'single_choice', title: 'Which is NOT a living thing?', data: sc([{ k: 'chair', l: 'A chair', c: true }, { k: 'cat', l: 'A cat' }, { k: 'flower', l: 'A flower' }, { k: 'human', l: 'A human' }]) },
          { type: 'true_false', title: 'A rock breathes and grows.', data: tf(false) },
        ],
      },
    ],
    assignments: [
      { title: 'Draw 4 types of angles', description: 'Geometry sketching.', instructions: 'Draw a right angle, an acute angle, an obtuse angle and a straight angle. Label each one.', isTimeBound: false },
      { title: 'Living vs non-living chart', description: 'Classification activity.', instructions: 'Make a chart with two columns - Living and Non-living. List 8 things in each column.', isTimeBound: false },
    ],
  },

  '6': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Decimals - The Easy Way',
        summary: 'A decimal is just another way to write a fraction. The dot is called the decimal point. 0.5 means "half" and is the same as 1/2. 0.25 is the same as 1/4.',
        activity: 'Take a chocolate bar with 10 squares. Eat 3 squares. You have eaten 0.3 of the bar. Write what you have eaten as a fraction too.',
        youtube: ['https://www.youtube.com/watch?v=xAeM1Iex_TY'],
        questions: [
          { type: 'single_choice', title: '0.5 is the same as which fraction?', data: sc([{ k: '12', l: '1/2', c: true }, { k: '14', l: '1/4' }, { k: '15', l: '1/5' }, { k: '13', l: '1/3' }]) },
          { type: 'single_choice', title: 'What is 0.25 as a fraction?', data: sc([{ k: '14', l: '1/4', c: true }, { k: '12', l: '1/2' }, { k: '34', l: '3/4' }, { k: '15', l: '1/5' }]) },
          { type: 'true_false', title: '0.1 is the same as 1/10.', data: tf(true) },
          { type: 'single_choice', title: 'Which is bigger: 0.7 or 0.3?', data: sc([{ k: '07', l: '0.7', c: true }, { k: '03', l: '0.3' }]) },
          { type: 'single_choice', title: '0.5 + 0.5 = ?', data: sc([{ k: '1', l: '1', c: true }, { k: '0.10', l: '0.10' }, { k: '5.5', l: '5.5' }, { k: '0.5', l: '0.5' }]) },
        ],
      },
      {
        subject: 'Science',
        topic: 'Air Around Us',
        summary: 'Air is all around us, even though we cannot see it. We need air to breathe. Air is a mixture of many gases - oxygen is the one we use when we breathe in.',
        activity: 'Hold a piece of paper. Wave it. You feel a breeze. That breeze is moving air. Try blowing into a balloon - the balloon fills with air.',
        youtube: ['https://www.youtube.com/watch?v=Re2C2hAFvCo'],
        questions: [
          { type: 'single_choice', title: 'Which gas in air do we use when we breathe?', data: sc([{ k: 'o2', l: 'Oxygen', c: true }, { k: 'co2', l: 'Carbon dioxide' }, { k: 'h', l: 'Hydrogen' }, { k: 'he', l: 'Helium' }]) },
          { type: 'true_false', title: 'Air takes up space (it has volume).', data: tf(true) },
          { type: 'single_choice', title: 'A balloon fills up because we blow ___ into it.', data: sc([{ k: 'air', l: 'air', c: true }, { k: 'water', l: 'water' }, { k: 'oil', l: 'oil' }]) },
          { type: 'true_false', title: 'We can see air with our eyes.', data: tf(false) },
          { type: 'single_choice', title: 'Wind is:', data: sc([{ k: 'moving', l: 'Moving air', c: true }, { k: 'still', l: 'Still air' }, { k: 'water', l: 'Moving water' }]) },
        ],
      },
    ],
    assignments: [
      { title: 'Convert 10 fractions to decimals', description: 'Number practice.', instructions: 'Convert these fractions to decimals: 1/2, 1/4, 3/4, 1/5, 2/5, 1/10, 3/10, 7/10, 1/100, 25/100.', isTimeBound: false },
      { title: 'Air investigation', description: 'Hands-on science.', instructions: 'Find 3 things at home that prove air is real (e.g. a balloon, a fan, a pinwheel). Describe each in 2 sentences.', isTimeBound: false },
    ],
  },

  '8': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Algebra: Letters in Maths',
        summary: 'In algebra we use letters like x and y to stand for numbers we do not know yet. If x + 3 = 7, what is x? Take 3 away from both sides: x = 4.',
        activity: 'Solve these in your head: x + 5 = 12, y - 2 = 10, 2x = 14. Write each step.',
        youtube: ['https://www.youtube.com/watch?v=NybHckSEQBI'],
        questions: [
          { type: 'single_choice', title: 'If x + 3 = 7, what is x?', data: sc([{ k: '4', l: '4', c: true }, { k: '10', l: '10' }, { k: '3', l: '3' }, { k: '7', l: '7' }]) },
          { type: 'single_choice', title: 'If y - 2 = 5, what is y?', data: sc([{ k: '7', l: '7', c: true }, { k: '3', l: '3' }, { k: '5', l: '5' }, { k: '10', l: '10' }]) },
          { type: 'single_choice', title: 'If 2x = 10, what is x?', data: sc([{ k: '5', l: '5', c: true }, { k: '10', l: '10' }, { k: '2', l: '2' }, { k: '20', l: '20' }]) },
          { type: 'true_false', title: 'In x + 4 = 9, x = 5.', data: tf(true) },
          { type: 'single_choice', title: 'A letter that stands for a number is called:', data: sc([{ k: 'var', l: 'A variable', c: true }, { k: 'num', l: 'A number' }, { k: 'op', l: 'An operation' }]) },
        ],
      },
      {
        subject: 'Science',
        topic: 'Sound: How We Hear',
        summary: 'Sound is made when something vibrates (shakes very fast). The vibrations travel through the air to our ears, and our brain understands them as sound.',
        activity: 'Place your fingers gently on your throat and hum a song. You will feel vibrations - that is how sound is made.',
        youtube: ['https://www.youtube.com/watch?v=W23pwjrOFHM'],
        questions: [
          { type: 'single_choice', title: 'Sound is made by:', data: sc([{ k: 'vib', l: 'Vibrations', c: true }, { k: 'light', l: 'Light' }, { k: 'heat', l: 'Heat' }, { k: 'water', l: 'Water' }]) },
          { type: 'single_choice', title: 'Sound travels through:', data: sc([{ k: 'air', l: 'Air, water and solids', c: true }, { k: 'noair', l: 'Empty space (vacuum)' }, { k: 'colour', l: 'Colours' }]) },
          { type: 'true_false', title: 'When you talk, your vocal cords vibrate.', data: tf(true) },
          { type: 'true_false', title: 'Sound can travel in empty space.', data: tf(false) },
          { type: 'single_choice', title: 'A part of the body that helps us hear:', data: sc([{ k: 'ear', l: 'Ears', c: true }, { k: 'eyes', l: 'Eyes' }, { k: 'nose', l: 'Nose' }, { k: 'hair', l: 'Hair' }]) },
        ],
      },
    ],
    assignments: [
      { title: 'Solve 10 simple equations', description: 'Algebra warm-up.', instructions: 'Solve: x+5=11, x-3=8, 2x=12, x+10=20, 3x=9, x-7=4, 4x=20, x+1=2, x-1=0, 5x=25.', isTimeBound: false },
      { title: 'Sound experiment', description: 'Hands-on science.', instructions: 'Stretch a rubber band between two fingers and pluck it. Note the sound. Make it tighter and pluck again. How does the sound change? Write 3 sentences.', isTimeBound: false },
    ],
  },

  '9': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Coordinate Geometry (Easy Intro)',
        summary: 'On a graph paper we have two lines that cross each other - the X-axis (going across) and the Y-axis (going up and down). Any point can be written as (x, y). The point (3, 2) means: 3 steps right, then 2 steps up.',
        activity: 'On graph paper, mark the points (1, 1), (3, 2), (0, 4), (2, 0). Join them in order to see what shape they make.',
        youtube: ['https://www.youtube.com/watch?v=ZG_qCK6cxJ4'],
        questions: [
          { type: 'single_choice', title: 'The point (3, 2) means:', data: sc([{ k: '3r2u', l: '3 right, 2 up', c: true }, { k: '2r3u', l: '2 right, 3 up' }, { k: '5up', l: '5 up' }, { k: 'origin', l: 'The origin' }]) },
          { type: 'single_choice', title: 'The horizontal line is called the:', data: sc([{ k: 'x', l: 'X-axis', c: true }, { k: 'y', l: 'Y-axis' }, { k: 'z', l: 'Z-axis' }]) },
          { type: 'single_choice', title: 'The point where X-axis and Y-axis cross is called:', data: sc([{ k: 'origin', l: 'Origin (0, 0)', c: true }, { k: 'top', l: 'Top' }, { k: 'corner', l: 'Corner' }, { k: 'side', l: 'Side' }]) },
          { type: 'true_false', title: 'The point (0, 0) is called the origin.', data: tf(true) },
          { type: 'single_choice', title: 'In (5, 7) which number tells how far up to go?', data: sc([{ k: '7', l: '7', c: true }, { k: '5', l: '5' }, { k: '12', l: '12' }, { k: '0', l: '0' }]) },
        ],
      },
      {
        subject: 'Science (Physics, Chemistry, Biology)',
        topic: 'Force: Push and Pull',
        summary: 'A force is a push or a pull. When you kick a ball, you push it. When you open a drawer, you pull it. Forces can make things move, stop, or change direction.',
        activity: 'Push a book across a smooth table. Then push it across a rough cloth. Which moves easier? That is friction at work.',
        youtube: ['https://www.youtube.com/watch?v=zOI-3rFjXvU'],
        questions: [
          { type: 'single_choice', title: 'A force is a:', data: sc([{ k: 'pushpull', l: 'Push or pull', c: true }, { k: 'colour', l: 'Colour' }, { k: 'sound', l: 'Sound' }]) },
          { type: 'single_choice', title: 'Kicking a football is an example of a:', data: sc([{ k: 'push', l: 'Push', c: true }, { k: 'colour', l: 'Colour' }, { k: 'pull', l: 'Pull' }, { k: 'noise', l: 'Noise' }]) },
          { type: 'true_false', title: 'Forces can make things stop.', data: tf(true) },
          { type: 'single_choice', title: 'Pulling a drawer to open it is a:', data: sc([{ k: 'pull', l: 'Pull', c: true }, { k: 'push', l: 'Push' }, { k: 'twist', l: 'Twist' }]) },
          { type: 'true_false', title: 'Friction is a force that slows things down.', data: tf(true) },
        ],
      },
    ],
    assignments: [
      { title: 'Plot a shape on graph paper', description: 'Coordinate practice.', instructions: 'Plot the points (1,1), (1,4), (4,4), (4,1) and join them. Name the shape you see.', isTimeBound: false },
      { title: 'Find 5 forces around you', description: 'Force observation.', instructions: 'Find 5 examples of pushes or pulls at home (e.g., closing a door, picking up a glass). Write each example in 1 sentence.', isTimeBound: false },
    ],
  },

  '10': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Trigonometry: Just the Basics',
        summary: 'In a right-angled triangle there are three sides: the hypotenuse (longest, opposite the right angle), the opposite side, and the adjacent side. The three basic ratios are sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent. SOH-CAH-TOA helps us remember.',
        activity: 'Draw a right-angled triangle. Label the three sides. If opposite=3 and hypotenuse=5, what is sin? (Answer: 3/5 = 0.6).',
        youtube: ['https://www.youtube.com/watch?v=F21S9Wpi0y8'],
        questions: [
          { type: 'single_choice', title: 'The longest side of a right triangle is called the:', data: sc([{ k: 'hyp', l: 'Hypotenuse', c: true }, { k: 'opp', l: 'Opposite' }, { k: 'adj', l: 'Adjacent' }, { k: 'base', l: 'Base' }]) },
          { type: 'single_choice', title: 'sin = ?', data: sc([{ k: 'oh', l: 'opposite / hypotenuse', c: true }, { k: 'ah', l: 'adjacent / hypotenuse' }, { k: 'oa', l: 'opposite / adjacent' }]) },
          { type: 'single_choice', title: 'cos = ?', data: sc([{ k: 'ah', l: 'adjacent / hypotenuse', c: true }, { k: 'oh', l: 'opposite / hypotenuse' }, { k: 'oa', l: 'opposite / adjacent' }]) },
          { type: 'true_false', title: 'tan equals opposite divided by adjacent.', data: tf(true) },
          { type: 'single_choice', title: 'In a right triangle with opposite=3 and hypotenuse=5, sin = ?', data: sc([{ k: '06', l: '0.6', c: true }, { k: '08', l: '0.8' }, { k: '15', l: '15' }, { k: '53', l: '5/3' }]) },
        ],
      },
      {
        subject: 'Science (Physics, Chemistry, Biology)',
        topic: 'Light: Reflection in Mirrors',
        summary: 'Light travels in straight lines. When light hits a mirror it bounces back - this is called reflection. The angle at which light hits the mirror equals the angle at which it bounces off.',
        activity: 'Hold a small mirror and a torch in a dark room. Shine the torch on the mirror at an angle and see where the light bounces.',
        youtube: ['https://www.youtube.com/watch?v=mvpYUlyqamw'],
        questions: [
          { type: 'single_choice', title: 'When light bounces off a mirror, it is called:', data: sc([{ k: 'refl', l: 'Reflection', c: true }, { k: 'absorp', l: 'Absorption' }, { k: 'refr', l: 'Refraction' }, { k: 'shadow', l: 'Shadow' }]) },
          { type: 'true_false', title: 'Light travels in straight lines.', data: tf(true) },
          { type: 'single_choice', title: 'The angle of incidence equals the angle of:', data: sc([{ k: 'refl', l: 'Reflection', c: true }, { k: 'rot', l: 'Rotation' }, { k: 'right', l: '90 degrees always' }]) },
          { type: 'single_choice', title: 'A flat mirror is also called a:', data: sc([{ k: 'plane', l: 'Plane mirror', c: true }, { k: 'curve', l: 'Curved mirror' }, { k: 'lens', l: 'Lens' }]) },
          { type: 'true_false', title: 'A shadow is formed because light cannot pass through some objects.', data: tf(true) },
        ],
      },
    ],
    assignments: [
      { title: 'Trig ratio practice', description: 'Trigonometry practice.', instructions: 'For a right triangle with opposite=4, adjacent=3, hypotenuse=5, find sin, cos and tan. Show your work.', isTimeBound: false },
      { title: 'Mirror experiment notebook', description: 'Light experiment.', instructions: 'Use a small mirror and a torch. Shine the torch at 3 different angles. Sketch the path of light each time.', isTimeBound: false },
    ],
  },

  '11': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Sequences and Patterns',
        summary: 'A sequence is a list of numbers in order, like 2, 4, 6, 8, ... Each number follows a rule. In this list the rule is "add 2". When all the differences are equal, it is called an arithmetic sequence.',
        activity: 'Find the next 3 numbers in: 5, 10, 15, 20, ___, ___, ___. Write the rule.',
        youtube: ['https://www.youtube.com/watch?v=jExpsJTu9o8'],
        questions: [
          { type: 'single_choice', title: 'What comes next in 2, 4, 6, 8, ___?', data: sc([{ k: '10', l: '10', c: true }, { k: '12', l: '12' }, { k: '9', l: '9' }, { k: '16', l: '16' }]) },
          { type: 'single_choice', title: 'The rule for 3, 6, 9, 12, ... is:', data: sc([{ k: 'add3', l: 'Add 3', c: true }, { k: 'add2', l: 'Add 2' }, { k: 'mul', l: 'Multiply by 2' }, { k: 'sub', l: 'Subtract 3' }]) },
          { type: 'single_choice', title: 'A sequence with the same difference between terms is called:', data: sc([{ k: 'arith', l: 'Arithmetic sequence', c: true }, { k: 'random', l: 'Random' }, { k: 'geom', l: 'Geometric only' }]) },
          { type: 'true_false', title: '10, 8, 6, 4 is a sequence with rule "subtract 2".', data: tf(true) },
          { type: 'single_choice', title: 'Next term after 1, 4, 7, 10 is:', data: sc([{ k: '13', l: '13', c: true }, { k: '11', l: '11' }, { k: '14', l: '14' }, { k: '20', l: '20' }]) },
        ],
      },
      {
        subject: 'Physics',
        topic: 'Newton\'s First Law: Inertia',
        summary: 'Newton\'s first law says: an object at rest stays at rest, and an object moving in a straight line keeps moving at the same speed, unless a force acts on it. This tendency to keep doing what it is doing is called inertia.',
        activity: 'Place a book on a table. It does not move on its own. Now push it gently and it slides. The push is the force.',
        youtube: ['https://www.youtube.com/watch?v=CQYELiTtUs8'],
        questions: [
          { type: 'single_choice', title: 'The tendency of an object to keep doing what it is doing is called:', data: sc([{ k: 'inertia', l: 'Inertia', c: true }, { k: 'energy', l: 'Energy' }, { k: 'mass', l: 'Mass' }, { k: 'speed', l: 'Speed' }]) },
          { type: 'single_choice', title: 'A still object will only start moving when a ___ acts on it.', data: sc([{ k: 'force', l: 'Force', c: true }, { k: 'colour', l: 'Colour' }, { k: 'sound', l: 'Sound' }]) },
          { type: 'true_false', title: 'Newton\'s first law is also called the law of inertia.', data: tf(true) },
          { type: 'single_choice', title: 'Heavier objects have:', data: sc([{ k: 'more', l: 'More inertia', c: true }, { k: 'less', l: 'Less inertia' }, { k: 'no', l: 'No inertia' }]) },
          { type: 'true_false', title: 'A bus suddenly stops; passengers jerk forward because of inertia.', data: tf(true) },
        ],
      },
    ],
    assignments: [
      { title: 'Pattern practice', description: 'Sequences exercise.', instructions: 'Continue these patterns by 3 terms each: (a) 5, 10, 15, ... (b) 100, 90, 80, ... (c) 1, 4, 9, 16, ... For each, write the rule.', isTimeBound: false },
      { title: 'Inertia in everyday life', description: 'Physics observation.', instructions: 'Find 3 examples of inertia in daily life (e.g. seat belts, dust on a carpet that comes off when shaken). Explain each in 2 sentences.', isTimeBound: false },
    ],
  },

  '12': {
    difficulty: 'easy',
    lessons: [
      {
        subject: 'Mathematics',
        topic: 'Integration: Sums That Never End',
        summary: 'Integration is the opposite of differentiation. It helps us find the total area under a curve. The simplest rule: the integral of x^n is x^(n+1)/(n+1) (when n is not -1). For example, the integral of x is x^2/2 + C, where C is a constant we add.',
        activity: 'Try these: integral of 2 dx (answer 2x + C), integral of x dx (answer x^2/2 + C), integral of x^2 dx (answer x^3/3 + C).',
        youtube: ['https://www.youtube.com/watch?v=__1JbE-fKi4'],
        questions: [
          { type: 'single_choice', title: 'The integral of 1 dx is:', data: sc([{ k: 'xc', l: 'x + C', c: true }, { k: '1c', l: '1 + C' }, { k: 'x2', l: 'x/2 + C' }, { k: '0', l: '0' }]) },
          { type: 'single_choice', title: 'The integral of x dx is:', data: sc([{ k: 'x22', l: 'x^2 / 2 + C', c: true }, { k: 'x', l: 'x + C' }, { k: 'x2', l: 'x^2 + C' }, { k: '1', l: '1 + C' }]) },
          { type: 'single_choice', title: 'The integral of x^2 dx is:', data: sc([{ k: 'x33', l: 'x^3 / 3 + C', c: true }, { k: 'x22', l: 'x^2 / 2 + C' }, { k: '2x', l: '2x + C' }, { k: 'x3', l: 'x^3 + C' }]) },
          { type: 'true_false', title: 'Integration is the opposite of differentiation.', data: tf(true) },
          { type: 'single_choice', title: 'The "+ C" in an integral stands for a:', data: sc([{ k: 'const', l: 'Constant of integration', c: true }, { k: 'var', l: 'Variable' }, { k: 'coef', l: 'Coefficient' }]) },
        ],
      },
      {
        subject: 'Physics',
        topic: 'Wave Optics: Light as a Wave',
        summary: 'Light behaves like a wave. Two waves can meet and add up (constructive) or cancel out (destructive) - this is called interference. We can see colourful patterns in soap bubbles because of interference.',
        activity: 'Look at a soap bubble or a thin oil film on water. The colours you see are from light waves interfering with each other.',
        youtube: ['https://www.youtube.com/watch?v=Iuv6hY6zsd0'],
        questions: [
          { type: 'single_choice', title: 'Light behaves like a:', data: sc([{ k: 'wave', l: 'Wave', c: true }, { k: 'rock', l: 'Rock' }, { k: 'liquid', l: 'Liquid' }]) },
          { type: 'single_choice', title: 'When two light waves add up to make a brighter light, this is:', data: sc([{ k: 'constr', l: 'Constructive interference', c: true }, { k: 'destr', l: 'Destructive interference' }, { k: 'refl', l: 'Reflection' }]) },
          { type: 'true_false', title: 'Soap bubbles show colours because of interference.', data: tf(true) },
          { type: 'single_choice', title: 'When two waves cancel each other out, it is called:', data: sc([{ k: 'destr', l: 'Destructive interference', c: true }, { k: 'constr', l: 'Constructive interference' }, { k: 'refl', l: 'Reflection' }]) },
          { type: 'true_false', title: 'Light cannot show interference.', data: tf(false) },
        ],
      },
    ],
    assignments: [
      { title: 'Easy integration practice', description: 'Calculus practice.', instructions: 'Integrate: (a) integral of 5 dx, (b) integral of 3x dx, (c) integral of x^3 dx, (d) integral of (x + 2) dx. Show all steps.', isTimeBound: false },
      { title: 'Wave optics observation', description: 'Physics observation.', instructions: 'Look at a soap bubble for 2 minutes. Note 3 different colours you see. Explain in 3 sentences why these colours appear (interference).', isTimeBound: false },
    ],
  },
};

// ───────────────────────────── DRIVER ─────────────────────────────
async function main() {
  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json?.accessToken) {
    console.error(`Login failed: ${reason(login)}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  const orgId = login.json.user?.organizationId;
  console.log(`Logged in as ${LOGIN_ID} (role ${login.json.user?.activeRole}) -> org ${orgId}\n`);

  const report = {
    org: orgId,
    classes: [],
    totals: { contents: 0, quizzes: 0, questions: 0, classrooms: 0, failures: 0 },
    failures: [],
  };

  for (const classLevel of Object.keys(CURRICULUM)) {
    const plan = CURRICULUM[classLevel];
    console.log(`\n═══════════════ Class ${classLevel} ═══════════════`);

    const contentIds = [];
    const quizIds = [];

    // existing topics + quizzes for idempotency
    const existingTopicsRes = await http('GET', `${GATEWAY}/topics?class_level=${encodeURIComponent(classLevel)}&limit=500`, token);
    const existingTopics = existingTopicsRes.ok ? (existingTopicsRes.json?.topics || []) : [];
    const existingQuizzesRes = await http('GET', `${GATEWAY}/quizzes/teacher/library?class_level=${encodeURIComponent(classLevel)}&limit=500`, token);
    const existingQuizzes = existingQuizzesRes.ok ? (existingQuizzesRes.json?.quizzes || []) : [];

    for (const lesson of plan.lessons) {
      const labeledTopic = `Class ${classLevel} - ${lesson.topic}`;
      const labeledQuiz = `Class ${classLevel} - ${lesson.topic} Quiz`;
      console.log(`\n  • ${labeledTopic}`);

      // 1) topic
      let topicId = null;
      const matchTopic = existingTopics.find((t) => t.title === labeledTopic);
      if (matchTopic) {
        topicId = matchTopic.id;
        console.log(`    - topic exists -> ${topicId}`);
      } else {
        const r = await http('POST', `${GATEWAY}/topics`, token, {
          classLevel, subject: lesson.subject, title: labeledTopic, isGlobal: false,
        });
        if (r.ok && r.json?.id) {
          topicId = r.json.id;
          console.log(`    ✓ topic -> ${topicId}`);
        } else {
          console.error(`    x topic create failed: ${reason(r)}`);
          report.failures.push({ stage: 'topic', classLevel, title: labeledTopic, reason: reason(r) });
          report.totals.failures++;
          continue;
        }
      }

      // 2) content
      const sections = [
        { title: 'Summary', contentType: 'text', textContent: lesson.summary },
        ...(lesson.youtube || []).map((url, i) => ({ title: `Watch & Learn ${i + 1}`, contentType: 'youtube_url', externalUrl: url })),
        { title: 'Classroom Activity', contentType: 'text', textContent: lesson.activity },
      ];
      const contentRes = await http('POST', `${GATEWAY}/content/items`, token, {
        classLevel, subject: lesson.subject, topicId, title: labeledTopic, sections, isGlobal: false,
      });
      if (contentRes.ok && contentRes.json?.id) {
        contentIds.push(contentRes.json.id);
        report.totals.contents++;
        console.log(`    ✓ content (${sections.length} sections) -> ${contentRes.json.id}`);
      } else {
        console.error(`    x content failed: ${reason(contentRes)}`);
        report.failures.push({ stage: 'content', classLevel, title: labeledTopic, reason: reason(contentRes) });
        report.totals.failures++;
      }

      // 3) quiz + questions
      let quizId = null;
      const matchQuiz = existingQuizzes.find((q) => q.title === labeledQuiz);
      if (matchQuiz) {
        quizId = matchQuiz.id;
        console.log(`    - quiz exists -> ${quizId}`);
      } else {
        const qres = await http('POST', `${GATEWAY}/quizzes`, token, {
          title: labeledQuiz,
          description: `An easy quiz on ${lesson.topic} for Class ${classLevel}.`,
          classLevel, subject: lesson.subject,
          quizType: 'single_choice',
          difficultyLevel: plan.difficulty,
          theme: { learningContent: { topic: labeledTopic, subject: lesson.subject } },
          isPublished: true, isAiGenerated: true, isGlobal: false,
        });
        if (qres.ok && qres.json?.id) {
          quizId = qres.json.id;
          report.totals.quizzes++;
          console.log(`    ✓ quiz -> ${quizId}`);

          let qok = 0;
          for (let i = 0; i < lesson.questions.length; i++) {
            const q = lesson.questions[i];
            const qq = await http('POST', `${GATEWAY}/quizzes/${quizId}/questions`, token, {
              questionType: q.type,
              questionTitle: q.title,
              questionInstruction: 'Choose your answer.',
              questionData: q.data,
              points: 10, timeLimitSeconds: 30,
              sortOrder: i + 1,
            });
            if (qq.ok && qq.json?.id) { qok++; report.totals.questions++; }
            else {
              console.error(`      x question ${i + 1} failed: ${reason(qq)}`);
              report.failures.push({ stage: 'question', classLevel, title: labeledQuiz, sortOrder: i + 1, reason: reason(qq) });
              report.totals.failures++;
            }
          }
          console.log(`    ✓ questions: ${qok}/${lesson.questions.length}`);
        } else {
          console.error(`    x quiz create failed: ${reason(qres)}`);
          report.failures.push({ stage: 'quiz', classLevel, title: labeledQuiz, reason: reason(qres) });
          report.totals.failures++;
        }
      }
      if (quizId) {
        quizIds.push(quizId);
        await http('PUT', `${GATEWAY}/topics/${topicId}/quizzes`, token, { quizIds: [quizId] });
      }
    }

    // 4) classroom for this class titled "Kothnuru Global Class"
    const existingClassRes = await http('GET', `${GATEWAY}/classrooms?class_level=${encodeURIComponent(classLevel)}&limit=500`, token);
    const existingClass = existingClassRes.ok && (existingClassRes.json?.classrooms || []).find((c) => c.title === CLASSROOM_TITLE);
    let classroomId = null;
    if (existingClass) {
      classroomId = existingClass.id;
      console.log(`\n  - classroom exists -> ${classroomId}`);
    } else if (contentIds.length || quizIds.length) {
      const cls = await http('POST', `${GATEWAY}/classrooms`, token, {
        title: CLASSROOM_TITLE,
        description: `The Kothnuru Global Class for Class ${classLevel}: combined content, quizzes and assignments students can revisit anytime.`,
        scheduleType: 'instant',
        durationMinutes: 60,
        classLevel,
        contentIds,
        quizIds,
        assignments: plan.assignments,
      });
      if (cls.ok && cls.json?.classroom?.id) {
        classroomId = cls.json.classroom.id;
        report.totals.classrooms++;
        console.log(`\n  ✓ classroom -> ${classroomId} (assignments: ${cls.json.assignments?.length || 0})`);
      } else {
        console.error(`  x classroom create failed: ${reason(cls)}`);
        report.failures.push({ stage: 'classroom', classLevel, title: CLASSROOM_TITLE, reason: reason(cls) });
        report.totals.failures++;
      }
    }

    report.classes.push({ classLevel, contentIds, quizIds, classroomId });
    await sleep(120);
  }

  console.log('\n\n══════════════════ FINAL REPORT ══════════════════');
  console.log(`Org      : ${report.org}`);
  console.log(`Contents : ${report.totals.contents}`);
  console.log(`Quizzes  : ${report.totals.quizzes}`);
  console.log(`Questions: ${report.totals.questions}`);
  console.log(`Classrooms (Kothnuru Global Class): ${report.totals.classrooms}`);
  console.log(`Failures : ${report.totals.failures}`);
  if (report.failures.length) {
    console.log('\n-- Failures --');
    for (const f of report.failures) {
      console.log(`  [${f.stage}] class ${f.classLevel} / ${f.title}: ${f.reason}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'kothnuru_global_class_seed_result.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport written to scripts/kothnuru_global_class_seed_result.json`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
