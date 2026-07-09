import type { SectionValidationResult, VideoSection } from '../types/videoContent';

type RangeSection = Pick<VideoSection, 'id' | 'title' | 'startTime' | 'endTime'>;

// A new section overlaps an existing one when:
//   newStart < existingEnd AND newEnd > existingStart
export function isOverlapping(
  newStart: number,
  newEnd: number,
  existing: RangeSection[],
  ignoreId?: string,
): SectionValidationResult {
  for (const s of existing) {
    if (ignoreId && s.id === ignoreId) continue;
    if (newStart < s.endTime && newEnd > s.startTime) {
      return { isValid: false, reason: `Selected time overlaps with "${s.title}"` };
    }
  }
  return { isValid: true };
}

export interface ValidateSectionArgs {
  startTime: number | null;
  endTime: number | null;
  videoDuration?: number | null;
  existing: RangeSection[];
  ignoreId?: string;
}

// Full client-side validation mirroring the DB constraints so the UI can flag
// problems before hitting the API.
export function validateSection({
  startTime,
  endTime,
  videoDuration,
  existing,
  ignoreId,
}: ValidateSectionArgs): SectionValidationResult {
  if (startTime == null || endTime == null) {
    return { isValid: false, reason: 'Enter a valid start and end time' };
  }
  if (startTime < 0) {
    return { isValid: false, reason: 'Start time must be 0 or greater' };
  }
  if (endTime <= startTime) {
    return { isValid: false, reason: 'End time must be greater than start time' };
  }
  if (videoDuration != null && videoDuration > 0 && endTime > videoDuration) {
    return { isValid: false, reason: 'End time exceeds the video duration' };
  }
  return isOverlapping(startTime, endTime, existing, ignoreId);
}
