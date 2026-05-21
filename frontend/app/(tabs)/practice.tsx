import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getStandardLabel, STANDARD_OPTIONS } from '../../src/constants/standards';
import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';

type ContentSection = {
  id: string;
  sectionOrder: number;
  title?: string;
  contentType: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
};

type LearningContentItem = {
  id: string;
  title: string;
  classLevel: string;
  subject: string;
  contentType: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  sections?: ContentSection[];
};

type ClassroomQuiz = {
  id: string;
  title: string;
  classLevel: string;
  subject: string;
  quizType: string;
  difficultyLevel?: string;
  totalQuestions: number;
  status: 'not_attempted' | 'completed';
  score?: number;
};

type ClassroomAssignment = {
  id: string;
  title: string;
  description?: string;
  attachmentUrl?: string;
  instructions?: string;
  dueDate?: string | null;
  isTimeBound: boolean;
  status: 'pending' | 'submitted' | 'overdue';
  submission?: {
    submittedAt?: string | null;
    submissionText?: string;
    attachmentUrl?: string;
  } | null;
};

type ClassroomItem = {
  id: string;
  title: string;
  description?: string;
  classLevel: string;
  scheduleType: 'instant' | 'scheduled';
  startTime?: string | null;
  status: 'active' | 'completed' | 'draft';
  completionPct: number;
  contents: LearningContentItem[];
  quizzes: ClassroomQuiz[];
  assignments: ClassroomAssignment[];
};

type SelectorField = 'class';
type StudentTab = 'content' | 'quiz' | 'assignments';
type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

const STATUS_COLORS: Record<ClassroomItem['status'], string> = {
  active: '#16a34a',
  completed: '#6b7280',
  draft: '#2563eb',
};

async function pickFileAsDataUrl(accept: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    throw new Error('File upload is currently supported on web. On mobile, paste submission URL manually.');
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

function resolveMediaType(file: PickedFile): 'image' | 'audio' | 'video' {
  const mime = file.mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'video';
}

function resolveMediaUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('/media')) return `${API_BASE_URL}${url}`;
  return url;
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const sanitized = url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(sanitized);
}

