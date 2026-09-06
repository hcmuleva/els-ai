import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, GripVertical, Clock, BookOpen, Trophy, ClipboardList, Settings, Eye, Zap, Calendar, Users, CheckCircle, School, Bookmark, FileText } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import SelectorModal from '../../src/components/SelectorModal';
import CreateQuizModal from '../../src/components/quiz/CreateQuizModal';
import { ModalHeader } from '../../src/components/common/ModalHeader';
import { Card } from '../../src/components/common/Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { getAuthorizedClasses, getAuthorizedCatalogItems } from '../../src/utils/assignments';
import { useAuth } from '../../src/context/AuthContext';
import ClassDetailsScreen from '../../src/components/classroom/ClassDetailsScreen';
import { PickedFile, pickFileAsDataUrl, uploadPickedFileToS3 } from '../../src/utils/fileUpload';
import MediaUploader from '../../src/components/media/MediaUploader';
type ModalTab = 'setup' | 'sections' | 'preview';

type ScheduleType = 'instant' | 'scheduled';
type ClassroomStatus = 'draft' | 'active' | 'completed';
type SelectorField = 'classLevel' | 'quizSubject' | 'contentClass' | 'contentSubject' | 'quizClass' | 'bookmarkClass';

type ClassroomSummary = {
  id: string;
  title: string;
  description: string;
  classLevel: string;
  scheduleType: ScheduleType;
  durationMinutes: number;
  startTime?: string;
  endTime?: string | null;
  status: ClassroomStatus;
  createdAt: string;
  contentCount: number;
  quizCount: number;
  assignmentCount: number;
};

type ContentItem = {
  id: string;
  classLevel: string;
  subject: string;
  title: string;
  contentType: string;
};

type QuizItem = {
  id: string;
  title: string;
  class_level?: string;
  subject?: string;
  quiz_type?: string;
  difficulty_level?: string;
  total_questions?: number;
};

type AssignmentDraft = {
  id: string;
  title: string;
  description: string;
  attachmentUrl: string;
  instructions: string;
  dueDate: string;
  isTimeBound: boolean;
};

type ClassroomFormState = {
  title: string;
  description: string;
  scheduleType: ScheduleType;
  startDateInput: string;
  startTimeOfDayInput: string;
  endEnabled: boolean;
  endDateInput: string;
  endTimeOfDayInput: string;
  durationMinutes: string;
  classLevel: string;
  status: ClassroomStatus;
  selectedContentIds: string[];
  selectedQuizIds: string[];
  assignments: AssignmentDraft[];
};

type SubjectCatalogItem = {
  classLevel: string;
  subject: string;
  coverImage?: string;
  iconImage?: string;
  iconBgColor?: string;
};

type BookmarkSummary = {
  id: string;
  name: string;
  description?: string;
  classLevel?: string;
  itemCount: number;
  contentCount: number;
  quizCount: number;
  subjects: string[];
};

type BookmarkDetailItem = {
  id: string;
  itemType: 'content' | 'quiz';
  contentId?: string;
  quizId?: string;
  title: string;
  subject?: string;
  classLevel?: string;
  contentType?: string;
  quizType?: string;
  totalQuestions?: number;
};

type BookmarkDetail = { id: string; name: string; items: BookmarkDetailItem[] };

const bookmarkItemKey = (itemType: 'content' | 'quiz', resourceId: string) => `${itemType}:${resourceId}`;




const STATUS_COLORS: Record<ClassroomStatus, string> = {
  active: '#16a34a',
  completed: '#525C6B',
  draft: '#2563eb',
};

const EMPTY_FORM: ClassroomFormState = {
  title: '',
  description: '',
  scheduleType: 'instant',
  startDateInput: '',
  startTimeOfDayInput: '',
  endEnabled: false,
  endDateInput: '',
  endTimeOfDayInput: '',
  durationMinutes: '45',
  classLevel: '',
  status: 'active',
  selectedContentIds: [],
  selectedQuizIds: [],
  assignments: [],
};

const makeAssignment = (): AssignmentDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  description: '',
  attachmentUrl: '',
  instructions: '',
  dueDate: '',
  isTimeBound: false,
});




function resolveUploadMediaType(file: PickedFile): 'image' | 'audio' | 'video' {
  const mime = file.mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'video';
}

function toIsoOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  const d = dateStr.trim();
  const t = timeStr.trim();
  if (!d || !t) return null;
  const dt = new Date(`${d}T${t}:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function splitIsoToDateAndTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { date: '', time: '' };
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

function DateTimeInput({ kind, value, onChange, placeholder, minDate }: {
  kind: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minDate?: Date;
}) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    const React = require('react');
    const minAttr = minDate
      ? (kind === 'date'
          ? `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`
          : `${String(minDate.getHours()).padStart(2, '0')}:${String(minDate.getMinutes()).padStart(2, '0')}`)
      : undefined;
    return React.createElement('input', {
      type: kind,
      value,
      min: minAttr,
      onChange: (e: any) => onChange(e.target.value),
      style: {
        backgroundColor: '#F4F5FF',
        borderRadius: 10,
        padding: 10,
        fontSize: 13,
        color: '#1a1a2e',
        border: '1px solid #E2E5F0',
        outline: 'none',
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
      },
    });
  }

  const currentDate = (() => {
    if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0);
    }
    if (kind === 'time' && /^\d{2}:\d{2}$/.test(value)) {
      const [h, mi] = value.split(':').map(Number);
      const dt = new Date();
      dt.setHours(h || 0, mi || 0, 0, 0);
      return dt;
    }
    return new Date();
  })();

  const display = value || placeholder || (kind === 'date' ? 'Select date' : 'Select time');

  return (
    <>
      <Pressable
        onPress={() => setShow(true)}
        style={{
          backgroundColor: '#F4F5FF',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: '#E2E5F0',
        }}
      >
        <Text style={{ fontSize: 14, color: value ? '#1a1a2e' : '#B0B8D0', fontWeight: '600' }}>{display}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={currentDate}
          mode={kind}
          is24Hour={false}
          minimumDate={minDate}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event: any, picked?: Date) => {
            if (Platform.OS !== 'ios') setShow(false);
            if (!picked) return;
            if (kind === 'date') {
              const y = picked.getFullYear();
              const m = String(picked.getMonth() + 1).padStart(2, '0');
              const d = String(picked.getDate()).padStart(2, '0');
              onChange(`${y}-${m}-${d}`);
            } else {
              const h = String(picked.getHours()).padStart(2, '0');
              const mi = String(picked.getMinutes()).padStart(2, '0');
              onChange(`${h}:${mi}`);
            }
          }}
        />
      ) : null}
      {show && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setShow(false)} style={{ alignSelf: 'flex-end', paddingVertical: 6 }}>
          <Text style={{ color: '#2D5DC9', fontWeight: '800', fontSize: 12 }}>Done</Text>
        </Pressable>
      ) : null}
    </>
  );
}

export default function PlannerScreen() {
  const { user, apiFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingClassroomId, setDeletingClassroomId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectCatalogItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassroomFormState>(EMPTY_FORM);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [quizFilters, setQuizFilters] = useState({ subject: '', category: '', difficulty: '', search: '' });
  const [isAssignContentOpen, setIsAssignContentOpen] = useState(false);
  const [isAssignQuizOpen, setIsAssignQuizOpen] = useState(false);
  const [quizCreatorOpen, setQuizCreatorOpen] = useState(false);
  const [assignQuizPage, setAssignQuizPage] = useState(0);
  const [assignContentPage, setAssignContentPage] = useState(0);
  const ASSIGN_PAGE_SIZE = 10;
  const [contentSearch, setContentSearch] = useState('');
  const [contentSubjectFilter, setContentSubjectFilter] = useState('');
  const [contentClassFilter, setContentClassFilter] = useState('');
  const [quizClassFilter, setQuizClassFilter] = useState('');
  const [bookmarkClassFilter, setBookmarkClassFilter] = useState('');
  const [isBookmarkPickerOpen, setIsBookmarkPickerOpen] = useState(false);
  const [bookmarkList, setBookmarkList] = useState<BookmarkSummary[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [bookmarkSearch, setBookmarkSearch] = useState('');
  const [activeBookmark, setActiveBookmark] = useState<BookmarkDetail | null>(null);
  const [loadingBookmarkDetail, setLoadingBookmarkDetail] = useState(false);
  const [bookmarkItemSel, setBookmarkItemSel] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<ClassroomSummary | null>(null);
  const [pendingEndClassroom, setPendingEndClassroom] = useState<ClassroomSummary | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('setup');

  // ── History + Class Details ────────────────────────────────────────────────
  const [isHistoryOpen, setIsHistoryOpen]         = useState(false);
  const [historyLoading, setHistoryLoading]        = useState(false);
  const [historyRooms, setHistoryRooms]            = useState<any[]>([]);
  const [endingClassroomId, setEndingClassroomId]  = useState<string | null>(null);
  const [detailsClassroomId, setDetailsClassroomId]= useState<string | null>(null);
  const [restartingId, setRestartingId]            = useState<string | null>(null);
  const [activityCounts, setActivityCounts]        = useState<Record<string, number>>({});

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  // React Query owns the classrooms list: it's read from 3 render sites and
  // re-fetched from 4 mutation handlers below via `classroomsQuery.refetch()`,
  // replacing what used to be a hand-rolled `loadClassrooms()`/`setClassrooms`
  // pair. `loadData`'s own `loading`/`setLoading` still wraps the combined
  // fetch below so the on-screen "Loading classrooms…" state is unchanged.
  const classroomsQuery = useQuery({
    queryKey: ['classrooms', 'planner'],
    queryFn: async () => {
      const res = await apiFetch('/classrooms?limit=200');
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to load classrooms');
      }
      const payload = await res.json();
      return (payload.classrooms || []) as ClassroomSummary[];
    },
    enabled: isTeacherView,
  });
  const classrooms = classroomsQuery.data ?? [];

  const loadActivityCounts = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications/teacher-activity');
      if (!res.ok) return;
      const payload = await res.json();
      const next: Record<string, number> = {};
      for (const row of (payload.counts || []) as Array<{ classroomId: string; unread: number }>) {
        if (row.classroomId) next[row.classroomId] = Number(row.unread) || 0;
      }
      setActivityCounts(next);
    } catch (_e) {
      /* silent */
    }
  }, [apiFetch]);

  const loadResources = useCallback(async () => {
    const fetchPagedRows = async (
      endpoint: string,
      key: 'items' | 'quizzes',
      baseQuery: URLSearchParams,
      chunkSize = 200,
    ) => {
      const merged: any[] = [];
      let offset = 0;
      let guard = 0;
      while (guard < 1000) {
        const query = new URLSearchParams(baseQuery);
        query.set('limit', String(chunkSize));
        query.set('offset', String(offset));
        const res = await apiFetch(`${endpoint}?${query.toString()}`);
        if (!res.ok) break;
        const payload = await res.json();
        const rows = Array.isArray(payload[key]) ? payload[key] : [];
        merged.push(...rows);
        if (rows.length === 0) break;
        const total = Number(payload.total ?? NaN);
        if (Number.isFinite(total)) {
          if (merged.length >= total) break;
        } else if (rows.length < chunkSize) {
          break;
        }
        offset += rows.length;
        guard += 1;
      }
      return merged;
    };

    const [contentRows, quizRows, catalogRes] = await Promise.all([
      fetchPagedRows('/content/items', 'items', new URLSearchParams(), 200),
      fetchPagedRows('/quizzes/teacher/library', 'quizzes', new URLSearchParams({ status: 'all' }), 200),
      apiFetch('/catalog/subjects'),
    ]);

    setContentItems(contentRows as ContentItem[]);
    setQuizItems(quizRows as QuizItem[]);

    if (catalogRes.ok) {
      const payload = await catalogRes.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      setSubjectCatalog(
        items
          .map((item: any) => ({
            classLevel: String(item.class_level || item.classLevel || '').trim(),
            subject: String(item.subject || item.title || '').trim(),
            coverImage: item.coverImage || undefined,
            iconImage: item.iconImage || undefined,
            iconBgColor: item.iconBgColor || undefined,
          }))
          .filter((item: SubjectCatalogItem) => item.classLevel && item.subject),
      );
    }
  }, [apiFetch]);

  const loadData = useCallback(async () => {
    if (!isTeacherView) return;
    setLoading(true);
    setMessage(null);
    try {
      await Promise.all([classroomsQuery.refetch({ throwOnError: true }), loadResources(), loadActivityCounts()]);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load classroom planning data' });
    } finally {
      setLoading(false);
    }
  }, [isTeacherView, classroomsQuery.refetch, loadResources, loadActivityCounts]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const classLevelOptions = useMemo(
    () => {
      const allClassOptions = STANDARD_OPTIONS.map((item) => item.value);
      return [...new Set(['ANY', ...getAuthorizedClasses(user, allClassOptions)])];
    },
    [user],
  );
  // Classes the teacher is assigned to (no 'ANY'); used for per-modal class filters
  // so resources from other assigned classes can be added, but never unassigned ones.
  const assignableClasses = useMemo(
    () => getAuthorizedClasses(user, STANDARD_OPTIONS.map((item) => item.value)).filter((c) => c !== 'ANY'),
    [user],
  );
  const isAnyClass = form.classLevel === 'ANY';
  const matchesClassLevel = (itemClassLevel?: string) =>
    !form.classLevel || isAnyClass || itemClassLevel === form.classLevel;

  const subjectOptions = useMemo(
    () => {
      const authorizedItems = getAuthorizedCatalogItems(
        user,
        subjectCatalog,
        (item) => item.classLevel,
        (item) => item.subject,
        isAnyClass ? undefined : form.classLevel || undefined
      );
      return [
        ...new Set(
          authorizedItems
            .filter((item) => matchesClassLevel(item.classLevel))
            .map((item) => item.subject),
        ),
      ].sort((a, b) => a.localeCompare(b));
    },
    [form.classLevel, subjectCatalog, user, isAnyClass],
  );

  const contentSubjectOptions = useMemo(
    () => {
      const authorizedItems = getAuthorizedCatalogItems(
        user,
        contentItems,
        (item) => item.classLevel,
        (item) => item.subject,
        contentClassFilter || undefined
      );
      return [...new Set(
        authorizedItems.map((item) => item.subject).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
    },
    [contentItems, contentClassFilter, user],
  );

  const quizSubjectOptions = useMemo(
    () => {
      const authorizedItems = getAuthorizedCatalogItems(
        user,
        quizItems,
        (quiz) => quiz.class_level || '',
        (quiz) => quiz.subject || '',
        quizClassFilter || undefined
      );
      return [...new Set(
        authorizedItems.map((quiz) => (quiz.subject || '').trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
    },
    [quizItems, quizClassFilter, user],
  );

  const filteredContents = useMemo(() => {
    const authorizedItems = getAuthorizedCatalogItems(
      user,
      contentItems,
      (item) => item.classLevel,
      (item) => item.subject,
      contentClassFilter || undefined
    );
    return authorizedItems
      .filter((item) => !contentSubjectFilter || item.subject === contentSubjectFilter)
      .filter((item) => {
        const keyword = contentSearch.trim().toLowerCase();
        if (!keyword) return true;
        return `${item.title} ${item.subject} ${item.contentType}`.toLowerCase().includes(keyword);
      });
  }, [contentItems, contentClassFilter, contentSearch, contentSubjectFilter, user]);

  const filteredQuizzes = useMemo(() => {
    const authorizedItems = getAuthorizedCatalogItems(
      user,
      quizItems,
      (quiz) => quiz.class_level || '',
      (quiz) => quiz.subject || '',
      quizClassFilter || undefined
    );
    return authorizedItems
      .filter((quiz) => !quizFilters.subject || (quiz.subject || '').trim() === quizFilters.subject)
      .filter((quiz) => !quizFilters.category || (quiz.quiz_type || '').toLowerCase().includes(quizFilters.category.toLowerCase()))
      .filter((quiz) => !quizFilters.difficulty || (quiz.difficulty_level || '').toLowerCase().includes(quizFilters.difficulty.toLowerCase()))
      .filter((quiz) => {
        const keyword = quizFilters.search.trim().toLowerCase();
        if (!keyword) return true;
        return `${quiz.title} ${quiz.subject || ''}`.toLowerCase().includes(keyword);
      });
  }, [quizClassFilter, quizFilters.category, quizFilters.difficulty, quizFilters.search, quizFilters.subject, quizItems, user]);

  useEffect(() => { setAssignQuizPage(0); }, [quizFilters.search, quizFilters.subject, quizFilters.category, quizFilters.difficulty, quizClassFilter]);
  useEffect(() => { setAssignContentPage(0); }, [contentSearch, contentSubjectFilter, contentClassFilter]);

  // Seed the per-modal class/subject filters to the classroom's class whenever it
  // changes. Manual changes inside the Add modals are NOT reset here, so the most
  // recently selected class persists across modal open/close.
  useEffect(() => {
    const cls = form.classLevel && form.classLevel !== 'ANY' ? form.classLevel : '';
    setContentClassFilter(cls);
    setQuizClassFilter(cls);
    setBookmarkClassFilter(cls);
    setContentSubjectFilter('');
    setQuizFilters((current) => ({ ...current, subject: '' }));
  }, [form.classLevel]);

  const setFormPatch = (patch: Partial<ClassroomFormState>) => setForm((current) => ({ ...current, ...patch }));

  // ── Reorder helpers ──────────────────────────────────────────────────────
  const moveItemUp = (arr: string[], id: string): string[] => {
    const idx = arr.indexOf(id);
    if (idx <= 0) return arr;
    const next = [...arr];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    return next;
  };
  const moveItemDown = (arr: string[], id: string): string[] => {
    const idx = arr.indexOf(id);
    if (idx < 0 || idx >= arr.length - 1) return arr;
    const next = [...arr];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    return next;
  };

  const openCreate = () => {
    setEditingClassroomId(null);
    setModalTab('setup');
    setQuizFilters({ subject: '', category: '', difficulty: '', search: '' });
    setContentSearch('');
    setForm({ ...EMPTY_FORM, assignments: [makeAssignment()] });
    setIsFormOpen(true);
  };

  const openEdit = async (classroomId: string) => {
    setMessage(null);
    try {
      const res = await apiFetch(`/classrooms/${classroomId}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to load classroom details');
      }
      const payload = await res.json();
      const classroom = payload.classroom || {};
      const assignments = Array.isArray(payload.assignments) && payload.assignments.length > 0
        ? payload.assignments.map((item: any) => ({
            id: item.id as string,
            title: item.title || '',
            description: item.description || '',
            attachmentUrl: item.attachmentUrl || '',
            instructions: item.instructions || '',
            dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : '',
            isTimeBound: Boolean(item.isTimeBound),
          }))
        : [makeAssignment()];

      setEditingClassroomId(classroomId);
      setModalTab('setup');
      setQuizFilters({ subject: '', category: '', difficulty: '', search: '' });
      setContentSearch('');
      const startParts = splitIsoToDateAndTime(classroom.startTime);
      const endParts = splitIsoToDateAndTime((classroom as any).endTime);
      setForm({
        title: classroom.title || '',
        description: classroom.description || '',
        scheduleType: (classroom.scheduleType as ScheduleType) || 'instant',
        startDateInput: startParts.date,
        startTimeOfDayInput: startParts.time,
        endEnabled: !!(classroom as any).endTime,
        endDateInput: endParts.date,
        endTimeOfDayInput: endParts.time,
        durationMinutes: String(classroom.durationMinutes ?? 0),
        classLevel: classroom.classLevel || '',
        status: (classroom.status as ClassroomStatus) || 'draft',
        selectedContentIds: Array.isArray(payload.contents) ? payload.contents.map((item: any) => item.id as string) : [],
        selectedQuizIds: Array.isArray(payload.quizzes) ? payload.quizzes.map((item: any) => item.id as string) : [],
        assignments,
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to open classroom' });
    }
  };

  const toggleId = (ids: string[], value: string) => (ids.includes(value) ? ids.filter((item) => item !== value) : [...ids, value]);

  const updateAssignment = (id: string, patch: Partial<AssignmentDraft>) => {
    setForm((current) => ({
      ...current,
      assignments: current.assignments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeAssignment = (id: string) => {
    setForm((current) => {
      const next = current.assignments.filter((item) => item.id !== id);
      return { ...current, assignments: next.length > 0 ? next : [makeAssignment()] };
    });
  };

  const fetchBookmarks = useCallback(async (classFilter: string) => {
    setLoadingBookmarks(true);
    try {
      const query = new URLSearchParams();
      if (classFilter) query.set('class_level', classFilter);
      const res = await apiFetch(`/bookmarks?${query.toString()}`);
      const data = res.ok ? await res.json() : { bookmarks: [] };
      setBookmarkList(data.bookmarks || []);
    } catch {
      setBookmarkList([]);
    } finally {
      setLoadingBookmarks(false);
    }
  }, [apiFetch]);

  const openBookmarkPicker = useCallback(async () => {
    setIsBookmarkPickerOpen(true);
    setActiveBookmark(null);
    setBookmarkItemSel(new Set());
    setBookmarkSearch('');
    await fetchBookmarks(bookmarkClassFilter);
  }, [fetchBookmarks, bookmarkClassFilter]);

  const openBookmarkDetail = useCallback(async (id: string) => {
    setLoadingBookmarkDetail(true);
    try {
      const res = await apiFetch(`/bookmarks/${id}`);
      const data = res.ok ? await res.json() : null;
      if (data?.bookmark) {
        setActiveBookmark(data.bookmark as BookmarkDetail);
        const preselect = new Set<string>(
          (data.bookmark.items || [])
            .map((it: BookmarkDetailItem) => {
              const rid = it.itemType === 'content' ? it.contentId : it.quizId;
              return rid ? bookmarkItemKey(it.itemType, rid) : null;
            })
            .filter((k: string | null): k is string => !!k),
        );
        setBookmarkItemSel(preselect);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingBookmarkDetail(false);
    }
  }, [apiFetch]);

  const toggleBookmarkItem = (key: string) => {
    setBookmarkItemSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyBookmarkSelection = () => {
    if (!activeBookmark) return;
    const contentIdsToAdd: string[] = [];
    const quizIdsToAdd: string[] = [];
    const newContentItems: ContentItem[] = [];
    const newQuizItems: QuizItem[] = [];
    activeBookmark.items.forEach((it) => {
      const rid = it.itemType === 'content' ? it.contentId : it.quizId;
      if (!rid || !bookmarkItemSel.has(bookmarkItemKey(it.itemType, rid))) return;
      if (it.itemType === 'content') {
        contentIdsToAdd.push(rid);
        newContentItems.push({
          id: rid,
          classLevel: it.classLevel || form.classLevel || '',
          subject: it.subject || '',
          title: it.title,
          contentType: it.contentType || 'content',
        });
      } else {
        quizIdsToAdd.push(rid);
        newQuizItems.push({
          id: rid,
          title: it.title,
          class_level: it.classLevel,
          subject: it.subject,
          quiz_type: it.quizType,
          total_questions: it.totalQuestions,
        });
      }
    });
    setContentItems((prev) => {
      const ids = new Set(prev.map((x) => x.id));
      return [...prev, ...newContentItems.filter((x) => !ids.has(x.id))];
    });
    setQuizItems((prev) => {
      const ids = new Set(prev.map((x) => x.id));
      return [...prev, ...newQuizItems.filter((x) => !ids.has(x.id))];
    });
    setForm((current) => ({
      ...current,
      selectedContentIds: [...current.selectedContentIds, ...contentIdsToAdd.filter((id) => !current.selectedContentIds.includes(id))],
      selectedQuizIds: [...current.selectedQuizIds, ...quizIdsToAdd.filter((id) => !current.selectedQuizIds.includes(id))],
    }));
    setIsBookmarkPickerOpen(false);
    setMessage({ type: 'success', text: `Added ${contentIdsToAdd.length + quizIdsToAdd.length} item(s) from bookmark.` });
  };



  const saveClassroom = async () => {
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'Classroom title is required.' });
      return;
    }
    if (!form.classLevel) {
      setMessage({ type: 'error', text: 'Standard/Class is required.' });
      return;
    }

    const durationMinutes = Number(form.durationMinutes || '0');
    if (Number.isNaN(durationMinutes) || durationMinutes < 0) {
      setMessage({ type: 'error', text: 'Duration must be a valid number.' });
      return;
    }

    const startTimeIso = form.scheduleType === 'scheduled'
      ? combineDateAndTime(form.startDateInput, form.startTimeOfDayInput)
      : null;
    if (form.scheduleType === 'scheduled' && !startTimeIso) {
      setMessage({ type: 'error', text: 'Start date & time is required for scheduled classroom.' });
      return;
    }
    if (form.scheduleType === 'scheduled' && startTimeIso) {
      if (new Date(startTimeIso).getTime() <= Date.now()) {
        setMessage({ type: 'error', text: 'Start date & time must be in the future.' });
        return;
      }
    }
    let endTimeIso: string | null = null;
    if (form.scheduleType === 'scheduled' && form.endEnabled) {
      endTimeIso = combineDateAndTime(form.endDateInput, form.endTimeOfDayInput);
      if (!endTimeIso) {
        setMessage({ type: 'error', text: 'End date & time is invalid.' });
        return;
      }
      if (new Date(endTimeIso).getTime() <= Date.now()) {
        setMessage({ type: 'error', text: 'End date & time must be in the future.' });
        return;
      }
      if (startTimeIso && new Date(endTimeIso).getTime() <= new Date(startTimeIso).getTime()) {
        setMessage({ type: 'error', text: 'End time must be after start time.' });
        return;
      }
    }

    const assignments = form.assignments
      .map((item) => ({
        id: item.id,
        title: item.title.trim(),
        description: item.description.trim(),
        attachmentUrl: item.attachmentUrl.trim(),
        instructions: item.instructions.trim(),
        dueDate: toIsoOrNull(item.dueDate),
        isTimeBound: item.isTimeBound,
      }))
      .filter((item) => item.title);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      scheduleType: form.scheduleType,
      startTime: form.scheduleType === 'scheduled' ? startTimeIso : null,
      endTime: form.scheduleType === 'scheduled' && form.endEnabled ? endTimeIso : null,
      durationMinutes,
      classLevel: form.classLevel,
      status: form.status,
      contentIds: form.selectedContentIds,
      quizIds: form.selectedQuizIds,
      assignments,
    };

    setSaving(true);
    setMessage(null);
    try {
      const endpoint = editingClassroomId ? `/classrooms/${editingClassroomId}` : '/classrooms';
      const method = editingClassroomId ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || `Failed to ${editingClassroomId ? 'update' : 'create'} classroom`);
      }
      await classroomsQuery.refetch({ throwOnError: true });
      setIsFormOpen(false);
      setEditingClassroomId(null);
      setForm(EMPTY_FORM);
      setMessage({ type: 'success', text: `Classroom ${editingClassroomId ? 'updated' : 'created'} successfully.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save classroom' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeletingClassroomId(pendingDelete.id);
    try {
      const res = await apiFetch(`/classrooms/${pendingDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to delete classroom');
      }
      await classroomsQuery.refetch({ throwOnError: true });
      setMessage({ type: 'success', text: 'Classroom deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete classroom' });
    } finally {
      setDeletingClassroomId(null);
      setPendingDelete(null);
    }
  };

  // ── End class ─────────────────────────────────────────────────────────────
  const endClassroom = async (classroomId: string) => {
    setEndingClassroomId(classroomId);
    try {
      const res = await apiFetch(`/classrooms/${classroomId}/end`, { method: 'PATCH' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed'); }
      await classroomsQuery.refetch({ throwOnError: true });
      setMessage({ type: 'success', text: 'Class ended and moved to history.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to end class' });
    } finally {
      setEndingClassroomId(null);
      setPendingEndClassroom(null);
    }
  };

  const confirmEndClassroom = async () => {
    if (!pendingEndClassroom) return;
    await endClassroom(pendingEndClassroom.id);
  };

  // ── Load history ──────────────────────────────────────────────────────────
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch('/classrooms/history');
      if (res.ok) { const d = await res.json(); setHistoryRooms(d.classrooms ?? []); }
    } finally { setHistoryLoading(false); }
  };

  const openHistory = () => { setIsHistoryOpen(true); loadHistory(); };

  const getDateTimeParts = (iso?: string | null) => {
    if (!iso) return { date: '—', time: '—' };
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return { date: '—', time: '—' };
    return {
      date: dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      time: dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    };
  };

  // ── Restart class ─────────────────────────────────────────────────────────
  const restartClassroom = async (classroomId: string) => {
    setRestartingId(classroomId);
    try {
      const res = await apiFetch(`/classrooms/${classroomId}/restart`, { method: 'PATCH' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed'); }
      setIsHistoryOpen(false);
      await classroomsQuery.refetch({ throwOnError: true });
      setMessage({ type: 'success', text: 'Class restarted successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to restart class' });
    } finally { setRestartingId(null); }
  };

  const isClassSelector = selectorField === 'classLevel' || selectorField === 'contentClass' || selectorField === 'quizClass' || selectorField === 'bookmarkClass';
  const selectorOptions = (() => {
    switch (selectorField) {
      case 'classLevel': return classLevelOptions;
      case 'contentClass':
      case 'quizClass':
      case 'bookmarkClass': return assignableClasses;
      case 'contentSubject': return contentSubjectOptions;
      case 'quizSubject': return quizSubjectOptions;
      default: return subjectOptions;
    }
  })();
  const selectorSelected = (() => {
    switch (selectorField) {
      case 'classLevel': return form.classLevel;
      case 'contentClass': return contentClassFilter;
      case 'quizClass': return quizClassFilter;
      case 'bookmarkClass': return bookmarkClassFilter;
      case 'contentSubject': return contentSubjectFilter;
      case 'quizSubject': return quizFilters.subject;
      default: return '';
    }
  })();

  const applySelectorValue = (value: string) => {
    if (selectorField === 'classLevel') {
      setFormPatch({ classLevel: value, selectedQuizIds: [], selectedContentIds: [] });
      setQuizFilters((current) => ({ ...current, subject: '' }));
    } else if (selectorField === 'quizSubject') {
      setQuizFilters((current) => ({ ...current, subject: value }));
    } else if (selectorField === 'quizClass') {
      setQuizClassFilter(value);
      setQuizFilters((current) => ({ ...current, subject: '' }));
    } else if (selectorField === 'contentClass') {
      setContentClassFilter(value);
      setContentSubjectFilter('');
    } else if (selectorField === 'contentSubject') {
      setContentSubjectFilter(value);
    } else if (selectorField === 'bookmarkClass') {
      setBookmarkClassFilter(value);
      fetchBookmarks(value);
    }
    setSelectorField(null);
  };

  if (!isTeacherView) {
    return (
      <View style={p.screen}>
        <Text style={p.noPermText}>You do not have permission to manage classrooms.</Text>
      </View>
    );
  }

  // `text` is a darkened variant of `bg` (~55% luminance) used anywhere the
  // palette color sits on top of `light` as actual text (e.g. the "Edit"
  // button label below) — `bg` itself is too light to hit WCAG AA 4.5:1 on
  // its own tint, per an `agent-browser a11y` audit finding.
  const CARD_PALETTES = [
    { bg: '#4A7FE0', light: '#D6EAFF', text: '#29467B' },
    { bg: '#D33F13', light: '#FFE8D6', text: '#74230A' },
    { bg: '#9B8EC4', light: '#EDE4FF', text: '#554E6C' },
    { bg: '#7DC67A', light: '#D6F5D6', text: '#456D43' },
    { bg: '#E6A817', light: '#FFF5CC', text: '#7F5C0D' },
    { bg: '#F06292', light: '#FFE0EC', text: '#843650' },
  ];
  const CARD_ICONS = [BookOpen, School, Trophy, ClipboardList, BookOpen, Trophy, Settings, CheckCircle];
  const STATUS_TAG: Record<ClassroomStatus, { bg: string; text: string; label: string }> = {
    active:    { bg: '#D6F5D6', text: '#1A6B1A', label: '● Live' },
    completed: { bg: '#F0F0F8', text: '#6B6B8A', label: 'Done' },
    draft:     { bg: '#D6EAFF', text: '#1A4DA2', label: 'Draft' },
  };
  const viewportWidth = Dimensions.get('window').width;
  const classCardWidth = viewportWidth >= 720 ? '48.5%' : '100%';
  const historyCardWidth = viewportWidth >= 760 ? '48.5%' : '100%';

  return (
    <ScrollView style={p.screen} contentContainerStyle={p.scroll}>

      {/* ── Header ── */}
      <View style={[p.header, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={p.headerTitle}>My Classes</Text>
          <Text style={p.headerSub}>Manage and schedule your classroom sessions</Text>
        </View>
        <Pressable style={p.historyBtn} onPress={openHistory}>
          <Clock size={13} color="#5A6A8A" />
          <Text style={p.historyBtnText}>History</Text>
        </Pressable>
        <Pressable style={p.createBtn} onPress={openCreate}>
          <Text style={p.createBtnText}>+ New</Text>
        </Pressable>
      </View>

      {message ? (
        <View style={[p.toast, message.type === 'success' ? p.toastSuccess : p.toastError]}>
          <Text style={[p.toastText, message.type === 'success' ? p.toastSuccessText : p.toastErrorText]}>{message.text}</Text>
        </View>
      ) : null}



      {/* ── Classroom cards ── */}
      {loading ? (
        <View style={p.loadingWrap}>
          <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
          <Text style={p.loadingText}>Loading classrooms…</Text>
        </View>
      ) : classrooms.length === 0 ? (
        <View style={p.emptyWrap}>
          <School size={56} color="#D0D8F0" />
          <Text style={p.emptyTitle}>No classrooms yet</Text>
          <Text style={p.emptySub}>Tap "+ New" to create your first classroom session</Text>
          <Pressable style={p.emptyBtn} onPress={openCreate}>
            <Text style={p.emptyBtnText}>Create Classroom</Text>
          </Pressable>
        </View>
      ) : (
        <View style={p.classCardGrid}>
          {(() => {
            const totalPages = Math.ceil(classrooms.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginatedClassrooms = classrooms.slice(startIndex, startIndex + itemsPerPage);
            
            return (
              <>
                {paginatedClassrooms.map((item, idx) => {
                  const actualIdx = startIndex + idx;
                  const pal = CARD_PALETTES[actualIdx % CARD_PALETTES.length];
                  const IconComp = CARD_ICONS[actualIdx % CARD_ICONS.length];
                  const tag = STATUS_TAG[item.status];
                  const startMeta = getDateTimeParts(item.startTime);
                  return (
                    <View key={item.id} style={[p.classCard, { backgroundColor: pal.light, width: classCardWidth }]}>
                {/* Top row: icon art box + title + status */}
                <View style={p.classCardTop}>
                  <View style={[p.classArtBox, { backgroundColor: `${pal.bg}22` }]}>
                    <IconComp size={24} color={pal.bg} />
                  </View>
                  <View style={p.classCardInfo}>
                    <Text style={p.classCardTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={p.classModeRow}>
                      <View style={p.classModeChip}>
                        <Text style={p.classModeChipLabel}>Class</Text>
                        <Text style={p.classModeChipValue}>{getStandardLabel(item.classLevel)}</Text>
                      </View>
                      <View style={p.classModeChip}>
                        <Text style={p.classModeChipLabel}>Mode</Text>
                        <Text style={p.classModeChipValue}>{item.scheduleType === 'instant' ? 'Instant' : 'Scheduled'}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[p.statusTag, { backgroundColor: tag.bg }]}>
                    <Text style={[p.statusTagText, { color: tag.text }]}>{tag.label}</Text>
                  </View>
                </View>

                <View style={p.classTimingRow}>
                  <View style={p.classTimingItem}>
                    <Text style={p.classMetaLabel}>Duration</Text>
                    <Text style={p.classMetaValue}>{item.durationMinutes} min</Text>
                  </View>
                  <View style={p.classTimingItem}>
                    <Text style={p.classMetaLabel}>Start</Text>
                    <Text style={p.classMetaValue}>{item.scheduleType === 'instant' ? 'Instant' : startMeta.date}</Text>
                    {item.scheduleType !== 'instant' && <Text style={p.classTimingSub}>{startMeta.time}</Text>}
                  </View>
                  {item.endTime ? (
                    <View style={p.classTimingItem}>
                      <Text style={p.classMetaLabel}>End</Text>
                      <Text style={p.classMetaValue}>{getDateTimeParts(item.endTime).date}</Text>
                      <Text style={p.classTimingSub}>{getDateTimeParts(item.endTime).time}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={p.classCountsRow}>
                  <View style={p.classCountChip}><Text style={p.classCountChipText}>{item.contentCount} content</Text></View>
                  <View style={p.classCountChip}><Text style={p.classCountChipText}>{item.quizCount} quizzes</Text></View>
                  <View style={p.classCountChip}><Text style={p.classCountChipText}>{item.assignmentCount} tasks</Text></View>
                </View>

                {/* Actions */}
                <View style={p.classCardFooter}>
                  <Pressable
                    style={[p.footerBtn, { backgroundColor: '#EBF4FF' }]}
                    onPress={async () => {
                      setDetailsClassroomId(item.id);
                      if (activityCounts[item.id]) {
                        try {
                          await apiFetch(`/notifications/teacher-activity/${item.id}/seen`, { method: 'PATCH' });
                          setActivityCounts((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                        } catch (_e) { /* silent */ }
                      }
                    }}
                  >
                    <Text numberOfLines={1} style={[p.footerBtnText, { color: '#1A4DA2' }]}>Details</Text>
                    {activityCounts[item.id] ? (
                      <View style={p.activityDot}>
                        <Text style={p.activityDotText}>{activityCounts[item.id] > 9 ? '9+' : String(activityCounts[item.id])}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable style={[p.footerBtn, { backgroundColor: `${pal.bg}18` }]} onPress={() => openEdit(item.id)}>
                    <Text numberOfLines={1} style={[p.footerBtnText, { color: pal.text }]}>Edit</Text>
                  </Pressable>
                  {item.status !== 'completed' && (
                    <Pressable style={[p.footerBtn, { backgroundColor: '#FEF0ED' }]} onPress={() => setPendingEndClassroom(item)} disabled={endingClassroomId === item.id}>
                      {endingClassroomId === item.id
                        ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#D33F13" />
                        : <Text numberOfLines={1} style={[p.footerBtnText, { color: '#B03A19' }]}>End Class</Text>}
                    </Pressable>
                  )}
                  <Pressable style={p.footerBtnGhost} onPress={() => setPendingDelete(item)} disabled={deletingClassroomId === item.id}>
                    {deletingClassroomId === item.id
                      ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#D33F13" />
                      : <Text numberOfLines={1} style={p.footerBtnDelete}>Delete</Text>}
                  </Pressable>
                </View>
              </View>
            );
          })}
          
          {totalPages > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, width: '100%' }}>
              <Pressable 
                style={[p.pageBtn, currentPage === 1 && { opacity: 0.5 }]} 
                onPress={() => setCurrentPage(pg => Math.max(1, pg - 1))}
                disabled={currentPage === 1}
              >
                <Text style={p.pageBtnText}>Previous</Text>
              </Pressable>
              <Text style={p.pageText}>Page {currentPage} of {totalPages}</Text>
              <Pressable 
                style={[p.pageBtn, currentPage === totalPages && { opacity: 0.5 }]} 
                onPress={() => setCurrentPage(pg => Math.min(totalPages, pg + 1))}
                disabled={currentPage === totalPages}
              >
                <Text style={p.pageBtnText}>Next</Text>
              </Pressable>
            </View>
          )}
          </>
        )
      })()}
      </View>
      )}

      {/* ── Create / Edit Modal (full-screen slide) ── */}
      <Modal visible={isFormOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsFormOpen(false)}>
        <View style={p.modalScreen}>

          {/* Modal header */}
          <ModalHeader
            title={editingClassroomId ? 'Edit Classroom' : 'New Classroom'}
            onBack={() => setIsFormOpen(false)}
            right={
              <Pressable style={p.modalSaveBtn} onPress={saveClassroom} disabled={saving}>
                {saving ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" size="small" /> : <Text style={p.modalSaveBtnText}>Save</Text>}
              </Pressable>
            }
          />

          {/* Tab bar */}
          <View style={p.modalTabBar}>
            {([['setup', 'Setup', Settings], ['sections', 'Sections', BookOpen], ['preview', 'Preview', Eye]] as [ModalTab, string, any][]).map(([tab, label, TabIcon]) => (
              <Pressable
                key={tab}
                style={[p.modalTab, modalTab === tab && p.modalTabActive]}
                onPress={() => setModalTab(tab)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <TabIcon size={13} color={modalTab === tab ? '#2D5DC9' : '#525C6B'} />
                  <Text style={[p.modalTabText, modalTab === tab && p.modalTabTextActive]}>{label}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* ── SETUP tab ── */}
          {modalTab === 'setup' && (
            <ScrollView contentContainerStyle={p.tabContent}>
              <View style={p.fieldGroup}>
                <Text style={p.groupLabel}>BASIC INFO</Text>
                <View style={p.fieldCard}>
                  <Text style={p.fieldLabel}>Classroom Title *</Text>
                  <TextInput value={form.title} onChangeText={(v) => setFormPatch({ title: v })} placeholder="e.g. Class 1 Morning Session" style={p.fieldInput} placeholderTextColor="#B0B8D0" />
                  <View style={p.fieldDivider} />
                  <Text style={p.fieldLabel}>Description</Text>
                  <TextInput value={form.description} onChangeText={(v) => setFormPatch({ description: v })} placeholder="Optional description…" style={[p.fieldInput, { minHeight: 60 }]} multiline placeholderTextColor="#B0B8D0" />
                </View>
              </View>

              <View style={p.fieldGroup}>
                <Text style={p.groupLabel}>CLASS SETTINGS</Text>
                <View style={p.fieldCard}>
                  <Text style={p.fieldLabel}>Standard / Class *</Text>
                  <Pressable style={p.selectorRow} onPress={() => setSelectorField('classLevel')}>
                    <Text style={form.classLevel ? p.selectorVal : p.selectorPlaceholder}>{form.classLevel ? getStandardLabel(form.classLevel) : 'Select Standard'}</Text>
                    <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                  </Pressable>
                  <View style={p.fieldDivider} />
                  <Text style={p.fieldLabel}>Duration (minutes)</Text>
                  <TextInput value={form.durationMinutes} onChangeText={(v) => setFormPatch({ durationMinutes: v })} placeholder="45" keyboardType="number-pad" style={p.fieldInput} placeholderTextColor="#B0B8D0" />
                </View>
              </View>

              <View style={p.fieldGroup}>
                <Text style={p.groupLabel}>SCHEDULE</Text>
                <View style={p.fieldCard}>
                  <Text style={p.fieldLabel}>Schedule Type</Text>
                  <View style={p.chipRow}>
                    {([['instant', 'Instant', Zap], ['scheduled', 'Scheduled', Calendar]] as [ScheduleType, string, any][]).map(([v, l, ChipIcon]) => (
                      <Pressable key={v} style={[p.chip, form.scheduleType === v && p.chipActive]} onPress={() => setFormPatch({ scheduleType: v })}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ChipIcon size={12} color={form.scheduleType === v ? '#2D5DC9' : '#525C6B'} />
                          <Text style={[p.chipText, form.scheduleType === v && p.chipTextActive]}>{l}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  {form.scheduleType === 'scheduled' && (
                    <>
                      <View style={p.fieldDivider} />
                      <Text style={p.fieldLabel}>Start Date & Time</Text>
                      <View style={p.dateTimeRow}>
                        <View style={p.dateTimeCol}>
                          <Text style={p.dateTimeLabel}>Date</Text>
                          <DateTimeInput
                            kind="date"
                            value={form.startDateInput}
                            onChange={(v) => setFormPatch({ startDateInput: v })}
                            placeholder="YYYY-MM-DD"
                            minDate={new Date()}
                          />
                        </View>
                        <View style={p.dateTimeCol}>
                          <Text style={p.dateTimeLabel}>Time</Text>
                          <DateTimeInput
                            kind="time"
                            value={form.startTimeOfDayInput}
                            onChange={(v) => setFormPatch({ startTimeOfDayInput: v })}
                            placeholder="HH:MM"
                            minDate={(() => {
                              const today = new Date();
                              const sel = form.startDateInput;
                              const isToday = sel === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                              return isToday ? today : undefined;
                            })()}
                          />
                        </View>
                      </View>
                      <View style={p.fieldDivider} />
                      {form.endEnabled ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={p.fieldLabel}>End Date & Time</Text>
                            <Pressable onPress={() => setFormPatch({ endEnabled: false, endDateInput: '', endTimeOfDayInput: '' })}>
                              <Text style={p.removeEndText}>Remove</Text>
                            </Pressable>
                          </View>
                          <View style={p.dateTimeRow}>
                            <View style={p.dateTimeCol}>
                              <Text style={p.dateTimeLabel}>Date</Text>
                              <DateTimeInput
                                kind="date"
                                value={form.endDateInput}
                                onChange={(v) => setFormPatch({ endDateInput: v })}
                                placeholder="YYYY-MM-DD"
                                minDate={form.startDateInput ? new Date(`${form.startDateInput}T00:00:00`) : new Date()}
                              />
                            </View>
                            <View style={p.dateTimeCol}>
                              <Text style={p.dateTimeLabel}>Time</Text>
                              <DateTimeInput
                                kind="time"
                                value={form.endTimeOfDayInput}
                                onChange={(v) => setFormPatch({ endTimeOfDayInput: v })}
                                placeholder="HH:MM"
                                minDate={(() => {
                                  if (form.endDateInput && form.endDateInput === form.startDateInput && form.startTimeOfDayInput) {
                                    const [h, mi] = form.startTimeOfDayInput.split(':').map(Number);
                                    const d = new Date();
                                    d.setHours(h || 0, mi || 0, 0, 0);
                                    return d;
                                  }
                                  return undefined;
                                })()}
                              />
                            </View>
                          </View>
                        </>
                      ) : (
                        <Pressable
                          style={p.addEndBtn}
                          onPress={() => setFormPatch({
                            endEnabled: true,
                            endDateInput: form.startDateInput,
                            endTimeOfDayInput: '',
                          })}
                        >
                          <Text style={p.addEndBtnText}>+ Add End Time</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View style={p.fieldGroup}>
                <Text style={p.groupLabel}>STATUS</Text>
                <Card style={p.fieldCard}>
                  <View style={p.chipRow}>
                    {([['draft', '⊘ Draft'], ['active', '● Active'], ['completed', '✓ Done']] as [ClassroomStatus, string][]).map(([v, l]) => (
                      <Pressable key={v} style={[p.chip, form.status === v && p.chipActive]} onPress={() => setFormPatch({ status: v })}>
                        <Text style={[p.chipText, form.status === v && p.chipTextActive]}>{l}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </View>
            </ScrollView>
          )}

          {/* ── SECTIONS tab ── */}
          {modalTab === 'sections' && (
            <ScrollView contentContainerStyle={p.tabContent}>
              {!form.classLevel && (
                <View style={p.infoBox}>
                  <Text style={p.infoBoxText}>⚠ Select a Standard/Class in Setup first to add resources.</Text>
                </View>
              )}

              <Pressable style={[p.bookmarkBtn, !form.classLevel && { opacity: 0.4 }]} disabled={!form.classLevel} onPress={openBookmarkPicker}>
                <Bookmark size={15} color="#7C3AED" />
                <Text style={p.bookmarkBtnText}>Add from Bookmark</Text>
              </Pressable>

              <View style={p.secGroup}>
                <View style={p.secGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><BookOpen size={14} color="#2D5DC9" /><Text style={p.secGroupTitle}>Learning Content</Text></View>
                  <Pressable style={[p.addSecBtn, !form.classLevel && { opacity: 0.4 }]} disabled={!form.classLevel} onPress={() => setIsAssignContentOpen(true)}>
                    <Text style={p.addSecBtnText}>+ Add</Text>
                  </Pressable>
                </View>
                {form.selectedContentIds.length === 0 ? (
                  <Text style={p.secEmptyText}>No content added yet.</Text>
                ) : (
                  form.selectedContentIds.map((cid, cidx) => {
                    const cItem = contentItems.find((x) => x.id === cid);
                    if (!cItem) return null;
                    return (
                      <View key={cid} style={p.sectionItem}>
                        <View style={p.dragHandle}><GripVertical size={16} color="#B0B8D0" /><Text style={p.sectionItemOrder}>{cidx + 1}</Text></View>
                        <View style={p.sectionItemBody}>
                          <Text style={p.sectionItemTitle} numberOfLines={1}>{cItem.title}</Text>
                          <Text style={p.sectionItemMeta}>{cItem.subject} · {cItem.contentType}</Text>
                        </View>
                        <View style={p.sectionItemActions}>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedContentIds: moveItemUp(form.selectedContentIds, cid) })} disabled={cidx === 0} style={[p.orderBtn, cidx === 0 && { opacity: 0.2 }]}><ChevronUp size={14} color="#2D5DC9" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedContentIds: moveItemDown(form.selectedContentIds, cid) })} disabled={cidx === form.selectedContentIds.length - 1} style={[p.orderBtn, cidx === form.selectedContentIds.length - 1 && { opacity: 0.2 }]}><ChevronDown size={14} color="#2D5DC9" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedContentIds: form.selectedContentIds.filter((x) => x !== cid) })} style={p.removeBtn}><Text style={p.removeBtnText}>✕</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={p.secGroup}>
                <View style={p.secGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Trophy size={14} color="#D33F13" /><Text style={p.secGroupTitle}>Quizzes</Text></View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable style={[p.addSecBtn, !form.classLevel && { opacity: 0.4 }]} disabled={!form.classLevel} onPress={() => setIsAssignQuizOpen(true)}>
                      <Text style={p.addSecBtnText}>+ Add</Text>
                    </Pressable>
                    <Pressable style={[p.addSecBtn, { backgroundColor: '#EBF4FF' }, !form.classLevel && { opacity: 0.4 }]} disabled={!form.classLevel} onPress={() => setQuizCreatorOpen(true)}>
                      <Text style={[p.addSecBtnText, { color: '#2D5DC9' }]}>+ Create</Text>
                    </Pressable>
                  </View>
                </View>
                {form.selectedQuizIds.length === 0 ? (
                  <Text style={p.secEmptyText}>No quizzes added yet.</Text>
                ) : (
                  form.selectedQuizIds.map((qid, qidx) => {
                    const qItem = quizItems.find((x) => x.id === qid);
                    if (!qItem) return null;
                    return (
                      <View key={qid} style={p.sectionItem}>
                        <View style={p.dragHandle}><GripVertical size={16} color="#B0B8D0" /><Text style={p.sectionItemOrder}>{qidx + 1}</Text></View>
                        <View style={p.sectionItemBody}>
                          <Text style={p.sectionItemTitle} numberOfLines={1}>{qItem.title}</Text>
                          <Text style={p.sectionItemMeta}>{qItem.subject || '-'} · {qItem.difficulty_level || '-'}</Text>
                        </View>
                        <View style={p.sectionItemActions}>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedQuizIds: moveItemUp(form.selectedQuizIds, qid) })} disabled={qidx === 0} style={[p.orderBtn, qidx === 0 && { opacity: 0.2 }]}><ChevronUp size={14} color="#D33F13" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedQuizIds: moveItemDown(form.selectedQuizIds, qid) })} disabled={qidx === form.selectedQuizIds.length - 1} style={[p.orderBtn, qidx === form.selectedQuizIds.length - 1 && { opacity: 0.2 }]}><ChevronDown size={14} color="#D33F13" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedQuizIds: form.selectedQuizIds.filter((x) => x !== qid) })} style={p.removeBtn}><Text style={p.removeBtnText}>✕</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={p.secGroup}>
                <View style={p.secGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ClipboardList size={14} color="#9B8EC4" /><Text style={p.secGroupTitle}>Assignments</Text></View>
                  <Pressable style={p.addSecBtn} onPress={() => setForm((c) => ({ ...c, assignments: [...c.assignments, makeAssignment()] }))}>
                    <Text style={p.addSecBtnText}>+ Add</Text>
                  </Pressable>
                </View>
                {form.assignments.map((asgn, aidx) => (
                  <View key={asgn.id} style={p.assignCard}>
                    <View style={p.assignCardHeader}>
                      <Text style={p.assignCardLabel}>Assignment {aidx + 1}</Text>
                      <Pressable onPress={() => removeAssignment(asgn.id)}><Text style={p.removeBtnText}>✕ Remove</Text></Pressable>
                    </View>
                    <Text style={p.fieldLabel}>Title *</Text>
                    <TextInput value={asgn.title} onChangeText={(v) => updateAssignment(asgn.id, { title: v })} placeholder="Title" style={p.fieldInput} placeholderTextColor="#B0B8D0" />
                    <View style={p.fieldDivider} />
                    <Text style={p.fieldLabel}>Description</Text>
                    <TextInput value={asgn.description} onChangeText={(v) => updateAssignment(asgn.id, { description: v })} placeholder="Optional" style={[p.fieldInput, { minHeight: 44 }]} multiline placeholderTextColor="#B0B8D0" />
                    <View style={p.fieldDivider} />
                    <Text style={p.fieldLabel}>Instructions</Text>
                    <TextInput value={asgn.instructions} onChangeText={(v) => updateAssignment(asgn.id, { instructions: v })} placeholder="Optional" style={p.fieldInput} multiline placeholderTextColor="#B0B8D0" />
                    <View style={p.fieldDivider} />
                    <Text style={p.fieldLabel}>Attachment URL</Text>
                    {!asgn.attachmentUrl && (
                      <TextInput value={asgn.attachmentUrl} onChangeText={(v) => updateAssignment(asgn.id, { attachmentUrl: v })} placeholder="URL or upload below" style={p.fieldInput} placeholderTextColor="#B0B8D0" />
                    )}
                    <MediaUploader
                      accept="image/*,audio/*,video/*,application/pdf"
                      mediaType="document"
                      value={asgn.attachmentUrl || null}
                      fileName={asgn.attachmentUrl ? asgn.attachmentUrl.split('/').pop() : ''}
                      onUploadSuccess={(url) => updateAssignment(asgn.id, { attachmentUrl: url })}
                      onClear={() => updateAssignment(asgn.id, { attachmentUrl: '' })}
                      buttonLabel="Upload File"
                    />
                    <View style={p.chipRow}>
                      <Pressable style={[p.chip, asgn.isTimeBound && p.chipActive]} onPress={() => updateAssignment(asgn.id, { isTimeBound: !asgn.isTimeBound })}>
                        <Text style={[p.chipText, asgn.isTimeBound && p.chipTextActive]}>⏰ Time Bound</Text>
                      </Pressable>
                    </View>
                    {asgn.isTimeBound && (
                      <TextInput value={asgn.dueDate} onChangeText={(v) => updateAssignment(asgn.id, { dueDate: v })} placeholder="Due: 2026-05-25T10:30" style={[p.fieldInput, { marginTop: 6 }]} placeholderTextColor="#B0B8D0" />
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── PREVIEW tab ── */}
          {modalTab === 'preview' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <View style={p.previewCard}>
                <View style={[p.previewHeader, { backgroundColor: '#4A7FE0' }]}>
                  <Text style={p.previewTitle}>{form.title || 'Untitled Classroom'}</Text>
                  <Text style={p.previewSub}>
                    {form.classLevel ? getStandardLabel(form.classLevel) : 'No class selected'}
                    {' · '}{form.durationMinutes || '0'} mins
                  </Text>
                  <View style={p.previewStatsRow}>
                    <View style={p.previewStat}><Text style={p.previewStatVal}>{form.selectedContentIds.length}</Text><Text style={p.previewStatLabel}>Content</Text></View>
                    <View style={p.previewStat}><Text style={p.previewStatVal}>{form.selectedQuizIds.length}</Text><Text style={p.previewStatLabel}>Quizzes</Text></View>
                    <View style={p.previewStat}><Text style={p.previewStatVal}>{form.assignments.filter((a) => a.title).length}</Text><Text style={p.previewStatLabel}>Tasks</Text></View>
                  </View>
                </View>

                <View style={p.previewBody}>
                  {form.selectedContentIds.length > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}><BookOpen size={13} color="#2D5DC9" /><Text style={p.previewSectionTitle}>Content</Text></View>
                      {form.selectedContentIds.map((cid, cidx) => {
                        const c = contentItems.find((x) => x.id === cid);
                        if (!c) return null;
                        return (
                          <View key={cid} style={p.previewItem}>
                            <View style={[p.previewItemDot, { backgroundColor: '#2D5DC9' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{cidx + 1}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={p.previewItemTitle}>{c.title}</Text>
                              <Text style={p.previewItemMeta}>{c.subject} · {c.contentType}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                  {form.selectedQuizIds.length > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, marginBottom: 6 }}><Trophy size={13} color="#D33F13" /><Text style={p.previewSectionTitle}>Quizzes</Text></View>
                      {form.selectedQuizIds.map((qid, qidx) => {
                        const q = quizItems.find((x) => x.id === qid);
                        if (!q) return null;
                        return (
                          <View key={qid} style={p.previewItem}>
                            <View style={[p.previewItemDot, { backgroundColor: '#D33F13' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{qidx + 1}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={p.previewItemTitle}>{q.title}</Text>
                              <Text style={p.previewItemMeta}>{q.subject || '-'} · {q.difficulty_level || 'standard'}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                  {form.assignments.filter((a) => a.title).length > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, marginBottom: 6 }}><ClipboardList size={13} color="#9B8EC4" /><Text style={p.previewSectionTitle}>Assignments</Text></View>
                      {form.assignments.filter((a) => a.title).map((a, aidx) => (
                        <View key={a.id} style={p.previewItem}>
                          <View style={[p.previewItemDot, { backgroundColor: '#9B8EC4' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{aidx + 1}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={p.previewItemTitle}>{a.title}</Text>
                            {a.isTimeBound && a.dueDate ? <Text style={p.previewItemMeta}>Due: {a.dueDate}</Text> : null}
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {form.selectedContentIds.length === 0 && form.selectedQuizIds.length === 0 && form.assignments.every((a) => !a.title) && (
                    <View style={p.previewEmpty}>
                      <BookOpen size={36} color="#D0D8F0" />
                      <Text style={p.previewEmptyText}>No sections added yet. Go to the Sections tab to add content, quizzes, and assignments.</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Assign Content picker ── */}
      <Modal visible={isAssignContentOpen} transparent animationType="slide" onRequestClose={() => setIsAssignContentOpen(false)}>
        <View style={p.pickerOverlay}>
          <View style={[p.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={p.pickerHeader}>
              <Text style={p.pickerTitle}>Add Learning Content</Text>
              <Pressable style={p.pickerDoneBtn} onPress={() => setIsAssignContentOpen(false)}>
                <Text style={p.pickerDoneText}>Done ({form.selectedContentIds.length})</Text>
              </Pressable>
            </View>
            <View style={p.pickerSearch}>
              <View style={p.quizFilterRow}>
                <Pressable style={p.filterChipBtn} onPress={() => setSelectorField('contentClass')}>
                  <Text style={contentClassFilter ? p.filterChipActive : p.filterChipPlaceholder}>
                    {contentClassFilter ? getStandardLabel(contentClassFilter) : 'All Classes ▾'}
                  </Text>
                </Pressable>
                <Pressable style={p.filterChipBtn} onPress={() => setSelectorField('contentSubject')}>
                  <Text style={contentSubjectFilter ? p.filterChipActive : p.filterChipPlaceholder}>
                    {contentSubjectFilter || 'Subject ▾'}
                  </Text>
                </Pressable>
                <Pressable style={p.filterClearBtn} onPress={() => { setContentClassFilter(''); setContentSubjectFilter(''); }}>
                  <Text style={p.filterClearText}>Clear</Text>
                </Pressable>
              </View>
              <TextInput
                value={contentSearch}
                onChangeText={setContentSearch}
                placeholder="Search content…"
                style={[p.searchInput, { marginTop: 8 }]}
                placeholderTextColor="#B0B8D0"
              />
            </View>
            {(() => {
              const acTotalPages = Math.max(1, Math.ceil(filteredContents.length / ASSIGN_PAGE_SIZE));
              const acPaged = filteredContents.slice(assignContentPage * ASSIGN_PAGE_SIZE, (assignContentPage + 1) * ASSIGN_PAGE_SIZE);
              return (
                <>
                  <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                    {filteredContents.length === 0 ? (
                      <Text style={p.flatEmpty}>No content found.</Text>
                    ) : (
                      acPaged.map((item) => {
                        const sel = form.selectedContentIds.includes(item.id);
                        return (
                          <Pressable
                            key={item.id}
                            style={[p.pickerItem, sel && p.pickerItemSelected]}
                            onPress={() => setFormPatch({ selectedContentIds: toggleId(form.selectedContentIds, item.id) })}
                          >
                            <View style={[p.checkBox, sel && p.checkBoxSelected]}>
                              {sel && <Text style={p.checkTick}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={p.pickerItemTitle}>{item.title}</Text>
                              <Text style={p.pickerItemMeta}>{getStandardLabel(item.classLevel)} · {item.subject} · {item.contentType}</Text>
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </ScrollView>
                  {filteredContents.length > ASSIGN_PAGE_SIZE && (
                    <View style={pagerS.bar}>
                      <Pressable
                        style={[pagerS.btn, assignContentPage === 0 && pagerS.btnDisabled]}
                        onPress={() => setAssignContentPage((pg) => Math.max(0, pg - 1))}
                        disabled={assignContentPage === 0}
                      >
                        <ChevronLeft size={16} color={assignContentPage === 0 ? '#C0C8D8' : '#2D5DC9'} />
                        <Text style={[pagerS.btnText, assignContentPage === 0 && pagerS.btnTextDisabled]}>Prev</Text>
                      </Pressable>
                      <Text style={pagerS.indicator}>Page {assignContentPage + 1} / {acTotalPages}</Text>
                      <Pressable
                        style={[pagerS.btn, assignContentPage >= acTotalPages - 1 && pagerS.btnDisabled]}
                        onPress={() => setAssignContentPage((pg) => Math.min(acTotalPages - 1, pg + 1))}
                        disabled={assignContentPage >= acTotalPages - 1}
                      >
                        <Text style={[pagerS.btnText, assignContentPage >= acTotalPages - 1 && pagerS.btnTextDisabled]}>Next</Text>
                        <ChevronRight size={16} color={assignContentPage >= acTotalPages - 1 ? '#C0C8D8' : '#2D5DC9'} />
                      </Pressable>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Add from Bookmark picker ── */}
      <Modal visible={isBookmarkPickerOpen} transparent animationType="slide" onRequestClose={() => setIsBookmarkPickerOpen(false)}>
        <View style={p.pickerOverlay}>
          <View style={[p.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={p.pickerHeader}>
              {activeBookmark ? (
                <Pressable style={p.bmBackBtn} onPress={() => setActiveBookmark(null)}>
                  <ChevronLeft size={16} color="#2D5DC9" />
                  <Text style={p.bmBackText}>Bookmarks</Text>
                </Pressable>
              ) : (
                <Text style={p.pickerTitle}>Add from Bookmark</Text>
              )}
              <Pressable style={p.pickerDoneBtn} onPress={() => setIsBookmarkPickerOpen(false)}>
                <Text style={p.pickerDoneText}>Close</Text>
              </Pressable>
            </View>

            {!activeBookmark ? (
              <>
                <View style={p.pickerSearch}>
                  <View style={p.quizFilterRow}>
                    <Pressable style={p.filterChipBtn} onPress={() => setSelectorField('bookmarkClass')}>
                      <Text style={bookmarkClassFilter ? p.filterChipActive : p.filterChipPlaceholder}>
                        {bookmarkClassFilter ? getStandardLabel(bookmarkClassFilter) : 'All Classes ▾'}
                      </Text>
                    </Pressable>
                    <Pressable style={p.filterClearBtn} onPress={() => { setBookmarkClassFilter(''); fetchBookmarks(''); }}>
                      <Text style={p.filterClearText}>Clear</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={bookmarkSearch}
                    onChangeText={setBookmarkSearch}
                    placeholder="Search bookmarks…"
                    style={[p.searchInput, { marginTop: 8 }]}
                    placeholderTextColor="#B0B8D0"
                  />
                </View>
                <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                  {loadingBookmarks ? (
                    <ActivityIndicator accessibilityLabel="Loading" size="small" color="#2D5DC9" style={{ marginTop: 16 }} />
                  ) : (() => {
                    const kw = bookmarkSearch.trim().toLowerCase();
                    const list = kw
                      ? bookmarkList.filter((b) => `${b.name} ${b.description || ''}`.toLowerCase().includes(kw))
                      : bookmarkList;
                    if (list.length === 0) return <Text style={p.flatEmpty}>No bookmarks found.</Text>;
                    return list.map((b) => (
                      <Pressable key={b.id} style={p.pickerItem} onPress={() => openBookmarkDetail(b.id)}>
                        <View style={p.bmIcon}><Bookmark size={16} color="#7C3AED" /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={p.pickerItemTitle}>{b.name}</Text>
                          <Text style={p.pickerItemMeta}>
                            {b.classLevel ? `${getStandardLabel(b.classLevel)} · ` : ''}{b.itemCount} item{b.itemCount !== 1 ? 's' : ''} · {b.contentCount} content · {b.quizCount} quiz
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#B0B8D0" />
                      </Pressable>
                    ));
                  })()}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={p.pickerSearch}>
                  <Text style={p.bmDetailName} numberOfLines={1}>{activeBookmark.name}</Text>
                </View>
                <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                  {loadingBookmarkDetail ? (
                    <ActivityIndicator accessibilityLabel="Loading" size="small" color="#2D5DC9" style={{ marginTop: 16 }} />
                  ) : activeBookmark.items.length === 0 ? (
                    <Text style={p.flatEmpty}>This bookmark has no items.</Text>
                  ) : (
                    activeBookmark.items.map((it) => {
                      const rid = it.itemType === 'content' ? it.contentId : it.quizId;
                      if (!rid) return null;
                      const key = bookmarkItemKey(it.itemType, rid);
                      const sel = bookmarkItemSel.has(key);
                      return (
                        <Pressable key={key} style={[p.pickerItem, sel && p.pickerItemSelected]} onPress={() => toggleBookmarkItem(key)}>
                          <View style={[p.checkBox, sel && p.checkBoxSelected]}>{sel && <Text style={p.checkTick}>✓</Text>}</View>
                          {it.itemType === 'content' ? <FileText size={13} color="#3F5D8C" /> : <Trophy size={13} color="#D33F13" />}
                          <View style={{ flex: 1 }}>
                            <Text style={p.pickerItemTitle}>{it.title}</Text>
                            <Text style={p.pickerItemMeta}>{(it.subject || '-')} · {it.itemType === 'content' ? (it.contentType || 'content') : (it.quizType || 'quiz')}</Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
                <View style={p.bmFooter}>
                  <Pressable style={[p.bmAddBtn, bookmarkItemSel.size === 0 && { opacity: 0.4 }]} disabled={bookmarkItemSel.size === 0} onPress={applyBookmarkSelection}>
                    <Text style={p.bmAddText}>Add {bookmarkItemSel.size} item{bookmarkItemSel.size !== 1 ? 's' : ''}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <CreateQuizModal
        visible={quizCreatorOpen}
        apiFetch={apiFetch}
        user={user}
        initialClassLevel={form.classLevel || undefined}
        onClose={() => setQuizCreatorOpen(false)}
        onCreated={(quiz) => {
          setQuizItems((prev) => {
            if (prev.some((q) => q.id === quiz.id)) return prev;
            return [{
              id: quiz.id,
              title: quiz.title,
              class_level: quiz.classLevel,
              subject: quiz.subject,
            } as any, ...prev];
          });
          setFormPatch({ selectedQuizIds: [...form.selectedQuizIds, quiz.id] });
          setQuizCreatorOpen(false);
        }}
      />

      {/* ── Assign Quiz picker ── */}
      <Modal visible={isAssignQuizOpen} transparent animationType="slide" onRequestClose={() => setIsAssignQuizOpen(false)}>
        <View style={p.pickerOverlay}>
          <View style={[p.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={p.pickerHeader}>
              <Text style={p.pickerTitle}>Add Quizzes</Text>
              <Pressable style={p.pickerDoneBtn} onPress={() => setIsAssignQuizOpen(false)}>
                <Text style={p.pickerDoneText}>Done ({form.selectedQuizIds.length})</Text>
              </Pressable>
            </View>
            <View style={p.pickerSearch}>
              <View style={p.quizFilterRow}>
                <Pressable style={p.filterChipBtn} onPress={() => setSelectorField('quizClass')}>
                  <Text style={quizClassFilter ? p.filterChipActive : p.filterChipPlaceholder}>
                    {quizClassFilter ? getStandardLabel(quizClassFilter) : 'All Classes ▾'}
                  </Text>
                </Pressable>
                <Pressable style={p.filterChipBtn} onPress={() => setSelectorField('quizSubject')}>
                  <Text style={quizFilters.subject ? p.filterChipActive : p.filterChipPlaceholder}>
                    {quizFilters.subject || 'Subject ▾'}
                  </Text>
                </Pressable>
                <Pressable style={p.filterClearBtn} onPress={() => { setQuizClassFilter(''); setQuizFilters((c) => ({ ...c, subject: '' })); }}>
                  <Text style={p.filterClearText}>Clear</Text>
                </Pressable>
              </View>
              <TextInput
                value={quizFilters.search}
                onChangeText={(v) => setQuizFilters((c) => ({ ...c, search: v }))}
                placeholder="Search quizzes…"
                style={[p.searchInput, { marginTop: 8 }]}
                placeholderTextColor="#B0B8D0"
              />
            </View>
            {(() => {
              const aqTotalPages = Math.max(1, Math.ceil(filteredQuizzes.length / ASSIGN_PAGE_SIZE));
              const aqPaged = filteredQuizzes.slice(assignQuizPage * ASSIGN_PAGE_SIZE, (assignQuizPage + 1) * ASSIGN_PAGE_SIZE);
              return (
                <>
                  <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                    {filteredQuizzes.length === 0 ? (
                      <Text style={p.flatEmpty}>No quizzes found.</Text>
                    ) : (
                      aqPaged.map((quiz) => {
                        const sel = form.selectedQuizIds.includes(quiz.id);
                        return (
                          <Pressable
                            key={quiz.id}
                            style={[p.pickerItem, sel && p.pickerItemSelected]}
                            onPress={() => setFormPatch({ selectedQuizIds: toggleId(form.selectedQuizIds, quiz.id) })}
                          >
                            <View style={[p.checkBox, sel && p.checkBoxSelected]}>
                              {sel && <Text style={p.checkTick}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={p.pickerItemTitle}>{quiz.title}</Text>
                              <Text style={p.pickerItemMeta}>{quiz.subject || '-'} · {quiz.quiz_type || '-'} · {quiz.difficulty_level || '-'}</Text>
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </ScrollView>
                  {filteredQuizzes.length > ASSIGN_PAGE_SIZE && (
                    <View style={pagerS.bar}>
                      <Pressable
                        style={[pagerS.btn, assignQuizPage === 0 && pagerS.btnDisabled]}
                        onPress={() => setAssignQuizPage((pg) => Math.max(0, pg - 1))}
                        disabled={assignQuizPage === 0}
                      >
                        <ChevronLeft size={16} color={assignQuizPage === 0 ? '#C0C8D8' : '#2D5DC9'} />
                        <Text style={[pagerS.btnText, assignQuizPage === 0 && pagerS.btnTextDisabled]}>Prev</Text>
                      </Pressable>
                      <Text style={pagerS.indicator}>Page {assignQuizPage + 1} / {aqTotalPages}</Text>
                      <Pressable
                        style={[pagerS.btn, assignQuizPage >= aqTotalPages - 1 && pagerS.btnDisabled]}
                        onPress={() => setAssignQuizPage((pg) => Math.min(aqTotalPages - 1, pg + 1))}
                        disabled={assignQuizPage >= aqTotalPages - 1}
                      >
                        <Text style={[pagerS.btnText, assignQuizPage >= aqTotalPages - 1 && pagerS.btnTextDisabled]}>Next</Text>
                        <ChevronRight size={16} color={assignQuizPage >= aqTotalPages - 1 ? '#C0C8D8' : '#2D5DC9'} />
                      </Pressable>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Selector (class level / subject) ── */}
      <SelectorModal
        visible={selectorField !== null}
        title={isClassSelector ? 'Select Class' : 'Select Subject'}
        options={selectorOptions.map((o) => {
          if (isClassSelector) {
            return { label: getStandardLabel(o), value: o };
          }
          // Pull visual metadata from the class-scoped subjectCatalog so the
          // picker shows admin-uploaded covers / icons / background colors.
          const scopeClass = selectorField === 'contentSubject'
            ? contentClassFilter
            : selectorField === 'quizSubject'
              ? quizClassFilter
              : form.classLevel;
          const meta = subjectCatalog.find(
            (item) => item.subject === o && (!scopeClass || scopeClass === 'ANY' || item.classLevel === scopeClass),
          );
          return {
            label: o,
            value: o,
            coverImage: meta?.coverImage,
            iconUrl: meta?.iconImage,
            iconBgColor: meta?.iconBgColor,
          };
        })}
        selected={selectorSelected}
        isSubject={!isClassSelector}
        showAny={selectorField !== 'classLevel'}
        anyLabel={isClassSelector ? 'All Classes' : 'All Subjects'}
        onSelect={applySelectorValue}
        onClose={() => setSelectorField(null)}
      />

      {/* ── Delete confirm ── */}
      <Modal visible={pendingDelete !== null} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View style={p.pickerOverlay}>
          <View style={[p.confirmCard, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>🗑</Text>
            <Text style={p.confirmTitle}>Delete Classroom?</Text>
            <Text style={p.confirmSub}>"{pendingDelete?.title}" will be permanently removed.</Text>
            <View style={p.confirmActions}>
              <Pressable style={p.confirmCancelBtn} onPress={() => setPendingDelete(null)}>
                <Text style={p.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={p.confirmDeleteBtn} onPress={confirmDelete}>
                <Text style={p.confirmDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── End class confirm ── */}
      <Modal visible={pendingEndClassroom !== null} transparent animationType="fade" onRequestClose={() => setPendingEndClassroom(null)}>
        <View style={p.pickerOverlay}>
          <View style={[p.confirmCard, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>⏹</Text>
            <Text style={p.confirmTitle}>End this class?</Text>
            <Text style={p.confirmSub}>
              "{pendingEndClassroom?.title}" will be moved to history and marked as ended.
            </Text>
            <View style={p.confirmActions}>
              <Pressable style={p.confirmCancelBtn} onPress={() => setPendingEndClassroom(null)}>
                <Text style={p.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[p.confirmDeleteBtn, p.confirmEndBtn]}
                onPress={confirmEndClassroom}
                disabled={endingClassroomId === pendingEndClassroom?.id}
              >
                {endingClassroomId === pendingEndClassroom?.id
                  ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#fff" />
                  : <Text style={p.confirmDeleteText}>End Class</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── History Modal ── */}
      <Modal visible={isHistoryOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsHistoryOpen(false)}>
        <View style={p.historyScreen}>
          <ModalHeader
            title="Previous Classes"
            subtitle="All your ended classroom sessions"
            onBack={() => setIsHistoryOpen(false)}
          />

          {historyLoading ? (
            <View style={p.historyCenter}>
              <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
              <Text style={{ color: '#525C6B', marginTop: 8 }}>Loading history…</Text>
            </View>
          ) : historyRooms.length === 0 ? (
            <View style={p.historyCenter}>
              <Text style={{ fontSize: 48 }}>🕐</Text>
              <Text style={p.historyEmptyTitle}>No history yet</Text>
              <Text style={p.historyEmptyText}>Ended classes will appear here.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={p.historyList}>
              {historyRooms.map((room: any, idx: number) => {
                const startedAt = getDateTimeParts(room.start_time);
                const endedAt = getDateTimeParts(room.ended_at);
                return (
                  <View key={room.id} style={[p.historyCard, { width: historyCardWidth }]}>
                    <View style={p.historyCardTop}>
                      <View style={p.historyCardIcon}>
                        <School size={22} color="#2D5DC9" />
                      </View>
                      <View style={p.historyCardBody}>
                        <Text style={p.historyCardTitle} numberOfLines={1}>{room.title}</Text>
                        <View style={p.historyModeRow}>
                          <View style={p.historyModeChip}>
                            <Text style={p.historyModeChipLabel}>Class</Text>
                            <Text style={p.historyModeChipValue}>{room.class_level ? getStandardLabel(room.class_level) : '—'}</Text>
                          </View>
                          <View style={p.historyModeChip}>
                            <Text style={p.historyModeChipLabel}>Mode</Text>
                            <Text style={p.historyModeChipValue}>{room.schedule_type === 'instant' ? 'Instant' : 'Scheduled'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={p.historyMetaGrid}>
                      <View style={p.historyMetaItem}>
                        <Text style={p.historyMetaLabel}>Started</Text>
                        <View style={p.historyMetaRow}>
                          <Calendar size={11} color="#525C70" />
                          <Text style={p.historyMetaRowText}>{startedAt.date}</Text>
                        </View>
                        <View style={p.historyMetaRow}>
                          <Clock size={11} color="#525C70" />
                          <Text style={p.historyMetaRowText}>{startedAt.time}</Text>
                        </View>
                      </View>
                      <View style={p.historyMetaItem}>
                        <Text style={p.historyMetaLabel}>Ended</Text>
                        <View style={p.historyMetaRow}>
                          <Calendar size={11} color="#525C70" />
                          <Text style={p.historyMetaRowText}>{endedAt.date}</Text>
                        </View>
                        <View style={p.historyMetaRow}>
                          <Clock size={11} color="#525C70" />
                          <Text style={p.historyMetaRowText}>{endedAt.time}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={p.historyChipRow}>
                      <View style={[p.historyChip, { flexDirection: 'row', gap: 4 }]}><Users size={10} color="#3F5D8C" /><Text style={p.historyChipText}>{room.student_count} students</Text></View>
                      <View style={[p.historyChip, { flexDirection: 'row', gap: 4 }]}><Trophy size={10} color="#3F5D8C" /><Text style={p.historyChipText}>{room.quiz_count} quizzes</Text></View>
                      <View style={[p.historyChip, { flexDirection: 'row', gap: 4 }]}><ClipboardList size={10} color="#3F5D8C" /><Text style={p.historyChipText}>{room.assignment_count} tasks</Text></View>
                    </View>
                    <View style={p.historyCardFooter}>
                      <Pressable style={p.historyDetailBtn} onPress={() => { setIsHistoryOpen(false); setDetailsClassroomId(room.id); }}>
                        <Text style={p.historyDetailBtnText}>View Details</Text>
                      </Pressable>
                      <Pressable style={p.historyRestartBtn} onPress={() => restartClassroom(room.id)} disabled={restartingId === room.id}>
                        {restartingId === room.id
                          ? <ActivityIndicator accessibilityLabel="Loading" size="small" color="#2D5DC9" />
                          : <Text style={p.historyRestartBtnText}>Restart</Text>}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Class Details Screen ── */}
      <ClassDetailsScreen
        classroomId={detailsClassroomId}
        apiFetch={apiFetch}
        onClose={() => setDetailsClassroomId(null)}
        onUploadMedia={async () => {
          const picked = await pickFileAsDataUrl('image/*');
          const uploaded = await uploadPickedFileToS3(picked, 'image', 'class_details');
          return { url: uploaded.url };
        }}
      />

    </ScrollView>
  );
}

const p = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#F5F7FF' },
  scroll:       { paddingBottom: 40 },
  noPermText:   { margin: 24, color: '#525C6B', fontSize: 14 },

  // ── Header ──
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle:    { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  headerSub:      { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 2 },
  createBtn:      { backgroundColor: '#2D5DC9', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  createBtnText:  { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── Toast ──
  toast:            { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError:       { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#D33F13' },
  toastText:        { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText:   { color: '#B91C1C' },

  // ── Loading / Empty ──
  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 13, color: '#525C6B', fontWeight: '500' },
  emptyWrap:   { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 60, gap: 8 },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#525C6B', textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 10, backgroundColor: '#2D5DC9', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Classroom card ──
  classCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  classCard: {
    marginBottom: 2,
    borderRadius: 22, padding: 16,
    shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    gap: 12,
  },
  classCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  classArtBox:     { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  classArtEmoji:   { fontSize: 30 },
  classCardInfo:    { flex: 1, gap: 5 },
  classCardTitle:   { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  classModeRow:     { flexDirection: 'column', gap: 4, alignItems: 'flex-start' },
  classModeChip:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classModeChipLabel: { fontSize: 10, fontWeight: '700', color: '#525C70', textTransform: 'uppercase' },
  classModeChipValue: { fontSize: 11, fontWeight: '800', color: '#334155' },
  classCardMeta:    { fontSize: 12, color: '#525C6B', fontWeight: '500' },
  classMetaGrid:    { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 6, marginTop: 2 },
  classMetaItem:    { flexBasis: '48%', flexGrow: 1, minWidth: 96 },
  classTimingRow:   { flexDirection: 'row', gap: 10 },
  classTimingItem:  { flex: 1, minWidth: 0 },
  classTimingSub:   { fontSize: 10, fontWeight: '600', color: '#4B5768', marginTop: 1 },
  classDetailGrid:  { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 8 },
  classDetailItem:  { flexBasis: '48%', flexGrow: 1, minWidth: 96 },
  classMetaLabel:   { fontSize: 10, color: '#525C70', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.35 },
  classMetaValue:   { fontSize: 12, color: '#334155', fontWeight: '700', marginTop: 1 },
  classCardCounts:  { fontSize: 12, color: '#667085', fontWeight: '600' },
  classCountsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -2 },
  classCountChip:   { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.45)', paddingHorizontal: 9, paddingVertical: 4 },
  classCountChipText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  statusTag:        { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  statusTagText:    { fontSize: 10, fontWeight: '800' },
  classCardFooter:  { flexDirection: 'row', gap: 6, paddingTop: 2 },
  footerBtn:        { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 9, alignItems: 'center', position: 'relative' },
  footerBtnText:    { fontSize: 11, fontWeight: '800' },
  activityDot: {
    position: 'absolute',
    top: -4, right: -4,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  activityDotText: { fontSize: 10, fontWeight: '900', color: '#fff', lineHeight: 12 },
  footerBtnGhost:   { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
  footerBtnDelete:  { fontSize: 11, fontWeight: '700', color: '#525C6B' },

  // ── Full-screen modal ──
  modalScreen:       { flex: 1, backgroundColor: '#F5F7FF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F8',
  },
  modalBackBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBackArrow:   { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  modalTitle:       { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  modalSaveBtn:     { backgroundColor: '#2D5DC9', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── Modal tab bar ──
  modalTabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F8',
  },
  modalTab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  modalTabActive:     { borderBottomColor: '#2D5DC9' },
  modalTabText:       { fontSize: 13, fontWeight: '600', color: '#525C6B' },
  modalTabTextActive: { color: '#2D5DC9', fontWeight: '800' },

  // ── Tab content ──
  tabContent: { padding: 16, gap: 16, paddingBottom: 40 },

  // ── Field groups (modal form) ──
  fieldGroup:   { gap: 8 },
  groupLabel:   { fontSize: 10, fontWeight: '800', color: '#525C6B', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  fieldCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:   { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  fieldDivider: { height: 1, backgroundColor: '#F0F0F8' },
  dateTimeRow:  { flexDirection: 'row', gap: 10, marginTop: 6 },
  dateTimeCol:  { flex: 1 },
  dateTimeLabel:{ fontSize: 10, fontWeight: '700', color: '#525C6B', marginBottom: 4 },
  addEndBtn:    { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EBF4FF' },
  addEndBtnText:{ fontSize: 12, fontWeight: '800', color: '#2D5DC9' },
  removeEndText:{ fontSize: 11, fontWeight: '700', color: '#B03A19' },
  selectorRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  selectorVal:  { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  selectorPlaceholder: { fontSize: 14, color: '#B0B8D0' },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F0F0F8' },
  chipActive:   { backgroundColor: '#D6EAFF' },
  chipText:     { fontSize: 13, fontWeight: '600', color: '#525C6B' },
  chipTextActive: { color: '#1A4DA2', fontWeight: '700' },

  // ── Sections tab ──
  secGroup:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  secGroupTitle:  { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  addSecBtn:      { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  addSecBtnText:  { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  secEmptyText:   { fontSize: 13, color: '#B0B8D0', padding: 14, textAlign: 'center' },
  bookmarkBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5D9F8', backgroundColor: '#F7F2FE', borderStyle: 'dashed', marginBottom: 12 },
  bookmarkBtnText:{ fontSize: 13, fontWeight: '800', color: '#7C3AED' },
  bmBackBtn:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bmBackText:     { fontSize: 14, fontWeight: '700', color: '#2D5DC9' },
  bmIcon:         { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },
  bmDetailName:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  bmFooter:       { padding: 12, borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  bmAddBtn:       { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  bmAddText:      { color: '#fff', fontWeight: '800', fontSize: 14 },
  sectionItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  dragHandle:     { alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  sectionItemOrder: { fontSize: 10, fontWeight: '800', color: '#B0B8D0' },
  sectionItemBody:  { flex: 1, gap: 2 },
  sectionItemTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  sectionItemMeta:  { fontSize: 11, color: '#525C6B' },
  sectionItemActions: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  orderBtn:       { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F5F7FF' },
  removeBtn:      { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FFE8E8', marginLeft: 2 },
  removeBtnText:  { fontSize: 11, fontWeight: '800', color: '#D33F13' },
  assignCard:     { padding: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  assignCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignCardLabel:  { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  uploadBtn:      { marginTop: 4, borderRadius: 8, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 8, alignItems: 'center' },
  uploadBtnText:  { fontSize: 12, fontWeight: '700', color: '#2D5DC9' },

  // ── Form layout (flat, no nested cards) ──
  formScroll:  { flex: 1, backgroundColor: '#F4F6FB' },
  formContent: { paddingVertical: 20, paddingHorizontal: 0, gap: 0, paddingBottom: 48 },

  // Section header label above each block
  sectionHdr:  { fontSize: 11, fontWeight: '700', color: '#525C6B', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 6, marginTop: 20 },
  secHdrRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 6, marginTop: 20 },

  // White block — full width, no border, no shadow
  formBlock:   { backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ECEEF4' },

  // Each row inside a block
  formRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, minHeight: 50 },
  formRowLabel:    { fontSize: 14, fontWeight: '600', color: '#1a1a2e', minWidth: 90 },
  formRowInput:    { flex: 1, fontSize: 14, color: '#1a1a2e', textAlign: 'right', fontWeight: '400' },
  formRowValue:    { fontSize: 14, color: '#1a1a2e', fontWeight: '400' },
  formRowPlaceholder: { fontSize: 14, color: '#C0C8D8' },
  formRowAction:   { fontSize: 14, color: '#2D5DC9', fontWeight: '600' },
  rowDivider:      { height: 1, backgroundColor: '#F0F2F8', marginLeft: 20 },

  // Segmented control (replaces chips inside the row)
  segRow:       { flexDirection: 'row', gap: 4 },
  seg:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F2F8' },
  segActive:    { backgroundColor: '#D6EAFF' },
  segText:      { fontSize: 13, fontWeight: '600', color: '#525C6B' },
  segTextActive:{ color: '#1A4DA2', fontWeight: '700' },

  // Toggle switch
  toggle:        { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D8DCE8', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn:      { backgroundColor: '#2D5DC9' },
  toggleThumb:   { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Warning banner
  infoBox:     { marginHorizontal: 20, marginTop: 16, backgroundColor: '#FFFBEA', borderRadius: 10, padding: 12 },
  infoBoxText: { fontSize: 13, color: '#7A5A00', fontWeight: '500' },

  // Flat list rows (sections tab content/quiz items)
  flatRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  flatRowBody:   { flex: 1, gap: 2 },
  flatRowTitle:  { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  flatRowMeta:   { fontSize: 11, color: '#525C6B' },
  flatRowCtrls:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  flatEmpty:     { fontSize: 13, color: '#B0B8D0', paddingVertical: 16, textAlign: 'center' },
  miniBtn:       { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F4F6FB' },
  miniRemove:    { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FEF0ED', marginLeft: 2 },
  miniRemoveText:{ fontSize: 10, fontWeight: '900', color: '#B03A19' },

  // Add button next to section header
  addRowBtn:     { backgroundColor: '#E8F0FE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addRowBtnText: { fontSize: 12, fontWeight: '700', color: '#3B72D4' },

  // Assignment sub-header
  asgnHdrRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  asgnIndex:    { fontSize: 12, fontWeight: '700', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.5 },
  asgnRemove:   { fontSize: 13, fontWeight: '600', color: '#B03A19' },

  // ── Preview tab ──
  previewCard:          { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  previewHeader:        { padding: 20, gap: 6 },
  previewTitle:         { fontSize: 20, fontWeight: '900', color: '#fff' },
  previewSub:           { fontSize: 13, color: '#fff' },
  previewStatsRow:      { flexDirection: 'row', gap: 20, marginTop: 8 },
  previewStat:          { alignItems: 'center', gap: 2 },
  previewStatVal:       { fontSize: 22, fontWeight: '900', color: '#fff' },
  previewStatLabel:     { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  previewBody:          { padding: 16, gap: 6 },
  previewSectionTitle:  { fontSize: 13, fontWeight: '800', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.8 },
  previewItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  previewItemDot:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewItemTitle:     { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  previewItemMeta:      { fontSize: 11, color: '#525C6B', marginTop: 1 },
  previewEmpty:         { alignItems: 'center', paddingVertical: 32, gap: 8 },
  previewEmptyText:     { fontSize: 13, color: '#525C6B', textAlign: 'center', lineHeight: 20 },

  // ── Content/Quiz pickers ──
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  pickerSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', overflow: 'hidden' },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  pickerTitle:   { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  pickerDoneBtn: { backgroundColor: '#2D5DC9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  pickerDoneText:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  pickerSearch:  { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  searchInput:   { backgroundColor: '#F5F7FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#1a1a2e' },
  quizFilterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChipBtn: { borderRadius: 10, backgroundColor: '#F0F0F8', paddingHorizontal: 12, paddingVertical: 9 },
  filterChipActive:     { fontSize: 12, fontWeight: '700', color: '#2D5DC9' },
  filterChipPlaceholder:{ fontSize: 12, fontWeight: '600', color: '#525C6B' },
  filterClearBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  filterClearText: { fontSize: 12, fontWeight: '700', color: '#D33F13' },
  pickerItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFF', borderRadius: 12, padding: 12 },
  pickerItemSelected: { backgroundColor: '#D6EAFF', borderWidth: 1, borderColor: '#2D5DC9' },
  pickerItemTitle:    { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  pickerItemMeta:     { fontSize: 11, color: '#525C6B', marginTop: 1 },
  checkBox:           { width: 20, height: 20, borderWidth: 2, borderColor: '#D0D8F0', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkBoxSelected:   { backgroundColor: '#2D5DC9', borderColor: '#2D5DC9' },
  checkTick:          { color: '#fff', fontSize: 11, fontWeight: '900' },

  // ── Selector sheet ──


  // ── Delete confirm ──
  confirmCard:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', gap: 6 },
  confirmTitle:       { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  confirmSub:         { fontSize: 13, color: '#525C6B', textAlign: 'center', lineHeight: 20 },
  confirmActions:     { width: '100%', flexDirection: 'row', gap: 10, marginTop: 16 },
  confirmCancelBtn:   { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#D0D8F0', paddingVertical: 13, alignItems: 'center' },
  confirmCancelText:  { fontWeight: '700', color: '#525C6B', fontSize: 14 },
  confirmDeleteBtn:   { flex: 1, borderRadius: 12, backgroundColor: '#D33F13', paddingVertical: 13, alignItems: 'center' },
  confirmEndBtn:      { backgroundColor: '#B03A19' },
  confirmDeleteText:  { fontWeight: '800', color: '#fff', fontSize: 14 },

  // ── History button in header
  historyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#D0D8F0', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  historyBtnText: { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },

  // ── History full-screen modal
  historyScreen:     { flex: 1, backgroundColor: '#F5F7FF' },
  historyHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  historyBackBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  historyBackArrow:  { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  historyTitle:      { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historySubtitle:   { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 1 },
  historyCenter:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  historyEmptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historyEmptyText:  { fontSize: 13, color: '#525C6B', textAlign: 'center' },
  historyList:       { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12, paddingBottom: 40 },

  historyCard:       { backgroundColor: '#fff', borderRadius: 20, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  historyCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 8 },
  historyCardIcon:   { width: 46, height: 46, borderRadius: 13, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  historyCardBody:   { flex: 1, gap: 6 },
  historyCardTitle:  { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  historyModeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyModeChip:   { borderRadius: 999, backgroundColor: '#F2F6FF', paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyModeChipLabel: { fontSize: 10, fontWeight: '700', color: '#525C70', textTransform: 'uppercase' },
  historyModeChipValue: { fontSize: 11, fontWeight: '800', color: '#334155' },
  historyCardMeta:   { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 2 },
  historyMetaGrid:   { flexDirection: 'row', columnGap: 10, rowGap: 8, paddingHorizontal: 16, marginTop: 2 },
  historyMetaItem:   { flexBasis: '48%', flexGrow: 1, minWidth: 130 },
  historyMetaItemWide: { flexBasis: '100%' },
  historyMetaLabel:  { fontSize: 10, fontWeight: '800', color: '#525C70', textTransform: 'uppercase', letterSpacing: 0.4 },
  historyMetaValue:  { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 1 },
  historyMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  historyMetaRowText:{ fontSize: 11, fontWeight: '600', color: '#475569' },
  historyChipRow:    { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', paddingHorizontal: 16 },
  historyChip:       { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0F4FF' },
  historyChipText:   { fontSize: 11, fontWeight: '700', color: '#3F5D8C' },
  historyCardFooter: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  historyDetailBtn:  { flex: 1, borderRadius: 12, backgroundColor: '#EBF4FF', paddingVertical: 10, alignItems: 'center' },
  historyDetailBtnText: { fontSize: 13, fontWeight: '800', color: '#1A4DA2' },
  historyRestartBtn: { flex: 1, borderRadius: 12, backgroundColor: '#D6F5D6', paddingVertical: 10, alignItems: 'center' },
  historyRestartBtnText: { fontSize: 13, fontWeight: '800', color: '#1A6B1A' },

  pageBtn:      { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#EEF4FF', borderRadius: 8 },
  pageBtnText:  { fontSize: 13, fontWeight: '700', color: '#2D5DC9' },
  pageText:     { fontSize: 13, fontWeight: '600', color: '#525C6B' },
});

const pagerS = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F4FF' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EBF4FF' },
  btnDisabled: { backgroundColor: '#F4F5FF' },
  btnText: { fontSize: 12, fontWeight: '700', color: '#2D5DC9' },
  btnTextDisabled: { color: '#C0C8D8' },
  indicator: { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },
});
