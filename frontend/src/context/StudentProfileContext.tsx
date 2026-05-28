import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const SELECTED_STUDENT_KEY = 'els_selected_student_id';

export type StudentProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  classLevel?: string;
  profileImage?: string;
  analytics: {
    streakDays: number;
    consistencyScore: number;
    completionRate: number;
    attemptedCount: number;
    completedCount: number;
    totalTimeSeconds: number;
  };
};

export type QuizAttempt = {
  id: string;
  quizTitle: string;
  classLevel?: string;
  score: number;
  totalPoints: number;
  scorePct: number;
  totalQuestions: number;
  correctCount: number;
  attemptedAt: string;
  kind?: 'classroom' | 'story' | 'subject';
};

export type AssignmentItem = {
  id: string;
  title: string;
  fileUrl?: string;
  status: string;
  submittedAt?: string;
  grade?: number;
  feedback?: string;
  createdAt: string;
};

export type UpcomingClassroom = {
  id: string;
  title: string;
  classLevel: string;
  status: string;
  description?: string;
};

export type ClassroomRemarkItem = {
  id: string;
  title: string;
  classLevel: string;
  status: string;
  createdAt: string;
  endedAt?: string | null;
  remarkText?: string | null;
  parentNote?: string | null;
  remarkMediaUrl?: string | null;
  scoreBehavior?: number | null;
  scoreConfidence?: number | null;
  scoreParticipation?: number | null;
  scorePerformance?: number | null;
  achievements: Array<{ id: string; name: string; emoji: string; color: string; description?: string; grantedAt?: string }>;
};

export type ActivityItem = {
  id: string;
  activityType: 'content' | 'quiz' | 'assignment';
  referenceId?: string;
  referenceTitle?: string;
  status: 'completed' | 'pending' | 'attempted';
  score?: number;
  timeSpentSeconds: number;
  activityDate: string;
  createdAt: string;
};

export type StudentAnalytics = {
  summary: {
    streakDays: number;
    consistencyScore: number;
    attemptedCount: number;
    notAttemptedCount: number;
    completedCount: number;
    completionRate: number;
    totalTimeSeconds: number;
  } | null;
  daily: Array<{
    date: string;
    streakDays: number;
    consistencyScore: number;
    attemptedCount: number;
    completedCount: number;
    completionRate: number;
    totalTimeSeconds: number;
  }>;
  breakdown: Record<string, { count: number; totalTime: number; avgScore: number | null }>;
};

type StudentProfileContextType = {
  linkedStudents: StudentProfile[];
  activeStudent: StudentProfile | null;
  loadingStudents: boolean;
  loadingActivity: boolean;
  loadingAnalytics: boolean;
  activity: ActivityItem[];
  analytics: StudentAnalytics | null;
  quizAttempts: QuizAttempt[];
  assignments: AssignmentItem[];
  upcomingClassrooms: UpcomingClassroom[];
  classroomRemarks: { active: ClassroomRemarkItem[]; completed: ClassroomRemarkItem[] };
  switchToStudent: (studentId: string) => void;
  refreshAll: () => void;
  logActivity: (payload: {
    activityType: 'content' | 'quiz' | 'assignment';
    referenceId?: string;
    referenceTitle?: string;
    status?: 'completed' | 'pending' | 'attempted';
    score?: number;
    timeSpentSeconds?: number;
  }) => Promise<void>;
};

const StudentProfileContext = createContext<StudentProfileContextType | null>(null);

