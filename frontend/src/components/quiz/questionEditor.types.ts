// Question editor — shared types and constants.
// Extracted from frontend/app/(tabs)/manage.tsx so the editor JSX can be reused
// from manage.tsx and from the inline Create-Question tab in CreateQuizModal.

export type QuestionEditorMode =
  | 'choice'
  | 'drag_drop'
  | 'logico'
  | 'memory_match'
  | 'fill_blank'
  | 'jigsaw'
  | 'custom';

export type SupportedQuestionType =
  | 'guess_image'
  | 'drag_drop_match'
  | 'guess_audio'
  | 'true_false'
  | 'single_choice'
  | 'multi_choice'
  | 'logico'
  | 'memory_match'
  | 'fill_blank'
  | 'jigsaw';

export type OptionDraft = {
  id: string;
  slotPosition: number;
  image: string;
  imageLabel: string;
  imageAssetId: string;
  audio: string;
  audioLabel: string;
  audioAssetId: string;
  label: string;
  isCorrect: boolean;
};

export type MatchPairDraft = {
  id: string;
  itemLabel: string;
  targetLabel: string;
  image: string;
  imageLabel: string;
  imageAssetId: string;
  audio: string;
  audioLabel: string;
  audioAssetId: string;
};

export type QuestionDraft = {
  classLevel: string;
  subject: string;
  questionTitle: string;
  questionInstruction: string;
  questionType: string;
  mainImage: string;
  mainImageLabel: string;
  mainImageAssetId: string;
  mainAudio: string;
  mainAudioLabel: string;
  mainAudioAssetId: string;
  points: string;
  timeLimitSeconds: string;
  sortOrder: string;
  options: OptionDraft[];
  matchPairs: MatchPairDraft[];
  rawQuestionData: unknown;
};

export type MediaRemovalRequest =
  | { scope: 'question'; mediaType: 'image' | 'audio' }
  | { scope: 'option'; index: number; mediaType: 'image' | 'audio' }
  | { scope: 'pair'; index: number; mediaType: 'image' | 'audio' };

export type OptionRemovalRequest = { index: number };

export type QuestionItemForEdit = {
  id: string;
  class_level?: string;
  subject?: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  question_audio?: string;
  time_limit_seconds: number;
  points: number;
  sort_order?: number;
  question_data: unknown;
};

export const QUESTION_TYPE_CHOICES: Array<{ value: SupportedQuestionType; label: string; description: string }> = [
  {
    value: 'guess_image',
    label: 'Guess the Image',
    description: 'Show a main image prompt and let students choose the correct image option.',
  },
  {
    value: 'drag_drop_match',
    label: 'Drag & Drop Match',
    description: 'Students drag each item and drop it on the correct matching target.',
  },
  {
    value: 'guess_audio',
    label: 'Guess the Audio',
    description: 'Play a main audio prompt and ask students to pick the correct option.',
  },
  {
    value: 'true_false',
    label: 'True / False',
    description: 'Students answer using exactly two options: True and False.',
  },
  {
    value: 'single_choice',
    label: 'Single Choice',
    description: 'Students pick exactly one correct answer from multiple options.',
  },
  {
    value: 'multi_choice',
    label: 'Multi Choice',
    description: 'Students select all correct options. Score is correct only when all are selected with no wrong picks.',
  },
  {
    value: 'logico',
    label: 'Logico',
    description: 'Upload a worksheet image and map each Logico button to slot positions 1 to 10.',
  },
  {
    value: 'memory_match',
    label: 'Memory Match',
    description: 'Card flip matching game — students pair up matching cards on a grid.',
  },
  {
    value: 'fill_blank',
    label: 'Fill in the Blank',
    description: 'Students complete a sentence by selecting the missing word from options.',
  },
  {
    value: 'jigsaw',
    label: 'Jigsaw Puzzle',
    description: 'Students drag and rearrange puzzle pieces of an uploaded image.',
  },
];

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  guess_image: 'Guess the Image',
  drag_drop_match: 'Drag & Drop Match',
  guess_audio: 'Guess the Audio',
  true_false: 'True / False',
  single_choice: 'Single Choice',
  multi_choice: 'Multi Choice',
  logico: 'Logico',
  memory_match: 'Memory Match',
  fill_blank: 'Fill in the Blank',
  jigsaw: 'Jigsaw Puzzle',
  image_select: 'Guess the Image',
  drag_drop: 'Drag & Drop Match',
  sound_match: 'Guess the Audio',
  memory_game: 'Multi Choice',
};

export const QUESTION_TYPE_DEFAULT_INSTRUCTIONS: Record<SupportedQuestionType, string> = {
  guess_image: 'Look at the main image and choose the correct option.',
  drag_drop_match: 'Drag each item and drop it on the correct matching target.',
  guess_audio: 'Listen to the audio and choose the correct answer.',
  true_false: 'Read the statement carefully and choose True or False.',
  single_choice: 'Choose one correct option.',
  multi_choice: 'Select all correct options before submitting your answer.',
  logico: 'Match each Logico button with the correct option position from top to bottom.',
  memory_match: 'Tap cards to find all matching pairs before time runs out.',
  fill_blank: 'Read the sentence carefully and choose the correct missing word.',
  jigsaw: 'Drag and rearrange pieces until the full image is complete.',
};

export const QUESTION_TYPE_ALIASES: Record<string, SupportedQuestionType> = {
  image_select: 'guess_image',
  drag_drop: 'drag_drop_match',
  sound_match: 'guess_audio',
  memory_game: 'multi_choice',
};

export const QTYPES_EMOJI: Record<string, string> = {
  guess_image: '',
  drag_drop_match: '',
  guess_audio: '',
  true_false: '',
  single_choice: '',
  multi_choice: '',
  logico: '',
};

export const QTYPES_COLOR: Record<string, string> = {
  guess_image: '#4A90E2',
  drag_drop_match: '#9B8EC4',
  guess_audio: '#7DC67A',
  true_false: '#E6A817',
  single_choice: '#FF7043',
  multi_choice: '#E91E8C',
  logico: '#0f766e',
  memory_match: '#7B4FCA',
  fill_blank: '#E6A020',
  jigsaw: '#0EA5E9',
};

export const QTYPES_BG: Record<string, string> = {
  guess_image: '#D6EAFF',
  drag_drop_match: '#EDE4FF',
  guess_audio: '#D6F5D6',
  true_false: '#FFF5CC',
  single_choice: '#FFE8D6',
  multi_choice: '#FFE0F0',
  logico: '#DCFCE7',
  memory_match: '#EDE4FF',
  fill_blank: '#FFF5CC',
  jigsaw: '#E0F2FE',
};
