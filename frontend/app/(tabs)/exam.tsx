import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';

type QuizType = 'drag_drop' | 'image_select' | 'sound_match' | 'memory_game';
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type LibraryItem = {
  id: string;
  title: string;
  class_level?: string;
  subject?: string;
  quiz_type: QuizType;
  difficulty_level?: string;
  total_questions: number;
  is_published: boolean;
  is_ai_generated: boolean;
};

export default function ExamSetupScreen() {
  const { user, apiFetch } = useAuth();
  const [creating, setCreating] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [publishLoadingId, setPublishLoadingId] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    classLevel: '',
    subject: '',
    quizType: 'drag_drop' as QuizType,
    difficultyLevel: 'Easy' as Difficulty,
  });
  const [search, setSearch] = useState('');

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const difficultyMix = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const quiz of library) {
      const difficulty = quiz.difficulty_level?.toLowerCase();
      if (difficulty === 'easy') counts.easy += 1;
      if (difficulty === 'medium') counts.medium += 1;
      if (difficulty === 'hard') counts.hard += 1;
    }
    const total = counts.easy + counts.medium + counts.hard || 1;
    return {
      easy: Math.round((counts.easy / total) * 100),
      medium: Math.round((counts.medium / total) * 100),
      hard: Math.round((counts.hard / total) * 100),
    };
  }, [library]);

  const loadLibrary = useCallback(async () => {
    if (!isTeacherView) return;
    setLoadingLibrary(true);
    try {
      const query = new URLSearchParams();
      query.set('status', 'all');
      query.set('source', 'all');
      query.set('limit', '80');
      if (search.trim()) query.set('search', search.trim());

      const res = await apiFetch(`/quizzes/teacher/library?${query.toString()}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load exam library');
      }

      const payload = await res.json();
      setLibrary(payload.quizzes || []);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load exam library';
      setMessage({ type: 'error', text });
    } finally {
      setLoadingLibrary(false);
    }
  }, [apiFetch, isTeacherView, search]);

  useFocusEffect(
    useCallback(() => {
      loadLibrary();
    }, [loadLibrary]),
  );

  const createExam = async () => {
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'Exam title is required.' });
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      const res = await apiFetch('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          classLevel: form.classLevel.trim() || undefined,
          subject: form.subject.trim() || undefined,
          quizType: form.quizType,
          difficultyLevel: form.difficultyLevel,
          isPublished: false,
          isAiGenerated: false,
          theme: { colors: { primary: '#1d4ed8', background: '#eff6ff' } },
        }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to create exam');
      }

      setForm({
        title: '',
        description: '',
        classLevel: '',
        subject: '',
        quizType: 'drag_drop',
        difficultyLevel: 'Easy',
      });
      setMessage({ type: 'success', text: 'Exam template created as draft.' });
      await loadLibrary();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to create exam';
      setMessage({ type: 'error', text });
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (quizId: string, isPublished: boolean) => {
    setPublishLoadingId(quizId);
    setMessage(null);
    try {
      const res = await apiFetch(`/quizzes/${quizId}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to update publish status');
      }
      await loadLibrary();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to update publish status';
      setMessage({ type: 'error', text });
    } finally {
      setPublishLoadingId(null);
    }
  };

  if (!isTeacherView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Exam & Question Setup</Text>
        <Text style={styles.errorText}>You do not have permission to manage teacher exams.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Exam & Question Setup</Text>
      <Text style={styles.subtitle}>Create draft exams, filter them, and publish when ready.</Text>

      {message && (
        <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
            {message.text}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Exam Template</Text>
        <TextInput
          value={form.title}
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          placeholder="Exam title"
          style={styles.input}
        />
        <TextInput
          value={form.description}
          onChangeText={(description) => setForm((current) => ({ ...current, description }))}
          placeholder="Description (optional)"
          style={styles.input}
        />
        <TextInput
          value={form.classLevel}
          onChangeText={(classLevel) => setForm((current) => ({ ...current, classLevel }))}
          placeholder="Class level (e.g. Grade 7)"
          style={styles.input}
        />
        <TextInput
          value={form.subject}
          onChangeText={(subject) => setForm((current) => ({ ...current, subject }))}
          placeholder="Subject (e.g. Mathematics)"
          style={styles.input}
        />
        <View style={styles.chipsRow}>
          {(['drag_drop', 'image_select', 'sound_match', 'memory_game'] as QuizType[]).map((quizType) => (
            <Pressable
              key={quizType}
              onPress={() => setForm((current) => ({ ...current, quizType }))}
              style={[styles.chip, form.quizType === quizType && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.quizType === quizType && styles.chipTextActive]}>{quizType}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chipsRow}>
          {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((difficultyLevel) => (
            <Pressable
              key={difficultyLevel}
              onPress={() => setForm((current) => ({ ...current, difficultyLevel }))}
              style={[styles.chip, form.difficultyLevel === difficultyLevel && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.difficultyLevel === difficultyLevel && styles.chipTextActive]}>
                {difficultyLevel}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryButton} onPress={createExam} disabled={creating}>
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create Draft Exam</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Question Bank Mix</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Easy</Text>
          <Text style={styles.value}>{difficultyMix.easy}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Medium</Text>
          <Text style={styles.value}>{difficultyMix.medium}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Hard</Text>
          <Text style={styles.value}>{difficultyMix.hard}%</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exam Library</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Filter by title or description"
          style={styles.input}
        />
        <Pressable style={styles.secondaryButton} onPress={loadLibrary} disabled={loadingLibrary}>
          {loadingLibrary ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Apply Filter</Text>}
        </Pressable>

        {loadingLibrary ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : library.length === 0 ? (
          <Text style={styles.emptyText}>No exams found for this filter.</Text>
        ) : (
          library.map((quiz) => (
            <View key={quiz.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{quiz.title}</Text>
              <Text style={styles.itemMeta}>
                {quiz.class_level || 'Unassigned'} • {quiz.subject || 'General'} • {quiz.quiz_type} • {quiz.difficulty_level || 'NA'}
              </Text>
              <Text style={styles.itemMeta}>
                Questions: {quiz.total_questions} • {quiz.is_ai_generated ? 'AI' : 'Manual'} • {quiz.is_published ? 'Published' : 'Draft'}
              </Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => togglePublish(quiz.id, quiz.is_published)}
                disabled={publishLoadingId === quiz.id}
              >
                {publishLoadingId === quiz.id ? (
                  <ActivityIndicator color="#1d4ed8" />
                ) : (
                  <Text style={styles.secondaryButtonText}>{quiz.is_published ? 'Move to Draft' : 'Publish Exam'}</Text>
                )}
              </Pressable>
            </View>
          ))
        )}
      </View>
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
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  messageCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    color: '#166534',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  chipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1d4ed8',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  badge: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
    fontWeight: '700',
    fontSize: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 12,
    color: '#475569',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
});
