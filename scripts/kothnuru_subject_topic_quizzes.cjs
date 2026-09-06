/**
 * Kothnuru org - generate subject-level review quizzes + extra topic-content
 * practice quizzes.
 *
 * For each existing Kothnuru topic, create one additional "Practice Round 2"
 * quiz (3 easy questions) and link it to the topic via PUT /topics/:id/quizzes.
 *
 * For each (class_level, subject) pair that has topics, create one
 * subject-level review quiz (5 easy questions) with topic_id = NULL but
 * subject_id set, so it shows up under the subject view.
 *
 * Idempotent: existing quizzes are matched by title and skipped.
 *
 *   GATEWAY  default http://localhost:4000
 *   LOGIN_ID default teacher@kothnuru.ai
 *   LOGIN_PW default welcome
 */

const GATEWAY = process.env.GATEWAY || 'http://localhost:4000';
const LOGIN_ID = process.env.LOGIN_ID || 'teacher@kothnuru.ai';
const LOGIN_PW = process.env.LOGIN_PW || 'welcome';

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

const sc = (opts) => ({ options: opts.map((o, i) => ({ id: 'opt_' + i, label: o.l, is_correct: !!o.c })) });
const tf = (correct) => ({ options: [
  { id: 'opt_true',  label: 'True',  is_correct: correct },
  { id: 'opt_false', label: 'False', is_correct: !correct },
] });

