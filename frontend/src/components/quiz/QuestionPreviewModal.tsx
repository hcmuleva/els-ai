import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Check,
  ChevronLeft,
  Clock,
  Eye,
  FileQuestion,
  HelpCircle,
  Pause,
  Pencil,
  Play,
  Sparkles,
  SplitSquareHorizontal,
  Volume2,
  X,
  Zap,
} from 'lucide-react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LatexText from '../common/LatexText';
import SafeImage from './SafeImage';
import SingleQuestionPlayer from './SingleQuestionPlayer';
import JigsawRenderer from './JigsawRenderer';
import { resolveMediaUrl } from '../../utils/media';
import { getStandardLabel } from '../../constants/standards';

export interface QuestionPreviewItem {
  id: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  explanation?: string | null;
  question_audio?: string | null;
  time_limit_seconds?: number;
  points?: number;
  question_data?: any;
  class_level?: string;
  subject?: string;
  quiz_title?: string;
  quiz_id?: string;
}

export type QuestionPreviewModalProps = {
  visible: boolean;
  question: QuestionPreviewItem | null;
  loading?: boolean;
  onClose: () => void;
  onEdit?: (q: QuestionPreviewItem) => void;
};

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  single_choice:    { label: 'Single Choice', bg: '#EFF6FF', color: '#1D4ED8' },
  multi_choice:     { label: 'Multiple Choice', bg: '#F5F3FF', color: '#6D28D9' },
  true_false:       { label: 'True / False', bg: '#ECFDF5', color: '#047857' },
  drag_drop:        { label: 'Drag & Drop', bg: '#FFF7ED', color: '#C2410C' },
  drag_drop_match:  { label: 'Drag & Drop Match', bg: '#FFF7ED', color: '#C2410C' },
  memory_game:      { label: 'Memory Game', bg: '#FDF2F8', color: '#BE185D' },
  memory_match:     { label: 'Memory Match', bg: '#FDF2F8', color: '#BE185D' },
  fill_blank:       { label: 'Fill in Blank', bg: '#F0FDFA', color: '#0F766E' },
  fill_in_blank:    { label: 'Fill in Blank', bg: '#F0FDFA', color: '#0F766E' },
  logico:           { label: 'Logico Matrix', bg: '#FEFCE8', color: '#A16207' },
  jigsaw:           { label: 'Jigsaw Puzzle', bg: '#F1F5F9', color: '#475569' },
  jigsaw_puzzle:    { label: 'Jigsaw Puzzle', bg: '#F1F5F9', color: '#475569' },
  guess_image:      { label: 'Image Select', bg: '#EFF6FF', color: '#2563EB' },
  guess_audio:      { label: 'Audio Match', bg: '#FAF5FF', color: '#7E22CE' },
  image_select:     { label: 'Image Select', bg: '#EFF6FF', color: '#2563EB' },
  sound_match:      { label: 'Sound Match', bg: '#FAF5FF', color: '#7E22CE' },
};

function normalizeType(raw: string): string {
  const t = (raw || '').toLowerCase().trim();
  if (t === 'jigsaw_puzzle') return 'jigsaw';
  if (t === 'fill_in_blank') return 'fill_blank';
  return t;
}

