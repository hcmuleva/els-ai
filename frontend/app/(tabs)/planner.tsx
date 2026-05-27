import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, GripVertical, Clock, BookOpen, Trophy, ClipboardList, Settings, Eye, Zap, Calendar, Users, CheckCircle, School } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import SelectorModal from '../../src/components/SelectorModal';

import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { useAuth } from '../../src/context/AuthContext';
import ClassDetailsScreen from '../../src/components/classroom/ClassDetailsScreen';

type ModalTab = 'setup' | 'sections' | 'preview';

type ScheduleType = 'instant' | 'scheduled';
type ClassroomStatus = 'draft' | 'active' | 'completed';
type SelectorField = 'classLevel' | 'quizSubject';

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
};

type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

const STATUS_COLORS: Record<ClassroomStatus, string> = {
  active: '#16a34a',
  completed: '#6b7280',
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

async function pickFileAsDataUrl(accept: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    throw new Error('File upload is currently supported on web. On mobile, paste attachment URL manually.');
  }

  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) {
      reject(new Error('File picker is unavailable in this environment.'));
      return;
    }

    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          dataUrl: String(reader.result || ''),
          fileName: file.name || 'uploaded-file',
          mimeType: file.type || '',
        });
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    };

    input.click();
  });
}

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
          <Text style={{ color: '#4A90E2', fontWeight: '800', fontSize: 12 }}>Done</Text>
        </Pressable>
      ) : null}
    </>
  );
}

