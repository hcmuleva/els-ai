export type UserRole = 'student' | 'teacher' | 'parent' | 'admin' | 'superadmin';

export type UserRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  active_role: UserRole;
  profile_image?: string;
};

export type UserWithRoles = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  classLevel?: string;
  branch?: string;
  activeRole: UserRole;
  roles: UserRole[];
  profileImage?: string;
  organizationId?: string;
  isActive?: boolean;
};

export type QuizRecord = {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  thumbnail_image?: string;
  created_by?: string;
  class_level?: string;
  subject?: string;
  quiz_type: string;
  difficulty_level?: string;
  background_music_url?: string;
  theme: any;
  total_questions: number;
  is_published: boolean;
  is_ai_generated: boolean;
  created_at: string;
};

export type QuizQuestionRecord = {
  id: string;
  quiz_id: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  question_audio?: string;
  time_limit_seconds: number;
  points: number;
  sort_order?: number;
  question_data: any;
};