// ───────── per-topic practice quiz questions (3 easy Qs each) ─────────
// Keyed by topic title from the DB.
const TOPIC_PRACTICE = {
  // Class 1
  'Numbers 1 to 20': [
    { t: 'Which number comes just after 14?', d: sc([{ l: '15', c: true }, { l: '13' }, { l: '16' }, { l: '12' }]) },
    { t: 'Count the dots: • • • • • • • •. How many?', d: sc([{ l: '8', c: true }, { l: '7' }, { l: '9' }, { l: '6' }]) },
    { t: 'The number 11 is bigger than 9.', d: tf(true) },
  ],
  'Class 1 - Place Value: Tens and Ones': [
    { t: 'In the number 23, how many tens are there?', d: sc([{ l: '2', c: true }, { l: '3' }, { l: '23' }, { l: '5' }]) },
    { t: 'In the number 45, the digit at the ones place is:', d: sc([{ l: '5', c: true }, { l: '4' }, { l: '0' }, { l: '9' }]) },
    { t: '17 = 1 ten + 7 ones.', d: tf(true) },
  ],
  'Naming Words (Nouns)': [
    { t: 'Which one is a naming word?', d: sc([{ l: 'mango', c: true }, { l: 'sing' }, { l: 'big' }, { l: 'jump' }]) },
    { t: 'Pick the name of an animal:', d: sc([{ l: 'cat', c: true }, { l: 'sleep' }, { l: 'tall' }, { l: 'happy' }]) },
    { t: '"Park" is a naming word for a place.', d: tf(true) },
  ],
  'Class 1 - Vowels and Consonants': [
    { t: 'Which letter is a vowel?', d: sc([{ l: 'E', c: true }, { l: 'B' }, { l: 'K' }, { l: 'P' }]) },
    { t: 'How many vowels are in the English alphabet?', d: sc([{ l: '5', c: true }, { l: '6' }, { l: '4' }, { l: '7' }]) },
    { t: 'The letter "M" is a vowel.', d: tf(false) },
  ],

  // Class 2
  'Addition up to 100': [
    { t: 'What is 24 + 35?', d: sc([{ l: '59', c: true }, { l: '49' }, { l: '69' }, { l: '57' }]) },
    { t: 'Add: 18 + 22 = ?', d: sc([{ l: '40', c: true }, { l: '30' }, { l: '38' }, { l: '42' }]) },
    { t: '50 + 50 makes 100.', d: tf(true) },
  ],
  'Class 2 - Subtraction up to 100': [
    { t: 'What is 30 - 12?', d: sc([{ l: '18', c: true }, { l: '22' }, { l: '20' }, { l: '17' }]) },
    { t: 'Subtract: 75 - 25 = ?', d: sc([{ l: '50', c: true }, { l: '40' }, { l: '60' }, { l: '55' }]) },
    { t: 'When you take away, the answer is smaller than the first number.', d: tf(true) },
  ],
  'Action Words (Verbs)': [
    { t: 'Which is an action word?', d: sc([{ l: 'run', c: true }, { l: 'cup' }, { l: 'red' }, { l: 'tall' }]) },
    { t: 'Pick the verb in: "She sings a song."', d: sc([{ l: 'sings', c: true }, { l: 'she' }, { l: 'song' }, { l: 'a' }]) },
    { t: '"Write" is an action word.', d: tf(true) },
  ],
  'Class 2 - Reading Short Sentences': [
    { t: 'In "The cat sat on the mat.", who sat?', d: sc([{ l: 'the cat', c: true }, { l: 'the mat' }, { l: 'the dog' }, { l: 'a boy' }]) },
    { t: 'A sentence ends with a:', d: sc([{ l: 'full stop', c: true }, { l: 'comma' }, { l: 'colon' }, { l: 'dash' }]) },
    { t: 'Every sentence starts with a small letter.', d: tf(false) },
  ],

  // Class 4
  'Multiplication and Times Tables': [
    { t: '7 × 6 = ?', d: sc([{ l: '42', c: true }, { l: '36' }, { l: '48' }, { l: '40' }]) },
    { t: 'What is 9 × 8?', d: sc([{ l: '72', c: true }, { l: '64' }, { l: '81' }, { l: '63' }]) },
    { t: '5 × 0 = 5.', d: tf(false) },
  ],
  'Class 4 - Division Basics': [
    { t: '24 ÷ 6 = ?', d: sc([{ l: '4', c: true }, { l: '3' }, { l: '6' }, { l: '5' }]) },
    { t: 'What is 35 ÷ 5?', d: sc([{ l: '7', c: true }, { l: '6' }, { l: '8' }, { l: '5' }]) },
    { t: 'Division is sharing equally.', d: tf(true) },
  ],
  'Parts of a Plant': [
    { t: 'Which part of a plant takes water from the soil?', d: sc([{ l: 'roots', c: true }, { l: 'leaf' }, { l: 'flower' }, { l: 'fruit' }]) },
    { t: 'The green part where food is made by sunlight is the:', d: sc([{ l: 'leaf', c: true }, { l: 'stem' }, { l: 'root' }, { l: 'seed' }]) },
    { t: 'The flower grows into a fruit.', d: tf(true) },
  ],
  'Class 4 - Past, Present and Future Tense': [
    { t: 'Pick the past tense of "play".', d: sc([{ l: 'played', c: true }, { l: 'plays' }, { l: 'playing' }, { l: 'will play' }]) },
    { t: '"She is reading a book." is in which tense?', d: sc([{ l: 'present', c: true }, { l: 'past' }, { l: 'future' }, { l: 'none' }]) },
    { t: '"Will go" is future tense.', d: tf(true) },
  ],

  // Class 5
  'Fractions and Decimals': [
    { t: '1/2 is the same as:', d: sc([{ l: '0.5', c: true }, { l: '0.2' }, { l: '0.05' }, { l: '5.0' }]) },
    { t: 'Which fraction is bigger: 3/4 or 1/4?', d: sc([{ l: '3/4', c: true }, { l: '1/4' }, { l: 'they are equal' }, { l: 'cannot tell' }]) },
    { t: '0.25 = 1/4.', d: tf(true) },
  ],
  'Class 5 - Lines and Angles (Easy Start)': [
    { t: 'A right angle measures:', d: sc([{ l: '90 degrees', c: true }, { l: '60 degrees' }, { l: '180 degrees' }, { l: '45 degrees' }]) },
    { t: 'Two lines that never meet are called:', d: sc([{ l: 'parallel', c: true }, { l: 'crossing' }, { l: 'curved' }, { l: 'broken' }]) },
    { t: 'A straight angle is 180 degrees.', d: tf(true) },
  ],
  'Our Body and Its Systems': [
    { t: 'Which organ pumps blood?', d: sc([{ l: 'heart', c: true }, { l: 'lungs' }, { l: 'liver' }, { l: 'stomach' }]) },
    { t: 'We breathe in air using our:', d: sc([{ l: 'lungs', c: true }, { l: 'kidney' }, { l: 'brain' }, { l: 'skin' }]) },
    { t: 'Bones make our skeleton.', d: tf(true) },
  ],
  'Class 5 - Plants and Animals - Living Things': [
    { t: 'Which is a living thing?', d: sc([{ l: 'tree', c: true }, { l: 'rock' }, { l: 'pencil' }, { l: 'chair' }]) },
    { t: 'Animals get their food by:', d: sc([{ l: 'eating other plants or animals', c: true }, { l: 'making it from sunlight' }, { l: 'soaking it from soil' }, { l: 'drinking only water' }]) },
    { t: 'All living things grow.', d: tf(true) },
  ],

  // Class 6
  'Whole Numbers and Integers': [
    { t: 'Which of these is a whole number?', d: sc([{ l: '8', c: true }, { l: '-3' }, { l: '0.5' }, { l: '-1.2' }]) },
    { t: 'The smallest whole number is:', d: sc([{ l: '0', c: true }, { l: '1' }, { l: '-1' }, { l: '10' }]) },
    { t: 'Every natural number is a whole number.', d: tf(true) },
  ],
  'Class 6 - Decimals - The Easy Way': [
    { t: '0.7 + 0.2 = ?', d: sc([{ l: '0.9', c: true }, { l: '0.5' }, { l: '0.09' }, { l: '1.0' }]) },
    { t: 'Which is bigger: 0.4 or 0.04?', d: sc([{ l: '0.4', c: true }, { l: '0.04' }, { l: 'equal' }, { l: 'cannot tell' }]) },
    { t: '1.5 means one and a half.', d: tf(true) },
  ],
  'Components of Food': [
    { t: 'Which food is rich in protein?', d: sc([{ l: 'eggs', c: true }, { l: 'sugar' }, { l: 'butter' }, { l: 'rice only' }]) },
    { t: 'The food that gives us energy mostly is:', d: sc([{ l: 'carbohydrates', c: true }, { l: 'water' }, { l: 'salt' }, { l: 'minerals only' }]) },
    { t: 'Vitamins keep us healthy.', d: tf(true) },
  ],
  'Class 6 - Air Around Us': [
    { t: 'Which gas do we breathe in?', d: sc([{ l: 'oxygen', c: true }, { l: 'carbon dioxide' }, { l: 'nitrogen only' }, { l: 'hydrogen' }]) },
    { t: 'Wind is:', d: sc([{ l: 'air in motion', c: true }, { l: 'still air' }, { l: 'water in motion' }, { l: 'sound only' }]) },
    { t: 'Air takes up space.', d: tf(true) },
  ],

  // Class 8
  'Linear Equations in One Variable': [
    { t: 'Solve: x + 5 = 12. x = ?', d: sc([{ l: '7', c: true }, { l: '17' }, { l: '5' }, { l: '12' }]) },
    { t: 'If 3x = 21, then x = ?', d: sc([{ l: '7', c: true }, { l: '6' }, { l: '8' }, { l: '24' }]) },
    { t: 'In x - 4 = 10, x = 14.', d: tf(true) },
  ],
  'Class 8 - Algebra: Letters in Maths': [
    { t: 'In algebra, the letter x usually stands for:', d: sc([{ l: 'an unknown number', c: true }, { l: 'a letter only' }, { l: 'always 10' }, { l: 'always 0' }]) },
    { t: '2x + 3x = ?', d: sc([{ l: '5x', c: true }, { l: '6x' }, { l: '23x' }, { l: 'x5' }]) },
    { t: 'a + a = 2a.', d: tf(true) },
  ],
  'Force and Pressure': [
    { t: 'A push or a pull on an object is called:', d: sc([{ l: 'force', c: true }, { l: 'speed' }, { l: 'mass' }, { l: 'time' }]) },
    { t: 'Pressure increases when the area becomes:', d: sc([{ l: 'smaller', c: true }, { l: 'bigger' }, { l: 'longer' }, { l: 'wider' }]) },
    { t: 'A heavy bag with thin straps hurts more because of higher pressure.', d: tf(true) },
  ],
  'Class 8 - Sound: How We Hear': [
    { t: 'Sound is produced when something:', d: sc([{ l: 'vibrates', c: true }, { l: 'sleeps' }, { l: 'glows' }, { l: 'melts' }]) },
    { t: 'Sound travels fastest in:', d: sc([{ l: 'solids', c: true }, { l: 'gases' }, { l: 'vacuum' }, { l: 'empty space' }]) },
    { t: 'Sound cannot travel in empty space (vacuum).', d: tf(true) },
  ],

  // Class 9
  'Polynomials': [
    { t: 'The degree of x^3 + 2x + 1 is:', d: sc([{ l: '3', c: true }, { l: '2' }, { l: '1' }, { l: '0' }]) },
    { t: 'A polynomial with one term is called:', d: sc([{ l: 'monomial', c: true }, { l: 'binomial' }, { l: 'trinomial' }, { l: 'zero' }]) },
    { t: '5 is a polynomial of degree 0.', d: tf(true) },
  ],
  'Class 9 - Coordinate Geometry (Easy Intro)': [
    { t: 'In a graph, the horizontal line is called:', d: sc([{ l: 'x-axis', c: true }, { l: 'y-axis' }, { l: 'origin' }, { l: 'plot' }]) },
    { t: 'The point (0, 0) is called:', d: sc([{ l: 'origin', c: true }, { l: 'centre' }, { l: 'corner' }, { l: 'unit' }]) },
    { t: 'In (3, 5), 3 is the x-coordinate.', d: tf(true) },
  ],
  'Atoms and Molecules': [
    { t: 'The smallest part of matter is an:', d: sc([{ l: 'atom', c: true }, { l: 'leaf' }, { l: 'rock' }, { l: 'star' }]) },
    { t: 'Water (H2O) is a:', d: sc([{ l: 'molecule', c: true }, { l: 'single atom' }, { l: 'metal' }, { l: 'gas only' }]) },
    { t: 'A molecule is made of two or more atoms joined together.', d: tf(true) },
  ],
  'Class 9 - Force: Push and Pull': [
    { t: 'A force is needed to:', d: sc([{ l: 'change the motion of an object', c: true }, { l: 'paint a wall' }, { l: 'see a picture' }, { l: 'hear sound' }]) },
    { t: 'The unit of force is:', d: sc([{ l: 'newton', c: true }, { l: 'metre' }, { l: 'second' }, { l: 'gram' }]) },
    { t: 'Friction is a kind of force.', d: tf(true) },
  ],

  // Class 10
  'Quadratic Equations': [
    { t: 'A quadratic equation has highest power equal to:', d: sc([{ l: '2', c: true }, { l: '1' }, { l: '3' }, { l: '0' }]) },
    { t: 'The roots of x^2 - 4 = 0 are:', d: sc([{ l: '2 and -2', c: true }, { l: '4 and 0' }, { l: '1 and -1' }, { l: 'only 2' }]) },
    { t: 'x^2 + 5x + 6 has two real roots.', d: tf(true) },
  ],
  'Class 10 - Trigonometry: Just the Basics': [
    { t: 'sin 30° = ?', d: sc([{ l: '1/2', c: true }, { l: '1' }, { l: '0' }, { l: '√3/2' }]) },
    { t: 'In a right triangle, the longest side is the:', d: sc([{ l: 'hypotenuse', c: true }, { l: 'base' }, { l: 'height' }, { l: 'angle' }]) },
    { t: 'cos 0° = 1.', d: tf(true) },
  ],
  'Acids, Bases and Salts': [
    { t: 'Lemon juice is:', d: sc([{ l: 'an acid', c: true }, { l: 'a base' }, { l: 'a salt' }, { l: 'a metal' }]) },
    { t: 'Soap solution turns red litmus to:', d: sc([{ l: 'blue', c: true }, { l: 'red' }, { l: 'green' }, { l: 'no change' }]) },
    { t: 'Acids taste sour.', d: tf(true) },
  ],
  'Class 10 - Light: Reflection in Mirrors': [
    { t: 'A plane mirror forms an image that is:', d: sc([{ l: 'same size as the object', c: true }, { l: 'always smaller' }, { l: 'always bigger' }, { l: 'upside down' }]) },
    { t: 'Angle of incidence equals angle of:', d: sc([{ l: 'reflection', c: true }, { l: 'refraction' }, { l: 'rotation' }, { l: 'incidence again' }]) },
    { t: 'Light travels in a straight line.', d: tf(true) },
  ],

  // Class 11
  'Sets and Functions': [
    { t: 'A collection of well-defined objects is called a:', d: sc([{ l: 'set', c: true }, { l: 'list only' }, { l: 'sum' }, { l: 'graph' }]) },
    { t: 'If A = {1,2}, B = {2,3}, then A ∩ B = ?', d: sc([{ l: '{2}', c: true }, { l: '{1,2,3}' }, { l: '{1,3}' }, { l: '{}' }]) },
    { t: 'A function pairs each input with one output.', d: tf(true) },
  ],
  'Class 11 - Sequences and Patterns': [
    { t: 'In 2, 4, 6, 8, ..., the next number is:', d: sc([{ l: '10', c: true }, { l: '12' }, { l: '9' }, { l: '11' }]) },
    { t: 'A sequence with a common difference is called:', d: sc([{ l: 'arithmetic', c: true }, { l: 'geometric' }, { l: 'random' }, { l: 'finite only' }]) },
    { t: 'In 3, 6, 12, 24, ... each term is multiplied by 2.', d: tf(true) },
  ],
  'Kinematics: Motion in a Straight Line': [
    { t: 'Speed is distance divided by:', d: sc([{ l: 'time', c: true }, { l: 'force' }, { l: 'mass' }, { l: 'area' }]) },
    { t: 'The SI unit of velocity is:', d: sc([{ l: 'm/s', c: true }, { l: 'km/hr only' }, { l: 'metre' }, { l: 'second' }]) },
    { t: 'Acceleration is the rate of change of velocity.', d: tf(true) },
  ],
  "Class 11 - Newton's First Law: Inertia": [
    { t: 'A body at rest stays at rest unless a force acts on it. This is:', d: sc([{ l: "Newton's First Law", c: true }, { l: 'Second Law' }, { l: 'Third Law' }, { l: 'No law' }]) },
    { t: 'The tendency of a body to resist change in motion is called:', d: sc([{ l: 'inertia', c: true }, { l: 'speed' }, { l: 'force' }, { l: 'pressure' }]) },
    { t: 'A heavy object has more inertia than a light one.', d: tf(true) },
  ],

  // Class 12
  'Calculus: Differentiation': [
    { t: "If f(x) = x^2, then f'(x) = ?", d: sc([{ l: '2x', c: true }, { l: 'x' }, { l: 'x^2' }, { l: '2' }]) },
    { t: "d/dx (sin x) = ?", d: sc([{ l: 'cos x', c: true }, { l: '-cos x' }, { l: '-sin x' }, { l: 'tan x' }]) },
    { t: "d/dx of a constant is 0.", d: tf(true) },
  ],
  'Class 12 - Integration: Sums That Never End': [
    { t: '∫ x dx = ?', d: sc([{ l: 'x^2/2 + C', c: true }, { l: 'x^2 + C' }, { l: '2x + C' }, { l: '1 + C' }]) },
    { t: 'Integration is the reverse of:', d: sc([{ l: 'differentiation', c: true }, { l: 'addition' }, { l: 'multiplication' }, { l: 'rotation' }]) },
    { t: '∫ 1 dx = x + C.', d: tf(true) },
  ],
  'Electromagnetic Induction': [
    { t: 'A changing magnetic field through a coil produces:', d: sc([{ l: 'an induced EMF', c: true }, { l: 'sound' }, { l: 'heat only' }, { l: 'nothing' }]) },
    { t: 'The law that gives the direction of induced current is:', d: sc([{ l: "Lenz's law", c: true }, { l: "Ohm's law" }, { l: "Boyle's law" }, { l: "Newton's law" }]) },
    { t: 'A generator converts mechanical energy into electrical energy.', d: tf(true) },
  ],
  'Class 12 - Wave Optics: Light as a Wave': [
    { t: 'Interference of light proves that light behaves like a:', d: sc([{ l: 'wave', c: true }, { l: 'particle only' }, { l: 'liquid' }, { l: 'gas' }]) },
    { t: 'In Young\u2019s double slit experiment we see:', d: sc([{ l: 'bright and dark fringes', c: true }, { l: 'rainbow only' }, { l: 'a single dot' }, { l: 'a square' }]) },
    { t: 'Light has wavelength.', d: tf(true) },
  ],
};