export default function PlannerScreen() {
  const { user, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingClassroomId, setDeletingClassroomId] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
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
  const [contentSearch, setContentSearch] = useState('');
  const [contentSubjectFilter, setContentSubjectFilter] = useState('');
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

  const loadClassrooms = useCallback(async () => {
    const res = await apiFetch('/classrooms?limit=200');
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message || 'Failed to load classrooms');
    }
    const payload = await res.json();
    setClassrooms((payload.classrooms || []) as ClassroomSummary[]);
  }, [apiFetch]);

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
    const [contentRes, quizRes, catalogRes] = await Promise.all([
      apiFetch('/content/items?limit=300'),
      apiFetch('/quizzes/teacher/library?status=all&limit=300'),
      apiFetch('/catalog/subjects'),
    ]);

    if (contentRes.ok) {
      const payload = await contentRes.json();
      setContentItems((payload.items || []) as ContentItem[]);
    }

    if (quizRes.ok) {
      const payload = await quizRes.json();
      setQuizItems((payload.quizzes || []) as QuizItem[]);
    }

    if (catalogRes.ok) {
      const payload = await catalogRes.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      setSubjectCatalog(
        items
          .map((item: any) => ({
            classLevel: String(item.class_level || '').trim(),
            subject: String(item.subject || '').trim(),
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
      await Promise.all([loadClassrooms(), loadResources(), loadActivityCounts()]);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load classroom planning data' });
    } finally {
      setLoading(false);
    }
  }, [isTeacherView, loadClassrooms, loadResources, loadActivityCounts]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const classLevelOptions = useMemo(() => STANDARD_OPTIONS.map((item) => item.value), []);

  const subjectOptions = useMemo(
    () =>
      [
        ...new Set(
          subjectCatalog
            .filter((item) => !form.classLevel || item.classLevel === form.classLevel)
            .map((item) => item.subject),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [form.classLevel, subjectCatalog],
  );

  const contentSubjectOptions = useMemo(
    () => [...new Set(contentItems
      .filter((item) => !form.classLevel || item.classLevel === form.classLevel)
      .map((item) => item.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [contentItems, form.classLevel],
  );

  const filteredContents = useMemo(() => {
    return contentItems
      .filter((item) => !form.classLevel || item.classLevel === form.classLevel)
      .filter((item) => !contentSubjectFilter || item.subject === contentSubjectFilter)
      .filter((item) => {
        const keyword = contentSearch.trim().toLowerCase();
        if (!keyword) return true;
        return `${item.title} ${item.subject} ${item.contentType}`.toLowerCase().includes(keyword);
      });
  }, [contentItems, form.classLevel, contentSearch, contentSubjectFilter]);

  const filteredQuizzes = useMemo(
    () =>
      quizItems
        .filter((quiz) => !form.classLevel || (quiz.class_level || '').trim() === form.classLevel)
        .filter((quiz) => !quizFilters.subject || (quiz.subject || '').trim() === quizFilters.subject)
        .filter((quiz) => !quizFilters.category || (quiz.quiz_type || '').toLowerCase().includes(quizFilters.category.toLowerCase()))
        .filter((quiz) => !quizFilters.difficulty || (quiz.difficulty_level || '').toLowerCase().includes(quizFilters.difficulty.toLowerCase()))
        .filter((quiz) => {
          const keyword = quizFilters.search.trim().toLowerCase();
          if (!keyword) return true;
          return `${quiz.title} ${quiz.subject || ''}`.toLowerCase().includes(keyword);
        }),
    [form.classLevel, quizFilters.category, quizFilters.difficulty, quizFilters.search, quizFilters.subject, quizItems],
  );

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

  const uploadAssignmentAttachment = async (id: string) => {
    try {
      const picked = await pickFileAsDataUrl('image/*,audio/*,video/*');
      const mediaType = resolveUploadMediaType(picked);
      const res = await apiFetch('/assets/upload', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl: picked.dataUrl,
          fileName: picked.fileName,
          mimeType: picked.mimeType,
          mediaType,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to upload attachment');
      }
      const payload = await res.json();
      updateAssignment(id, { attachmentUrl: payload.url || '' });
      setMessage({ type: 'success', text: 'Attachment uploaded successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload attachment' });
    }
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
      await loadClassrooms();
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
      await loadClassrooms();
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
      await loadClassrooms();
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
      await loadClassrooms();
      setMessage({ type: 'success', text: 'Class restarted successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to restart class' });
    } finally { setRestartingId(null); }
  };

  const selectorOptions = selectorField === 'classLevel' ? classLevelOptions : subjectOptions;

  const applySelectorValue = (value: string) => {
    if (selectorField === 'classLevel') {
      setFormPatch({ classLevel: value, selectedQuizIds: [], selectedContentIds: [] });
      setQuizFilters((current) => ({ ...current, subject: '' }));
    } else if (selectorField === 'quizSubject') {
      setQuizFilters((current) => ({ ...current, subject: value }));
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

  const CARD_PALETTES = [
    { bg: '#4A7FE0', light: '#D6EAFF' },
    { bg: '#FF7043', light: '#FFE8D6' },
    { bg: '#9B8EC4', light: '#EDE4FF' },
    { bg: '#7DC67A', light: '#D6F5D6' },
    { bg: '#E6A817', light: '#FFF5CC' },
    { bg: '#F06292', light: '#FFE0EC' },
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
          <ActivityIndicator size="large" color="#4A90E2" />
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
          {classrooms.map((item, idx) => {
            const pal = CARD_PALETTES[idx % CARD_PALETTES.length];
            const IconComp = CARD_ICONS[idx % CARD_ICONS.length];
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
                    <Text numberOfLines={1} style={[p.footerBtnText, { color: pal.bg }]}>Edit</Text>
                  </Pressable>
                  {item.status !== 'completed' && (
                    <Pressable style={[p.footerBtn, { backgroundColor: '#FEF0ED' }]} onPress={() => setPendingEndClassroom(item)} disabled={endingClassroomId === item.id}>
                      {endingClassroomId === item.id
                        ? <ActivityIndicator size="small" color="#FF7043" />
                        : <Text numberOfLines={1} style={[p.footerBtnText, { color: '#E05A3A' }]}>End Class</Text>}
                    </Pressable>
                  )}
                  <Pressable style={p.footerBtnGhost} onPress={() => setPendingDelete(item)} disabled={deletingClassroomId === item.id}>
                    {deletingClassroomId === item.id
                      ? <ActivityIndicator size="small" color="#FF7043" />
                      : <Text numberOfLines={1} style={p.footerBtnDelete}>Delete</Text>}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Create / Edit Modal (full-screen slide) ── */}
      <Modal visible={isFormOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsFormOpen(false)}>
        <View style={p.modalScreen}>

          {/* Modal header */}
          <View style={[p.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setIsFormOpen(false)} style={p.modalBackBtn}>
              <Text style={p.modalBackArrow}>‹</Text>
            </Pressable>
            <Text style={p.modalTitle} numberOfLines={1}>
              {editingClassroomId ? 'Edit Classroom' : 'New Classroom'}
            </Text>
            <Pressable style={p.modalSaveBtn} onPress={saveClassroom} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={p.modalSaveBtnText}>Save</Text>}
            </Pressable>
          </View>

          {/* Tab bar */}
          <View style={p.modalTabBar}>
            {([['setup', 'Setup', Settings], ['sections', 'Sections', BookOpen], ['preview', 'Preview', Eye]] as [ModalTab, string, any][]).map(([tab, label, TabIcon]) => (
              <Pressable
                key={tab}
                style={[p.modalTab, modalTab === tab && p.modalTabActive]}
                onPress={() => setModalTab(tab)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <TabIcon size={13} color={modalTab === tab ? '#4A90E2' : '#9A9AB0'} />
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
                          <ChipIcon size={12} color={form.scheduleType === v ? '#4A90E2' : '#9A9AB0'} />
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
                <View style={p.fieldCard}>
                  <View style={p.chipRow}>
                    {([['draft', '⊘ Draft'], ['active', '● Active'], ['completed', '✓ Done']] as [ClassroomStatus, string][]).map(([v, l]) => (
                      <Pressable key={v} style={[p.chip, form.status === v && p.chipActive]} onPress={() => setFormPatch({ status: v })}>
                        <Text style={[p.chipText, form.status === v && p.chipTextActive]}>{l}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
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

              <View style={p.secGroup}>
                <View style={p.secGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><BookOpen size={14} color="#4A90E2" /><Text style={p.secGroupTitle}>Learning Content</Text></View>
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
                          <TouchableOpacity onPress={() => setFormPatch({ selectedContentIds: moveItemUp(form.selectedContentIds, cid) })} disabled={cidx === 0} style={[p.orderBtn, cidx === 0 && { opacity: 0.2 }]}><ChevronUp size={14} color="#4A90E2" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedContentIds: moveItemDown(form.selectedContentIds, cid) })} disabled={cidx === form.selectedContentIds.length - 1} style={[p.orderBtn, cidx === form.selectedContentIds.length - 1 && { opacity: 0.2 }]}><ChevronDown size={14} color="#4A90E2" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedContentIds: form.selectedContentIds.filter((x) => x !== cid) })} style={p.removeBtn}><Text style={p.removeBtnText}>✕</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={p.secGroup}>
                <View style={p.secGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Trophy size={14} color="#FF7043" /><Text style={p.secGroupTitle}>Quizzes</Text></View>
                  <Pressable style={[p.addSecBtn, !form.classLevel && { opacity: 0.4 }]} disabled={!form.classLevel} onPress={() => setIsAssignQuizOpen(true)}>
                    <Text style={p.addSecBtnText}>+ Add</Text>
                  </Pressable>
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
                          <TouchableOpacity onPress={() => setFormPatch({ selectedQuizIds: moveItemUp(form.selectedQuizIds, qid) })} disabled={qidx === 0} style={[p.orderBtn, qidx === 0 && { opacity: 0.2 }]}><ChevronUp size={14} color="#FF7043" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormPatch({ selectedQuizIds: moveItemDown(form.selectedQuizIds, qid) })} disabled={qidx === form.selectedQuizIds.length - 1} style={[p.orderBtn, qidx === form.selectedQuizIds.length - 1 && { opacity: 0.2 }]}><ChevronDown size={14} color="#FF7043" /></TouchableOpacity>
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
                    <TextInput value={asgn.attachmentUrl} onChangeText={(v) => updateAssignment(asgn.id, { attachmentUrl: v })} placeholder="URL or upload below" style={p.fieldInput} placeholderTextColor="#B0B8D0" />
                    <Pressable style={p.uploadBtn} onPress={() => uploadAssignmentAttachment(asgn.id)}><Text style={p.uploadBtnText}>⬆ Upload File</Text></Pressable>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}><BookOpen size={13} color="#4A90E2" /><Text style={p.previewSectionTitle}>Content</Text></View>
                      {form.selectedContentIds.map((cid, cidx) => {
                        const c = contentItems.find((x) => x.id === cid);
                        if (!c) return null;
                        return (
                          <View key={cid} style={p.previewItem}>
                            <View style={[p.previewItemDot, { backgroundColor: '#4A90E2' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{cidx + 1}</Text></View>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, marginBottom: 6 }}><Trophy size={13} color="#FF7043" /><Text style={p.previewSectionTitle}>Quizzes</Text></View>
                      {form.selectedQuizIds.map((qid, qidx) => {
                        const q = quizItems.find((x) => x.id === qid);
                        if (!q) return null;
                        return (
                          <View key={qid} style={p.previewItem}>
                            <View style={[p.previewItemDot, { backgroundColor: '#FF7043' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{qidx + 1}</Text></View>
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
          <View style={p.pickerSheet}>
            <View style={p.pickerHeader}>
              <Text style={p.pickerTitle}>Add Learning Content</Text>
              <Pressable style={p.pickerDoneBtn} onPress={() => setIsAssignContentOpen(false)}>
                <Text style={p.pickerDoneText}>Done ({form.selectedContentIds.length})</Text>
              </Pressable>
            </View>
            <View style={p.pickerSearch}>
              <TextInput
                value={contentSearch}
                onChangeText={setContentSearch}
                placeholder="Search content…"
                style={p.searchInput}
                placeholderTextColor="#B0B8D0"
              />
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
              {filteredContents.length === 0 ? (
                <Text style={p.flatEmpty}>No content found.</Text>
              ) : (
                filteredContents.map((item) => {
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
          </View>
        </View>
      </Modal>

      {/* ── Assign Quiz picker ── */}
      <Modal visible={isAssignQuizOpen} transparent animationType="slide" onRequestClose={() => setIsAssignQuizOpen(false)}>
        <View style={p.pickerOverlay}>
          <View style={p.pickerSheet}>
            <View style={p.pickerHeader}>
              <Text style={p.pickerTitle}>Add Quizzes</Text>
              <Pressable style={p.pickerDoneBtn} onPress={() => setIsAssignQuizOpen(false)}>
                <Text style={p.pickerDoneText}>Done ({form.selectedQuizIds.length})</Text>
              </Pressable>
            </View>
            <View style={p.pickerSearch}>
              <View style={p.quizFilterRow}>
                <Pressable style={p.filterChipBtn} onPress={() => setSelectorField('quizSubject')}>
                  <Text style={quizFilters.subject ? p.filterChipActive : p.filterChipPlaceholder}>
                    {quizFilters.subject || 'Subject ▾'}
                  </Text>
                </Pressable>
                <TextInput
                  value={quizFilters.search}
                  onChangeText={(v) => setQuizFilters((c) => ({ ...c, search: v }))}
                  placeholder="Search quizzes…"
                  style={[p.searchInput, { flex: 1 }]}
                  placeholderTextColor="#B0B8D0"
                />
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
              {filteredQuizzes.length === 0 ? (
                <Text style={p.flatEmpty}>No quizzes found.</Text>
              ) : (
                filteredQuizzes.map((quiz) => {
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
          </View>
        </View>
      </Modal>

      {/* ── Selector (class level / subject) ── */}
      <SelectorModal
        visible={selectorField !== null}
        title={selectorField === 'classLevel' ? 'Select Standard' : 'Select Subject'}
        options={selectorOptions.map((o) => ({ label: selectorField === 'classLevel' ? getStandardLabel(o) : o, value: o }))}
        selected={selectorField === 'classLevel' ? form.classLevel : ''}
        isSubject={selectorField !== 'classLevel'}
        onSelect={applySelectorValue}
        onClose={() => setSelectorField(null)}
      />

      {/* ── Delete confirm ── */}
      <Modal visible={pendingDelete !== null} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View style={p.pickerOverlay}>
          <View style={p.confirmCard}>
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
          <View style={p.confirmCard}>
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
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={p.confirmDeleteText}>End Class</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── History Modal ── */}
      <Modal visible={isHistoryOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsHistoryOpen(false)}>
        <View style={p.historyScreen}>
          <View style={[p.historyHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setIsHistoryOpen(false)} style={p.historyBackBtn}>
              <Text style={p.historyBackArrow}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={p.historyTitle}>Previous Classes</Text>
              <Text style={p.historySubtitle}>All your ended classroom sessions</Text>
            </View>
          </View>

          {historyLoading ? (
            <View style={p.historyCenter}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={{ color: '#9A9AB0', marginTop: 8 }}>Loading history…</Text>
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
                        <School size={22} color="#4A90E2" />
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
                          <Calendar size={11} color="#7A869F" />
                          <Text style={p.historyMetaRowText}>{startedAt.date}</Text>
                        </View>
                        <View style={p.historyMetaRow}>
                          <Clock size={11} color="#7A869F" />
                          <Text style={p.historyMetaRowText}>{startedAt.time}</Text>
                        </View>
                      </View>
                      <View style={p.historyMetaItem}>
                        <Text style={p.historyMetaLabel}>Ended</Text>
                        <View style={p.historyMetaRow}>
                          <Calendar size={11} color="#7A869F" />
                          <Text style={p.historyMetaRowText}>{endedAt.date}</Text>
                        </View>
                        <View style={p.historyMetaRow}>
                          <Clock size={11} color="#7A869F" />
                          <Text style={p.historyMetaRowText}>{endedAt.time}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={p.historyChipRow}>
                      <View style={[p.historyChip, { flexDirection: 'row', gap: 4 }]}><Users size={10} color="#5A7AB0" /><Text style={p.historyChipText}>{room.student_count} students</Text></View>
                      <View style={[p.historyChip, { flexDirection: 'row', gap: 4 }]}><Trophy size={10} color="#5A7AB0" /><Text style={p.historyChipText}>{room.quiz_count} quizzes</Text></View>
                      <View style={[p.historyChip, { flexDirection: 'row', gap: 4 }]}><ClipboardList size={10} color="#5A7AB0" /><Text style={p.historyChipText}>{room.assignment_count} tasks</Text></View>
                    </View>
                    <View style={p.historyCardFooter}>
                      <Pressable style={p.historyDetailBtn} onPress={() => { setIsHistoryOpen(false); setDetailsClassroomId(room.id); }}>
                        <Text style={p.historyDetailBtnText}>View Details</Text>
                      </Pressable>
                      <Pressable style={p.historyRestartBtn} onPress={() => restartClassroom(room.id)} disabled={restartingId === room.id}>
                        {restartingId === room.id
                          ? <ActivityIndicator size="small" color="#4A90E2" />
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
          const res = await apiFetch('/assets/upload', {
            method: 'POST',
            body: JSON.stringify({ dataUrl: picked.dataUrl, fileName: picked.fileName, mimeType: picked.mimeType, mediaType: 'image' }),
          });
          if (!res.ok) throw new Error('Upload failed');
          const payload = await res.json();
          return { url: payload.url };
        }}
      />

    </ScrollView>
  );
}

const p = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#F5F7FF' },
  scroll:       { paddingBottom: 40 },
  noPermText:   { margin: 24, color: '#9A9AB0', fontSize: 14 },

  // ── Header ──
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle:    { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  headerSub:      { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  createBtn:      { backgroundColor: '#4A90E2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  createBtnText:  { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── Toast ──
  toast:            { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError:       { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#FF7043' },
  toastText:        { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText:   { color: '#B91C1C' },

  // ── Loading / Empty ──
  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 13, color: '#9A9AB0', fontWeight: '500' },
  emptyWrap:   { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 60, gap: 8 },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 10, backgroundColor: '#4A90E2', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
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
  classModeChipLabel: { fontSize: 10, fontWeight: '700', color: '#7A869F', textTransform: 'uppercase' },
  classModeChipValue: { fontSize: 11, fontWeight: '800', color: '#334155' },
  classCardMeta:    { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  classMetaGrid:    { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 6, marginTop: 2 },
  classMetaItem:    { flexBasis: '48%', flexGrow: 1, minWidth: 96 },
  classTimingRow:   { flexDirection: 'row', gap: 10 },
  classTimingItem:  { flex: 1, minWidth: 0 },
  classTimingSub:   { fontSize: 10, fontWeight: '600', color: '#64748B', marginTop: 1 },
  classDetailGrid:  { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 8 },
  classDetailItem:  { flexBasis: '48%', flexGrow: 1, minWidth: 96 },
  classMetaLabel:   { fontSize: 10, color: '#7A869F', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.35 },
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
  footerBtnDelete:  { fontSize: 11, fontWeight: '700', color: '#9A9AB0' },

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
  modalSaveBtn:     { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
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
  modalTabActive:     { borderBottomColor: '#4A90E2' },
  modalTabText:       { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  modalTabTextActive: { color: '#4A90E2', fontWeight: '800' },

  // ── Tab content ──
  tabContent: { padding: 16, gap: 16, paddingBottom: 40 },

  // ── Field groups (modal form) ──
  fieldGroup:   { gap: 8 },
  groupLabel:   { fontSize: 10, fontWeight: '800', color: '#9A9AB0', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  fieldCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:   { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  fieldDivider: { height: 1, backgroundColor: '#F0F0F8' },
  dateTimeRow:  { flexDirection: 'row', gap: 10, marginTop: 6 },
  dateTimeCol:  { flex: 1 },
  dateTimeLabel:{ fontSize: 10, fontWeight: '700', color: '#9A9AB0', marginBottom: 4 },
  addEndBtn:    { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EBF4FF' },
  addEndBtnText:{ fontSize: 12, fontWeight: '800', color: '#4A90E2' },
  removeEndText:{ fontSize: 11, fontWeight: '700', color: '#E05A3A' },
  selectorRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  selectorVal:  { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  selectorPlaceholder: { fontSize: 14, color: '#B0B8D0' },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F0F0F8' },
  chipActive:   { backgroundColor: '#D6EAFF' },
  chipText:     { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  chipTextActive: { color: '#1A4DA2', fontWeight: '700' },

  // ── Sections tab ──
  secGroup:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  secGroupTitle:  { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  addSecBtn:      { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  addSecBtnText:  { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  secEmptyText:   { fontSize: 13, color: '#B0B8D0', padding: 14, textAlign: 'center' },
  sectionItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  dragHandle:     { alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  sectionItemOrder: { fontSize: 10, fontWeight: '800', color: '#B0B8D0' },
  sectionItemBody:  { flex: 1, gap: 2 },
  sectionItemTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  sectionItemMeta:  { fontSize: 11, color: '#9A9AB0' },
  sectionItemActions: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  orderBtn:       { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F5F7FF' },
  removeBtn:      { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FFE8E8', marginLeft: 2 },
  removeBtnText:  { fontSize: 11, fontWeight: '800', color: '#FF7043' },
  assignCard:     { padding: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  assignCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignCardLabel:  { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  uploadBtn:      { marginTop: 4, borderRadius: 8, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 8, alignItems: 'center' },
  uploadBtnText:  { fontSize: 12, fontWeight: '700', color: '#4A90E2' },

  // ── Form layout (flat, no nested cards) ──
  formScroll:  { flex: 1, backgroundColor: '#F4F6FB' },
  formContent: { paddingVertical: 20, paddingHorizontal: 0, gap: 0, paddingBottom: 48 },

  // Section header label above each block
  sectionHdr:  { fontSize: 11, fontWeight: '700', color: '#9A9AB0', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 6, marginTop: 20 },
  secHdrRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 6, marginTop: 20 },

  // White block — full width, no border, no shadow
  formBlock:   { backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ECEEF4' },

  // Each row inside a block
  formRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, minHeight: 50 },
  formRowLabel:    { fontSize: 14, fontWeight: '600', color: '#1a1a2e', minWidth: 90 },
  formRowInput:    { flex: 1, fontSize: 14, color: '#1a1a2e', textAlign: 'right', fontWeight: '400' },
  formRowValue:    { fontSize: 14, color: '#1a1a2e', fontWeight: '400' },
  formRowPlaceholder: { fontSize: 14, color: '#C0C8D8' },
  formRowAction:   { fontSize: 14, color: '#4A90E2', fontWeight: '600' },
  rowDivider:      { height: 1, backgroundColor: '#F0F2F8', marginLeft: 20 },

  // Segmented control (replaces chips inside the row)
  segRow:       { flexDirection: 'row', gap: 4 },
  seg:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F2F8' },
  segActive:    { backgroundColor: '#D6EAFF' },
  segText:      { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  segTextActive:{ color: '#1A4DA2', fontWeight: '700' },

  // Toggle switch
  toggle:        { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D8DCE8', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn:      { backgroundColor: '#4A90E2' },
  toggleThumb:   { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Warning banner
  infoBox:     { marginHorizontal: 20, marginTop: 16, backgroundColor: '#FFFBEA', borderRadius: 10, padding: 12 },
  infoBoxText: { fontSize: 13, color: '#7A5A00', fontWeight: '500' },

  // Flat list rows (sections tab content/quiz items)
  flatRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  flatRowBody:   { flex: 1, gap: 2 },
  flatRowTitle:  { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  flatRowMeta:   { fontSize: 11, color: '#9A9AB0' },
  flatRowCtrls:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  flatEmpty:     { fontSize: 13, color: '#B0B8D0', paddingVertical: 16, textAlign: 'center' },
  miniBtn:       { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F4F6FB' },
  miniRemove:    { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FEF0ED', marginLeft: 2 },
  miniRemoveText:{ fontSize: 10, fontWeight: '900', color: '#E05A3A' },

  // Add button next to section header
  addRowBtn:     { backgroundColor: '#E8F0FE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addRowBtnText: { fontSize: 12, fontWeight: '700', color: '#3B72D4' },

  // Assignment sub-header
  asgnHdrRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  asgnIndex:    { fontSize: 12, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  asgnRemove:   { fontSize: 13, fontWeight: '600', color: '#E05A3A' },

  // ── Preview tab ──
  previewCard:          { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  previewHeader:        { padding: 20, gap: 6 },
  previewTitle:         { fontSize: 20, fontWeight: '900', color: '#fff' },
  previewSub:           { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  previewStatsRow:      { flexDirection: 'row', gap: 20, marginTop: 8 },
  previewStat:          { alignItems: 'center', gap: 2 },
  previewStatVal:       { fontSize: 22, fontWeight: '900', color: '#fff' },
  previewStatLabel:     { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  previewBody:          { padding: 16, gap: 6 },
  previewSectionTitle:  { fontSize: 13, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8 },
  previewItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  previewItemDot:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewItemTitle:     { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  previewItemMeta:      { fontSize: 11, color: '#9A9AB0', marginTop: 1 },
  previewEmpty:         { alignItems: 'center', paddingVertical: 32, gap: 8 },
  previewEmptyText:     { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },

  // ── Content/Quiz pickers ──
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  pickerSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', overflow: 'hidden' },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  pickerTitle:   { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  pickerDoneBtn: { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  pickerDoneText:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  pickerSearch:  { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  searchInput:   { backgroundColor: '#F5F7FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#1a1a2e' },
  quizFilterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChipBtn: { borderRadius: 10, backgroundColor: '#F0F0F8', paddingHorizontal: 12, paddingVertical: 9 },
  filterChipActive:     { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  filterChipPlaceholder:{ fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  pickerItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFF', borderRadius: 12, padding: 12 },
  pickerItemSelected: { backgroundColor: '#D6EAFF', borderWidth: 1, borderColor: '#4A90E2' },
  pickerItemTitle:    { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  pickerItemMeta:     { fontSize: 11, color: '#9A9AB0', marginTop: 1 },
  checkBox:           { width: 20, height: 20, borderWidth: 2, borderColor: '#D0D8F0', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkBoxSelected:   { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  checkTick:          { color: '#fff', fontSize: 11, fontWeight: '900' },

  // ── Selector sheet ──


  // ── Delete confirm ──
  confirmCard:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', gap: 6 },
  confirmTitle:       { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  confirmSub:         { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },
  confirmActions:     { width: '100%', flexDirection: 'row', gap: 10, marginTop: 16 },
  confirmCancelBtn:   { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#D0D8F0', paddingVertical: 13, alignItems: 'center' },
  confirmCancelText:  { fontWeight: '700', color: '#9A9AB0', fontSize: 14 },
  confirmDeleteBtn:   { flex: 1, borderRadius: 12, backgroundColor: '#FF7043', paddingVertical: 13, alignItems: 'center' },
  confirmEndBtn:      { backgroundColor: '#E05A3A' },
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
  historySubtitle:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 1 },
  historyCenter:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  historyEmptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historyEmptyText:  { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },
  historyList:       { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12, paddingBottom: 40 },

  historyCard:       { backgroundColor: '#fff', borderRadius: 20, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  historyCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 8 },
  historyCardIcon:   { width: 46, height: 46, borderRadius: 13, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  historyCardBody:   { flex: 1, gap: 6 },
  historyCardTitle:  { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  historyModeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyModeChip:   { borderRadius: 999, backgroundColor: '#F2F6FF', paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyModeChipLabel: { fontSize: 10, fontWeight: '700', color: '#7A869F', textTransform: 'uppercase' },
  historyModeChipValue: { fontSize: 11, fontWeight: '800', color: '#334155' },
  historyCardMeta:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  historyMetaGrid:   { flexDirection: 'row', columnGap: 10, rowGap: 8, paddingHorizontal: 16, marginTop: 2 },
  historyMetaItem:   { flexBasis: '48%', flexGrow: 1, minWidth: 130 },
  historyMetaItemWide: { flexBasis: '100%' },
  historyMetaLabel:  { fontSize: 10, fontWeight: '800', color: '#7A869F', textTransform: 'uppercase', letterSpacing: 0.4 },
  historyMetaValue:  { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 1 },
  historyMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  historyMetaRowText:{ fontSize: 11, fontWeight: '600', color: '#475569' },
  historyChipRow:    { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', paddingHorizontal: 16 },
  historyChip:       { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0F4FF' },
  historyChipText:   { fontSize: 11, fontWeight: '700', color: '#5A7AB0' },
  historyCardFooter: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  historyDetailBtn:  { flex: 1, borderRadius: 12, backgroundColor: '#EBF4FF', paddingVertical: 10, alignItems: 'center' },
  historyDetailBtnText: { fontSize: 13, fontWeight: '800', color: '#1A4DA2' },
  historyRestartBtn: { flex: 1, borderRadius: 12, backgroundColor: '#D6F5D6', paddingVertical: 10, alignItems: 'center' },
  historyRestartBtnText: { fontSize: 13, fontWeight: '800', color: '#1A6B1A' },
});
