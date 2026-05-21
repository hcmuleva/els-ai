import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { useAuth } from '../../src/context/AuthContext';

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
  startTimeInput: string;
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
  startTimeInput: '',
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
  const [pendingDelete, setPendingDelete] = useState<ClassroomSummary | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const loadClassrooms = useCallback(async () => {
    const res = await apiFetch('/quizzes/classrooms?limit=200');
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message || 'Failed to load classrooms');
    }
    const payload = await res.json();
    setClassrooms((payload.classrooms || []) as ClassroomSummary[]);
  }, [apiFetch]);

  const loadResources = useCallback(async () => {
    const [contentRes, quizRes, catalogRes] = await Promise.all([
      apiFetch('/quizzes/content/items?limit=300'),
      apiFetch('/quizzes/teacher/library?status=all&limit=300'),
      apiFetch('/quizzes/catalog/subjects'),
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
      await Promise.all([loadClassrooms(), loadResources()]);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load classroom planning data' });
    } finally {
      setLoading(false);
    }
  }, [isTeacherView, loadClassrooms, loadResources]);

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

  const filteredContents = useMemo(() => {
    return contentItems
      .filter((item) => !form.classLevel || item.classLevel === form.classLevel)
      .filter((item) => {
        const keyword = contentSearch.trim().toLowerCase();
        if (!keyword) return true;
        return `${item.title} ${item.subject} ${item.contentType}`.toLowerCase().includes(keyword);
      });
  }, [contentItems, form.classLevel, contentSearch]);

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

  const openCreate = () => {
    setEditingClassroomId(null);
    setQuizFilters({ subject: '', category: '', difficulty: '', search: '' });
    setContentSearch('');
    setForm({ ...EMPTY_FORM, assignments: [makeAssignment()] });
    setIsFormOpen(true);
  };

  const openEdit = async (classroomId: string) => {
    setMessage(null);
    try {
      const res = await apiFetch(`/quizzes/classrooms/${classroomId}`);
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
      setQuizFilters({ subject: '', category: '', difficulty: '', search: '' });
      setContentSearch('');
      setForm({
        title: classroom.title || '',
        description: classroom.description || '',
        scheduleType: (classroom.scheduleType as ScheduleType) || 'instant',
        startTimeInput: classroom.startTime ? new Date(classroom.startTime).toISOString().slice(0, 16) : '',
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
      const res = await apiFetch('/quizzes/uploads/media', {
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

    const startTimeIso = toIsoOrNull(form.startTimeInput);
    if (form.scheduleType === 'scheduled' && !startTimeIso) {
      setMessage({ type: 'error', text: 'Start date & time is required for scheduled classroom.' });
      return;
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
      const endpoint = editingClassroomId ? `/quizzes/classrooms/${editingClassroomId}` : '/quizzes/classrooms';
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
      const res = await apiFetch(`/quizzes/classrooms/${pendingDelete.id}`, { method: 'DELETE' });
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Classroom Planner</Text>
        <Text style={styles.errorText}>You do not have permission to manage classrooms.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Classroom Planner</Text>
      <Text style={styles.subtitle}>Create, schedule, and assign classroom activities by standard.</Text>

      {message ? (
        <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>My Classes ({classrooms.length})</Text>
          <Pressable style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryButtonText}>Create Classroom</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : classrooms.length === 0 ? (
          <Text style={styles.emptyText}>No classrooms created yet.</Text>
        ) : (
          classrooms.map((item) => (
            <View key={item.id} style={styles.rowCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[item.status] }]}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.metaText}>{getStandardLabel(item.classLevel)} • {item.scheduleType === 'instant' ? 'Instant' : 'Scheduled'}</Text>
              <Text style={styles.metaText}>Duration: {item.durationMinutes} mins • Created: {new Date(item.createdAt).toLocaleDateString()}</Text>
              <Text style={styles.metaText}>Content: {item.contentCount} • Quizzes: {item.quizCount} • Assignments: {item.assignmentCount}</Text>
              <View style={styles.actionsRow}>
                <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={() => openEdit(item.id)}>
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.dangerButton, styles.halfInput]}
                  onPress={() => setPendingDelete(item)}
                  disabled={deletingClassroomId === item.id}
                >
                  {deletingClassroomId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Delete</Text>}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <Modal visible={isFormOpen} transparent animationType="fade" onRequestClose={() => setIsFormOpen(false)}>
        <Pressable style={styles.dialogOverlay} onPress={() => setIsFormOpen(false)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{editingClassroomId ? 'Edit Classroom' : 'Create Classroom'}</Text>
            </View>
            <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogScrollContent}>
              <TextInput
                value={form.title}
                onChangeText={(value) => setFormPatch({ title: value })}
                placeholder="Classroom title"
                style={styles.input}
              />
              <TextInput
                value={form.description}
                onChangeText={(value) => setFormPatch({ description: value })}
                placeholder="Description (optional)"
                style={styles.input}
                multiline
              />

              <View style={styles.row}>
                <Pressable style={[styles.selectorInput, styles.halfInput]} onPress={() => setSelectorField('classLevel')}>
                  <Text style={form.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                    {form.classLevel ? getStandardLabel(form.classLevel) : 'Select Standard/Class'}
                  </Text>
                </Pressable>
                <TextInput
                  value={form.durationMinutes}
                  onChangeText={(value) => setFormPatch({ durationMinutes: value })}
                  placeholder="Duration (mins)"
                  keyboardType="number-pad"
                  style={[styles.input, styles.halfInput]}
                />
              </View>

              <View style={styles.rowWrap}>
                <Pressable
                  style={[styles.typeChip, form.scheduleType === 'instant' && styles.typeChipActive]}
                  onPress={() => setFormPatch({ scheduleType: 'instant' })}
                >
                  <Text style={[styles.typeChipText, form.scheduleType === 'instant' && styles.typeChipTextActive]}>Instant</Text>
                </Pressable>
                <Pressable
                  style={[styles.typeChip, form.scheduleType === 'scheduled' && styles.typeChipActive]}
                  onPress={() => setFormPatch({ scheduleType: 'scheduled' })}
                >
                  <Text style={[styles.typeChipText, form.scheduleType === 'scheduled' && styles.typeChipTextActive]}>Scheduled</Text>
                </Pressable>
              </View>

              {form.scheduleType === 'scheduled' ? (
                <TextInput
                  value={form.startTimeInput}
                  onChangeText={(value) => setFormPatch({ startTimeInput: value })}
                  placeholder="Start Date & Time (e.g. 2026-05-25T10:30)"
                  style={styles.input}
                />
              ) : null}

              <View style={styles.rowWrap}>
                {(['draft', 'active', 'completed'] as ClassroomStatus[]).map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.typeChip, form.status === status && styles.typeChipActive]}
                    onPress={() => setFormPatch({ status })}
                  >
                    <Text style={[styles.typeChipText, form.status === status && styles.typeChipTextActive]}>{status}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Classroom Resources</Text>
              <View style={styles.resourceButtonsRow}>
                <Pressable
                  style={[
                    styles.resourceButton,
                    !form.classLevel && styles.disabledButton,
                    form.selectedContentIds.length > 0 && styles.resourceButtonActive
                  ]}
                  disabled={!form.classLevel}
                  onPress={() => setIsAssignContentOpen(true)}
                >
                  <Text style={[
                    styles.resourceButtonText,
                    form.selectedContentIds.length > 0 && styles.resourceButtonTextActive
                  ]}>
                    📚 Content ({form.selectedContentIds.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.resourceButton,
                    !form.classLevel && styles.disabledButton,
                    form.selectedQuizIds.length > 0 && styles.resourceButtonActive
                  ]}
                  disabled={!form.classLevel}
                  onPress={() => setIsAssignQuizOpen(true)}
                >
                  <Text style={[
                    styles.resourceButtonText,
                    form.selectedQuizIds.length > 0 && styles.resourceButtonTextActive
                  ]}>
                    ✏️ Quizzes ({form.selectedQuizIds.length})
                  </Text>
                </Pressable>
              </View>
              {!form.classLevel && (
                <Text style={styles.infoText}>* Please select a Standard/Class first to assign resources.</Text>
              )}

              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Assignments ({form.assignments.length})</Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setForm((current) => ({ ...current, assignments: [...current.assignments, makeAssignment()] }))}
                >
                  <Text style={styles.secondaryButtonText}>Add Assignment</Text>
                </Pressable>
              </View>

              {form.assignments.map((assignment) => (
                <View key={assignment.id} style={styles.assignmentCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.optionTitle}>Assignment</Text>
                    <Pressable style={styles.linkButton} onPress={() => removeAssignment(assignment.id)}>
                      <Text style={styles.linkButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={assignment.title}
                    onChangeText={(value) => updateAssignment(assignment.id, { title: value })}
                    placeholder="Title"
                    style={styles.input}
                  />
                  <TextInput
                    value={assignment.description}
                    onChangeText={(value) => updateAssignment(assignment.id, { description: value })}
                    placeholder="Description"
                    style={styles.input}
                    multiline
                  />
                  <TextInput
                    value={assignment.instructions}
                    onChangeText={(value) => updateAssignment(assignment.id, { instructions: value })}
                    placeholder="Instructions"
                    style={styles.input}
                    multiline
                  />
                  <TextInput
                    value={assignment.attachmentUrl}
                    onChangeText={(value) => updateAssignment(assignment.id, { attachmentUrl: value })}
                    placeholder="Attachment URL"
                    style={styles.input}
                  />
                  <Pressable style={styles.secondaryButton} onPress={() => uploadAssignmentAttachment(assignment.id)}>
                    <Text style={styles.secondaryButtonText}>Upload Attachment</Text>
                  </Pressable>
                  <View style={styles.assignmentCheckboxRow}>
                    <Pressable
                      style={[styles.typeChip, assignment.isTimeBound && styles.typeChipActive]}
                      onPress={() => updateAssignment(assignment.id, { isTimeBound: !assignment.isTimeBound })}
                    >
                      <Text style={[styles.typeChipText, assignment.isTimeBound && styles.typeChipTextActive]}>⏰ Time Bound Assignment</Text>
                    </Pressable>
                  </View>
                  {assignment.isTimeBound && (
                    <TextInput
                      value={assignment.dueDate}
                      onChangeText={(value) => updateAssignment(assignment.id, { dueDate: value })}
                      placeholder="Due Date & Time (e.g. 2026-05-25T10:30)"
                      style={styles.input}
                    />
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.dialogActions}>
              <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={() => setIsFormOpen(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.halfInput]} onPress={saveClassroom} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Classroom</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign Content Modal */}
      <Modal visible={isAssignContentOpen} transparent animationType="slide" onRequestClose={() => setIsAssignContentOpen(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.subModalCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Assign Learning Content</Text>
            </View>
            <View style={styles.searchFilterBar}>
              <TextInput
                value={contentSearch}
                onChangeText={setContentSearch}
                placeholder="Search learning content..."
                style={styles.input}
              />
            </View>
            <ScrollView style={styles.subModalScroll} contentContainerStyle={styles.dialogScrollContent}>
              {filteredContents.length === 0 ? (
                <Text style={styles.emptyText}>No content found matching criteria.</Text>
              ) : (
                filteredContents.map((item) => {
                  const selected = form.selectedContentIds.includes(item.id);
                  return (
                    <Pressable
                      key={`content-assign-${item.id}`}
                      style={[styles.optionCard, selected && styles.optionCardActive]}
                      onPress={() => setFormPatch({ selectedContentIds: toggleId(form.selectedContentIds, item.id) })}
                    >
                      <View style={styles.checkboxRow}>
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <View style={styles.optionInfo}>
                          <Text style={styles.optionTitle}>{item.title}</Text>
                          <Text style={styles.metaText}>{getStandardLabel(item.classLevel)} • {item.subject} • {item.contentType}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.dialogActions}>
              <Pressable style={styles.primaryButton} onPress={() => setIsAssignContentOpen(false)}>
                <Text style={styles.primaryButtonText}>Done ({form.selectedContentIds.length} Selected)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Quiz Modal */}
      <Modal visible={isAssignQuizOpen} transparent animationType="slide" onRequestClose={() => setIsAssignQuizOpen(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.subModalCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Assign Quizzes</Text>
            </View>
            <View style={styles.quizFiltersContainer}>
              <View style={styles.row}>
                <Pressable
                  style={[styles.selectorInput, styles.halfInput]}
                  onPress={() => setSelectorField('quizSubject')}
                >
                  <Text style={quizFilters.subject ? styles.selectorText : styles.selectorPlaceholder}>
                    {quizFilters.subject || 'Filter Subject'}
                  </Text>
                </Pressable>
                <TextInput
                  value={quizFilters.search}
                  onChangeText={(value) => setQuizFilters((current) => ({ ...current, search: value }))}
                  placeholder="Search title..."
                  style={[styles.input, styles.halfInput]}
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  value={quizFilters.category}
                  onChangeText={(value) => setQuizFilters((current) => ({ ...current, category: value }))}
                  placeholder="Category"
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  value={quizFilters.difficulty}
                  onChangeText={(value) => setQuizFilters((current) => ({ ...current, difficulty: value }))}
                  placeholder="Difficulty"
                  style={[styles.input, styles.halfInput]}
                />
              </View>
            </View>
            <ScrollView style={styles.subModalScroll} contentContainerStyle={styles.dialogScrollContent}>
              {filteredQuizzes.length === 0 ? (
                <Text style={styles.emptyText}>No quizzes found matching criteria.</Text>
              ) : (
                filteredQuizzes.map((quiz) => {
                  const selected = form.selectedQuizIds.includes(quiz.id);
                  return (
                    <Pressable
                      key={`quiz-assign-${quiz.id}`}
                      style={[styles.optionCard, selected && styles.optionCardActive]}
                      onPress={() => setFormPatch({ selectedQuizIds: toggleId(form.selectedQuizIds, quiz.id) })}
                    >
                      <View style={styles.checkboxRow}>
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <View style={styles.optionInfo}>
                          <Text style={styles.optionTitle}>{quiz.title}</Text>
                          <Text style={styles.metaText}>
                            {getStandardLabel(quiz.class_level || '')} • {quiz.subject || '-'} • {quiz.quiz_type || '-'} • {quiz.difficulty_level || '-'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.dialogActions}>
              <Pressable style={styles.primaryButton} onPress={() => setIsAssignQuizOpen(false)}>
                <Text style={styles.primaryButtonText}>Done ({form.selectedQuizIds.length} Selected)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectorField !== null} transparent animationType="fade" onRequestClose={() => setSelectorField(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.selectorCard}>
            <Text style={styles.cardTitle}>{selectorField === 'classLevel' ? 'Select Standard' : 'Select Subject'}</Text>
            <ScrollView style={styles.selectorList}>
              <Pressable style={styles.selectorOption} onPress={() => applySelectorValue('')}>
                <Text style={styles.selectorOptionText}>Any</Text>
              </Pressable>
              {selectorOptions.map((option) => (
                <Pressable key={option} style={styles.selectorOption} onPress={() => applySelectorValue(option)}>
                  <Text style={styles.selectorOptionText}>{selectorField === 'classLevel' ? getStandardLabel(option) : option}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setSelectorField(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={pendingDelete !== null} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.selectorCard}>
            <Text style={styles.cardTitle}>Delete Classroom?</Text>
            <Text style={styles.metaText}>Are you sure you want to delete this classroom?</Text>
            <View style={styles.dialogActions}>
              <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={() => setPendingDelete(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.dangerButton, styles.halfInput]} onPress={confirmDelete}>
                <Text style={styles.primaryButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  halfInput: {
    flex: 1,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  selectorInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  selectorText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: '#94a3b8',
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  dangerButton: {
    borderRadius: 10,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.55,
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    color: '#065f46',
  },
  errorText: {
    color: '#b91c1c',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  optionCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: '#f8fbff',
  },
  optionCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionTitle: {
    fontSize: 13,
    color: '#1e3a8a',
    fontWeight: '700',
  },
  assignmentCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  linkButtonText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  typeChipActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  typeChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeChipTextActive: {
    color: '#1d4ed8',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
    justifyContent: 'center',
  },
  dialogCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: '92%',
    overflow: 'hidden',
  },
  dialogHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  dialogScroll: {
    flex: 1,
  },
  dialogScrollContent: {
    padding: 16,
    gap: 10,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  selectorCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  selectorList: {
    maxHeight: 280,
  },
  selectorOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectorOptionText: {
    fontSize: 14,
    color: '#0f172a',
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  subModalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: '80%',
    overflow: 'hidden',
  },
  subModalScroll: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  resourceButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resourceButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceButtonActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  resourceButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  resourceButtonTextActive: {
    color: '#1d4ed8',
  },
  infoText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  checkboxTick: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  quizFiltersContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  searchFilterBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  assignmentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