// ── Inline Audio Player ───────────────────────────────────────────────────────
function PreviewInlineAudio({
  url,
  label = 'Play Audio',
  accentColor = '#2D5DC9',
}: {
  url: string;
  label?: string;
  accentColor?: string;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (s) => {
          if (s.isLoaded) {
            setPos(s.positionMillis ?? 0);
            setDur(s.durationMillis ?? 0);
            setPlaying(s.isPlaying);
            if (s.didJustFinish) setPlaying(false);
          }
        },
      );
      soundRef.current = sound;
      setLoaded(true);
      setPlaying(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!loaded) {
      load();
      return;
    }
    if (playing) await soundRef.current?.pauseAsync();
    else await soundRef.current?.playAsync();
  };

  const fmt = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const pct = dur > 0 ? (pos / dur) * 100 : 0;

  return (
    <View style={[audioStyles.wrap, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }]}>
      <TouchableOpacity
        style={[audioStyles.playBtn, { backgroundColor: accentColor }]}
        onPress={togglePlay}
        disabled={loading || error}
      >
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading" size="small" color="#fff" />
        ) : error ? (
          <Volume2 size={16} color="#fff" />
        ) : playing ? (
          <Pause size={16} color="#fff" fill="#fff" />
        ) : (
          <Play size={16} color="#fff" fill="#fff" />
        )}
      </TouchableOpacity>
      <View style={audioStyles.info}>
        <Text style={[audioStyles.label, { color: accentColor }]}>{label}</Text>
        {error ? (
          <Text style={audioStyles.error}>Could not load audio</Text>
        ) : (
          <>
            <View style={[audioStyles.track, { backgroundColor: `${accentColor}20` }]}>
              <View style={[audioStyles.fill, { width: `${pct}%`, backgroundColor: accentColor }]} />
            </View>
            <Text style={audioStyles.time}>
              {fmt(pos)}
              {dur > 0 ? ` / ${fmt(dur)}` : ''}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const audioStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  track: { height: 4, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  time: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  error: { fontSize: 11, color: '#B91C1C' },
});

// ── Main Question Preview Modal ───────────────────────────────────────────────
export default function QuestionPreviewModal({
  visible,
  question,
  loading = false,
  onClose,
  onEdit,
}: QuestionPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeMode, setActiveMode] = useState<'data' | 'play'>('data');

  // Reset mode to data when visible changes
  useEffect(() => {
    if (visible) {
      setActiveMode('data');
    }
  }, [visible, question?.id]);

  const qType = normalizeType(question?.question_type || 'single_choice');
  const typeCfg = TYPE_CONFIG[qType] || { label: question?.question_type || 'Question', bg: '#F1F5F9', color: '#475569' };

  // Parse question_data safely
  const qData = useMemo(() => {
    let data = question?.question_data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    return data || {};
  }, [question?.question_data]);

  const promptImage = useMemo(() => {
    const raw = qData.prompt_image || qData.image || qData.media_url || qData.imageUrl;
    return raw ? resolveMediaUrl(raw) : '';
  }, [qData]);

  const promptAudio = useMemo(() => {
    const raw = question?.question_audio || qData.prompt_audio || qData.audio_url || qData.audio;
    return raw ? resolveMediaUrl(raw) : '';
  }, [question?.question_audio, qData]);

  const options: any[] = useMemo(() => {
    const raw = qData.options || qData.choices || [];
    return Array.isArray(raw) ? raw : [];
  }, [qData]);

  const optionSlots: any[] = Array.isArray(qData.option_slots) ? qData.option_slots : [];
  const buttonSlotMap: Record<string, number> =
    qData.button_slot_map && typeof qData.button_slot_map === 'object'
      ? (qData.button_slot_map as Record<string, number>)
      : {};

  const dragItems: any[] = Array.isArray(qData.drag_items) ? qData.drag_items : [];
  const dropTargets: any[] = Array.isArray(qData.drop_targets) ? qData.drop_targets : [];
  const matchRules: any[] = Array.isArray(qData.match_rules) ? qData.match_rules : [];

  const pairs: any[] = useMemo(() => {
    const raw = qData.pairs || qData.matching_pairs || qData.match_pairs || [];
    return Array.isArray(raw) ? raw : [];
  }, [qData]);

  const explanation = question?.explanation || qData.explanation;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={isDesktop}
      presentationStyle={isDesktop ? 'overFullScreen' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={[styles.root, isDesktop && styles.rootDesktop]}>
        <View style={[styles.container, isDesktop && styles.containerDesktop]}>
          {/* Header Bar */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, isDesktop ? 16 : 12) }]}>
            <View style={styles.headerLeft}>
              <Pressable onPress={onClose} style={styles.backBtn} accessibilityLabel="Back">
                <ChevronLeft size={22} color="#1E293B" />
              </Pressable>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.headerTitle}>Question Preview</Text>
                  <View style={[styles.typePill, { backgroundColor: typeCfg.bg }]}>
                    <Text style={[styles.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  {question?.class_level ? getStandardLabel(question.class_level) : 'All Standards'}
                  {question?.subject ? ` · ${question.subject}` : ''}
                </Text>
              </View>
            </View>

            {/* Mode Switcher & Actions */}
            <View style={styles.headerActions}>
              <View style={styles.modeToggleGroup}>
                <Pressable
                  style={[styles.modeToggleBtn, activeMode === 'data' && styles.modeToggleBtnActive]}
                  onPress={() => setActiveMode('data')}
                >
                  <Eye size={13} color={activeMode === 'data' ? '#2D5DC9' : '#64748B'} />
                  <Text style={[styles.modeToggleText, activeMode === 'data' && styles.modeToggleTextActive]}>
                    Data & Key
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeToggleBtn, activeMode === 'play' && styles.modeToggleBtnActive]}
                  onPress={() => setActiveMode('play')}
                >
                  <Play size={13} color={activeMode === 'play' ? '#2D5DC9' : '#64748B'} fill={activeMode === 'play' ? '#2D5DC9' : 'transparent'} />
                  <Text style={[styles.modeToggleText, activeMode === 'play' && styles.modeToggleTextActive]}>
                    Test Play
                  </Text>
                </Pressable>
              </View>

              {question && onEdit ? (
                <Pressable
                  style={styles.editBtn}
                  onPress={() => {
                    onClose();
                    onEdit(question);
                  }}
                >
                  <Pencil size={13} color="#1E293B" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : null}

              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                <X size={20} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* Loading or Content State */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator accessibilityLabel="Loading" size="large" color="#2D5DC9" />
              <Text style={styles.loadingText}>Fetching question details...</Text>
            </View>
          ) : !question ? (
            <View style={styles.centerBox}>
              <FileQuestion size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Question not found</Text>
            </View>
          ) : activeMode === 'play' ? (
            /* Interactive Student Player Mode */
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.playScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.playHintCard}>
                <Sparkles size={16} color="#2D5DC9" />
                <Text style={styles.playHintText}>
                  Interactive Student Test Mode — play through this question exactly as a student would. Answers here are not saved.
                </Text>
              </View>

              <SingleQuestionPlayer
                questionType={qType}
                questionTitle={question.question_title}
                questionInstruction={question.question_instruction}
                questionAudio={question.question_audio ?? undefined}
                questionData={question.question_data}
              />
            </ScrollView>
          ) : (
            /* Data & Solution Key Mode */
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Question Hero Card */}
              <View style={styles.heroCard}>
                <View style={styles.heroHeaderRow}>
                  <View style={[styles.heroIconBox, { backgroundColor: typeCfg.bg }]}>
                    <FileQuestion size={22} color={typeCfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LatexText
                      content={question.question_title || 'Untitled Question'}
                      style={styles.heroTitleText}
                      background="transparent"
                    />
                  </View>
                </View>

                {/* Metadata Pills */}
                <View style={styles.metaRow}>
                  {question.class_level ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Class</Text>
                      <Text style={styles.metaPillValue}>{getStandardLabel(question.class_level)}</Text>
                    </View>
                  ) : null}

                  {question.subject ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Subject</Text>
                      <Text style={styles.metaPillValue}>{question.subject}</Text>
                    </View>
                  ) : null}

                  <View style={styles.metaPill}>
                    <Zap size={12} color="#D97706" />
                    <Text style={styles.metaPillValue}>{question.points ?? 1} pt{question.points !== 1 ? 's' : ''}</Text>
                  </View>

                  {question.time_limit_seconds ? (
                    <View style={styles.metaPill}>
                      <Clock size={12} color="#64748B" />
                      <Text style={styles.metaPillValue}>{question.time_limit_seconds}s</Text>
                    </View>
                  ) : null}

                  {question.quiz_title ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Quiz</Text>
                      <Text style={styles.metaPillValue} numberOfLines={1}>{question.quiz_title}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Instruction Stimulus */}
              {question.question_instruction ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Instruction Stimulus</Text>
                  <Text style={styles.instructionText}>{question.question_instruction}</Text>
                </View>
              ) : null}

              {/* Prompt Image Stimulus */}
              {promptImage ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Prompt Image</Text>
                  <View style={styles.promptImgBox}>
                    <SafeImage uri={promptImage} style={styles.promptImg} resizeMode="contain" />
                  </View>
                </View>
              ) : null}

              {/* Prompt Audio Stimulus */}
              {promptAudio ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Prompt Audio</Text>
                  <PreviewInlineAudio url={promptAudio} label="Audio Prompt" accentColor="#2D5DC9" />
                </View>
              ) : null}

              {/* Choice Questions (Single / Multi / True-False / Guess-Image / Guess-Audio) */}
              {options.length > 0 && qType !== 'fill_blank' && qType !== 'jigsaw' && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Options & Answer Key</Text>
                    <Text style={styles.sectionSubCount}>{options.length} options</Text>
                  </View>
                  <View style={styles.optionsList}>
                    {options.map((opt: any, idx: number) => {
                      const isCorrect = Boolean(
                        opt.is_correct ?? opt.correct ?? opt.isCorrect ?? (qData.correct_option === idx)
                      );
                      const optText =
                        opt.text || opt.label || opt.option_text || (typeof opt === 'string' ? opt : `Option ${idx + 1}`);
                      const optImg = opt.image ? resolveMediaUrl(opt.image) : '';
                      const optAudio = opt.audio ? resolveMediaUrl(opt.audio) : '';

                      return (
                        <View
                          key={idx}
                          style={[styles.optionItem, isCorrect && styles.optionItemCorrect]}
                        >
                          <View style={[styles.optLetterBadge, isCorrect && styles.optLetterBadgeCorrect]}>
                            <Text style={[styles.optLetterText, isCorrect && styles.optLetterTextCorrect]}>
                              {String.fromCharCode(65 + idx)}
                            </Text>
                          </View>

                          <View style={{ flex: 1, gap: 6 }}>
                            <LatexText
                              content={String(optText)}
                              style={StyleSheet.flatten([styles.optText, isCorrect && styles.optTextCorrect])}
                              background="transparent"
                              compact
                            />
                            {optImg ? (
                              <SafeImage uri={optImg} style={styles.optImg} resizeMode="contain" />
                            ) : null}
                            {optAudio ? (
                              <PreviewInlineAudio url={optAudio} label="Option audio" accentColor={isCorrect ? '#15803D' : '#64748B'} />
                            ) : null}
                          </View>

                          {isCorrect ? (
                            <View style={styles.correctBadge}>
                              <Check size={12} color="#15803D" strokeWidth={2.5} />
                              <Text style={styles.correctBadgeText}>Correct</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Fill in the Blank */}
              {qType === 'fill_blank' && (() => {
                const sentence: string = qData.sentence || '';
                const answer: string = qData.answer || qData.blank_answer || qData.correct_answer || '';
                const hint: string = qData.hint || '';
                const fbOpts: string[] = Array.isArray(qData.options) ? qData.options : [];
                const parts = sentence.split('___');

                return (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>Sentence & Target</Text>
                    <View style={styles.sentenceBox}>
                      {sentence ? (
                        <Text style={styles.sentenceText}>
                          <Text>{parts[0] ?? ''}</Text>
                          <Text style={styles.sentenceHighlight}>
                            {' '}{answer || '___'}{' '}
                          </Text>
                          <Text>{parts[1] ?? ''}</Text>
                        </Text>
                      ) : (
                        <Text style={styles.mutedText}>No sentence text defined</Text>
                      )}

                      {hint ? (
                        <View style={styles.hintPill}>
                          <Text style={{ fontSize: 12 }}>💡</Text>
                          <Text style={styles.hintText}>Hint: "{hint}"</Text>
                        </View>
                      ) : null}
                    </View>

                    {fbOpts.length > 0 && (
                      <View style={{ marginTop: 14, gap: 8 }}>
                        <Text style={styles.sectionSubLabel}>Choice Options</Text>
                        <View style={styles.pillCloud}>
                          {fbOpts.map((opt, i) => {
                            const isCorrect = answer && opt.trim().toLowerCase() === answer.trim().toLowerCase();
                            return (
                              <View
                                key={i}
                                style={[styles.choiceCloudPill, isCorrect && styles.choiceCloudPillCorrect]}
                              >
                                <Text style={[styles.choiceCloudText, isCorrect && styles.choiceCloudTextCorrect]}>
                                  {opt}
                                </Text>
                                {isCorrect && <Check size={12} color="#15803D" strokeWidth={2.5} />}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Drag and Drop / Matching Pairs */}
              {pairs.length > 0 && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Matching Pairs</Text>
                  <View style={styles.pairsList}>
                    {pairs.map((p: any, pIdx: number) => {
                      const left = p.left || p.item || p.leftText || `Item ${pIdx + 1}`;
                      const right = p.right || p.pair || p.rightText || `Match ${pIdx + 1}`;
                      return (
                        <View key={pIdx} style={styles.pairRow}>
                          <View style={styles.pairItem}>
                            <Text style={styles.pairItemText}>{String(left)}</Text>
                          </View>
                          <View style={styles.pairArrowBox}>
                            <SplitSquareHorizontal size={14} color="#64748B" />
                          </View>
                          <View style={[styles.pairItem, styles.pairItemTarget]}>
                            <Text style={styles.pairItemTextTarget}>{String(right)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {dragItems.length > 0 && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Drag & Drop Match Rules</Text>
                  <View style={styles.pairsList}>
                    {dragItems.map((item: any, idx: number) => {
                      const rule = matchRules.find((r: any) => r.drag_item_id === item.id);
                      const target = rule ? dropTargets.find((t: any) => t.id === rule.drop_target_id) : null;
                      return (
                        <View key={idx} style={styles.pairRow}>
                          <View style={styles.pairItem}>
                            {item.label ? <Text style={styles.pairItemText}>{item.label}</Text> : null}
                            {item.image ? <SafeImage uri={resolveMediaUrl(item.image)} style={styles.pairThumb} resizeMode="contain" /> : null}
                          </View>
                          <View style={styles.pairArrowBox}>
                            <SplitSquareHorizontal size={14} color="#64748B" />
                          </View>
                          <View style={[styles.pairItem, styles.pairItemTarget]}>
                            {target?.label ? (
                              <Text style={styles.pairItemTextTarget}>{target.label}</Text>
                            ) : (
                              <Text style={styles.mutedText}>–</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Logico Matrix */}
              {qType === 'logico' && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Logico Slot Mapping (1-10)</Text>
                  <View style={styles.logicoList}>
                    {Array.from({ length: 10 }, (_, index) => {
                      const slotId = index + 1;
                      const mappedButton = Object.entries(buttonSlotMap).find(([, slot]) => Number(slot) === slotId)?.[0] ?? '';
                      const optionLabel =
                        optionSlots.find((slot) => Number(slot?.id) === slotId)?.value ||
                        `Position ${slotId}`;
                      return (
                        <View key={`logico-slot-${slotId}`} style={styles.logicoRow}>
                          <View style={styles.logicoSlotBadge}>
                            <Text style={styles.logicoSlotBadgeText}>{slotId}</Text>
                          </View>
                          <Text style={styles.logicoOptionText}>{String(optionLabel)}</Text>
                          <View style={[styles.logicoButtonPill, mappedButton ? styles.logicoButtonPillMapped : styles.logicoButtonPillUnmapped]}>
                            <Text style={[styles.logicoButtonPillText, mappedButton ? styles.logicoButtonPillTextMapped : styles.logicoButtonPillTextUnmapped]}>
                              {mappedButton || 'Unmapped'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Memory Match */}
              {qType === 'memory_match' && (() => {
                const grid = String(qData.grid || '4x4');
                const memPairs: any[] = Array.isArray(qData.pairs) ? qData.pairs : [];
                return (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>Memory Match Configuration</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillLabel}>Grid</Text>
                        <Text style={styles.metaPillValue}>{grid}</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillLabel}>Pairs</Text>
                        <Text style={styles.metaPillValue}>{memPairs.length}</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillLabel}>Cards</Text>
                        <Text style={styles.metaPillValue}>{memPairs.length * 2}</Text>
                      </View>
                    </View>
                    {memPairs.length > 0 && (
                      <View style={{ marginTop: 12, gap: 8 }}>
                        <Text style={styles.sectionSubLabel}>Configured Pairs</Text>
                        <View style={styles.pillCloud}>
                          {memPairs.map((p: any, i: number) => (
                            <View key={i} style={styles.choiceCloudPill}>
                              <Text style={styles.choiceCloudText}>{p.label || `Pair ${i + 1}`}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Jigsaw Puzzle */}
              {qType === 'jigsaw' && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Jigsaw Puzzle Configuration</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Grid</Text>
                      <Text style={styles.metaPillValue}>{String(qData.gridSize || '3x3')}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Difficulty</Text>
                      <Text style={styles.metaPillValue}>{String(qData.difficulty || 'medium')}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Moves Limit</Text>
                      <Text style={styles.metaPillValue}>{Number(qData.clickLimit || 0) > 0 ? `${qData.clickLimit} moves` : 'Unlimited'}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Explanation Card */}
              {explanation ? (
                <View style={styles.explanationCard}>
                  <View style={styles.explanationHeader}>
                    <Sparkles size={16} color="#2563EB" />
                    <Text style={styles.explanationLabel}>Solution Explanation</Text>
                  </View>
                  <Text style={styles.explanationText}>{explanation}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles (Compliant with uniform border guidelines in AGENTS.md) ─────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  rootDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDesktop: {
    flex: undefined as any,
    width: '100%',
    maxWidth: 960,
    height: '92%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modeToggleTextActive: {
    color: '#2D5DC9',
    fontWeight: '800',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  playScrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  playHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    padding: 12,
  },
  playHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaPillLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  metaPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  sectionSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  instructionText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
    fontWeight: '500',
  },
  promptImgBox: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promptImg: {
    width: '100%',
    height: '100%',
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionItemCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  optLetterBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterBadgeCorrect: {
    backgroundColor: '#22C55E',
  },
  optLetterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  optLetterTextCorrect: {
    color: '#FFFFFF',
  },
  optText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  optTextCorrect: {
    color: '#14532D',
    fontWeight: '700',
  },
  optImg: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginTop: 4,
  },
  correctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  correctBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  sentenceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sentenceText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 26,
  },
  sentenceHighlight: {
    fontWeight: '800',
    color: '#15803D',
    textDecorationLine: 'underline',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'center',
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A16207',
  },
  pillCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceCloudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  choiceCloudPillCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  choiceCloudText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  choiceCloudTextCorrect: {
    color: '#15803D',
    fontWeight: '800',
  },
  pairsList: {
    gap: 8,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pairItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    justifyContent: 'center',
  },
  pairItemTarget: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  pairItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  pairItemTextTarget: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  pairArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairThumb: {
    width: 60,
    height: 45,
    borderRadius: 6,
    marginTop: 4,
  },
  logicoList: {
    gap: 6,
  },
  logicoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logicoSlotBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logicoSlotBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  logicoOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  logicoButtonPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  logicoButtonPillMapped: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  logicoButtonPillUnmapped: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  logicoButtonPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logicoButtonPillTextMapped: {
    color: '#92400E',
  },
  logicoButtonPillTextUnmapped: {
    color: '#94A3B8',
  },
  explanationCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  explanationText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E3A8A',
    lineHeight: 20,
  },
  mutedText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
