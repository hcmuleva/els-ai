import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import { useAuth } from '../../src/context/AuthContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';

type QuizListItem = {
  id: string;
  title: string;
  description?: string;
  thumbnail_image?: string;
  class_level?: string;
  subject?: string;
  quiz_type: string;
  difficulty_level?: string;
  theme?: any;
};

export default function PracticeScreen() {
  const { apiFetch, isAuthenticated } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  const loadQuizzes = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await apiFetch('/quizzes');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      }
    } catch (e) {
      console.warn('Failed to load quizzes list', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQuizzes();
    }, [isAuthenticated])
  );

  return (
    <ScreenTemplate title="Playroom Portal">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Interactive Practices</Text>
        <Text style={styles.sectionSubtitle}>
          Select a quiz template below to start your learning playroom.
        </Text>

        {loading ? (
          <View style={styles.centerWrapper}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Fetching playrooms...</Text>
          </View>
        ) : quizzes.length === 0 ? (
          <View style={styles.centerWrapper}>
            <Text style={styles.emptyText}>No playrooms available right now.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {quizzes.map((quiz) => {
              const primaryColor = quiz.theme?.colors?.primary || '#1d4ed8';
              const bgColor = quiz.theme?.colors?.background || '#eff6ff';

              return (
                <Pressable
                  key={quiz.id}
                  onPress={() => setSelectedQuizId(quiz.id)}
                  style={[styles.quizCard, { backgroundColor: bgColor, borderColor: primaryColor }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: primaryColor }]}>
                      <Text style={styles.badgeText}>{quiz.quiz_type.replace('_', ' ')}</Text>
                    </View>
                    {quiz.class_level ? (
                      <Text style={styles.classLevel}>{quiz.class_level}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.cardTitle}>{quiz.title}</Text>
                  {quiz.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {quiz.description}
                    </Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    {quiz.subject ? <Text style={styles.subjectText}>{quiz.subject}</Text> : <View />}
                    <View style={[styles.playBtn, { backgroundColor: primaryColor }]}>
                      <Play size={14} color="#ffffff" fill="#ffffff" />
                      <Text style={styles.playBtnText}>Play</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selectedQuizId && (
        <QuizRenderer
          quizId={selectedQuizId}
          visible={selectedQuizId !== null}
          onClose={() => {
            setSelectedQuizId(null);
            loadQuizzes(); // Refresh lists
          }}
        />
      )}
    </ScreenTemplate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
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
  grid: {
    gap: 14,
  },
  quizCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  classLevel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  playBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
