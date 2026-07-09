import type { VideoSection } from '../../types/videoContent';

export interface StatusVisual {
  label: string;
  color: string;
  bg: string;
}

// Sections are always live now; the only distinction that matters is whether a
// quiz is attached.
export function getSectionVisual(section: Pick<VideoSection, 'quizId'>): StatusVisual {
  if (!section.quizId) {
    return { label: 'No quiz', color: '#C77700', bg: '#FFF1DB' }; // orange
  }
  return { label: 'Quiz attached', color: '#2FA36B', bg: '#E1F6EC' }; // green
}
