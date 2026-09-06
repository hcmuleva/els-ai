#!/usr/bin/env node
/**
 * Kothnuru org curriculum seeder.
 *
 * For each class level in [1, 2, 4, 5, 6, 8, 9, 10, 11, 12], creates:
 *   - 2 topics (one per chosen subject) with class-appropriate difficulty
 *   - 1 learning_content per topic with summary + YouTube link(s) + activity
 *   - 1 quiz per topic with 5 questions (mix of single_choice + true_false)
 *   - 1 classroom (instant) attaching all that class's content + quizzes
 *   - 2 stories (1 live, 1 scheduled +3 days)
 *
 * Idempotent: existing topics/quizzes/classrooms/stories are reused/skipped.
 *
 * The Kothnuru org tag is implied by logging in as admin@kothnuru.ai (its JWT
 * carries organizationId = e1811769-...). All inserts are RLS-scoped to that org.
 *
 *   GATEWAY  default http://localhost:4000
 *   LOGIN_ID default admin@kothnuru.ai
 *   LOGIN_PW default welcome
 */

const fs = require('fs');
const path = require('path');

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@kothnuru.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';

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

// ───────────────────────────── CURRICULUM ─────────────────────────────
const CURRICULUM = {
  '1': {
    classroomTitle: 'Class 1 - Daily Foundation Class',
    classroomDescription: 'A friendly daily class for Class 1 covering counting and naming words.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Numbers 1 to 20',
        summary: 'In this lesson we count from 1 up to 20. We learn to say each number, write it, and count small groups of objects.',
        activity: 'Find 10 small things in your home (pencils, spoons, toys). Place them in two rows of 5 and count them out loud.',
        youtube: ['https://www.youtube.com/watch?v=DR-cfDsHCGA'],
        quizTitle: 'Numbers 1 to 20 - Class 1 Quiz',
        difficulty: 'easy',
        questions: [
          { type: 'single_choice', title: 'What number comes after 7?', data: sc([{ k: '8', l: '8', c: true }, { k: '9', l: '9' }, { k: '6', l: '6' }, { k: '10', l: '10' }]) },
          { type: 'single_choice', title: 'How many fingers are on one hand?', data: sc([{ k: '5', l: '5', c: true }, { k: '4', l: '4' }, { k: '6', l: '6' }, { k: '3', l: '3' }]) },
          { type: 'single_choice', title: 'Which is bigger: 14 or 9?', data: sc([{ k: '14', l: '14', c: true }, { k: '9', l: '9' }]) },
          { type: 'true_false', title: 'The number 12 comes before 11.', data: tf(false) },
          { type: 'single_choice', title: 'Count: ★ ★ ★ ★ ★ ★. How many stars?', data: sc([{ k: '6', l: '6', c: true }, { k: '5', l: '5' }, { k: '7', l: '7' }, { k: '4', l: '4' }]) },
        ],
      },
      {
        subject: 'English',
        title: 'Naming Words (Nouns)',
        summary: 'A naming word, or noun, is the name of a person, place, animal, or thing. "Dog", "Ravi", "school", and "ball" are all naming words.',
        activity: 'Look around your room. Write 5 things you can see. Each one is a naming word!',
        youtube: ['https://www.youtube.com/watch?v=-QzIS_oUbBo'],
        quizTitle: 'Naming Words - Class 1 Quiz',
        difficulty: 'easy',
        questions: [
          { type: 'single_choice', title: 'Which of these is a naming word?', data: sc([{ k: 'apple', l: 'apple', c: true }, { k: 'jump', l: 'jump' }, { k: 'red', l: 'red' }, { k: 'fast', l: 'fast' }]) },
          { type: 'single_choice', title: 'Pick the naming word for a place.', data: sc([{ k: 'school', l: 'school', c: true }, { k: 'happy', l: 'happy' }, { k: 'run', l: 'run' }]) },
          { type: 'true_false', title: '"Dog" is a naming word.', data: tf(true) },
          { type: 'single_choice', title: 'Which is the name of a person?', data: sc([{ k: 'priya', l: 'Priya', c: true }, { k: 'cup', l: 'Cup' }, { k: 'mango', l: 'Mango' }]) },
          { type: 'true_false', title: '"Run" is a naming word.', data: tf(false) },
        ],
      },
    ],
    stories: [
      {
        title: 'The Hare and the Tortoise',
        description: 'A speedy hare and a slow tortoise discover what really wins a race.',
        intro: 'A proud hare laughed at a slow tortoise. "I can run faster than anyone!" he boasted. The tortoise smiled and said, "Let us race."',
        body: 'The hare zoomed ahead, then took a nap. The tortoise walked on, slow and steady, and crossed the line first. Slow and steady wins the race!',
        transition: 'live',
      },
      {
        title: 'The Honest Woodcutter',
        description: 'Honesty is the best gift of all.',
        intro: 'A poor woodcutter dropped his axe in a river. A kind fairy showed him a gold axe and a silver axe.',
        body: 'The woodcutter said, "Neither is mine." The fairy was so happy with his honesty that she gave him all three axes.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '2': {
    classroomTitle: 'Class 2 - Daily Practice Class',
    classroomDescription: 'A daily class for Class 2 covering simple addition and action words.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Addition up to 100',
        summary: 'When we add two numbers we put them together and count the total. 23 + 14 = 37. We can add tens with tens and ones with ones.',
        activity: 'Roll two dice. Add the numbers. Do this 10 times and write each total.',
        youtube: ['https://www.youtube.com/watch?v=AuX7nPBqDts'],
        quizTitle: 'Addition - Class 2 Quiz',
        difficulty: 'easy',
        questions: [
          { type: 'single_choice', title: 'What is 12 + 7?', data: sc([{ k: '19', l: '19', c: true }, { k: '17', l: '17' }, { k: '21', l: '21' }, { k: '18', l: '18' }]) },
          { type: 'single_choice', title: 'What is 25 + 30?', data: sc([{ k: '55', l: '55', c: true }, { k: '45', l: '45' }, { k: '50', l: '50' }, { k: '60', l: '60' }]) },
          { type: 'single_choice', title: '40 + 22 = ?', data: sc([{ k: '62', l: '62', c: true }, { k: '52', l: '52' }, { k: '72', l: '72' }]) },
          { type: 'true_false', title: '14 + 6 equals 20.', data: tf(true) },
          { type: 'single_choice', title: 'Ravi has 8 apples and gets 5 more. How many now?', data: sc([{ k: '13', l: '13', c: true }, { k: '12', l: '12' }, { k: '11', l: '11' }, { k: '14', l: '14' }]) },
        ],
      },
      {
        subject: 'English',
        title: 'Action Words (Verbs)',
        summary: 'An action word, or verb, tells what someone or something is doing. "Jump", "read", "sing", and "play" are action words.',
        activity: 'Act out 5 action words for your family. Ask them to guess each one.',
        youtube: ['https://www.youtube.com/watch?v=Q4xOMb_6FmI'],
        quizTitle: 'Action Words - Class 2 Quiz',
        difficulty: 'easy',
        questions: [
          { type: 'single_choice', title: 'Which is an action word?', data: sc([{ k: 'jump', l: 'jump', c: true }, { k: 'apple', l: 'apple' }, { k: 'red', l: 'red' }, { k: 'school', l: 'school' }]) },
          { type: 'single_choice', title: 'Pick the action word: "She sings a song."', data: sc([{ k: 'sings', l: 'sings', c: true }, { k: 'song', l: 'song' }, { k: 'she', l: 'she' }]) },
          { type: 'true_false', title: '"Run" is an action word.', data: tf(true) },
          { type: 'true_false', title: '"Book" is an action word.', data: tf(false) },
          { type: 'single_choice', title: 'Which is NOT an action word?', data: sc([{ k: 'house', l: 'house', c: true }, { k: 'eat', l: 'eat' }, { k: 'play', l: 'play' }, { k: 'walk', l: 'walk' }]) },
        ],
      },
    ],
    stories: [
      {
        title: 'The Greedy Dog',
        description: 'A dog learns that greed leaves you with nothing.',
        intro: 'A dog found a big bone and walked home with it. On the way, he crossed a bridge over a river.',
        body: 'He saw his own reflection in the water and thought it was another dog with a bigger bone. He barked to grab it - and his own bone fell into the river!',
        transition: 'live',
      },
      {
        title: 'The Ant and the Grasshopper',
        description: 'Hard work today brings comfort tomorrow.',
        intro: 'All summer the grasshopper sang while the ant worked, storing food for winter.',
        body: 'When winter came, the grasshopper had no food. The kind ant shared a little, and the grasshopper learned the value of hard work.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '4': {
    classroomTitle: 'Class 4 - Smart Learners Class',
    classroomDescription: 'A daily class for Class 4 covering multiplication and plant biology.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Multiplication and Times Tables',
        summary: 'Multiplication is repeated addition. 4 × 3 means 4 added 3 times = 12. Times tables help us multiply quickly.',
        activity: 'Write the times table of 6 from 6×1 to 6×10. Quiz a friend by saying the question and timing the answer.',
        youtube: ['https://www.youtube.com/watch?v=qQbGPplWIOg'],
        quizTitle: 'Multiplication - Class 4 Quiz',
        difficulty: 'easy',
        questions: [
          { type: 'single_choice', title: '7 × 8 = ?', data: sc([{ k: '56', l: '56', c: true }, { k: '48', l: '48' }, { k: '54', l: '54' }, { k: '64', l: '64' }]) },
          { type: 'single_choice', title: '9 × 6 = ?', data: sc([{ k: '54', l: '54', c: true }, { k: '45', l: '45' }, { k: '63', l: '63' }, { k: '56', l: '56' }]) },
          { type: 'single_choice', title: '12 × 11 = ?', data: sc([{ k: '132', l: '132', c: true }, { k: '121', l: '121' }, { k: '143', l: '143' }, { k: '110', l: '110' }]) },
          { type: 'true_false', title: '5 × 0 = 0', data: tf(true) },
          { type: 'single_choice', title: 'A box has 8 rows of 6 chocolates. Total chocolates?', data: sc([{ k: '48', l: '48', c: true }, { k: '42', l: '42' }, { k: '56', l: '56' }, { k: '14', l: '14' }]) },
        ],
      },
      {
        subject: 'Environmental Studies (EVS)',
        title: 'Parts of a Plant',
        summary: 'A plant has four main parts: roots (hold the plant and absorb water), stem (carries water and food), leaves (make food using sunlight), and flowers (which become fruits and seeds).',
        activity: 'Find a small plant and gently examine it. Draw it and label the four parts.',
        youtube: ['https://www.youtube.com/watch?v=ql6OL7_qFgU'],
        quizTitle: 'Parts of a Plant - Class 4 Quiz',
        difficulty: 'easy',
        questions: [
          { type: 'single_choice', title: 'Which part of the plant absorbs water from the soil?', data: sc([{ k: 'roots', l: 'Roots', c: true }, { k: 'leaves', l: 'Leaves' }, { k: 'flower', l: 'Flower' }, { k: 'fruit', l: 'Fruit' }]) },
          { type: 'single_choice', title: 'Where does a plant make its food?', data: sc([{ k: 'leaves', l: 'In the leaves', c: true }, { k: 'roots', l: 'In the roots' }, { k: 'soil', l: 'In the soil' }]) },
          { type: 'true_false', title: 'The stem carries water and food in the plant.', data: tf(true) },
          { type: 'single_choice', title: 'A plant uses ___ to make food.', data: sc([{ k: 'sun', l: 'sunlight, water and air', c: true }, { k: 'soap', l: 'soap and salt' }, { k: 'milk', l: 'milk and sugar' }]) },
          { type: 'true_false', title: 'Flowers later become fruits and seeds.', data: tf(true) },
        ],
      },
    ],
    stories: [
      {
        title: 'The Boy Who Cried Wolf',
        description: 'A shepherd boy learns the value of telling the truth.',
        intro: 'A bored shepherd boy shouted "Wolf!" twice as a joke. The villagers came running and found nothing.',
        body: 'When a real wolf came, he cried "Wolf!" again - but no one believed him. We learn: do not lie, even for fun.',
        transition: 'live',
      },
      {
        title: 'King Bruce and the Spider',
        description: 'A determined spider inspires a defeated king.',
        intro: 'King Bruce had lost six battles and felt like giving up. Hiding in a cave, he watched a spider try to climb to its web.',
        body: 'The spider failed six times but tried a seventh and made it. Inspired, the king fought again - and won. Try, try, again!',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '5': {
    classroomTitle: 'Class 5 - Daily Class',
    classroomDescription: 'A daily class for Class 5 covering fractions and the human body.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Fractions and Decimals',
        summary: 'A fraction shows part of a whole, like 1/2 or 3/4. A decimal also shows part of a whole using a point: 0.5 = 1/2, 0.25 = 1/4.',
        activity: 'Cut a paper circle into 4 equal parts. Label each part as 1/4. Show 2/4, then write it as 0.5.',
        youtube: ['https://www.youtube.com/watch?v=n0FZhQ_GkKw'],
        quizTitle: 'Fractions and Decimals - Class 5 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'Which fraction equals 0.5?', data: sc([{ k: '12', l: '1/2', c: true }, { k: '13', l: '1/3' }, { k: '14', l: '1/4' }, { k: '15', l: '1/5' }]) },
          { type: 'single_choice', title: '3/4 written as a decimal is:', data: sc([{ k: '0.75', l: '0.75', c: true }, { k: '0.34', l: '0.34' }, { k: '0.43', l: '0.43' }, { k: '0.7', l: '0.7' }]) },
          { type: 'single_choice', title: 'Which is greater: 2/5 or 3/5?', data: sc([{ k: '35', l: '3/5', c: true }, { k: '25', l: '2/5' }]) },
          { type: 'true_false', title: '1/2 + 1/2 = 1', data: tf(true) },
          { type: 'single_choice', title: '0.25 + 0.25 = ?', data: sc([{ k: '0.5', l: '0.5', c: true }, { k: '0.25', l: '0.25' }, { k: '5.0', l: '5.0' }, { k: '0.05', l: '0.05' }]) },
        ],
      },
      {
        subject: 'Environmental Studies (EVS)',
        title: 'Our Body and Its Systems',
        summary: 'The human body has systems that work together: the skeletal system gives shape, the muscular system helps us move, the digestive system breaks down food, and the respiratory system helps us breathe.',
        activity: 'Trace your body on a big sheet of paper. Label the head, chest, hands, and legs. Mark where the heart and stomach are.',
        youtube: ['https://www.youtube.com/watch?v=bbfubT_YXaQ'],
        quizTitle: 'Our Body - Class 5 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'Which organ pumps blood?', data: sc([{ k: 'heart', l: 'Heart', c: true }, { k: 'liver', l: 'Liver' }, { k: 'lungs', l: 'Lungs' }, { k: 'kidney', l: 'Kidney' }]) },
          { type: 'single_choice', title: 'We breathe in oxygen with our:', data: sc([{ k: 'lungs', l: 'Lungs', c: true }, { k: 'stomach', l: 'Stomach' }, { k: 'brain', l: 'Brain' }, { k: 'eyes', l: 'Eyes' }]) },
          { type: 'true_false', title: 'The skeleton is made of bones.', data: tf(true) },
          { type: 'single_choice', title: 'Food is digested mainly in the:', data: sc([{ k: 'stomach', l: 'Stomach and intestines', c: true }, { k: 'brain', l: 'Brain' }, { k: 'lungs', l: 'Lungs' }]) },
          { type: 'true_false', title: 'Muscles help the body move.', data: tf(true) },
        ],
      },
    ],
    stories: [
      {
        title: 'The Story of Ekalavya',
        description: 'A devoted student becomes the greatest archer with focus and self-belief.',
        intro: 'Ekalavya wished to learn archery from the great teacher Drona, but was turned away. Instead, he made a clay statue of Drona and practised before it daily.',
        body: 'Through pure devotion he became an archer of unmatched skill. The story teaches us that learning is open to anyone with discipline and focus.',
        transition: 'live',
      },
      {
        title: 'The Magic Pot',
        description: 'A simple farmer\'s discovery shows that greed can spoil even a magical gift.',
        intro: 'A poor farmer found a strange pot. Whatever he placed inside doubled when he removed it. Soon the family had grain and gold to spare.',
        body: 'The greedy landlord stole the pot. He climbed inside it - and two greedy landlords came out, fighting forever. Greed brings only trouble.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '6': {
    classroomTitle: 'Class 6 - Foundations of Logic',
    classroomDescription: 'A daily class for Class 6 covering integers and food nutrients.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Whole Numbers and Integers',
        summary: 'Whole numbers are 0, 1, 2, 3, ... Integers include negative numbers, zero, and positive numbers (..., -2, -1, 0, 1, 2, ...). Adding a positive moves right, adding a negative moves left on the number line.',
        activity: 'Draw a number line from -10 to +10. Mark the answers to: 4 + (-7), -3 + 5, -2 + (-3).',
        youtube: ['https://www.youtube.com/watch?v=LXBOaBJYcQQ'],
        quizTitle: 'Integers - Class 6 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: '-5 + 8 = ?', data: sc([{ k: '3', l: '3', c: true }, { k: '-3', l: '-3' }, { k: '13', l: '13' }, { k: '-13', l: '-13' }]) },
          { type: 'single_choice', title: '-7 + (-4) = ?', data: sc([{ k: '-11', l: '-11', c: true }, { k: '11', l: '11' }, { k: '-3', l: '-3' }, { k: '3', l: '3' }]) },
          { type: 'single_choice', title: 'Which is greatest?', data: sc([{ k: '0', l: '0', c: true }, { k: '-2', l: '-2' }, { k: '-5', l: '-5' }, { k: '-1', l: '-1' }]) },
          { type: 'true_false', title: 'Every whole number is also an integer.', data: tf(true) },
          { type: 'single_choice', title: 'The temperature was -3 C and rose by 7 C. New temperature?', data: sc([{ k: '4', l: '4 C', c: true }, { k: '-10', l: '-10 C' }, { k: '10', l: '10 C' }, { k: '-4', l: '-4 C' }]) },
        ],
      },
      {
        subject: 'Science',
        title: 'Components of Food',
        summary: 'Food contains nutrients we need: carbohydrates (energy), proteins (growth and repair), fats (energy storage), vitamins and minerals (good health), and water (every body process).',
        activity: 'Look at the labels of 3 food items at home. Note which nutrients are listed and in what amounts.',
        youtube: ['https://www.youtube.com/watch?v=eR2LGRf-V8M'],
        quizTitle: 'Components of Food - Class 6 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'Which nutrient gives quick energy?', data: sc([{ k: 'carb', l: 'Carbohydrates', c: true }, { k: 'protein', l: 'Proteins' }, { k: 'water', l: 'Water' }]) },
          { type: 'single_choice', title: 'Proteins are needed mainly for:', data: sc([{ k: 'growth', l: 'Growth and repair', c: true }, { k: 'taste', l: 'Taste' }, { k: 'colour', l: 'Colour' }]) },
          { type: 'true_false', title: 'Vitamins keep us healthy.', data: tf(true) },
          { type: 'single_choice', title: 'Which food is rich in protein?', data: sc([{ k: 'dal', l: 'Dal (lentils) and milk', c: true }, { k: 'sugar', l: 'Sugar' }, { k: 'oil', l: 'Pure oil' }]) },
          { type: 'true_false', title: 'Water is not a nutrient.', data: tf(false) },
        ],
      },
    ],
    stories: [
      {
        title: 'Newton and the Apple',
        description: 'A falling apple inspired one of science\'s greatest ideas.',
        intro: 'Young Isaac Newton sat under an apple tree. An apple fell - and instead of just eating it, he asked: why does it fall straight down?',
        body: 'That question led Newton to the law of gravity, explaining why planets orbit the Sun and why we stay on the ground. Curiosity changes the world.',
        transition: 'live',
      },
      {
        title: 'The Clever Birbal',
        description: 'Wit beats brute force in Akbar\'s court.',
        intro: 'Emperor Akbar drew a line and asked his ministers to make it shorter without erasing it.',
        body: 'Birbal calmly drew a longer line beside it. The first line was now the shorter one. Smart thinking solved the puzzle.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '8': {
    classroomTitle: 'Class 8 - Concept Builders',
    classroomDescription: 'A daily class for Class 8 covering linear equations and force/pressure.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Linear Equations in One Variable',
        summary: 'A linear equation in one variable looks like ax + b = c. We solve it by isolating x: bring all x terms to one side and constants to the other, then divide by the coefficient of x.',
        activity: 'Solve and verify: (a) 2x + 5 = 17, (b) 3(x - 2) = 12, (c) x/4 + 1 = 5.',
        youtube: ['https://www.youtube.com/watch?v=1c5HY3z4k8E'],
        quizTitle: 'Linear Equations - Class 8 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'Solve 2x + 5 = 17. x = ?', data: sc([{ k: '6', l: '6', c: true }, { k: '11', l: '11' }, { k: '7', l: '7' }, { k: '12', l: '12' }]) },
          { type: 'single_choice', title: 'Solve 3x - 4 = 11. x = ?', data: sc([{ k: '5', l: '5', c: true }, { k: '7', l: '7' }, { k: '4', l: '4' }, { k: '15', l: '15' }]) },
          { type: 'single_choice', title: 'Solve x/4 = 7. x = ?', data: sc([{ k: '28', l: '28', c: true }, { k: '11', l: '11' }, { k: '3', l: '3' }, { k: '1.75', l: '1.75' }]) },
          { type: 'true_false', title: 'In 5x = 0, x = 0.', data: tf(true) },
          { type: 'single_choice', title: 'A number when doubled and increased by 7 gives 25. The number is:', data: sc([{ k: '9', l: '9', c: true }, { k: '8', l: '8' }, { k: '12', l: '12' }, { k: '16', l: '16' }]) },
        ],
      },
      {
        subject: 'Science',
        title: 'Force and Pressure',
        summary: 'Force is a push or pull. Pressure is force divided by the area it acts on (P = F/A). The same force on a smaller area gives more pressure - that is why a sharp knife cuts more easily than a blunt one.',
        activity: 'Press a coin onto your palm with the flat face, then with the edge, using the same force. Which feels sharper? Explain why using P = F/A.',
        youtube: ['https://www.youtube.com/watch?v=ZJsSrxAZ7Vw'],
        quizTitle: 'Force and Pressure - Class 8 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'Pressure is defined as:', data: sc([{ k: 'fa', l: 'Force per unit area', c: true }, { k: 'mass', l: 'Mass per unit volume' }, { k: 'speed', l: 'Speed per unit time' }]) },
          { type: 'single_choice', title: 'A force of 50 N on 0.5 m^2 gives pressure:', data: sc([{ k: '100', l: '100 Pa', c: true }, { k: '25', l: '25 Pa' }, { k: '50', l: '50 Pa' }, { k: '0.01', l: '0.01 Pa' }]) },
          { type: 'true_false', title: 'A sharp knife cuts more easily because it applies higher pressure on a smaller area.', data: tf(true) },
          { type: 'single_choice', title: 'The SI unit of force is the:', data: sc([{ k: 'newton', l: 'Newton (N)', c: true }, { k: 'pascal', l: 'Pascal' }, { k: 'joule', l: 'Joule' }, { k: 'kg', l: 'Kilogram' }]) },
          { type: 'true_false', title: 'Friction is a contact force.', data: tf(true) },
        ],
      },
    ],
    stories: [
      {
        title: 'The Discovery of Penicillin',
        description: 'A messy lab and a curious mind saved millions of lives.',
        intro: 'In 1928 Alexander Fleming returned to his lab and saw mould growing on a forgotten dish. Around the mould, bacteria had died.',
        body: 'That mould was Penicillium - the basis for the first antibiotic, penicillin. A tiny accident, examined carefully, became a global breakthrough.',
        transition: 'live',
      },
      {
        title: 'Kalpana Chawla\'s Dream',
        description: 'A small-town girl who reached the stars.',
        intro: 'Kalpana Chawla looked up at the night sky in Karnal, India, and dreamt of flying among the stars.',
        body: 'She studied hard, became an aerospace engineer, and flew on the Space Shuttle Columbia. Big dreams begin in small places.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '9': {
    classroomTitle: 'Class 9 - Advanced Foundations',
    classroomDescription: 'A daily class for Class 9 covering polynomials and atoms.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Polynomials',
        summary: 'A polynomial is an expression of the form a_n x^n + ... + a_1 x + a_0 with whole-number powers of x. The degree is the highest power. A linear polynomial has degree 1, quadratic 2, cubic 3.',
        activity: 'Identify the degree of: (a) 5x + 3, (b) x^2 - 4x + 7, (c) 2x^3 - x. Then evaluate each at x = 2.',
        youtube: ['https://www.youtube.com/watch?v=Vm7H0VTlIco'],
        quizTitle: 'Polynomials - Class 9 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'The degree of x^3 + 2x^2 + x is:', data: sc([{ k: '3', l: '3', c: true }, { k: '2', l: '2' }, { k: '1', l: '1' }, { k: '6', l: '6' }]) },
          { type: 'single_choice', title: 'p(x) = x^2 - 4. p(3) = ?', data: sc([{ k: '5', l: '5', c: true }, { k: '-5', l: '-5' }, { k: '7', l: '7' }, { k: '1', l: '1' }]) },
          { type: 'single_choice', title: 'A zero of p(x) = x^2 - 9 is:', data: sc([{ k: '3', l: '3', c: true }, { k: '0', l: '0' }, { k: '9', l: '9' }, { k: '1', l: '1' }]) },
          { type: 'true_false', title: 'Every polynomial of degree 2 has at most 2 zeros.', data: tf(true) },
          { type: 'single_choice', title: 'The polynomial 7 (a constant) has degree:', data: sc([{ k: '0', l: '0', c: true }, { k: '1', l: '1' }, { k: '7', l: '7' }, { k: 'undef', l: 'undefined' }]) },
        ],
      },
      {
        subject: 'Science (Physics, Chemistry, Biology)',
        title: 'Atoms and Molecules',
        summary: 'All matter is made of atoms. An atom has a tiny nucleus of protons and neutrons, surrounded by electrons. A molecule is two or more atoms bonded together (e.g. H2O has 2 hydrogens + 1 oxygen).',
        activity: 'Draw the structure of (a) H2O and (b) CO2. Count atoms of each element in each compound.',
        youtube: ['https://www.youtube.com/watch?v=IFKnq9QM6_A'],
        quizTitle: 'Atoms and Molecules - Class 9 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'The particle with positive charge in the nucleus is the:', data: sc([{ k: 'proton', l: 'Proton', c: true }, { k: 'electron', l: 'Electron' }, { k: 'neutron', l: 'Neutron' }]) },
          { type: 'single_choice', title: 'A water molecule has how many atoms in total?', data: sc([{ k: '3', l: '3', c: true }, { k: '2', l: '2' }, { k: '4', l: '4' }, { k: '1', l: '1' }]) },
          { type: 'true_false', title: 'Electrons orbit the nucleus.', data: tf(true) },
          { type: 'single_choice', title: 'CO2 contains how many oxygen atoms?', data: sc([{ k: '2', l: '2', c: true }, { k: '1', l: '1' }, { k: '3', l: '3' }, { k: '0', l: '0' }]) },
          { type: 'true_false', title: 'A proton and an electron have equal but opposite charges.', data: tf(true) },
        ],
      },
    ],
    stories: [
      {
        title: 'Madame Curie\'s Glow',
        description: 'A pioneer who discovered radioactivity at the cost of her own health.',
        intro: 'Marie Curie worked night after night with pitchblende ore in a cold shed in Paris.',
        body: 'She discovered polonium and radium, won two Nobel Prizes, and opened the door to modern medicine and atomic physics.',
        transition: 'live',
      },
      {
        title: 'CV Raman and the Blue Sea',
        description: 'A simple question on a ship led to a Nobel Prize for India.',
        intro: 'On a sea voyage, young CV Raman wondered: why is the sea blue, not just a reflection of the sky?',
        body: 'Years of careful experiments revealed the Raman Effect - showing that light scatters with a slight change in colour when it passes through matter.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '10': {
    classroomTitle: 'Class 10 - Board Prep Class',
    classroomDescription: 'A daily class for Class 10 covering quadratic equations and acids/bases.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Quadratic Equations',
        summary: 'A quadratic equation has the form ax^2 + bx + c = 0 with a != 0. It can be solved by factorisation, completing the square, or the quadratic formula x = (-b +- sqrt(b^2 - 4ac)) / 2a.',
        activity: 'Solve and check: (a) x^2 - 5x + 6 = 0, (b) 2x^2 + 7x - 4 = 0. Identify the discriminant of each.',
        youtube: ['https://www.youtube.com/watch?v=IlFFt6arRcQ'],
        quizTitle: 'Quadratic Equations - Class 10 Quiz',
        difficulty: 'hard',
        questions: [
          { type: 'single_choice', title: 'Roots of x^2 - 5x + 6 = 0 are:', data: sc([{ k: '23', l: '2 and 3', c: true }, { k: '14', l: '1 and 4' }, { k: '16', l: '1 and 6' }, { k: '36', l: '3 and 6' }]) },
          { type: 'single_choice', title: 'The discriminant of ax^2 + bx + c is:', data: sc([{ k: 'b24ac', l: 'b^2 - 4ac', c: true }, { k: 'b2', l: 'b^2' }, { k: '4ac', l: '4ac' }, { k: 'sum', l: 'a + b + c' }]) },
          { type: 'single_choice', title: 'If discriminant = 0, the roots are:', data: sc([{ k: 'real-eq', l: 'Real and equal', c: true }, { k: 'real-dist', l: 'Real and distinct' }, { k: 'imag', l: 'Imaginary' }, { k: 'no', l: 'No roots' }]) },
          { type: 'true_false', title: 'A quadratic always has exactly two roots in the complex numbers.', data: tf(true) },
          { type: 'single_choice', title: 'Sum of roots of x^2 - 7x + 12 = 0 is:', data: sc([{ k: '7', l: '7', c: true }, { k: '12', l: '12' }, { k: '-7', l: '-7' }, { k: '5', l: '5' }]) },
        ],
      },
      {
        subject: 'Science (Physics, Chemistry, Biology)',
        title: 'Acids, Bases and Salts',
        summary: 'Acids release H+ ions in water (e.g. HCl, H2SO4) and turn blue litmus red. Bases release OH- ions (e.g. NaOH, KOH) and turn red litmus blue. Acid + base -> salt + water.',
        activity: 'Test 5 household items (lemon juice, soap solution, vinegar, baking soda solution, milk) with red and blue litmus paper. Note which are acidic, basic, or neutral.',
        youtube: ['https://www.youtube.com/watch?v=H_Vgcjg8eJk'],
        quizTitle: 'Acids and Bases - Class 10 Quiz',
        difficulty: 'medium',
        questions: [
          { type: 'single_choice', title: 'Acids release which ion in water?', data: sc([{ k: 'h', l: 'H+', c: true }, { k: 'oh', l: 'OH-' }, { k: 'na', l: 'Na+' }, { k: 'cl', l: 'Cl-' }]) },
          { type: 'single_choice', title: 'A base turns red litmus paper:', data: sc([{ k: 'blue', l: 'Blue', c: true }, { k: 'green', l: 'Green' }, { k: 'red', l: 'Red' }, { k: 'yellow', l: 'Yellow' }]) },
          { type: 'true_false', title: 'pH of a neutral solution is 7.', data: tf(true) },
          { type: 'single_choice', title: 'HCl + NaOH gives:', data: sc([{ k: 'nacl', l: 'NaCl + H2O', c: true }, { k: 'h2', l: 'H2 + O2' }, { k: 'co2', l: 'CO2 + H2O' }]) },
          { type: 'true_false', title: 'pH below 7 is acidic.', data: tf(true) },
        ],
      },
    ],
    stories: [
      {
        title: 'Ramanujan\'s Notebooks',
        description: 'A self-taught genius from Kumbakonam astounds Cambridge.',
        intro: 'Srinivasa Ramanujan filled notebooks with thousands of original mathematical results - many beyond what professors had imagined.',
        body: 'GH Hardy invited him to Cambridge, where the world finally saw a mind that thought of mathematics in pictures and dreams.',
        transition: 'live',
      },
      {
        title: 'Mission Mangalyaan',
        description: 'India reaches Mars on its first try, on a budget.',
        intro: 'In 2014 ISRO launched Mangalyaan to Mars - a mission cheaper than a Hollywood movie.',
        body: 'On 24 September 2014 it entered Martian orbit at the first attempt - a feat no other country had achieved. Indian engineering, Indian pride.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '11': {
    classroomTitle: 'Class 11 - Senior Class',
    classroomDescription: 'A daily class for Class 11 covering sets/functions and kinematics.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Sets and Functions',
        summary: 'A set is a well-defined collection of objects. Operations include union (A U B), intersection (A n B), and difference (A - B). A function f: A -> B assigns to each element of A exactly one element of B.',
        activity: 'Let A = {1,2,3,4}, B = {3,4,5,6}. Find A U B, A n B, A - B. Then check whether the rule f(x) = x^2 from A to N is a function.',
        youtube: ['https://www.youtube.com/watch?v=jAfNg3ylZAI'],
        quizTitle: 'Sets and Functions - Class 11 Quiz',
        difficulty: 'hard',
        questions: [
          { type: 'single_choice', title: 'If A = {1,2,3} and B = {3,4}, A n B = ?', data: sc([{ k: '3', l: '{3}', c: true }, { k: '14', l: '{1,4}' }, { k: 'empty', l: '{}' }, { k: 'all', l: '{1,2,3,4}' }]) },
          { type: 'single_choice', title: 'The set of all natural numbers is:', data: sc([{ k: 'inf', l: 'Infinite', c: true }, { k: '100', l: 'Exactly 100 elements' }, { k: 'fin', l: 'Finite but unknown' }]) },
          { type: 'true_false', title: 'A function can map one input to two different outputs.', data: tf(false) },
          { type: 'single_choice', title: 'For f(x) = 3x + 2, f(4) = ?', data: sc([{ k: '14', l: '14', c: true }, { k: '12', l: '12' }, { k: '20', l: '20' }, { k: '7', l: '7' }]) },
          { type: 'single_choice', title: '|A| = 3 and |B| = 4. |A x B| = ?', data: sc([{ k: '12', l: '12', c: true }, { k: '7', l: '7' }, { k: '3', l: '3' }, { k: '4', l: '4' }]) },
        ],
      },
      {
        subject: 'Physics',
        title: 'Kinematics: Motion in a Straight Line',
        summary: 'Kinematics describes motion using displacement, velocity, and acceleration. For uniform acceleration: v = u + at, s = ut + (1/2) a t^2, v^2 = u^2 + 2 a s.',
        activity: 'A car starts from rest and accelerates at 2 m/s^2 for 5 s. Find its final velocity and the distance covered.',
        youtube: ['https://www.youtube.com/watch?v=ZM8ECpBuQYE'],
        quizTitle: 'Kinematics - Class 11 Quiz',
        difficulty: 'hard',
        questions: [
          { type: 'single_choice', title: 'A body starts from rest and accelerates at 2 m/s^2 for 5 s. Final velocity?', data: sc([{ k: '10', l: '10 m/s', c: true }, { k: '5', l: '5 m/s' }, { k: '25', l: '25 m/s' }, { k: '7', l: '7 m/s' }]) },
          { type: 'single_choice', title: 'SI unit of acceleration:', data: sc([{ k: 'ms2', l: 'm/s^2', c: true }, { k: 'ms', l: 'm/s' }, { k: 'n', l: 'N' }, { k: 'j', l: 'J' }]) },
          { type: 'single_choice', title: 'Displacement is a:', data: sc([{ k: 'vec', l: 'Vector quantity', c: true }, { k: 'sca', l: 'Scalar quantity' }, { k: 'unit', l: 'Unit' }]) },
          { type: 'true_false', title: 'Speed is the magnitude of velocity.', data: tf(true) },
          { type: 'single_choice', title: 'Distance covered in 4 s with u=0, a=3 m/s^2 is:', data: sc([{ k: '24', l: '24 m', c: true }, { k: '12', l: '12 m' }, { k: '48', l: '48 m' }, { k: '8', l: '8 m' }]) },
        ],
      },
    ],
    stories: [
      {
        title: 'The Wright Brothers\' First Flight',
        description: 'Two brothers turn a bicycle shop dream into powered flight.',
        intro: 'Wilbur and Orville Wright built and rebuilt their flying machine in Kitty Hawk, North Carolina, learning from every crash.',
        body: 'On 17 December 1903 the Flyer lifted off for 12 seconds - the world\'s first powered, controlled flight. Persistence opened the skies.',
        transition: 'live',
      },
      {
        title: 'Hawking\'s Universe',
        description: 'A mind unbroken by ALS reshapes our view of black holes.',
        intro: 'Stephen Hawking was given two years to live at age 21. He went on to live more than 50, writing breakthroughs along the way.',
        body: 'He showed black holes can radiate energy (Hawking radiation) and made cosmology accessible to everyone. The body has limits; the mind need not.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },

  '12': {
    classroomTitle: 'Class 12 - Final Year Class',
    classroomDescription: 'A daily class for Class 12 covering differentiation and electromagnetic induction.',
    topics: [
      {
        subject: 'Mathematics',
        title: 'Calculus: Differentiation',
        summary: 'The derivative of f(x) at x measures the instantaneous rate of change. Standard rules: d/dx(x^n) = n x^(n-1), d/dx(sin x) = cos x, d/dx(e^x) = e^x. Product, quotient and chain rules combine these for complex functions.',
        activity: 'Differentiate: (a) f(x) = 3x^4 - 2x + 7, (b) g(x) = sin(x) cos(x), (c) h(x) = e^(x^2).',
        youtube: ['https://www.youtube.com/watch?v=5yfh5cf4-0w'],
        quizTitle: 'Differentiation - Class 12 Quiz',
        difficulty: 'hard',
        questions: [
          { type: 'single_choice', title: 'd/dx (x^5) = ?', data: sc([{ k: '5x4', l: '5x^4', c: true }, { k: 'x4', l: 'x^4' }, { k: '5x5', l: '5x^5' }, { k: '5', l: '5' }]) },
          { type: 'single_choice', title: 'd/dx (sin x) = ?', data: sc([{ k: 'cos', l: 'cos x', c: true }, { k: '-cos', l: '-cos x' }, { k: '-sin', l: '-sin x' }, { k: 'tan', l: 'tan x' }]) },
          { type: 'single_choice', title: 'd/dx (e^(2x)) = ?', data: sc([{ k: '2e2x', l: '2 e^(2x)', c: true }, { k: 'e2x', l: 'e^(2x)' }, { k: '2x', l: '2x' }, { k: 'e2', l: 'e^2' }]) },
          { type: 'true_false', title: 'd/dx of a constant is 0.', data: tf(true) },
          { type: 'single_choice', title: 'If f(x) = ln x, then f\'(x) = ?', data: sc([{ k: '1x', l: '1/x', c: true }, { k: 'x', l: 'x' }, { k: 'lnx', l: 'ln x' }, { k: 'ex', l: 'e^x' }]) },
        ],
      },
      {
        subject: 'Physics',
        title: 'Electromagnetic Induction',
        summary: 'Faraday\'s law: a changing magnetic flux through a coil induces an EMF in the coil. EMF = -dPhi/dt. Lenz\'s law fixes the sign so the induced current opposes the change in flux. This principle drives generators and transformers.',
        activity: 'A coil of 200 turns has flux changing from 0.02 Wb to 0.06 Wb in 0.1 s. Find the induced EMF (magnitude).',
        youtube: ['https://www.youtube.com/watch?v=3HyORmBip-w'],
        quizTitle: 'Electromagnetic Induction - Class 12 Quiz',
        difficulty: 'hard',
        questions: [
          { type: 'single_choice', title: 'Induced EMF is given by EMF = ?', data: sc([{ k: 'dphi', l: '-N dPhi/dt', c: true }, { k: 'phi', l: 'N Phi' }, { k: 'i2r', l: 'I^2 R' }, { k: 'qv', l: 'qV' }]) },
          { type: 'single_choice', title: 'Lenz\'s law is a statement of:', data: sc([{ k: 'energy', l: 'Conservation of energy', c: true }, { k: 'mass', l: 'Conservation of mass' }, { k: 'charge', l: 'Equality of charge' }]) },
          { type: 'true_false', title: 'A transformer works on AC, not DC.', data: tf(true) },
          { type: 'single_choice', title: 'SI unit of magnetic flux is the:', data: sc([{ k: 'wb', l: 'Weber (Wb)', c: true }, { k: 't', l: 'Tesla' }, { k: 'h', l: 'Henry' }, { k: 'a', l: 'Ampere' }]) },
          { type: 'single_choice', title: 'Flux changes from 0.02 to 0.06 Wb in 0.1 s in a 200-turn coil. |EMF| = ?', data: sc([{ k: '80', l: '80 V', c: true }, { k: '40', l: '40 V' }, { k: '0.4', l: '0.4 V' }, { k: '8', l: '8 V' }]) },
        ],
      },
    ],
    stories: [
      {
        title: 'Einstein\'s Year of Miracles',
        description: 'In 1905 a patent clerk shook physics from his desk.',
        intro: 'Albert Einstein published four papers in a single year, on the photoelectric effect, Brownian motion, special relativity, and E = mc^2.',
        body: 'Each paper changed a corner of physics forever. Genius needs neither title nor lab - only deep, sustained thought.',
        transition: 'live',
      },
      {
        title: 'APJ Abdul Kalam: Wings of Fire',
        description: 'A boy from Rameswaram who taught India to dream big.',
        intro: 'Avul Pakir Jainulabdeen Abdul Kalam delivered newspapers as a child, then helped build India\'s missile and space programmes.',
        body: 'As 11th President he told every student: dream, dream, dream - dreams transform into thoughts, and thoughts result in action.',
        transition: 'scheduled', scheduleInDays: 3,
      },
    ],
  },
};

// ───────────────────────────── DRIVER ─────────────────────────────
async function main() {
  // login
  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json?.accessToken) {
    console.error(`Login failed for ${LOGIN_ID}: ${reason(login)}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  const orgId = login.json.user?.organizationId;
  console.log(`Logged in as ${LOGIN_ID} (role ${login.json.user?.activeRole}) -> org ${orgId}\n`);

  const report = {
    org: orgId,
    classes: [],
    totals: { topics: 0, contents: 0, quizzes: 0, questions: 0, classrooms: 0, stories: 0, failures: 0 },
    failures: [],
  };

  for (const classLevel of Object.keys(CURRICULUM)) {
    const plan = CURRICULUM[classLevel];
    console.log(`\n═══════════════ Class ${classLevel} ═══════════════`);
    const classOut = { classLevel, topics: [], classroomId: null, stories: [] };

    const contentIds = [];
    const quizIds = [];

    // existing topics for this class (idempotency)
    const existingTopicsRes = await http('GET', `${GATEWAY}/topics?class_level=${encodeURIComponent(classLevel)}&limit=500`, token);
    const existingTopics = existingTopicsRes.ok && Array.isArray(existingTopicsRes.json?.topics) ? existingTopicsRes.json.topics : [];

    // existing quizzes for this class (idempotency)
    const existingQuizzesRes = await http('GET', `${GATEWAY}/quizzes/teacher/library?class_level=${encodeURIComponent(classLevel)}&limit=500`, token);
    const existingQuizzes = existingQuizzesRes.ok && Array.isArray(existingQuizzesRes.json?.quizzes) ? existingQuizzesRes.json.quizzes : [];

    for (const topic of plan.topics) {
      console.log(`\n  • Topic: ${topic.subject} / ${topic.title}`);

      // 1) topic
      let topicId = null;
      const matchTopic = existingTopics.find((t) => t.title === topic.title && (t.subject === topic.subject || t.classLevel === classLevel));
      if (matchTopic) {
        topicId = matchTopic.id;
        console.log(`    - topic exists -> ${topicId}`);
      } else {
        const r = await http('POST', `${GATEWAY}/topics`, token, {
          classLevel, subject: topic.subject, title: topic.title, isGlobal: false,
        });
        if (r.ok && r.json?.id) {
          topicId = r.json.id;
          report.totals.topics++;
          console.log(`    ✓ topic -> ${topicId}`);
        } else {
          console.error(`    x topic create failed: ${reason(r)}`);
          report.failures.push({ stage: 'topic', classLevel, title: topic.title, reason: reason(r) });
          report.totals.failures++;
          continue;
        }
      }

      // 2) content (sections built from summary + youtube + activity)
      const sections = [];
      sections.push({ title: 'Summary', contentType: 'text', textContent: topic.summary });
      (topic.youtube || []).forEach((url, i) => {
        sections.push({ title: `Watch & Learn ${i + 1}`, contentType: 'youtube_url', externalUrl: url });
      });
      sections.push({ title: 'Classroom Activity', contentType: 'text', textContent: topic.activity });

      const contentRes = await http('POST', `${GATEWAY}/content/items`, token, {
        classLevel, subject: topic.subject, topicId, title: topic.title, sections, isGlobal: false,
      });
      if (contentRes.ok && contentRes.json?.id) {
        contentIds.push(contentRes.json.id);
        report.totals.contents++;
        console.log(`    ✓ content (${sections.length} sections) -> ${contentRes.json.id}`);
      } else {
        console.error(`    x content failed: ${reason(contentRes)}`);
        report.failures.push({ stage: 'content', classLevel, title: topic.title, reason: reason(contentRes) });
        report.totals.failures++;
      }

      // 3) quiz + questions (skip if title already exists)
      let quizId = null;
      const matchQuiz = existingQuizzes.find((q) => q.title === topic.quizTitle);
      if (matchQuiz) {
        quizId = matchQuiz.id;
        console.log(`    - quiz exists -> ${quizId}`);
      } else {
        const quizBody = {
          title: topic.quizTitle,
          description: `Practice quiz for ${topic.title}.`,
          classLevel, subject: topic.subject,
          quizType: 'single_choice',
          difficultyLevel: topic.difficulty || 'medium',
          theme: { learningContent: { topic: topic.title, subject: topic.subject } },
          isPublished: true, isAiGenerated: true, isGlobal: false,
        };
        const qres = await http('POST', `${GATEWAY}/quizzes`, token, quizBody);
        if (qres.ok && qres.json?.id) {
          quizId = qres.json.id;
          report.totals.quizzes++;
          console.log(`    ✓ quiz -> ${quizId}`);

          let qok = 0;
          for (let i = 0; i < topic.questions.length; i++) {
            const q = topic.questions[i];
            const qbody = {
              questionType: q.type,
              questionTitle: q.title,
              questionInstruction: 'Choose your answer.',
              questionData: q.data,
              points: 10, timeLimitSeconds: 30,
              sortOrder: i + 1,
            };
            const qq = await http('POST', `${GATEWAY}/quizzes/${quizId}/questions`, token, qbody);
            if (qq.ok && qq.json?.id) { qok++; report.totals.questions++; }
            else {
              console.error(`      x question ${i + 1} failed: ${reason(qq)}`);
              report.failures.push({ stage: 'question', classLevel, title: topic.title, sortOrder: i + 1, reason: reason(qq) });
              report.totals.failures++;
            }
          }
          console.log(`    ✓ questions: ${qok}/${topic.questions.length}`);
        } else {
          console.error(`    x quiz create failed: ${reason(qres)}`);
          report.failures.push({ stage: 'quiz', classLevel, title: topic.quizTitle, reason: reason(qres) });
          report.totals.failures++;
        }
      }
      if (quizId) {
        quizIds.push(quizId);
        // link quiz -> topic
        await http('PUT', `${GATEWAY}/topics/${topicId}/quizzes`, token, { quizIds: [quizId] });
      }

      classOut.topics.push({ topicId, contentId: contentIds[contentIds.length - 1] || null, quizId });
    }

    // 4) classroom (instant) attaching all content + quizzes
    const existingClassRes = await http('GET', `${GATEWAY}/classrooms?class_level=${encodeURIComponent(classLevel)}&limit=500`, token);
    const existingClass = existingClassRes.ok && (existingClassRes.json?.classrooms || []).find((c) => c.title === plan.classroomTitle);
    if (existingClass) {
      classOut.classroomId = existingClass.id;
      console.log(`\n  - classroom exists -> ${existingClass.id}`);
    } else if (contentIds.length || quizIds.length) {
      const cls = await http('POST', `${GATEWAY}/classrooms`, token, {
        title: plan.classroomTitle,
        description: plan.classroomDescription,
        scheduleType: 'instant',
        durationMinutes: 45,
        classLevel,
        contentIds,
        quizIds,
      });
      if (cls.ok && cls.json?.classroom?.id) {
        classOut.classroomId = cls.json.classroom.id;
        report.totals.classrooms++;
        console.log(`\n  ✓ classroom -> ${cls.json.classroom.id}`);
      } else {
        console.error(`  x classroom create failed: ${reason(cls)}`);
        report.failures.push({ stage: 'classroom', classLevel, title: plan.classroomTitle, reason: reason(cls) });
        report.totals.failures++;
      }
    }

    // 5) stories (each: shell + 2 sections + 1 small quiz on section 2 + transition)
    const existingStoriesRes = await http('GET', `${GATEWAY}/stories?class_level=${encodeURIComponent(classLevel)}&limit=200`, token);
    const existingStoryTitles = new Set(existingStoriesRes.ok ? (existingStoriesRes.json?.stories || []).map((s) => s.title) : []);

    for (const story of plan.stories) {
      if (existingStoryTitles.has(story.title)) {
        console.log(`  - story "${story.title}" exists, skipping`);
        continue;
      }

      // little story quiz with 2 questions. Subject must reference an existing
      // subjects row for this org+class (subject_id is NOT NULL), so reuse the
      // first topic's subject (English/Mathematics/...).
      const storyQuizSubject = (plan.topics[0] && plan.topics[0].subject) || 'English';
      const sqz = await http('POST', `${GATEWAY}/quizzes`, token, {
        title: `${story.title} - Quick Check`,
        description: `Comprehension check for ${story.title}.`,
        classLevel, subject: storyQuizSubject,
        quizType: 'single_choice',
        difficultyLevel: 'easy',
        isPublished: true, isAiGenerated: true, isGlobal: false,
      });
      let storyQuizId = null;
      if (sqz.ok && sqz.json?.id) {
        storyQuizId = sqz.json.id;
        report.totals.quizzes++;
      } else {
        console.warn(`    ! story quiz "${story.title}" failed: ${reason(sqz)}`);
        report.failures.push({ stage: 'story_quiz', classLevel, title: story.title, reason: reason(sqz) });
        report.totals.failures++;
      }
      if (storyQuizId) {
        const q1 = await http('POST', `${GATEWAY}/quizzes/${storyQuizId}/questions`, token, {
          questionType: 'true_false',
          questionTitle: `Did you read "${story.title}" carefully?`,
          questionInstruction: 'True or False.',
          questionData: tf(true),
          points: 10, timeLimitSeconds: 25, sortOrder: 1,
        });
        if (q1.ok) report.totals.questions++;
        const q2 = await http('POST', `${GATEWAY}/quizzes/${storyQuizId}/questions`, token, {
          questionType: 'true_false',
          questionTitle: 'A good story always teaches us something.',
          questionInstruction: 'True or False.',
          questionData: tf(true),
          points: 10, timeLimitSeconds: 25, sortOrder: 2,
        });
        if (q2.ok) report.totals.questions++;
      }

      const sCreated = await http('POST', `${GATEWAY}/stories`, token, {
        title: story.title, description: story.description, classLevel,
      });
      if (!sCreated.ok || !sCreated.json?.story?.id) {
        console.error(`  x story create failed: ${reason(sCreated)}`);
        report.failures.push({ stage: 'story', classLevel, title: story.title, reason: reason(sCreated) });
        report.totals.failures++;
        continue;
      }
      const storyId = sCreated.json.story.id;
      report.totals.stories++;

      await http('POST', `${GATEWAY}/stories/${storyId}/sections`, token, {
        title: 'Once upon a time', bodyText: story.intro, media: [], orderIndex: 0,
      });
      await http('POST', `${GATEWAY}/stories/${storyId}/sections`, token, {
        title: 'What happened next', bodyText: story.body, media: [], quizId: storyQuizId, orderIndex: 1,
      });

      if (story.transition === 'live') {
        await http('PATCH', `${GATEWAY}/stories/${storyId}/publish`, token, {});
      } else if (story.transition === 'ended') {
        await http('PATCH', `${GATEWAY}/stories/${storyId}/end`, token, {});
      } else if (story.transition === 'scheduled') {
        const when = new Date(Date.now() + (story.scheduleInDays || 3) * 86400000);
        when.setHours(9, 0, 0, 0);
        await http('PATCH', `${GATEWAY}/stories/${storyId}/schedule`, token, { scheduledAt: when.toISOString() });
      }
      classOut.stories.push({ id: storyId, title: story.title, status: story.transition });
      console.log(`  ✓ story (${story.transition}) -> ${storyId} - ${story.title}`);
    }

    report.classes.push(classOut);
    await sleep(150);
  }

  console.log('\n\n══════════════════ FINAL REPORT ══════════════════');
  console.log(`Org      : ${report.org}`);
  console.log(`Topics   : ${report.totals.topics}`);
  console.log(`Contents : ${report.totals.contents}`);
  console.log(`Quizzes  : ${report.totals.quizzes}`);
  console.log(`Questions: ${report.totals.questions}`);
  console.log(`Classrooms: ${report.totals.classrooms}`);
  console.log(`Stories  : ${report.totals.stories}`);
  console.log(`Failures : ${report.totals.failures}`);
  if (report.failures.length) {
    console.log('\n-- Failures --');
    for (const f of report.failures) {
      console.log(`  [${f.stage}] class ${f.classLevel} / ${f.title}: ${f.reason}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'kothnuru_seed_curriculum_result.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport written to scripts/kothnuru_seed_curriculum_result.json`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
