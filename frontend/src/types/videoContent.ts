export type VideoType = 'youtube' | 'uploaded';
export type SectionStatus = 'draft' | 'ready' | 'published';
export type AgeGroup = '5-10' | '11-14' | '15-18';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type WatchStatus = 'not_started' | 'in_progress' | 'completed';

export interface VideoSection {
  id: string;
  contentId: string;
  title: string;
  description?: string;
  startTime: number; // seconds
  endTime: number; // seconds
  duration: number; // derived endTime - startTime
  learningObjective?: string;
  ageGroup?: AgeGroup;
  category?: string;
  difficulty?: Difficulty;
  quizId?: string;
  status: SectionStatus;
  contentSectionOrder?: number;
  sectionOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoContent {
  id: string;
  title: string;
  description?: string;
  videoType: VideoType;
  videoUrl: string;
  youtubeVideoId?: string;
  duration: number;
  sections: VideoSection[];
  status: 'draft' | 'published';
}

export interface StudentVideoProgress {
  sectionId: string;
  videoWatchStatus: WatchStatus;
  quizStatus: WatchStatus;
  watchedSeconds: number;
  quizScore?: number;
  completedAt?: string;
}

export interface SectionValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface TeacherVideoProgressSummary {
  contentId: string;
  totalSections: number;
  publishedSections: number;
  sectionsWithQuiz: number;
  sectionsWithoutQuiz: number;
  studentCompletionPct: number;
  quizAverageScore: number | null;
  studentsPendingQuiz: Array<{ studentId: string; name: string | null; sectionId: string }>;
  studentsFailedQuiz: Array<{ studentId: string; name: string | null; sectionId: string; score: number }>;
  studentsRequiringIntervention: Array<{ studentId: string; name: string | null; score: number }>;
}

export interface SectionQuizPayload {
  quiz: {
    id: string;
    title: string;
    description?: string;
    difficulty?: string;
    questions: Array<Record<string, unknown>>;
  } | null;
}
