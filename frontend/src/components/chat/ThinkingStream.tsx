import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

interface ThinkingStreamProps {
  thinkingText: string;
  isThinking: boolean;
  hasReplyStarted: boolean;
}

export function ThinkingStream({
  thinkingText,
  isThinking,
  hasReplyStarted,
}: ThinkingStreamProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Pulse animation for the brain icon / indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isThinking) {
      setSecondsElapsed(0);
      setIsExpanded(true);
      timer = setInterval(() => {
        setSecondsElapsed((s) => s + 1);
      }, 1000);
    } else if (hasReplyStarted) {
      // Auto-collapse once the reply tokens start streaming to give spotlight to the answer
      setIsExpanded(false);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isThinking, hasReplyStarted]);

  useEffect(() => {
    if (isThinking) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.45,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isThinking, pulseAnim]);

  // Only display if there is genuine thinking text for generative/complex tasks
  if (!thinkingText || !thinkingText.trim()) {
    return null;
  }

  const displayText = thinkingText.trim();

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setIsExpanded((prev) => !prev)}
        style={styles.headerRow}
        accessibilityRole="button"
        accessibilityLabel="Toggle thinking process"
      >
        <View style={styles.leftPill}>
          <Animated.View style={[styles.iconBox, { opacity: pulseAnim }]}>
            <Brain size={14} color="#6366F1" strokeWidth={2.4} />
          </Animated.View>

          <Text style={styles.headerTitle}>
            {isThinking ? 'Thinking' : 'Thought Process'}
          </Text>

          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>
              {secondsElapsed > 0 ? `${secondsElapsed}s` : 'active'}
            </Text>
          </View>
        </View>

        <View style={styles.rightAction}>
          <Text style={styles.toggleHint}>
            {isExpanded ? 'Hide' : 'View'}
          </Text>
          {isExpanded ? (
            <ChevronUp size={14} color={Colors.textMuted} />
          ) : (
            <ChevronDown size={14} color={Colors.textMuted} />
          )}
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.contentBox}>
          <View style={styles.statusIndicatorRow}>
            <Sparkles size={13} color="#818CF8" />
            <Text style={styles.statusText} numberOfLines={isThinking ? 2 : 10}>
              {displayText}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
    marginHorizontal: Spacing.xs,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 3,
    backgroundColor: '#FFFFFF',
  },
  leftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.2,
  },
  timerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  toggleHint: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  contentBox: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
    fontStyle: 'italic',
  },
});
