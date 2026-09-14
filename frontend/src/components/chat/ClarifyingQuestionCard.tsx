import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, HelpCircle, Sparkles } from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

export interface ClarifyingOption {
  label: string;
  value: string;
}

export interface ClarifyingQuestionData {
  type: 'clarifying_question';
  question: string;
  options: Array<ClarifyingOption | string>;
  category?: string;
}

interface ClarifyingQuestionCardProps {
  data: ClarifyingQuestionData;
  onSelectOption: (val: string) => void;
  disabled?: boolean;
}

export function ClarifyingQuestionCard({
  data,
  onSelectOption,
  disabled = false,
}: ClarifyingQuestionCardProps) {
  const [chosen, setChosen] = useState<string | null>(null);

  const normalizedOptions: ClarifyingOption[] = data.options.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return opt;
  });

  const handlePress = (val: string) => {
    if (disabled || chosen) return;
    setChosen(val);
    onSelectOption(val);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Sparkles size={14} color="#6366F1" strokeWidth={2.2} />
        </View>
        <Text style={styles.questionText}>{data.question}</Text>
      </View>

      <View style={styles.optionsWrap}>
        {normalizedOptions.map((opt, idx) => {
          const isSelected = chosen === opt.value;
          return (
            <Pressable
              key={`${opt.value}-${idx}`}
              onPress={() => handlePress(opt.value)}
              disabled={disabled || Boolean(chosen)}
              style={({ pressed }) => [
                styles.optionChip,
                isSelected && styles.optionChipSelected,
                pressed && !chosen && styles.optionChipPressed,
                Boolean(chosen) && !isSelected && styles.optionChipDimmed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              {isSelected ? (
                <View style={styles.checkCircle}>
                  <Check size={11} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                  Boolean(chosen) && !isSelected && styles.optionLabelDimmed,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: Spacing.md,
    ...Shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 18,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionChipPressed: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  optionChipSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#4F46E5',
  },
  optionChipDimmed: {
    opacity: 0.55,
  },
  checkCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  optionLabelDimmed: {
    color: '#64748B',
  },
});
