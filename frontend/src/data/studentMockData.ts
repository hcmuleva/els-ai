// ── Student Progress Mock Data ─────────────────────────────────────────────
// Replace individual fields with real API calls as endpoints become available.

export type ChartPoint = { label: string; value: number };

export type SubjectTopic = {
  id: string;
  title: string;
  type: 'lesson' | 'quiz' | 'assignment';
  score: number;        // 0-100, -1 = not attempted
  durationMin: number;
  completedAt: string;  // ISO date string or ''
};

export type SubjectDetail = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  progressPct: number;
  totalLessons: number;
  completedLessons: number;
  avgScore: number;
  streak: number;        // days
  xpEarned: number;
  topics: SubjectTopic[];
  recentScores: number[]; // last 5 quiz scores
};

// ── Chart data per time period ─────────────────────────────────────────────
export const CHART_DATA: Record<'hour' | 'day' | 'week' | 'month', ChartPoint[]> = {
  hour: [
    { label: '8am',  value: 0  },
    { label: '9am',  value: 45 },
    { label: '10am', value: 80 },
    { label: '11am', value: 30 },
    { label: '12pm', value: 0  },
    { label: '1pm',  value: 60 },
    { label: '2pm',  value: 90 },
    { label: '3pm',  value: 50 },
  ],
  day: [
    { label: 'Mon', value: 40  },
    { label: 'Tue', value: 90  },
    { label: 'Wed', value: 60  },
    { label: 'Thu', value: 120 },
    { label: 'Fri', value: 80  },
    { label: 'Sat', value: 30  },
    { label: 'Sun', value: 100 },
  ],
  week: [
    { label: 'W1', value: 320 },
    { label: 'W2', value: 480 },
    { label: 'W3', value: 390 },
    { label: 'W4', value: 520 },
  ],
  month: [
    { label: 'Jan', value: 900  },
    { label: 'Feb', value: 1200 },
    { label: 'Mar', value: 750  },
    { label: 'Apr', value: 1400 },
    { label: 'May', value: 1100 },
    { label: 'Jun', value: 600  },
  ],
};