// ───────── per (class, subject) review quiz questions (5 each) ─────────
// Keyed by `${classLevel}|${subjectName}`.
const SUBJECT_REVIEW = {
  '1|English': {
    title: 'Class 1 - English Subject Review',
    description: 'Quick review of naming words, vowels and consonants for Class 1.',
    qs: [
      { t: 'Which of these is a naming word?', d: sc([{ l: 'school', c: true }, { l: 'run' }, { l: 'happy' }, { l: 'fast' }]) },
      { t: 'How many vowels are there in English?', d: sc([{ l: '5', c: true }, { l: '4' }, { l: '6' }, { l: '7' }]) },
      { t: '"A" is a vowel.', d: tf(true) },
      { t: 'Pick the name of an animal.', d: sc([{ l: 'cow', c: true }, { l: 'jump' }, { l: 'tall' }, { l: 'sing' }]) },
      { t: '"Run" is a naming word.', d: tf(false) },
    ],
  },
  '1|Mathematics': {
    title: 'Class 1 - Mathematics Subject Review',
    description: 'Counting and place value review for Class 1.',
    qs: [
      { t: 'What number comes after 9?', d: sc([{ l: '10', c: true }, { l: '8' }, { l: '11' }, { l: '0' }]) },
      { t: 'In 27, the tens digit is:', d: sc([{ l: '2', c: true }, { l: '7' }, { l: '0' }, { l: '9' }]) },
      { t: '15 is bigger than 12.', d: tf(true) },
      { t: 'Count: ★ ★ ★ ★. How many?', d: sc([{ l: '4', c: true }, { l: '3' }, { l: '5' }, { l: '6' }]) },
      { t: 'Number 0 means nothing.', d: tf(true) },
    ],
  },

  '2|English': {
    title: 'Class 2 - English Subject Review',
    description: 'Action words and short sentences for Class 2.',
    qs: [
      { t: 'Pick the action word.', d: sc([{ l: 'jump', c: true }, { l: 'mango' }, { l: 'bag' }, { l: 'red' }]) },
      { t: 'A sentence ends with a:', d: sc([{ l: 'full stop', c: true }, { l: 'comma' }, { l: 'colon' }, { l: 'space' }]) },
      { t: '"He runs fast." - the action word is "runs".', d: tf(true) },
      { t: 'A sentence starts with a:', d: sc([{ l: 'capital letter', c: true }, { l: 'small letter' }, { l: 'number' }, { l: 'symbol' }]) },
      { t: '"Eat" is an action word.', d: tf(true) },
    ],
  },
  '2|Mathematics': {
    title: 'Class 2 - Mathematics Subject Review',
    description: 'Addition and subtraction up to 100 for Class 2.',
    qs: [
      { t: '32 + 17 = ?', d: sc([{ l: '49', c: true }, { l: '39' }, { l: '52' }, { l: '47' }]) },
      { t: '60 - 15 = ?', d: sc([{ l: '45', c: true }, { l: '55' }, { l: '40' }, { l: '50' }]) },
      { t: '25 + 25 = 50.', d: tf(true) },
      { t: 'Which is the biggest number?', d: sc([{ l: '99', c: true }, { l: '90' }, { l: '79' }, { l: '88' }]) },
      { t: '100 - 1 = 99.', d: tf(true) },
    ],
  },

  '4|English': {
    title: 'Class 4 - English Subject Review',
    description: 'Tense practice for Class 4.',
    qs: [
      { t: 'Past tense of "go":', d: sc([{ l: 'went', c: true }, { l: 'goes' }, { l: 'going' }, { l: 'will go' }]) },
      { t: '"I am writing." is in:', d: sc([{ l: 'present tense', c: true }, { l: 'past tense' }, { l: 'future tense' }, { l: 'no tense' }]) },
      { t: 'Future tense often uses "will".', d: tf(true) },
      { t: 'Past tense of "eat":', d: sc([{ l: 'ate', c: true }, { l: 'eats' }, { l: 'eating' }, { l: 'will eat' }]) },
      { t: '"She plays" is past tense.', d: tf(false) },
    ],
  },
  '4|Environmental Studies (EVS)': {
    title: 'Class 4 - EVS Subject Review',
    description: 'Plants and surroundings for Class 4.',
    qs: [
      { t: 'Which part of the plant makes food?', d: sc([{ l: 'leaf', c: true }, { l: 'root' }, { l: 'stem' }, { l: 'soil' }]) },
      { t: 'Roots help the plant by:', d: sc([{ l: 'taking water from soil', c: true }, { l: 'making sound' }, { l: 'flying' }, { l: 'glowing' }]) },
      { t: 'Plants need sunlight to grow.', d: tf(true) },
      { t: 'A plant grows from a:', d: sc([{ l: 'seed', c: true }, { l: 'rock' }, { l: 'bag' }, { l: 'pencil' }]) },
      { t: 'Stem holds the plant upright.', d: tf(true) },
    ],
  },
  '4|Mathematics': {
    title: 'Class 4 - Mathematics Subject Review',
    description: 'Multiplication and division basics for Class 4.',
    qs: [
      { t: '6 × 7 = ?', d: sc([{ l: '42', c: true }, { l: '36' }, { l: '48' }, { l: '40' }]) },
      { t: '36 ÷ 6 = ?', d: sc([{ l: '6', c: true }, { l: '7' }, { l: '5' }, { l: '4' }]) },
      { t: '0 × 8 = 0.', d: tf(true) },
      { t: '5 × 9 = ?', d: sc([{ l: '45', c: true }, { l: '40' }, { l: '54' }, { l: '50' }]) },
      { t: 'Division is the opposite of multiplication.', d: tf(true) },
    ],
  },

  '5|Mathematics': {
    title: 'Class 5 - Mathematics Subject Review',
    description: 'Fractions, decimals, lines and angles for Class 5.',
    qs: [
      { t: '1/4 written as a decimal is:', d: sc([{ l: '0.25', c: true }, { l: '0.4' }, { l: '0.04' }, { l: '4' }]) },
      { t: 'A right angle is exactly:', d: sc([{ l: '90 degrees', c: true }, { l: '60 degrees' }, { l: '180 degrees' }, { l: '45 degrees' }]) },
      { t: '0.5 = 1/2.', d: tf(true) },
      { t: 'Two parallel lines:', d: sc([{ l: 'never meet', c: true }, { l: 'always cross' }, { l: 'curve' }, { l: 'are equal in colour' }]) },
      { t: 'A straight angle is 180 degrees.', d: tf(true) },
    ],
  },
  '5|Environmental Studies (EVS)': {
    title: 'Class 5 - EVS Subject Review',
    description: 'Living things and the human body for Class 5.',
    qs: [
      { t: 'Which organ pumps blood?', d: sc([{ l: 'heart', c: true }, { l: 'lungs' }, { l: 'stomach' }, { l: 'liver' }]) },
      { t: 'Which is a living thing?', d: sc([{ l: 'tree', c: true }, { l: 'rock' }, { l: 'pencil' }, { l: 'cup' }]) },
      { t: 'We breathe oxygen into our lungs.', d: tf(true) },
      { t: 'Plants grow on:', d: sc([{ l: 'soil', c: true }, { l: 'plastic' }, { l: 'metal' }, { l: 'paper' }]) },
      { t: 'All living things grow.', d: tf(true) },
    ],
  },

  '6|Mathematics': {
    title: 'Class 6 - Mathematics Subject Review',
    description: 'Whole numbers, integers and decimals for Class 6.',
    qs: [
      { t: 'The smallest whole number is:', d: sc([{ l: '0', c: true }, { l: '1' }, { l: '-1' }, { l: '10' }]) },
      { t: '0.6 + 0.4 = ?', d: sc([{ l: '1.0', c: true }, { l: '0.10' }, { l: '0.64' }, { l: '0.06' }]) },
      { t: '-3 is greater than -5.', d: tf(true) },
      { t: 'Which is bigger: 0.7 or 0.07?', d: sc([{ l: '0.7', c: true }, { l: '0.07' }, { l: 'equal' }, { l: 'cannot tell' }]) },
      { t: 'Every natural number is a whole number.', d: tf(true) },
    ],
  },
  '6|Science': {
    title: 'Class 6 - Science Subject Review',
    description: 'Food and air around us for Class 6.',
    qs: [
      { t: 'Which gas do we breathe in?', d: sc([{ l: 'oxygen', c: true }, { l: 'carbon dioxide' }, { l: 'helium' }, { l: 'hydrogen' }]) },
      { t: 'A food rich in protein is:', d: sc([{ l: 'eggs', c: true }, { l: 'sugar' }, { l: 'butter only' }, { l: 'cold drink' }]) },
      { t: 'Wind is moving air.', d: tf(true) },
      { t: 'Carbohydrates mainly give us:', d: sc([{ l: 'energy', c: true }, { l: 'water' }, { l: 'iron only' }, { l: 'no nutrition' }]) },
      { t: 'Vitamins are needed only in tiny amounts.', d: tf(true) },
    ],
  },

  '8|Mathematics': {
    title: 'Class 8 - Mathematics Subject Review',
    description: 'Algebra and linear equations for Class 8.',
    qs: [
      { t: 'Solve: 2x = 14. x = ?', d: sc([{ l: '7', c: true }, { l: '12' }, { l: '16' }, { l: '5' }]) },
      { t: '3a + 2a = ?', d: sc([{ l: '5a', c: true }, { l: '6a' }, { l: '32a' }, { l: 'a5' }]) },
      { t: 'In algebra, x is a variable.', d: tf(true) },
      { t: 'If x + 9 = 20, x = ?', d: sc([{ l: '11', c: true }, { l: '29' }, { l: '9' }, { l: '20' }]) },
      { t: 'A linear equation in one variable has highest power 1.', d: tf(true) },
    ],
  },
  '8|Science': {
    title: 'Class 8 - Science Subject Review',
    description: 'Force, pressure and sound for Class 8.',
    qs: [
      { t: 'A push or pull is called:', d: sc([{ l: 'force', c: true }, { l: 'speed' }, { l: 'mass' }, { l: 'time' }]) },
      { t: 'Sound is produced by:', d: sc([{ l: 'vibration', c: true }, { l: 'light' }, { l: 'colour' }, { l: 'fog' }]) },
      { t: 'Pressure is force per unit area.', d: tf(true) },
      { t: 'Sound travels fastest in:', d: sc([{ l: 'solids', c: true }, { l: 'gases' }, { l: 'vacuum' }, { l: 'space' }]) },
      { t: 'Sound can travel in vacuum.', d: tf(false) },
    ],
  },

  '9|Mathematics': {
    title: 'Class 9 - Mathematics Subject Review',
    description: 'Polynomials and coordinate geometry for Class 9.',
    qs: [
      { t: 'Degree of 3x^2 + 5x + 1:', d: sc([{ l: '2', c: true }, { l: '1' }, { l: '3' }, { l: '0' }]) },
      { t: 'Coordinates of the origin are:', d: sc([{ l: '(0, 0)', c: true }, { l: '(1, 1)' }, { l: '(0, 1)' }, { l: '(1, 0)' }]) },
      { t: 'The y-axis is vertical.', d: tf(true) },
      { t: 'A monomial has:', d: sc([{ l: 'one term', c: true }, { l: 'two terms' }, { l: 'three terms' }, { l: 'no term' }]) },
      { t: 'In point (4, -2), the y-coordinate is -2.', d: tf(true) },
    ],
  },
  '9|Science (Physics, Chemistry, Biology)': {
    title: 'Class 9 - Science Subject Review',
    description: 'Atoms, molecules and force for Class 9.',
    qs: [
      { t: 'Smallest particle of an element is:', d: sc([{ l: 'atom', c: true }, { l: 'cell' }, { l: 'rock' }, { l: 'leaf' }]) },
      { t: 'The unit of force is:', d: sc([{ l: 'newton', c: true }, { l: 'metre' }, { l: 'kilogram' }, { l: 'second' }]) },
      { t: 'A molecule of water is H2O.', d: tf(true) },
      { t: 'Friction is:', d: sc([{ l: 'a force that opposes motion', c: true }, { l: 'a kind of light' }, { l: 'a sound only' }, { l: 'a smell' }]) },
      { t: 'Force can change the shape of an object.', d: tf(true) },
    ],
  },

  '10|Mathematics': {
    title: 'Class 10 - Mathematics Subject Review',
    description: 'Quadratic equations and trigonometry for Class 10.',
    qs: [
      { t: 'A quadratic equation has highest power:', d: sc([{ l: '2', c: true }, { l: '1' }, { l: '3' }, { l: '0' }]) },
      { t: 'sin 90° = ?', d: sc([{ l: '1', c: true }, { l: '0' }, { l: '1/2' }, { l: '√3/2' }]) },
      { t: 'cos 0° = 1.', d: tf(true) },
      { t: 'Roots of x^2 - 9 = 0 are:', d: sc([{ l: '3 and -3', c: true }, { l: '9 and 0' }, { l: 'only 9' }, { l: '1 and -1' }]) },
      { t: 'In a right triangle, hypotenuse is the longest side.', d: tf(true) },
    ],
  },
  '10|Science (Physics, Chemistry, Biology)': {
    title: 'Class 10 - Science Subject Review',
    description: 'Acids/bases and reflection of light for Class 10.',
    qs: [
      { t: 'Lemon juice is:', d: sc([{ l: 'acidic', c: true }, { l: 'basic' }, { l: 'neutral' }, { l: 'metallic' }]) },
      { t: 'Angle of incidence equals angle of:', d: sc([{ l: 'reflection', c: true }, { l: 'refraction' }, { l: 'rotation' }, { l: 'fall' }]) },
      { t: 'Soap solution is basic.', d: tf(true) },
      { t: 'A plane mirror gives an image that is:', d: sc([{ l: 'same size as object', c: true }, { l: 'always smaller' }, { l: 'always upside down' }, { l: 'always coloured' }]) },
      { t: 'Light travels in straight lines.', d: tf(true) },
    ],
  },

  '11|Mathematics': {
    title: 'Class 11 - Mathematics Subject Review',
    description: 'Sets and sequences for Class 11.',
    qs: [
      { t: 'A ∩ B means:', d: sc([{ l: 'common elements', c: true }, { l: 'all elements' }, { l: 'no elements' }, { l: 'only A' }]) },
      { t: 'In 5, 10, 15, 20, ... common difference is:', d: sc([{ l: '5', c: true }, { l: '10' }, { l: '15' }, { l: '0' }]) },
      { t: 'A function maps each input to one output.', d: tf(true) },
      { t: 'Empty set is denoted by:', d: sc([{ l: '∅', c: true }, { l: '0' }, { l: '1' }, { l: 'A' }]) },
      { t: 'In 2, 4, 8, 16, the ratio is 2.', d: tf(true) },
    ],
  },
  '11|Physics': {
    title: 'Class 11 - Physics Subject Review',
    description: 'Motion and inertia for Class 11.',
    qs: [
      { t: 'SI unit of velocity is:', d: sc([{ l: 'm/s', c: true }, { l: 'kg' }, { l: 'metre' }, { l: 'second' }]) },
      { t: 'Inertia is the property by which a body:', d: sc([{ l: 'resists change in motion', c: true }, { l: 'glows' }, { l: 'melts' }, { l: 'colours up' }]) },
      { t: 'Acceleration is rate of change of velocity.', d: tf(true) },
      { t: 'Speed = distance / time.', d: tf(true) },
      { t: "Newton's First Law is also called:", d: sc([{ l: 'law of inertia', c: true }, { l: 'law of forces' }, { l: 'law of springs' }, { l: 'law of pressure' }]) },
    ],
  },

  '12|Mathematics': {
    title: 'Class 12 - Mathematics Subject Review',
    description: 'Calculus basics for Class 12.',
    qs: [
      { t: "d/dx (x^3) = ?", d: sc([{ l: '3x^2', c: true }, { l: 'x^2' }, { l: '3x' }, { l: 'x^3' }]) },
      { t: '∫ 2x dx = ?', d: sc([{ l: 'x^2 + C', c: true }, { l: '2 + C' }, { l: 'x + C' }, { l: '2x + C' }]) },
      { t: 'Differentiation and integration are inverse operations.', d: tf(true) },
      { t: 'd/dx (cos x) = ?', d: sc([{ l: '-sin x', c: true }, { l: 'sin x' }, { l: 'cos x' }, { l: 'tan x' }]) },
      { t: '∫ 0 dx = C.', d: tf(true) },
    ],
  },
  '12|Physics': {
    title: 'Class 12 - Physics Subject Review',
    description: 'Electromagnetic induction and wave optics for Class 12.',
    qs: [
      { t: 'Changing magnetic flux through a coil produces:', d: sc([{ l: 'induced EMF', c: true }, { l: 'sound only' }, { l: 'colour' }, { l: 'no effect' }]) },
      { t: 'Interference of light proves light is a:', d: sc([{ l: 'wave', c: true }, { l: 'metal' }, { l: 'particle only' }, { l: 'gas' }]) },
      { t: "Lenz's law gives the direction of induced current.", d: tf(true) },
      { t: 'A generator converts:', d: sc([{ l: 'mechanical energy to electrical', c: true }, { l: 'sound to light' }, { l: 'colour to heat' }, { l: 'water to gas' }]) },
      { t: 'Light has wavelength.', d: tf(true) },
    ],
  },
};

