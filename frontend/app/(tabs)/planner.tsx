import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function PlannerScreen() {
  const { apiFetch } = useAuth();
  const [topic, setTopic] = useState('');
  const [classLevel, setClassLevel] = useState('KG');
  const [quizType, setQuizType] = useState<'drag_drop' | 'image_select'>('drag_drop');
  
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setMessage({ type: 'error', text: 'Please enter a quiz topic.' });
      return;
    }

    setGenerating(true);
    setMessage(null);
    setGeneratedQuiz(null);

    try {
      const res = await apiFetch('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          classLevel,
          quizType,
          difficultyLevel: 'Easy',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedQuiz(data);
      } else {
        setMessage({ type: 'error', text: 'AI generation failed. Please try again.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!generatedQuiz) return;
    setPublishing(true);
    setMessage(null);

    try {
      // 1. Create quiz record
      const quizRes = await apiFetch('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: generatedQuiz.title,
          description: generatedQuiz.description,
          classLevel: generatedQuiz.class_level,
          subject: 'AI Generated',
          quizType: generatedQuiz.quiz_type,
          difficultyLevel: generatedQuiz.difficulty_level,
          backgroundMusicUrl: generatedQuiz.background_music_url,
          theme: generatedQuiz.theme,
          isPublished: true,
          isAiGenerated: true,
        }),
      });

      if (!quizRes.ok) {
        throw new Error('Failed to create quiz record');
      }

      const createdQuiz = await quizRes.json();

      // 2. Insert questions
      for (const question of generatedQuiz.questions) {
        const questionRes = await apiFetch(`/quizzes/${createdQuiz.id}/questions`, {
          method: 'POST',
          body: JSON.stringify({
            questionType: question.question_type,
            questionTitle: question.question_title,
            questionInstruction: question.question_instruction,
            questionAudio: question.question_audio,
            questionData: question.question_data,
            points: 10,
          }),
        });
        if (!questionRes.ok) {
          throw new Error('Failed to save question');
        }
      }

      setMessage({
        type: 'success',
        text: 'Quiz approved and published! It is now available in student playrooms.',
      });
      setGeneratedQuiz(null);
      setTopic('');
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Publishing failed.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Classroom Planner</Text>
      <Text style={styles.subtitle}>Plan lessons, track readiness, and monitor completion.</Text>

      {/* AI Playroom Generator Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Sparkles size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>AI Playroom Generator</Text>
        </View>
        <Text style={styles.cardDesc}>
          Provide a topic to automatically generate interactive matching and visual playrooms.
        </Text>

        <View style={styles.form}>
          <Text style={styles.inputLabel}>Topic / Subject Concept</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Fractions, Animal Sounds, Planets"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Class / Grade Level</Text>
          <TextInput
            value={classLevel}
            onChangeText={setClassLevel}
            placeholder="e.g. KG, Class 1, Class 5"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Interactive Type</Text>
          <View style={styles.btnGroup}>
            <Pressable
              onPress={() => setQuizType('drag_drop')}
              style={[styles.typeBtn, quizType === 'drag_drop' && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, quizType === 'drag_drop' && styles.typeBtnTextActive]}>
                Matching Card
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setQuizType('image_select')}
              style={[styles.typeBtn, quizType === 'image_select' && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, quizType === 'image_select' && styles.typeBtnTextActive]}>
                Sound Select
              </Text>
            </Pressable>
          </View>

          <Pressable
            disabled={generating}
            onPress={handleGenerate}
            style={[styles.primaryBtn, generating && styles.btnDisabled]}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Sparkles size={16} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Generate Playroom</Text>
              </>
            )}
          </Pressable>
        </View>

        {message && (
          <View style={[styles.msgCard, message.type === 'success' ? styles.msgSuccess : styles.msgError]}>
            {message.type === 'success' ? (
              <CheckCircle2 size={16} color="#10b981" />
            ) : (
              <AlertCircle size={16} color="#ef4444" />
            )}
            <Text style={[styles.msgText, message.type === 'success' ? styles.msgTextSuccess : styles.msgTextError]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* Preview Section */}
        {generatedQuiz && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewHeading}>Generation Review</Text>
            <View style={styles.previewQuizInfo}>
              <Text style={styles.previewQuizTitle}>{generatedQuiz.title}</Text>
              <Text style={styles.previewQuizDesc}>{generatedQuiz.description}</Text>
            </View>

            <View style={styles.questionsPreview}>
              <Text style={styles.previewSubheading}>Questions ({generatedQuiz.questions.length})</Text>
              {generatedQuiz.questions.map((q: any, idx: number) => (
                <View key={idx} style={styles.questionPreviewCard}>
                  <Text style={styles.previewQTitle}>{q.question_title}</Text>
                  <Text style={styles.previewQInst}>{q.question_instruction}</Text>
                </View>
              ))}
            </View>

            <Pressable
              disabled={publishing}
              onPress={handlePublish}
              style={[styles.publishBtn, publishing && styles.btnDisabled]}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.publishBtnText}>Approve & Publish Live</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Week Plan</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Math - Fractions</Text>
          <Text style={styles.badge}>Mon 09:00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Science - Matter</Text>
          <Text style={styles.badge}>Wed 10:30</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>English - Reading Drill</Text>
          <Text style={styles.badge}>Fri 11:15</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Planning Metrics</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>18</Text>
            <Text style={styles.metricLabel}>Lessons</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>92%</Text>
            <Text style={styles.metricLabel}>Coverage</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>6</Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </View>
        </View>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  form: {
    gap: 8,
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  typeBtnActive: {
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  msgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  msgSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  msgError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  msgText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  msgTextSuccess: {
    color: '#065f46',
  },
  msgTextError: {
    color: '#991b1b',
  },
  previewContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 12,
    gap: 10,
  },
  previewHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  previewQuizInfo: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewQuizTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  previewQuizDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  previewSubheading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  questionsPreview: {
    gap: 6,
  },
  questionPreviewCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
  },
  previewQTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  previewQInst: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  publishBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  publishBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
  },
});
