import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, RotateCcw, Play } from 'lucide-react-native';

interface Props {
  visible: boolean;
  sectionTitle: string;
  hasQuiz: boolean;
  onStartQuiz: () => void;
  onReplay: () => void;
  onClose: () => void;
}

export default function SectionEndQuizPrompt({
  visible,
  sectionTitle,
  hasQuiz,
  onStartQuiz,
  onReplay,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <CheckCircle2 size={38} color="#2FA36B" />
          </View>

          <Text style={styles.title}>Section complete</Text>
          <Text style={styles.body}>
            You finished <Text style={styles.bodyStrong}>&ldquo;{sectionTitle}&rdquo;</Text>.
            {'\n'}
            {hasQuiz
              ? 'Take the quick quiz to continue to the next section.'
              : 'There is no quiz for this section, so you can keep going.'}
          </Text>

          <View style={styles.actions}>
            {hasQuiz ? (
              <Pressable style={[styles.btn, styles.primary]} onPress={onStartQuiz}>
                <Play size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Start Quiz</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.btn, styles.primary]} onPress={onClose}>
                <Text style={styles.primaryText}>Continue</Text>
              </Pressable>
            )}

            <Pressable style={[styles.btn, styles.secondary]} onPress={onReplay}>
              <RotateCcw size={16} color="#5A6A8A" />
              <Text style={styles.secondaryText}>Replay Section</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,20,38,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F7EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14.5,
    color: '#6A6A85',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  bodyStrong: { color: '#2A2A44', fontWeight: '700' },
  actions: { width: '100%', gap: 10 },
  btn: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
  },
  primary: {
    backgroundColor: '#2D5DC9',
    shadowColor: '#2D5DC9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15.5 },
  secondary: { backgroundColor: '#F4F5FA', borderWidth: 1, borderColor: '#E6E8F0' },
  secondaryText: { color: '#5A6A8A', fontWeight: '700', fontSize: 15 },
});