// ───────────────────────────── DRIVER ─────────────────────────────
async function main() {
  const login = await http('POST', `${GATEWAY}/auth/login`, null, { identifier: LOGIN_ID, password: LOGIN_PW });
  if (!login.ok || !login.json?.accessToken) {
    console.error(`Login failed for ${LOGIN_ID}: ${reason(login)}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  const orgId = login.json.user?.organizationId;
  console.log(`Logged in as ${LOGIN_ID} (role ${login.json.user?.activeRole}) -> org ${orgId}\n`);

  // Pull all kothnuru topics with subject names (single page)
  const topicsRes = await http('GET', `${GATEWAY}/topics?limit=300`, token);
  const allTopics = topicsRes.ok && Array.isArray(topicsRes.json?.topics) ? topicsRes.json.topics : [];
  if (allTopics.length === 0) {
    console.error(`No topics found via /topics: ${reason(topicsRes)}`);
    process.exit(1);
  }
  // The org filter is implicit from JWT; trust the result.
  console.log(`Loaded ${allTopics.length} topics from /topics.`);

  // Load existing quizzes (so we can dedupe by title)
  const existingQuizzesRes = await http('GET', `${GATEWAY}/quizzes/teacher/library?limit=500`, token);
  const existingQuizzes = existingQuizzesRes.ok && Array.isArray(existingQuizzesRes.json?.quizzes) ? existingQuizzesRes.json.quizzes : [];
  const existingTitles = new Set(existingQuizzes.map((q) => (q.title || '').trim()));
  console.log(`Loaded ${existingQuizzes.length} existing quizzes for dedupe.\n`);

  const totals = { topicQuizzes: 0, subjectQuizzes: 0, questions: 0, skipped: 0, failures: 0 };
  const failures = [];

  async function createQuiz({ title, description, classLevel, subject, difficulty, questions, topicId }) {
    if (existingTitles.has(title.trim())) {
      console.log(`    - skip (exists): ${title}`);
      totals.skipped++;
      return null;
    }
    const qres = await http('POST', `${GATEWAY}/quizzes`, token, {
      title,
      description,
      classLevel,
      subject,
      quizType: 'single_choice',
      difficultyLevel: difficulty || 'easy',
      theme: { learningContent: { topic: title, subject } },
      isPublished: true,
      isAiGenerated: true,
      isGlobal: false,
    });
    if (!qres.ok || !qres.json?.id) {
      console.error(`    x quiz create failed (${title}): ${reason(qres)}`);
      failures.push({ stage: 'quiz', title, reason: reason(qres) });
      totals.failures++;
      return null;
    }
    const quizId = qres.json.id;
    let qok = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qbody = {
        questionType: q.d.options.length === 2 && q.d.options[0].id === 'opt_true' ? 'true_false' : 'single_choice',
        questionTitle: q.t,
        questionInstruction: 'Choose your answer.',
        questionData: q.d,
        points: 10,
        timeLimitSeconds: 30,
        sortOrder: i + 1,
      };
      const qq = await http('POST', `${GATEWAY}/quizzes/${quizId}/questions`, token, qbody);
      if (qq.ok && qq.json?.id) {
        qok++;
        totals.questions++;
      } else {
        console.error(`      x question ${i + 1} failed (${title}): ${reason(qq)}`);
        failures.push({ stage: 'question', title, sortOrder: i + 1, reason: reason(qq) });
        totals.failures++;
      }
    }
    if (topicId) {
      const link = await http('PUT', `${GATEWAY}/topics/${topicId}/quizzes/${quizId}`, token);
      if (!link.ok) {
        console.error(`      x topic link failed (${title}): ${reason(link)}`);
        failures.push({ stage: 'topic-link', title, topicId, reason: reason(link) });
        totals.failures++;
      }
    }
    existingTitles.add(title.trim());
    console.log(`    \u2713 ${topicId ? 'topic' : 'subject'} quiz -> ${quizId} (${qok}/${questions.length} Qs)${topicId ? ' [topic-linked]' : ''}`);
    return quizId;
  }

  // 1) Per-topic practice quizzes
  console.log('\n=================== TOPIC PRACTICE QUIZZES ===================');
  for (const t of allTopics) {
    const qs = TOPIC_PRACTICE[t.title];
    if (!qs) {
      console.log(`  - skip (no template): ${t.title}`);
      continue;
    }
    console.log(`\n  Class ${t.classLevel} - ${t.subject} - ${t.title}`);
    const id = await createQuiz({
      title: `${t.title} - Practice Round 2`,
      description: `Extra practice questions for ${t.title}.`,
      classLevel: String(t.classLevel),
      subject: t.subject,
      difficulty: 'easy',
      questions: qs,
      topicId: t.id,
    });
    if (id) totals.topicQuizzes++;
  }

  // 2) Per (class, subject) review quizzes
  console.log('\n\n=================== SUBJECT REVIEW QUIZZES ===================');
  // Build the unique (class, subject) set from real topics so we only seed real combos
  const classSubjectSet = new Map();
  for (const t of allTopics) {
    const key = `${t.classLevel}|${t.subject}`;
    if (!classSubjectSet.has(key)) classSubjectSet.set(key, { classLevel: String(t.classLevel), subject: t.subject });
  }

  for (const [key, info] of classSubjectSet.entries()) {
    const tmpl = SUBJECT_REVIEW[key];
    if (!tmpl) {
      console.log(`  - skip (no template): ${key}`);
      continue;
    }
    console.log(`\n  Class ${info.classLevel} - ${info.subject}`);
    const id = await createQuiz({
      title: tmpl.title,
      description: tmpl.description,
      classLevel: info.classLevel,
      subject: info.subject,
      difficulty: 'easy',
      questions: tmpl.qs,
      topicId: null,
    });
    if (id) totals.subjectQuizzes++;
  }

  console.log('\n\n========================== SUMMARY ==========================');
  console.log(JSON.stringify({ totals, failureCount: failures.length, failures: failures.slice(0, 20) }, null, 2));
  if (failures.length > totals.failures) {
    // shouldn't happen, just sanity
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
