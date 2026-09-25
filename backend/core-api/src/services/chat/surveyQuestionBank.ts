export interface SurveyTopic {
  id: string;
  category: 'academic' | 'behavioral' | 'routine';
  title: string;
  prompt: string;
  followUpTriggers: string[];
}

export const SURVEY_TOPICS: SurveyTopic[] = [
  {
    id: 'reading_progress',
    category: 'academic',
    title: 'Reading & Literacy',
    prompt:
      "How is your child's reading or phonics progress going lately? Are they enjoying reading books or stories, or having trouble with certain words or sounds?",
    followUpTriggers: ['struggle', 'difficulty', 'confused', 'mixes', 'slow'],
  },
  {
    id: 'math_numbers',
    category: 'academic',
    title: 'Math & Numbers',
    prompt:
      'How are they feeling about math concepts, counting, and problem-solving puzzles at home or in class?',
    followUpTriggers: ['hard', 'frustrated', 'gives up', 'avoids'],
  },
  {
    id: 'focus_attention',
    category: 'behavioral',
    title: 'Focus & Attention',
    prompt:
      'During study time or activities, how long can they typically stay focused without getting distracted or needing a break?',
    followUpTriggers: ['restless', 'minutes', 'short', 'distracted', 'wanders'],
  },
  {
    id: 'study_routine',
    category: 'routine',
    title: 'Study Habits & Routine',
    prompt:
      'What does their daily homework or learning routine look like? Do they do it independently or need regular guidance?',
    followUpTriggers: ['fights', 'procrastinates', 'needs help', 'reminders'],
  },
  {
    id: 'strengths_passions',
    category: 'academic',
    title: 'Special Strengths & Interests',
    prompt:
      'What subjects or creative topics do they get most excited about and excel in?',
    followUpTriggers: ['loves', 'great at', 'drawing', 'curious', 'expert'],
  },
];