// ── Per-subject detail data ────────────────────────────────────────────────
export const SUBJECT_DETAILS: SubjectDetail[] = [
  {
    key: 'numbers',
    label: 'Numbers',
    emoji: '🦊',
    color: '#FF7043',
    bg: '#FFE8D6',
    progressPct: 80,
    totalLessons: 10,
    completedLessons: 8,
    avgScore: 88,
    streak: 5,
    xpEarned: 420,
    recentScores: [95, 80, 88, 72, 90],
    topics: [
      { id: 'n1', title: 'Counting 1–10',      type: 'lesson',     score: 100, durationMin: 12, completedAt: '2026-05-18' },
      { id: 'n2', title: 'Counting 11–20',     type: 'lesson',     score: 95,  durationMin: 10, completedAt: '2026-05-19' },
      { id: 'n3', title: 'Numbers Quiz #1',    type: 'quiz',       score: 88,  durationMin: 8,  completedAt: '2026-05-19' },
      { id: 'n4', title: 'Addition Basics',    type: 'lesson',     score: 90,  durationMin: 15, completedAt: '2026-05-20' },
      { id: 'n5', title: 'Subtraction Basics', type: 'lesson',     score: 72,  durationMin: 14, completedAt: '2026-05-20' },
      { id: 'n6', title: 'Numbers Quiz #2',    type: 'quiz',       score: 80,  durationMin: 9,  completedAt: '2026-05-21' },
      { id: 'n7', title: 'Shapes & Numbers',   type: 'lesson',     score: 85,  durationMin: 11, completedAt: '2026-05-21' },
      { id: 'n8', title: 'Number Patterns',    type: 'assignment', score: 78,  durationMin: 20, completedAt: '2026-05-21' },
      { id: 'n9', title: 'Big & Small Numbers',type: 'lesson',     score: -1,  durationMin: 13, completedAt: '' },
      { id: 'n10',title: 'Final Numbers Quiz', type: 'quiz',       score: -1,  durationMin: 10, completedAt: '' },
    ],
  },
  {
    key: 'alphabets',
    label: 'Alphabets',
    emoji: '🐧',
    color: '#4A90E2',
    bg: '#D6EAFF',
    progressPct: 65,
    totalLessons: 12,
    completedLessons: 8,
    avgScore: 76,
    streak: 3,
    xpEarned: 310,
    recentScores: [70, 85, 60, 78, 88],
    topics: [
      { id: 'a1', title: 'Letters A–E',        type: 'lesson',     score: 100, durationMin: 10, completedAt: '2026-05-17' },
      { id: 'a2', title: 'Letters F–J',        type: 'lesson',     score: 90,  durationMin: 10, completedAt: '2026-05-18' },
      { id: 'a3', title: 'Alphabet Quiz #1',   type: 'quiz',       score: 70,  durationMin: 8,  completedAt: '2026-05-18' },
      { id: 'a4', title: 'Letters K–O',        type: 'lesson',     score: 85,  durationMin: 12, completedAt: '2026-05-19' },
      { id: 'a5', title: 'Letters P–T',        type: 'lesson',     score: 78,  durationMin: 11, completedAt: '2026-05-20' },
      { id: 'a6', title: 'Alphabet Quiz #2',   type: 'quiz',       score: 85,  durationMin: 9,  completedAt: '2026-05-20' },
      { id: 'a7', title: 'Letters U–Z',        type: 'lesson',     score: 60,  durationMin: 10, completedAt: '2026-05-21' },
      { id: 'a8', title: 'Word Formation',     type: 'assignment', score: 88,  durationMin: 18, completedAt: '2026-05-21' },
      { id: 'a9', title: 'Capital vs Small',   type: 'lesson',     score: -1,  durationMin: 12, completedAt: '' },
      { id: 'a10',title: 'Vowels & Consonants',type: 'lesson',     score: -1,  durationMin: 13, completedAt: '' },
      { id: 'a11',title: 'Spelling Basics',    type: 'quiz',       score: -1,  durationMin: 10, completedAt: '' },
      { id: 'a12',title: 'Final Alphabet Quiz',type: 'quiz',       score: -1,  durationMin: 10, completedAt: '' },
    ],
  },
  {
    key: 'animals',
    label: 'Animals',
    emoji: '🐾',
    color: '#7DC67A',
    bg: '#D6F5D6',
    progressPct: 90,
    totalLessons: 8,
    completedLessons: 7,
    avgScore: 93,
    streak: 7,
    xpEarned: 560,
    recentScores: [95, 92, 90, 98, 88],
    topics: [
      { id: 'an1', title: 'Farm Animals',      type: 'lesson',     score: 100, durationMin: 10, completedAt: '2026-05-15' },
      { id: 'an2', title: 'Wild Animals',      type: 'lesson',     score: 95,  durationMin: 12, completedAt: '2026-05-16' },
      { id: 'an3', title: 'Animals Quiz #1',   type: 'quiz',       score: 92,  durationMin: 8,  completedAt: '2026-05-17' },
      { id: 'an4', title: 'Sea Creatures',     type: 'lesson',     score: 88,  durationMin: 11, completedAt: '2026-05-18' },
      { id: 'an5', title: 'Birds of the Sky',  type: 'lesson',     score: 98,  durationMin: 10, completedAt: '2026-05-19' },
      { id: 'an6', title: 'Animals Quiz #2',   type: 'quiz',       score: 90,  durationMin: 9,  completedAt: '2026-05-20' },
      { id: 'an7', title: 'Animal Sounds',     type: 'assignment', score: 95,  durationMin: 15, completedAt: '2026-05-21' },
      { id: 'an8', title: 'Final Animals Quiz',type: 'quiz',       score: -1,  durationMin: 10, completedAt: '' },
    ],
  },
  {
    key: 'colors',
    label: 'Colors',
    emoji: '🎨',
    color: '#9B8EC4',
    bg: '#EDE4FF',
    progressPct: 55,
    totalLessons: 8,
    completedLessons: 4,
    avgScore: 68,
    streak: 2,
    xpEarned: 200,
    recentScores: [65, 72, 60, 75, 68],
    topics: [
      { id: 'c1', title: 'Primary Colors',     type: 'lesson',     score: 90,  durationMin: 10, completedAt: '2026-05-18' },
      { id: 'c2', title: 'Secondary Colors',   type: 'lesson',     score: 75,  durationMin: 10, completedAt: '2026-05-19' },
      { id: 'c3', title: 'Colors Quiz #1',     type: 'quiz',       score: 65,  durationMin: 8,  completedAt: '2026-05-20' },
      { id: 'c4', title: 'Mixing Colors',      type: 'assignment', score: 72,  durationMin: 20, completedAt: '2026-05-21' },
      { id: 'c5', title: 'Shades & Tints',     type: 'lesson',     score: -1,  durationMin: 12, completedAt: '' },
      { id: 'c6', title: 'Colors in Nature',   type: 'lesson',     score: -1,  durationMin: 11, completedAt: '' },
      { id: 'c7', title: 'Colors Quiz #2',     type: 'quiz',       score: -1,  durationMin: 9,  completedAt: '' },
      { id: 'c8', title: 'Final Colors Quiz',  type: 'quiz',       score: -1,  durationMin: 10, completedAt: '' },
    ],
  },
];

// ── Summary stats ──────────────────────────────────────────────────────────
export const STUDENT_SUMMARY = {
  totalXp:        1490,
  weeklyXp:       520,
  dayStreak:      7,
  lessonsCompleted: 27,
  avgScore:       82,
  quizzesDone:    10,
  rank:           15,
  badges:         5,
};

export const BADGES_DATA = [
  { emoji: '🏆', label: 'Top 10',  bg: '#FFF5CC', earned: true  },
  { emoji: '❤️', label: 'Kind',    bg: '#FFE8D6', earned: true  },
  { emoji: '🌿', label: 'Nature',  bg: '#D6F5D6', earned: true  },
  { emoji: '🔮', label: 'Magic',   bg: '#EDE4FF', earned: true  },
  { emoji: '⭐', label: 'Learner', bg: '#D6EAFF', earned: true  },
  { emoji: '🔒', label: 'Locked',  bg: '#F0F0F8', earned: false },
];
