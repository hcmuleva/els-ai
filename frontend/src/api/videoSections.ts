import type {
  AgeGroup,
  Difficulty,
  SectionQuizPayload,
  SectionStatus,
  StudentVideoProgress,
  TeacherVideoProgressSummary,
  VideoSection,
  WatchStatus,
} from '../types/videoContent';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

export interface CreateSectionInput {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  learningObjective?: string;
  ageGroup?: AgeGroup;
  category?: string;
  difficulty?: Difficulty;
  contentSectionOrder?: number;
}

export type UpdateSectionInput = Partial<CreateSectionInput> & { status?: SectionStatus };

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body && (body.reason || body.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function createVideoSectionsApi(apiFetch: ApiFetch) {
  const jsonHeaders = { 'Content-Type': 'application/json' };
  return {
    list(contentId: string, sectionOrder?: number): Promise<VideoSection[]> {
      const qs = sectionOrder != null ? `?sectionOrder=${sectionOrder}` : '';
      return apiFetch(`/content/${contentId}/video-sections${qs}`).then((r) => readJson<VideoSection[]>(r));
    },
    create(
      contentId: string,
      input: CreateSectionInput,
      sectionOrder?: number,
    ): Promise<{ sectionId: string; section: VideoSection }> {
      const body = sectionOrder != null ? { ...input, contentSectionOrder: sectionOrder } : input;
      return apiFetch(`/content/${contentId}/video-sections`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }).then((r) => readJson(r));
    },
    update(sectionId: string, input: UpdateSectionInput): Promise<VideoSection> {
      return apiFetch(`/video-sections/${sectionId}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify(input),
      }).then((r) => readJson<VideoSection>(r));
    },
    remove(sectionId: string): Promise<{ status: string }> {
      return apiFetch(`/video-sections/${sectionId}`, { method: 'DELETE' }).then((r) => readJson(r));
    },
    attachQuiz(sectionId: string, quizId: string): Promise<VideoSection> {
      return apiFetch(`/video-sections/${sectionId}/quiz`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ quizId }),
      }).then((r) => readJson<VideoSection>(r));
    },
    detachQuiz(sectionId: string): Promise<VideoSection> {
      return apiFetch(`/video-sections/${sectionId}/quiz`, { method: 'DELETE' }).then((r) => readJson<VideoSection>(r));
    },
    getQuiz(sectionId: string): Promise<SectionQuizPayload> {
      return apiFetch(`/video-sections/${sectionId}/quiz`).then((r) => readJson<SectionQuizPayload>(r));
    },
    submitQuiz(sectionId: string, score: number, totalPoints: number): Promise<{ quizScore: number; quizStatus: WatchStatus }> {
      return apiFetch(`/video-sections/${sectionId}/quiz/submit`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ score, totalPoints }),
      }).then((r) => readJson(r));
    },
    saveProgress(
      sectionId: string,
      input: { videoWatchStatus?: WatchStatus; watchedSeconds?: number },
    ): Promise<{ videoWatchStatus: WatchStatus; quizStatus: WatchStatus; watchedSeconds: number }> {
      return apiFetch(`/video-sections/${sectionId}/progress`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(input),
      }).then((r) => readJson(r));
    },
    myProgress(contentId: string): Promise<StudentVideoProgress[]> {
      return apiFetch(`/video-sections/content/${contentId}/my-progress`).then((r) => readJson<StudentVideoProgress[]>(r));
    },
    dashboard(contentId: string): Promise<TeacherVideoProgressSummary> {
      return apiFetch(`/content/${contentId}/video-progress`).then((r) => readJson<TeacherVideoProgressSummary>(r));
    },
  };
}

export type VideoSectionsApi = ReturnType<typeof createVideoSectionsApi>;