export default function PracticeScreen() {
  const { apiFetch, isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [classLevels, setClassLevels] = useState<string[]>(STANDARD_OPTIONS.map((item) => item.value));
  const [selectedClassLevel, setSelectedClassLevel] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>('content');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<LearningContentItem | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<ClassroomAssignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadClassrooms = useCallback(
    async (classLevelOverride?: string) => {
      const classLevel = classLevelOverride ?? selectedClassLevel;
      const query = new URLSearchParams();
      if (classLevel) query.set('class_level', classLevel);
      const res = await apiFetch(`/quizzes/students/classrooms?${query.toString()}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to load classroom data');
      }
      const payload = await res.json();
      const loadedClassrooms = (payload.classrooms || []) as ClassroomItem[];
      const loadedLevels = (payload.classLevels || []) as string[];
      const currentLevel = (payload.currentClassLevel as string) || classLevel || loadedLevels[0] || '';

      setClassrooms(loadedClassrooms);
      setClassLevels(
        loadedLevels.length > 0
          ? loadedLevels
          : [...new Set(loadedClassrooms.map((item) => item.classLevel).filter(Boolean))],
      );
      setSelectedClassLevel(currentLevel);
      setSelectedClassroomId((current) => {
        if (current && loadedClassrooms.some((item) => item.id === current)) return current;
        return loadedClassrooms[0]?.id || null;
      });
    },
    [apiFetch, selectedClassLevel],
  );

  const loadStudentClassLevel = useCallback(async () => {
    if (!user?.id || user.activeRole !== 'student') return '';
    const res = await apiFetch(`/users/${user.id}`);
    if (!res.ok) return '';
    const profile = await res.json();
    return (profile.classLevel as string) || '';
  }, [apiFetch, user?.id, user?.activeRole]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setMessage(null);
    try {
      const profileClass = await loadStudentClassLevel();
      await loadClassrooms(profileClass);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load classrooms' });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadClassrooms, loadStudentClassLevel]);

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => item.id === selectedClassroomId) || classrooms[0] || null,
    [classrooms, selectedClassroomId],
  );

  const pendingAssignments = useMemo(
    () => selectedClassroom?.assignments.filter((assignment) => assignment.status !== 'submitted').length || 0,
    [selectedClassroom],
  );

  const completedActivities = useMemo(() => selectedClassroom?.completionPct || 0, [selectedClassroom]);

  const openExternalResource = async (url: string) => {
    const target = resolveMediaUrl(url);
    if (!target) return;
    try {
      const supported = await Linking.canOpenURL(target);
      if (!supported) throw new Error('Cannot open this link');
      await Linking.openURL(target);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to open link' });
    }
  };

  const continueLearning = () => {
    setActiveTab('content');
    const nextContent =
      selectedClassroom?.contents.find((item) => item.status === 'in_progress') ||
      selectedClassroom?.contents.find((item) => item.status !== 'completed') ||
      selectedClassroom?.contents[0];
    if (nextContent) setPreviewContent(nextContent);
  };

  const openAssignment = (assignment: ClassroomAssignment) => {
    setAssignmentModal(assignment);
    setSubmissionText(assignment.submission?.submissionText || '');
    setSubmissionAttachmentUrl(assignment.submission?.attachmentUrl || '');
  };

  const uploadSubmissionAttachment = async () => {
    if (!assignmentModal) return;
    try {
      const picked = await pickFileAsDataUrl('image/*,audio/*,video/*');
      const mediaType = resolveMediaType(picked);
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
        throw new Error(payload.message || 'Failed to upload submission attachment');
      }
      const payload = await res.json();
      setSubmissionAttachmentUrl(payload.url || '');
      setMessage({ type: 'success', text: 'Attachment uploaded successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload attachment' });
    }
  };

  const submitAssignment = async () => {
    if (!assignmentModal || !selectedClassroom) return;
    if (!submissionText.trim() && !submissionAttachmentUrl.trim()) {
      setMessage({ type: 'error', text: 'Please provide submission text or attachment.' });
      return;
    }
    setSavingSubmission(true);
    try {
      const res = await apiFetch(
        `/quizzes/students/classrooms/${selectedClassroom.id}/assignments/${assignmentModal.id}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
            submissionText: submissionText.trim() || undefined,
            attachmentUrl: submissionAttachmentUrl.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to submit assignment');
      }
      await loadClassrooms(selectedClassLevel);
      setAssignmentModal(null);
      setMessage({ type: 'success', text: 'Assignment submitted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to submit assignment' });
    } finally {
      setSavingSubmission(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>My Classroom</Text>
            <Pressable style={styles.classSwitcher} onPress={() => setSelectorField('class')}>
              <Text style={styles.classSwitcherText}>
                {selectedClassLevel ? getStandardLabel(selectedClassLevel) : 'Select Class'}
              </Text>
            </Pressable>
          </View>
          {selectedClassroom ? (
            <>
              <View style={styles.classroomHeaderRow}>
                <Text style={styles.classroomTitle}>{selectedClassroom.title}</Text>
                <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[selectedClassroom.status] }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[selectedClassroom.status] }]}>
                    {selectedClassroom.status === 'active'
                      ? 'Live'
                      : selectedClassroom.status === 'completed'
                        ? 'Completed'
                        : 'Scheduled'}
                  </Text>
                </View>
              </View>
              <Text style={styles.classroomMeta}>{getStandardLabel(selectedClassroom.classLevel)}</Text>
              <Text style={styles.classroomDescription} numberOfLines={2}>
                {selectedClassroom.description || 'Classroom activities and learning resources assigned to your class.'}
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>No classroom assigned for this class.</Text>
          )}
        </View>

        {message ? (
          <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
            <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerWrapper}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading classroom...</Text>
          </View>
        ) : !selectedClassroom ? (
          <View style={styles.centerWrapper}>
            <Text style={styles.emptyText}>No classroom sessions available.</Text>
          </View>
        ) : (
          <>
            <View style={styles.quickRow}>
              <View style={[styles.quickCard, styles.quickCardPrimary]}>
                <Text style={styles.quickTitle}>Running Session</Text>
                <Text style={styles.quickValue}>{selectedClassroom.status === 'active' ? 'Live now' : 'Upcoming'}</Text>
                <Pressable style={styles.quickButton} onPress={continueLearning}>
                  <Text style={styles.quickButtonText}>Continue Learning</Text>
                </Pressable>
              </View>
              <View style={styles.quickCard}>
                <Text style={styles.quickTitle}>Pending Assignments</Text>
                <Text style={styles.quickValue}>{pendingAssignments} Pending</Text>
              </View>
              <View style={styles.quickCard}>
                <Text style={styles.quickTitle}>Completed Activities</Text>
                <Text style={styles.quickValue}>{completedActivities}%</Text>
              </View>
            </View>

            <View style={styles.tabRow}>
              {(['content', 'quiz', 'assignments'] as StudentTab[]).map((tab) => (
                <Pressable key={tab} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]} onPress={() => setActiveTab(tab)}>
                  <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                    {tab === 'quiz' ? 'Quiz' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeTab === 'content' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Content</Text>
                {selectedClassroom.contents.length === 0 ? (
                  <Text style={styles.emptyText}>No learning content available.</Text>
                ) : (
                  selectedClassroom.contents.map((content) => {
                    const mediaUrl = resolveMediaUrl(content.mediaUrl);
                    const externalUrl = resolveMediaUrl(content.externalUrl);
                    const previewImageUrl = isImageUrl(mediaUrl) ? mediaUrl : isImageUrl(externalUrl) ? externalUrl : '';
                    const showImage = Boolean(previewImageUrl);
                    return (
                      <Pressable key={content.id} style={styles.itemCard} onPress={() => setPreviewContent(content)}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemTitle}>{content.title}</Text>
                          <View style={styles.itemChip}>
                            <Text style={styles.itemChipText}>{(content.status || 'not_started').replace('_', ' ')}</Text>
                          </View>
                        </View>
                        <Text style={styles.itemMeta}>
                          {content.subject || '-'} • {content.contentType.replace('_', ' ')}
                        </Text>
                        {showImage ? <Image source={{ uri: previewImageUrl }} style={styles.contentPreviewImage} resizeMode="cover" /> : null}
                        {!showImage && content.textContent ? (
                          <Text numberOfLines={3} style={styles.contentSnippet}>
                            {content.textContent}
                          </Text>
                        ) : null}
                        {!showImage && !content.textContent && (content.externalUrl || content.mediaUrl) ? (
                          <Text style={styles.itemAction}>Tap to open content link</Text>
                        ) : null}
                        <Text style={styles.itemAction}>Open Content</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {activeTab === 'quiz' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Quizzes</Text>
                {selectedClassroom.quizzes.length === 0 ? (
                  <Text style={styles.emptyText}>No quizzes assigned yet.</Text>
                ) : (
                  selectedClassroom.quizzes.map((quiz) => {
                    const isCompleted = quiz.status === 'completed';
                    return (
                      <View key={quiz.id} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemTitle}>{quiz.title}</Text>
                          <View style={[styles.itemChip, isCompleted && styles.itemChipSuccess]}>
                            <Text style={[styles.itemChipText, isCompleted && styles.itemChipSuccessText]}>
                              {isCompleted ? 'Completed' : 'Not Attempted'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.itemMeta}>
                          {quiz.difficultyLevel || 'General'} • Q: {quiz.totalQuestions} • {quiz.quizType}
                        </Text>
                        {isCompleted && quiz.score !== undefined ? <Text style={styles.itemMeta}>Score: {quiz.score}%</Text> : null}
                        <Pressable style={styles.primaryButton} onPress={() => setSelectedQuizId(quiz.id)}>
                          <Text style={styles.primaryButtonText}>{isCompleted ? 'View Result' : 'Start Quiz'}</Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {activeTab === 'assignments' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Assignments</Text>
                {selectedClassroom.assignments.length === 0 ? (
                  <Text style={styles.emptyText}>No assignments available.</Text>
                ) : (
                  selectedClassroom.assignments.map((assignment) => (
                    <View key={assignment.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{assignment.title}</Text>
                        <View
                          style={[
                            styles.itemChip,
                            assignment.status === 'submitted'
                              ? styles.itemChipSuccess
                              : assignment.status === 'overdue'
                                ? styles.itemChipWarning
                                : styles.itemChipDanger,
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemChipText,
                              assignment.status === 'submitted'
                                ? styles.itemChipSuccessText
                                : assignment.status === 'overdue'
                                  ? styles.itemChipWarningText
                                  : styles.itemChipDangerText,
                            ]}
                          >
                            {assignment.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.itemMeta}>
                        Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No due date'}
                      </Text>
                      <Pressable style={styles.secondaryButton} onPress={() => openAssignment(assignment)}>
                        <Text style={styles.secondaryButtonText}>{assignment.status === 'submitted' ? 'View / Resubmit' : 'View Assignment'}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {selectedQuizId && (
        <QuizRenderer
          quizId={selectedQuizId}
          visible={selectedQuizId !== null}
          onClose={() => {
            setSelectedQuizId(null);
            loadClassrooms(selectedClassLevel);
          }}
        />
      )}

      <Modal visible={selectorField !== null} transparent animationType="fade" onRequestClose={() => setSelectorField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Select Class</Text>
            <ScrollView style={styles.selectorList}>
              {classLevels.map((level) => (
                <Pressable
                  key={level}
                  style={styles.selectorOption}
                  onPress={() => {
                    setSelectorField(null);
                    loadClassrooms(level);
                  }}
                >
                  <Text style={styles.selectorOptionText}>{getStandardLabel(level)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setSelectorField(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={previewContent !== null} transparent animationType="fade" onRequestClose={() => setPreviewContent(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{previewContent?.title || 'Content'}</Text>
            <ScrollView style={styles.selectorList}>
              <Text style={styles.itemMeta}>
                {previewContent?.subject || '-'} • {previewContent?.contentType.replace('_', ' ')}
              </Text>
              {previewContent?.sections && previewContent.sections.length > 0 ? (
                previewContent.sections.map((section, idx) => (
                  <View key={section.id || idx} style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>
                      {section.title ? section.title : `Section ${section.sectionOrder || idx + 1}`}
                      {' — '}{section.contentType.replace('_', ' ')}
                    </Text>
                    {section.textContent ? <Text style={styles.modalBody}>{section.textContent}</Text> : null}
                    {section.mediaUrl && isImageUrl(resolveMediaUrl(section.mediaUrl)) ? (
                      <Image source={{ uri: resolveMediaUrl(section.mediaUrl) }} style={styles.contentModalImage} resizeMode="contain" />
                    ) : null}
                    {section.mediaUrl && !isImageUrl(resolveMediaUrl(section.mediaUrl)) ? (
                      <Pressable style={styles.secondaryButton} onPress={() => openExternalResource(section.mediaUrl || '')}>
                        <Text style={styles.secondaryButtonText}>Open Media</Text>
                      </Pressable>
                    ) : null}
                    {section.externalUrl ? (
                      <Pressable style={styles.secondaryButton} onPress={() => openExternalResource(section.externalUrl || '')}>
                        <Text style={styles.secondaryButtonText}>Open Link</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              ) : (
                <>
                  {(previewContent?.mediaUrl && isImageUrl(resolveMediaUrl(previewContent.mediaUrl))) ||
                  (previewContent?.externalUrl && isImageUrl(resolveMediaUrl(previewContent.externalUrl))) ? (
                    <Image
                      source={{
                        uri: previewContent?.mediaUrl && isImageUrl(resolveMediaUrl(previewContent.mediaUrl))
                          ? resolveMediaUrl(previewContent.mediaUrl)
                          : resolveMediaUrl(previewContent?.externalUrl),
                      }}
                      style={styles.contentModalImage}
                      resizeMode="contain"
                    />
                  ) : null}
                  {previewContent?.textContent ? <Text style={styles.modalBody}>{previewContent.textContent}</Text> : null}
                  {previewContent?.mediaUrl && !isImageUrl(resolveMediaUrl(previewContent.mediaUrl)) ? (
                    <Pressable style={styles.secondaryButton} onPress={() => openExternalResource(previewContent.mediaUrl || '')}>
                      <Text style={styles.secondaryButtonText}>Open Media</Text>
                    </Pressable>
                  ) : null}
                  {previewContent?.externalUrl ? (
                    <Pressable style={styles.secondaryButton} onPress={() => openExternalResource(previewContent.externalUrl || '')}>
                      <Text style={styles.secondaryButtonText}>Open Link</Text>
                    </Pressable>
                  ) : null}
                  {!previewContent?.textContent && !previewContent?.mediaUrl && !previewContent?.externalUrl ? (
                    <Text style={styles.emptyText}>No content details available.</Text>
                  ) : null}
                </>
              )}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setPreviewContent(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={assignmentModal !== null} transparent animationType="fade" onRequestClose={() => setAssignmentModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{assignmentModal?.title || 'Assignment'}</Text>
            <ScrollView style={styles.selectorList}>
              {assignmentModal?.description ? <Text style={styles.modalBody}>{assignmentModal.description}</Text> : null}
              {assignmentModal?.instructions ? <Text style={styles.modalBody}>{assignmentModal.instructions}</Text> : null}
              {assignmentModal?.attachmentUrl ? <Text style={styles.modalLink}>{assignmentModal.attachmentUrl}</Text> : null}
              <TextInput
                value={submissionText}
                onChangeText={setSubmissionText}
                placeholder="Write your submission notes"
                style={styles.input}
                multiline
              />
              <TextInput
                value={submissionAttachmentUrl}
                onChangeText={setSubmissionAttachmentUrl}
                placeholder="Submission attachment URL"
                style={styles.input}
              />
              <Pressable style={styles.secondaryButton} onPress={uploadSubmissionAttachment}>
                <Text style={styles.secondaryButtonText}>Upload Attachment</Text>
              </Pressable>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={[styles.secondaryButton, styles.halfButton]} onPress={() => setAssignmentModal(null)}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.halfButton]} onPress={submitAssignment} disabled={savingSubmission}>
                {savingSubmission ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  classSwitcher: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  classSwitcherText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  classroomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  classroomTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  classroomMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  classroomDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickRow: {
    gap: 10,
  },
  quickCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  quickCardPrimary: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  quickTitle: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  quickValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  quickButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 9,
    alignItems: 'center',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  tabButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
  },
  centerWrapper: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  itemAction: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  contentPreviewImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginTop: 2,
  },
  contentSnippet: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  itemChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  itemChipSuccess: {
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
  },
  itemChipSuccessText: {
    color: '#15803d',
  },
  itemChipWarning: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  itemChipWarningText: {
    color: '#c2410c',
  },
  itemChipDanger: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  itemChipDangerText: {
    color: '#dc2626',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  messageCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  successCard: {
    borderColor: '#6ee7b7',
    backgroundColor: '#ecfdf5',
  },
  errorCard: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
    maxHeight: '85%',
  },
  selectorList: {
    maxHeight: 300,
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
  modalBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 6,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  contentModalImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginTop: 6,
    marginBottom: 6,
  },
  modalLink: {
    fontSize: 12,
    color: '#1d4ed8',
    textDecorationLine: 'underline',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  halfButton: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  classLevel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
});