export function StudentProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, apiFetch } = useAuth();

  const [linkedStudents, setLinkedStudents] = useState<StudentProfile[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  // Restore persisted selection on mount
  useEffect(() => {
    AsyncStorage.getItem(SELECTED_STUDENT_KEY).then((id) => {
      if (id) setRestoredId(id);
    }).catch(() => {});
  }, []);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [upcomingClassrooms, setUpcomingClassrooms] = useState<UpcomingClassroom[]>([]);
  const [classroomRemarks, setClassroomRemarks] = useState<{ active: ClassroomRemarkItem[]; completed: ClassroomRemarkItem[] }>({ active: [], completed: [] });

  const isParent = user?.activeRole === 'parent';
  const isStudent = user?.activeRole === 'student';

  // Fetch list of children for parents
  const fetchLinkedStudents = useCallback(async () => {
    if (!user || !isParent) return;
    setLoadingStudents(true);
    try {
      const res = await apiFetch(`/students/parent/${user.id}/students`);
      if (res.ok) {
        const data = await res.json();
        const students: StudentProfile[] = data.students || [];
        setLinkedStudents(students);
        if (students.length > 0 && !activeStudentId) {
          // Prefer previously saved selection, fall back to first
          const savedId = restoredId ?? await AsyncStorage.getItem(SELECTED_STUDENT_KEY).catch(() => null);
          const match = savedId ? students.find((s) => s.id === savedId) : null;
          setActiveStudentId(match ? match.id : students[0].id);
        }
      }
    } catch (e) {
      console.warn('[StudentProfile] fetchLinkedStudents error:', e);
    } finally {
      setLoadingStudents(false);
    }
  }, [user, isParent, apiFetch, activeStudentId, restoredId]);

  // Fetch activity for active student
  const fetchActivity = useCallback(async (studentId: string) => {
    setLoadingActivity(true);
    try {
      const res = await apiFetch(`/students/${studentId}/activity?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activities || []);
      }
    } catch (e) {
      console.warn('[StudentProfile] fetchActivity error:', e);
    } finally {
      setLoadingActivity(false);
    }
  }, [apiFetch]);

  const fetchQuizAttempts = useCallback(async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/quiz-attempts?limit=100`);
      if (res.ok) { const d = await res.json(); setQuizAttempts(d.attempts || []); }
    } catch { /* silent */ }
  }, [apiFetch]);

  const fetchAssignments = useCallback(async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/assignments`);
      if (res.ok) { const d = await res.json(); setAssignments(d.assignments || []); }
    } catch { /* silent */ }
  }, [apiFetch]);

  const fetchUpcoming = useCallback(async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/upcoming-classrooms`);
      if (res.ok) { const d = await res.json(); setUpcomingClassrooms(d.classrooms || []); }
    } catch { /* silent */ }
  }, [apiFetch]);

  const fetchClassroomRemarks = useCallback(async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/classroom-remarks`);
      if (res.ok) { const d = await res.json(); setClassroomRemarks({ active: d.active ?? [], completed: d.completed ?? [] }); }
    } catch { /* silent */ }
  }, [apiFetch]);

  // Fetch analytics for active student
  const fetchAnalytics = useCallback(async (studentId: string) => {
    setLoadingAnalytics(true);
    try {
      const res = await apiFetch(`/students/${studentId}/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.warn('[StudentProfile] fetchAnalytics error:', e);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [apiFetch]);

  // Load students on mount (parent view)
  useEffect(() => {
    if (isParent) {
      fetchLinkedStudents();
    } else if (isStudent && user) {
      // Student views their own profile as a single-item list
      setLinkedStudents([{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        classLevel: user.classLevel,
        profileImage: user.profileImage,
        analytics: { streakDays: 0, consistencyScore: 0, completionRate: 0, attemptedCount: 0, completedCount: 0, totalTimeSeconds: 0 },
      }]);
      setActiveStudentId(user.id);
    }
  }, [user?.id, isParent, isStudent]);

  // Load data whenever active student changes
  const loadingRef = useRef(false);
  useEffect(() => {
    if (!activeStudentId || loadingRef.current) return;
    loadingRef.current = true;
    Promise.all([
      fetchActivity(activeStudentId),
      fetchAnalytics(activeStudentId),
      fetchQuizAttempts(activeStudentId),
      fetchAssignments(activeStudentId),
      fetchUpcoming(activeStudentId),
      fetchClassroomRemarks(activeStudentId),
    ]).finally(() => { loadingRef.current = false; });
  }, [activeStudentId]);

  const activeStudent = linkedStudents.find((s) => s.id === activeStudentId) ?? null;

  const switchToStudent = useCallback((studentId: string) => {
    if (studentId === activeStudentId) return;
    setActivity([]);
    setAnalytics(null);
    setQuizAttempts([]);
    setAssignments([]);
    setUpcomingClassrooms([]);
    setClassroomRemarks({ active: [], completed: [] });
    setActiveStudentId(studentId);
    AsyncStorage.setItem(SELECTED_STUDENT_KEY, studentId).catch(() => {});
  }, [activeStudentId]);

  const refreshAll = useCallback(() => {
    if (isParent) fetchLinkedStudents();
    if (activeStudentId) {
      fetchActivity(activeStudentId);
      fetchAnalytics(activeStudentId);
      fetchQuizAttempts(activeStudentId);
      fetchAssignments(activeStudentId);
      fetchUpcoming(activeStudentId);
      fetchClassroomRemarks(activeStudentId);
    }
  }, [isParent, activeStudentId, fetchLinkedStudents, fetchActivity, fetchAnalytics, fetchQuizAttempts, fetchAssignments, fetchUpcoming, fetchClassroomRemarks]);

  const logActivity = useCallback(async (payload: {
    activityType: 'content' | 'quiz' | 'assignment';
    referenceId?: string;
    referenceTitle?: string;
    status?: 'completed' | 'pending' | 'attempted';
    score?: number;
    timeSpentSeconds?: number;
  }) => {
    const studentId = isStudent ? user?.id : activeStudentId;
    if (!studentId) return;
    try {
      const res = await apiFetch(`/students/${studentId}/activity`, {
        method: 'POST',
        body: JSON.stringify({
          activityType: payload.activityType,
          referenceId: payload.referenceId,
          referenceTitle: payload.referenceTitle,
          status: payload.status ?? 'completed',
          score: payload.score ?? null,
          timeSpentSeconds: payload.timeSpentSeconds ?? 0,
        }),
      });
      if (res.ok) {
        const newItem = await res.json();
        setActivity((prev) => [newItem, ...prev]);
        // Refresh analytics after activity
        fetchAnalytics(studentId);
      }
    } catch (e) {
      console.warn('[StudentProfile] logActivity error:', e);
    }
  }, [user, isStudent, activeStudentId, apiFetch, fetchAnalytics]);

  return (
    <StudentProfileContext.Provider
      value={{
        linkedStudents,
        activeStudent,
        loadingStudents,
        loadingActivity,
        loadingAnalytics,
        activity,
        analytics,
        quizAttempts,
        assignments,
        upcomingClassrooms,
        classroomRemarks,
        switchToStudent,
        refreshAll,
        logActivity,
      }}
    >
      {children}
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  const ctx = useContext(StudentProfileContext);
  if (!ctx) throw new Error('useStudentProfile must be used inside StudentProfileProvider');
  return ctx;
}
