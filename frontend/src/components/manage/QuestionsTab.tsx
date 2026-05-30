/**
 * QuestionsTab — revamped to match ContentTab / TopicsTab UI style.
 * - No search text field (filters only)
 * - Filter chips + type chips on separate rows, both horizontally scrollable
 * - Full-screen QuestionDetailsModal
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  ChevronLeft, ChevronRight, Search, Filter, X,
  Zap, Clock, Eye, Volume2, CheckSquare, SplitSquareHorizontal, ListChecks, Layers, HelpCircle, ClipboardList,
  Play, Pause, Check, Image as ImageIcon,
} from 'lucide-react-native';
import { Audio } from 'expo-av';
import SelectorModal from '../SelectorModal';
import JigsawRenderer from '../quiz/JigsawRenderer';

import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import { API_BASE_URL } from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export type QuestionItem = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  class_level?: string;
  subject?: string;
  quiz_type: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  question_audio?: string;
  time_limit_seconds: number;
  points: number;
  sort_order?: number;
  question_data?: unknown;   // not included in list response, fetched on demand
  created_at: string;
};

type Filters = { search: string; classLevel: string; subject: string; category: string };
type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;
type QuestionFull = QuestionItem & { question_data: unknown };

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveUrl(url?: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

function SafeImage({ uri, style, resizeMode = 'contain' }: { uri: string; style?: any; resizeMode?: any }) {
  const [error, setError] = useState(false);
  
  if (!uri || error) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F4FB', overflow: 'hidden' }]}>
        <ImageIcon size={24} color="#9A9AB0" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      resizeMode={resizeMode} 
      onError={() => setError(true)}
    />
  );
}

type QtypeCfg = { Icon: React.ComponentType<{ size?: number; color?: string }>; label: string; color: string; bg: string };
const QTYPE_CONFIG: Record<string, QtypeCfg> = {
  guess_image:     { Icon: Eye,                  label: 'Guess Image',   color: '#4A90E2', bg: '#D6EAFF' },
  drag_drop_match: { Icon: SplitSquareHorizontal,label: 'Drag & Drop',   color: '#9B8EC4', bg: '#EDE4FF' },
  guess_audio:     { Icon: Volume2,              label: 'Guess Audio',   color: '#7DC67A', bg: '#D6F5D6' },
  true_false:      { Icon: CheckSquare,          label: 'True / False',  color: '#E6A817', bg: '#FFF5CC' },
  single_choice:   { Icon: Layers,              label: 'Single Choice', color: '#FF7043', bg: '#FFE8D6' },
  multi_choice:    { Icon: ListChecks,          label: 'Multi Choice',  color: '#E91E8C', bg: '#FFE0F0' },
  logico:          { Icon: ListChecks,          label: 'Logico',        color: '#0f766e', bg: '#DCFCE7' },
  memory_match:    { Icon: Layers,              label: 'Memory Match',  color: '#7C3AED', bg: '#EDE9FE' },
  fill_blank:      { Icon: ClipboardList,       label: 'Fill in Blank', color: '#0284C7', bg: '#E0F2FE' },
  jigsaw:          { Icon: Layers,              label: 'Jigsaw Puzzle', color: '#0EA5E9', bg: '#E0F2FE' },
};
function qtypeCfg(t: string): QtypeCfg {
  const normalized = t === 'jigsaw_puzzle' ? 'jigsaw' : t;
  return QTYPE_CONFIG[normalized] ?? { Icon: HelpCircle, label: normalized || 'Question', color: '#9A9AB0', bg: '#F4F4FB' };
}

const PAGE_SIZE = 10;



const CARD_COLORS = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC', '#FFE0F0'];
type SubjectCatalogItem = { classLevel: string; title: string; coverImage?: string; iconImage?: string; iconBgColor?: string };



// ── Compact inline audio player ───────────────────────────────────────────────
function InlineAudio({ url, label = 'Audio', accentColor = '#9B8EC4' }: {
  url: string; label?: string; accentColor?: string;
}) {
  const soundRef               = useRef<Audio.Sound | null>(null);
  const [loaded, setLoaded]    = useState(false);
  const [playing, setPlaying]  = useState(false);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState(false);
  const [pos, setPos]          = useState(0);
  const [dur, setDur]          = useState(0);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const load = async () => {
    setLoading(true); setError(false);
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
      setLoaded(true); setPlaying(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  const togglePlay = async () => {
    if (!loaded) { load(); return; }
    if (playing) await soundRef.current?.pauseAsync();
    else         await soundRef.current?.playAsync();
  };

  const fmt = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const pct = dur > 0 ? (pos / dur) * 100 : 0;

  return (
    <View style={[ia.wrap, { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}10` }]}>
      <TouchableOpacity
        style={[ia.playBtn, { backgroundColor: accentColor }]}
        onPress={togglePlay}
        disabled={loading || error}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : error
            ? <Volume2 size={18} color="#fff" />
            : playing
              ? <Pause size={18} color="#fff" fill="#fff" />
              : <Play  size={18} color="#fff" fill="#fff" />}
      </TouchableOpacity>
      <View style={ia.info}>
        <Text style={[ia.label, { color: accentColor }]}>{label}</Text>
        {error ? (
          <Text style={ia.error}>Could not load audio</Text>
        ) : (
          <>
            <View style={[ia.track, { backgroundColor: `${accentColor}25` }]}>
              <View style={[ia.fill, { width: `${pct}%`, backgroundColor: accentColor }]} />
            </View>
            <Text style={ia.time}>{fmt(pos)}{dur > 0 ? ` / ${fmt(dur)}` : ''}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const ia = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginTop: 6 },
  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
             shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  info:    { flex: 1, gap: 4 },
  label:   { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  track:   { height: 5, borderRadius: 999, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 999 },
  time:    { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  error:   { fontSize: 11, color: '#FF4444' },
});

// ── Question Details Modal ────────────────────────────────────────────────────
function QuestionDetailsModal({ question, onClose, onEdit }: {
  question: QuestionFull | null;
  onClose: () => void;
  onEdit: (q: QuestionFull) => void;
}) {
  if (!question) return null;
  const questionType = question.question_type === 'jigsaw_puzzle' ? 'jigsaw' : question.question_type;
  const cfg  = qtypeCfg(questionType);
  const data = question.question_data as Record<string, unknown> | null | undefined;

  const promptImage = (data as any)?.prompt_image || (data as any)?.image || '';
  const promptAudio = (data as any)?.prompt_audio || question.question_audio || '';
  const options: any[] = (data as any)?.options ?? [];
  const optionSlots: any[] = Array.isArray((data as any)?.option_slots) ? (data as any).option_slots : [];
  const buttonSlotMap = ((data as any)?.button_slot_map && typeof (data as any).button_slot_map === 'object')
    ? (data as any).button_slot_map as Record<string, number>
    : {};
  const dragItems: any[]  = (data as any)?.drag_items ?? [];
  const dropTargets: any[] = (data as any)?.drop_targets ?? [];
  const matchRules: any[]  = (data as any)?.match_rules ?? [];

  return (
    <Modal visible={!!question} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={q.modalScreen}>
        {/* Header */}
        <View style={[q.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={onClose} style={q.modalBack}>
            <ChevronLeft size={24} color="#1a1a2e" />
          </Pressable>
          <Text style={q.modalTitle} numberOfLines={1}>Question Details</Text>
          <Pressable style={q.modalEditBtn} onPress={() => { onClose(); onEdit(question); }}>
            <Text style={q.modalEditText}>Edit</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Hero */}
          <View style={[q.hero, { backgroundColor: cfg.bg }]}>
            <View style={q.heroIconWrap}>
              <cfg.Icon size={48} color={cfg.color} />
            </View>
            <View style={q.heroInfo}>
              <View style={q.heroBadgeRow}>
                <View style={[q.heroBadge, { backgroundColor: `${cfg.color}25` }]}>
                  <Text style={[q.heroBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {question.class_level ? (
                  <View style={q.heroBadge}>
                    <Text style={q.heroBadgeText}>{getStandardLabel(question.class_level)} · {question.subject || '–'}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={q.heroTitle}>{question.question_title || 'Untitled Question'}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={q.statsRow}>
            <View style={q.statCard}>
              <Text style={q.statVal}>{question.points}</Text>
              <Text style={q.statLabel}>Points</Text>
            </View>
            <View style={q.statCard}>
              <Text style={q.statVal}>{question.time_limit_seconds}s</Text>
              <Text style={q.statLabel}>Time</Text>
            </View>
            <View style={q.statCard}>
              <Text style={q.statVal}>
                {questionType === 'memory_match'
                  ? (((data as any)?.pairs ?? []) as any[]).length || '–'
                  : questionType === 'jigsaw'
                    ? (() => {
                        const grid = String((data as any)?.gridSize || '3x3');
                        const size = Number(grid.split('x')[0] || 3);
                        return Number.isFinite(size) ? size * size : 9;
                      })()
                    : (questionType === 'fill_blank' || questionType === 'fill_in_blank')
                    ? (((data as any)?.options ?? []) as string[]).length || '–'
                    : options.length || dragItems.length || '–'}
              </Text>
              <Text style={q.statLabel}>
                {questionType === 'memory_match' ? 'Pairs' : questionType === 'jigsaw' ? 'Pieces' : 'Options'}
              </Text>
            </View>
          </View>

          {/* Instruction */}
          {question.question_instruction ? (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Instruction</Text>
              <View style={q.infoBlock}>
                <Text style={q.infoBlockText}>{question.question_instruction}</Text>
              </View>
            </View>
          ) : null}

          {/* Prompt media */}
          {promptImage ? (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Prompt Image</Text>
              <SafeImage uri={resolveUrl(promptImage)} style={q.previewImage} resizeMode="contain" />
            </View>
          ) : null}

          {promptAudio ? (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Prompt Audio</Text>
              <InlineAudio url={resolveUrl(promptAudio)} label="Play audio prompt" accentColor="#9B8EC4" />
            </View>
          ) : null}

          {questionType === 'logico' && (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Logico Mapping</Text>
              {Array.from({ length: 10 }, (_, index) => {
                const slotId = index + 1;
                const mappedButton = Object.entries(buttonSlotMap).find(([, slot]) => Number(slot) === slotId)?.[0] ?? '';
                const optionLabel =
                  optionSlots.find((slot) => Number(slot?.id) === slotId)?.value ||
                  `Position ${slotId}`;
                return (
                  <View key={`logico-slot-${slotId}`} style={q.optionRow}>
                    <View style={q.optionDot}>
                      <Text style={q.optionDotText}>{slotId}</Text>
                    </View>
                    <Text style={q.optionText}>{String(optionLabel)}</Text>
                    <View style={q.correctBadge}>
                      <Text style={q.correctBadgeText}>{mappedButton || 'Unmapped'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Memory Match */}
          {questionType === 'memory_match' && (() => {
            const GRID_COLS_MAP: Record<string, number> = { '2x2': 2, '4x4': 4, '6x6': 6 };
            const GRID_PAIR_MAP: Record<string, number> = { '2x2': 2, '4x4': 4, '6x6': 6 };
            const grid   = ((data as any)?.grid as string) || '4x4';
            const pairs: any[] = (data as any)?.pairs ?? [];
            const cols   = GRID_COLS_MAP[grid] ?? 4;
            const needed = GRID_PAIR_MAP[grid] ?? 4;
            const allCards = [...pairs, ...pairs].slice(0, needed * 2);
            const previewW = Dimensions.get('window').width - 64;
            const GAP = 6;
            const pvCardW = Math.floor((previewW - GAP * (cols - 1)) / cols);
            const rows: any[][] = [];
            for (let i = 0; i < allCards.length; i += cols) rows.push(allCards.slice(i, i + cols));
            return (
              <View style={q.detailSection}>
                <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EEF0F8' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#9A9AB0', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Board Preview — {pairs.length}/{needed} pairs · {needed * 2} cards
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: previewW, gap: GAP }}>
                      {rows.map((row, rIdx) => (
                        <View key={rIdx} style={{ flexDirection: 'row', gap: GAP, justifyContent: 'center' }}>
                          {row.map((card: any, cIdx: number) => {
                            const imgUrl = card?.imageUrl ? resolveUrl(card.imageUrl) : undefined;
                            return (
                              <View key={cIdx} style={[mmDet.pairCard, { width: pvCardW, backgroundColor: '#4A90E2', borderColor: '#3A7BD5', paddingVertical: 6 }]}>
                                {imgUrl ? (
                                  <Image source={{ uri: imgUrl }} style={{ width: pvCardW * 0.55, height: pvCardW * 0.55 }} resizeMode="contain" />
                                ) : (
                                  <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700', textAlign: 'center' }}>?</Text>
                                )}
                                <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{card?.label ?? '?'}</Text>
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </View>
                  {pairs.length < needed && (
                    <Text style={{ fontSize: 11, color: '#F97316', fontWeight: '700', textAlign: 'center', marginTop: 8 }}>
                      {needed - pairs.length} more pair{needed - pairs.length > 1 ? 's' : ''} needed
                    </Text>
                  )}
                  {pairs.length === 0 && (
                    <Text style={{ color: '#9A9AB0', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>No pairs defined</Text>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Fill in the Blank */}
          {(questionType === 'fill_blank' || questionType === 'fill_in_blank') && (() => {
            const sentence: string = (data as any)?.sentence ?? '';
            const answer: string   = (data as any)?.answer   ?? '';
            const hint: string     = (data as any)?.hint     ?? '';
            const fbOpts           = ((data as any)?.options ?? []) as string[];
            const parts = sentence.split('___');
            return (
              <>
                <View style={q.detailSection}>
                  <Text style={q.detailSectionTitle}>Sentence</Text>
                  <View style={{ backgroundColor: '#F0F7FF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#C5D8F8' }}>
                    {sentence ? (
                      <Text style={{ fontSize: 17, fontWeight: '600', color: '#1a1a2e', textAlign: 'center', lineHeight: 28 }}>
                        <Text>{parts[0] ?? ''}</Text>
                        <Text style={{ fontWeight: '900', color: '#2E7D32', borderBottomWidth: 2, borderBottomColor: '#4CAF50' }}>
                          {' '}{answer || '___'}{' '}
                        </Text>
                        <Text>{parts[1] ?? ''}</Text>
                      </Text>
                    ) : (
                      <Text style={{ color: '#9A9AB0', textAlign: 'center', fontStyle: 'italic' }}>No sentence defined</Text>
                    )}
                    {hint ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'center', backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 12 }}>💡</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#E6A020' }}>Hint: "{hint}"</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {fbOpts.length > 0 && (
                  <View style={q.detailSection}>
                    <Text style={q.detailSectionTitle}>Answer Options</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {fbOpts.map((opt, i) => {
                        const isCorrect = answer && opt.toLowerCase() === answer.toLowerCase();
                        return (
                          <View key={i} style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                            borderWidth: isCorrect ? 2 : 1.5,
                            borderColor: isCorrect ? '#4CAF50' : '#D0D4E8',
                            backgroundColor: isCorrect ? '#E8F5E9' : '#F4F6FF',
                          }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isCorrect ? '#4CAF50' : '#C0C8D8' }} />
                            <Text style={{ fontSize: 14, fontWeight: isCorrect ? '800' : '600', color: isCorrect ? '#2E7D32' : '#3A3A5A' }}>{opt}</Text>
                            {isCorrect && <Check size={13} color="#4CAF50" strokeWidth={3} />}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            );
          })()}

          {questionType === 'jigsaw' && (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Jigsaw Preview</Text>
              <View style={q.jigsawMetaRow}>
                <View style={q.jigsawMetaChip}>
                  <Text style={q.jigsawMetaChipText}>Grid {(data as any)?.gridSize || '3x3'}</Text>
                </View>
                <View style={q.jigsawMetaChip}>
                  <Text style={q.jigsawMetaChipText}>Difficulty {String((data as any)?.difficulty || 'medium')}</Text>
                </View>
                <View style={q.jigsawMetaChip}>
                  <Text style={q.jigsawMetaChipText}>
                    {Number((data as any)?.clickLimit || 0) > 0 ? `${Number((data as any)?.clickLimit)} moves` : 'Unlimited'}
                  </Text>
                </View>
              </View>
              <View style={q.jigsawCard}>
                <JigsawRenderer
                  questionData={data as any}
                  onComplete={() => {}}
                  theme={{ bg: '#E0F2FE', cardBg: '#F0F9FF', accent: '#0EA5E9', textColor: '#0C4A6E', emoji: '🧩', label: 'Rebuild the image!' }}
                  autoStart
                  showControls={false}
                />
              </View>
            </View>
          )}

          {/* Options (MCQ / guess-image etc — not fill_blank) */}
          {options.length > 0 && questionType !== 'fill_blank' && questionType !== 'fill_in_blank' && questionType !== 'jigsaw' && (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Options</Text>
              {options.map((opt: any, idx: number) => {
                const isCorrect = Boolean(opt.is_correct || opt.isCorrect);
                const label = opt.label || opt.text || '';
                return (
                  <View key={idx} style={[q.optionRow, isCorrect && q.optionRowCorrect]}>
                    <View style={[q.optionDot, { backgroundColor: isCorrect ? '#7DC67A' : '#E0E4F0' }]}>
                      {isCorrect
                        ? <Check size={14} color="#fff" strokeWidth={3} />
                        : <Text style={q.optionDotText}>{String.fromCharCode(64 + idx + 1)}</Text>}
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      {label ? <Text style={[q.optionText, isCorrect && q.optionTextCorrect]}>{label}</Text> : null}
                      {opt.image ? <SafeImage uri={resolveUrl(opt.image)} style={q.optionThumb} resizeMode="contain" /> : null}
                      {opt.audio ? <InlineAudio url={resolveUrl(opt.audio)} label="Option audio" accentColor={isCorrect ? '#7DC67A' : '#9B8EC4'} /> : null}
                    </View>
                    {isCorrect && (
                      <View style={q.correctBadge}>
                        <Check size={11} color="#fff" strokeWidth={3} />
                        <Text style={q.correctBadgeText}>Correct</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Drag-drop pairs */}
          {dragItems.length > 0 && (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Match Pairs</Text>
              {dragItems.map((item: any, idx: number) => {
                const rule = matchRules.find((r: any) => r.drag_item_id === item.id);
                const target = rule ? dropTargets.find((t: any) => t.id === rule.drop_target_id) : null;
                return (
                  <View key={idx} style={q.pairRow}>
                    <View style={q.pairCell}>
                      {item.label ? <Text style={q.pairText}>{item.label}</Text> : null}
                      {item.image ? <SafeImage uri={resolveUrl(item.image)} style={q.pairThumb} resizeMode="contain" /> : null}
                      {item.sound ? <InlineAudio url={resolveUrl(item.sound)} label="Audio" accentColor="#9B8EC4" /> : null}
                    </View>
                    <View style={q.pairArrowWrap}>
                      <SplitSquareHorizontal size={16} color="#9A9AB0" />
                    </View>
                    <View style={q.pairCell}>
                      {target?.label ? <Text style={q.pairText}>{target.label}</Text> : <Text style={q.pairTextMuted}>–</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* True/False answer — only shown when options are absent (older format) */}
          {questionType === 'true_false' && options.length === 0 ? (
            <View style={q.detailSection}>
              <Text style={q.detailSectionTitle}>Correct Answer</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {['True', 'False'].map((val) => {
                  const rawAnswer = (data as any)?.correctAnswer ?? (data as any)?.answer ?? '';
                  const isAnswer = String(rawAnswer).toLowerCase() === val.toLowerCase();
                  return (
                    <View key={val} style={[q.tfChip, isAnswer && q.tfChipCorrect]}>
                      {isAnswer && <Check size={14} color="#fff" strokeWidth={3} />}
                      <Text style={[q.tfChipText, isAnswer && q.tfChipTextCorrect]}>{val}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Quiz */}
          <View style={q.detailSection}>
            <Text style={q.detailSectionTitle}>Parent Quiz</Text>
            <View style={q.infoBlock}>
              <Text style={q.infoBlockText}>{question.quiz_title}</Text>
              <Text style={q.infoBlockMeta}>{question.quiz_type}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({ question, idx, onAction }: {
  question: QuestionItem;
  idx: number;
  onAction: (a: 'view' | 'edit' | 'delete') => void;
}) {
  const cfg = qtypeCfg(question.question_type);
  const bg  = CARD_COLORS[idx % CARD_COLORS.length];

  return (
    <View style={q.card}>
      <View style={q.cardTop}>
        <View style={[q.artBox, { backgroundColor: bg }]}>
          <cfg.Icon size={24} color={cfg.color} />
        </View>
        <View style={q.cardInfo}>
          <Text style={q.cardTitle} numberOfLines={2}>{question.question_title || 'Untitled Question'}</Text>
          <Text style={q.cardMeta}>
            {question.class_level ? getStandardLabel(question.class_level) : '–'} · {question.subject || '–'}
          </Text>
          <View style={q.cardTagRow}>
            <View style={[q.typeTag, { backgroundColor: cfg.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <cfg.Icon size={10} color={cfg.color} />
              <Text style={[q.typeTagText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={[q.cardChipRow]}><Zap size={10} color="#E6A817" fill="#E6A817" /><Text style={q.cardChip}>{question.points} pt{question.points !== 1 ? 's' : ''}</Text></View>
            <View style={[q.cardChipRow]}><Clock size={10} color="#5A6A8A" /><Text style={q.cardChip}>{question.time_limit_seconds}s</Text></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <ClipboardList size={10} color="#9A9AB0" />
            <Text style={q.quizTag} numberOfLines={1}>{question.quiz_title}</Text>
          </View>
        </View>
      </View>
      <View style={q.cardFooter}>
        <Pressable style={[q.footerBtn, { backgroundColor: '#EBF4FF' }]} onPress={() => onAction('view')}>
          <Text style={[q.footerBtnText, { color: '#1A4DA2' }]}>Details</Text>
        </Pressable>
        <Pressable style={[q.footerBtn, { backgroundColor: '#FFF3E0' }]} onPress={() => onAction('edit')}>
          <Text style={[q.footerBtnText, { color: '#E65100' }]}>Edit</Text>
        </Pressable>
        <Pressable style={[q.footerBtn, { backgroundColor: '#FEF0ED' }]} onPress={() => onAction('delete')}>
          <Text style={[q.footerBtnText, { color: '#E05A3A' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  questions: QuestionItem[];
  loading: boolean;
  deletingQuestionId: string | null;
  filters: Filters;
  subjectCatalog: SubjectCatalogItem[];
  apiFetch: ApiFetch;
  onFiltersChange: (patch: Partial<Filters>) => void;
  onApplyFilters: () => void;
  onOpenCreate: () => void;
  onQuestionAction: (q: QuestionItem, action: 'view' | 'edit' | 'delete') => void;
  message?: { type: 'success' | 'error'; text: string } | null;
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuestionsTab({
  questions, loading, deletingQuestionId, filters, subjectCatalog, apiFetch,
  onFiltersChange, onApplyFilters, onOpenCreate, onQuestionAction, message,
}: Props) {
  const [classOpen, setClassOpen]         = useState(false);
  const [subjectOpen, setSubjectOpen]     = useState(false);
  const [detailsQuestion, setDetailsQuestion] = useState<QuestionFull | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [page, setPage] = useState(0);

  const openDetails = async (q: QuestionItem) => {
    setFetchingDetails(true);
    try {
      const res = await apiFetch(`/questions/${q.id}`);
      if (res.ok) {
        const payload = await res.json();
        setDetailsQuestion(payload.question as QuestionFull);
      } else {
        // fallback: show with whatever data we have
        setDetailsQuestion({ ...q, question_data: q.question_data ?? {} } as QuestionFull);
      }
    } catch {
      setDetailsQuestion({ ...q, question_data: q.question_data ?? {} } as QuestionFull);
    } finally {
      setFetchingDetails(false);
    }
  };

  const classOptions   = STANDARD_OPTIONS.map((o) => ({ label: o.label, value: o.value }));
  const subjectOptions = useMemo(() => {
    const filtered = subjectCatalog.filter((item) => !filters.classLevel || item.classLevel === filters.classLevel);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    filtered.forEach((item) => {
      const title = item.title.trim();
      if (!title) return;
      if (!byTitle.has(title)) {
        byTitle.set(title, { coverImage: item.coverImage, iconUrl: item.iconImage, iconBgColor: item.iconBgColor });
      }
    });
    if (filters.subject && !byTitle.has(filters.subject)) byTitle.set(filters.subject, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [filters.classLevel, filters.subject, subjectCatalog]);

  const hasFilters = !!(filters.classLevel || filters.subject || filters.category || filters.search);

  return (
    <View style={q.root}>
      {/* Header */}
      <View style={q.pageHeader}>
        <View>
          <Text style={q.pageTitle}>Questions</Text>
          <Text style={q.pageSub}>{questions.length} question{questions.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={q.createBtn} onPress={onOpenCreate}>
          <Text style={q.createBtnText}>+ New Question</Text>
        </Pressable>
      </View>

      {/* Toast */}
      {message && (
        <View style={[q.toast, message.type === 'success' ? q.toastSuccess : q.toastError]}>
          <Text style={[q.toastText, message.type === 'success' ? q.toastSuccessText : q.toastErrorText]}>{message.text}</Text>
        </View>
      )}

      {/* ── Filters ─── */}
      <View style={q.filterSection}>
        <View style={q.filterLabelRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Filter size={12} color="#9A9AB0" />
            <Text style={q.filterLabel}>Filters</Text>
          </View>
          {hasFilters && (
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => { onFiltersChange({ classLevel: '', subject: '', category: '', search: '' }); onApplyFilters(); setPage(0); }}>
              <X size={11} color="#DC2626" />
              <Text style={q.clearAllText}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {/* Search bar */}
        <View style={q.searchRow}>
          <Search size={14} color="#9A9AB0" />
          <TextInput
            value={filters.search}
            onChangeText={(v) => onFiltersChange({ search: v })}
            onSubmitEditing={() => { onApplyFilters(); setPage(0); }}
            returnKeyType="search"
            placeholder="Search questions..."
            placeholderTextColor="#A0A8C0"
            style={q.searchInput}
          />
          {filters.search !== '' && (
            <Pressable onPress={() => { onFiltersChange({ search: '' }); onApplyFilters(); setPage(0); }}>
              <X size={14} color="#9A9AB0" />
            </Pressable>
          )}
        </View>

        {/* Class + Subject chips — single scrollable row, no wrapping */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.filterChipRow}>
          <Pressable
            style={[q.chip, !!filters.classLevel && q.chipActive]}
            onPress={() => setClassOpen(true)}
          >
            <Text style={[q.chipText, !!filters.classLevel && q.chipTextActive]}>
              {filters.classLevel ? getStandardLabel(filters.classLevel) : 'All Classes'}
            </Text>
          </Pressable>
          <Pressable
            style={[q.chip, !!filters.subject && q.chipActive]}
            onPress={() => setSubjectOpen(true)}
          >
            <Text style={[q.chipText, !!filters.subject && q.chipTextActive]}>
              {filters.subject || 'All Subjects'}
            </Text>
          </Pressable>
          <Pressable style={q.applyBtn} onPress={onApplyFilters} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={q.applyBtnText}>Apply</Text>}
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Question type chips ── */}
      <View style={q.typeSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Search size={12} color="#9A9AB0" />
          <Text style={q.filterLabel}>Question Type</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.filterChipRow}>
          {Object.entries(QTYPE_CONFIG).map(([key, cfg]) => {
            const active = filters.category === key;
            return (
              <Pressable
                key={key}
                style={[q.typeChip, active && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                onPress={() => { onFiltersChange({ category: active ? '' : key }); setPage(0); }}
              >
                <cfg.Icon size={13} color={active ? cfg.color : '#9A9AB0'} />
                <Text style={[q.typeChipText, active && { color: cfg.color, fontWeight: '800' }]}>{cfg.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {(() => {
        const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
        const pagedQuestions = questions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return (
          <ScrollView contentContainerStyle={q.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={q.emptyWrap}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={q.loadingText}>Loading questions…</Text>
              </View>
            ) : questions.length === 0 ? (
              <View style={q.emptyWrap}>
                <HelpCircle size={48} color="#D0D8F0" />
                <Text style={q.emptyTitle}>No questions found</Text>
                <Text style={q.emptySub}>Create your first question or adjust filters.</Text>
                <Pressable style={q.emptyBtn} onPress={onOpenCreate}>
                  <Text style={q.emptyBtnText}>Create Question</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {pagedQuestions.map((question, idx) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    idx={page * PAGE_SIZE + idx}
                    onAction={async (action) => {
                      if (action === 'view') {
                        openDetails(question);
                      } else if (action === 'edit') {
                        setFetchingDetails(true);
                        try {
                          const res = await apiFetch(`/questions/${question.id}`);
                          if (res.ok) {
                            const payload = await res.json();
                            onQuestionAction(payload.question, 'edit');
                          } else {
                            onQuestionAction(question, 'edit');
                          }
                        } catch {
                          onQuestionAction(question, 'edit');
                        } finally {
                          setFetchingDetails(false);
                        }
                      } else {
                        onQuestionAction(question, action);
                      }
                    }}
                  />
                ))}
                {questions.length > PAGE_SIZE && (
                  <View style={q.paginationBar}>
                    <Pressable
                      style={[q.pageBtn, page === 0 && q.pageBtnDisabled]}
                      onPress={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft size={15} color={page === 0 ? '#C0C8D8' : '#4A90E2'} />
                      <Text style={[q.pageBtnText, page === 0 && q.pageBtnTextDisabled]}>Prev</Text>
                    </Pressable>
                    <Text style={q.pageIndicator}>Page {page + 1} / {totalPages}</Text>
                    <Pressable
                      style={[q.pageBtn, page >= totalPages - 1 && q.pageBtnDisabled]}
                      onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <Text style={[q.pageBtnText, page >= totalPages - 1 && q.pageBtnTextDisabled]}>Next</Text>
                      <ChevronRight size={15} color={page >= totalPages - 1 ? '#C0C8D8' : '#4A90E2'} />
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        );
      })()}

      {/* Selector modals */}
      <SelectorModal visible={classOpen}   title="Select Class"   options={classOptions}   selected={filters.classLevel} isSubject={false} anyLabel="All Classes"   onSelect={(v) => { onFiltersChange({ classLevel: v, subject: '' }); setPage(0); }} onClose={() => setClassOpen(false)} />
      <SelectorModal visible={subjectOpen} title="Select Subject" options={subjectOptions} selected={filters.subject}     isSubject={true}  anyLabel="All Subjects" onSelect={(v) => { onFiltersChange({ subject: v }); setPage(0); }}   onClose={() => setSubjectOpen(false)} />

      {/* Fetching details overlay */}
      {fetchingDetails && (
        <View style={q.fetchingOverlay}>
          <View style={q.fetchingCard}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={q.fetchingText}>Loading question…</Text>
          </View>
        </View>
      )}

      {/* Details modal (self-contained) */}
      <QuestionDetailsModal
        question={detailsQuestion}
        onClose={() => setDetailsQuestion(null)}
        onEdit={(item) => { setDetailsQuestion(null); onQuestionAction(item, 'edit'); }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const q = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  fetchingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  fetchingCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10 },
  fetchingText:    { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  list: { padding: 16, paddingBottom: 40 },

  pageHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  pageTitle:     { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  pageSub:       { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  createBtn:     { backgroundColor: '#4A90E2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  toast:            { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError:       { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#FF7043' },
  toastText:        { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText:   { color: '#B91C1C' },

  filterSection:   { paddingHorizontal: 16, marginBottom: 6 },
  filterLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  filterLabel:     { fontSize: 11, fontWeight: '800', color: '#9A9AB0', letterSpacing: 0.8, textTransform: 'uppercase' },
  clearAllText:    { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  filterChipRow:   { gap: 8, paddingBottom: 2 },

  typeSection:  { paddingHorizontal: 16, marginBottom: 10, gap: 8 },

  chip:           { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0F0F8' },
  chipActive:     { backgroundColor: '#D6EAFF' },
  chipText:       { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  chipTextActive: { color: '#1A4DA2', fontWeight: '700' },
  applyBtn:       { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#4A90E2' },
  applyBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },

  typeChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#F0F0F8', borderWidth: 1.5, borderColor: 'transparent' },
  typeChipText:  { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },

  cardChipRow:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  cardChipText2: { fontSize: 11, fontWeight: '700', color: '#5A7AB0' },

  searchRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchInput:         { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  paginationBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F4FF', marginTop: 4 },
  pageBtn:             { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EBF4FF' },
  pageBtnDisabled:     { backgroundColor: '#F4F5FF' },
  pageBtnText:         { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  pageBtnTextDisabled: { color: '#C0C8D8' },
  pageIndicator:       { fontSize: 12, fontWeight: '700', color: '#5A6A8A' },



  emptyWrap:   { alignItems: 'center', paddingVertical: 60, gap: 8 },
  loadingText: { fontSize: 13, color: '#9A9AB0', fontWeight: '500' },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 8, backgroundColor: '#4A90E2', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14 },

  card:         { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 10 },
  artBox:       { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  cardInfo:     { flex: 1, gap: 3 },
  cardTitle:    { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  cardMeta:     { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  cardTagRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  typeTag:      { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typeTagText:  { fontSize: 10, fontWeight: '800' },
  cardChip:     { fontSize: 11, fontWeight: '700', color: '#5A7AB0' },
  quizTag:      { fontSize: 11, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  cardFooter:   { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  footerBtn:    { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  footerBtnText:{ fontSize: 11, fontWeight: '800' },



  // Full-screen details modal
  modalScreen:    { flex: 1, backgroundColor: '#F5F7FF' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalBack:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  modalTitle:     { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  modalEditBtn:   { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalEditText:  { color: '#fff', fontWeight: '800', fontSize: 13 },

  hero:         { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, borderRadius: 20, padding: 20 },
  heroIconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  heroInfo:     { flex: 1, gap: 8 },
  heroBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroBadge:    { backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  heroBadgeText:{ fontSize: 11, fontWeight: '700', color: '#5A6A8A' },
  heroTitle:    { fontSize: 17, fontWeight: '900', color: '#1a1a2e', lineHeight: 24 },

  statsRow:  { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  statCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statVal:   { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },

  detailSection:      { marginHorizontal: 16, marginBottom: 16 },
  detailSectionTitle: { fontSize: 14, fontWeight: '900', color: '#1a1a2e', marginBottom: 10 },

  infoBlock:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  infoBlockText: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', lineHeight: 22 },
  infoBlockMeta: { fontSize: 12, color: '#9A9AB0', marginTop: 4 },


  previewImage: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#F0F0F8' },
  jigsawCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  jigsawMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  jigsawMetaChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E0F2FE' },
  jigsawMetaChipText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },

  optionRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  optionRowCorrect: { borderWidth: 2, borderColor: '#7DC67A', backgroundColor: '#F2FDF2' },
  optionDot:        { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  optionDotText:    { fontSize: 12, fontWeight: '800', color: '#9A9AB0' },
  optionText:       { fontSize: 14, fontWeight: '600', color: '#1a1a2e', lineHeight: 21 },
  optionTextCorrect:{ fontWeight: '800', color: '#1a6b1a' },
  optionThumb:      { width: '100%', height: 120, borderRadius: 10, marginTop: 4 },
  optionMeta:       { fontSize: 11, color: '#9A9AB0' },
  correctBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7DC67A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 1 },
  correctBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  tfChip:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0F0F8', borderRadius: 14, paddingVertical: 14, borderWidth: 2, borderColor: 'transparent' },
  tfChipCorrect: { backgroundColor: '#7DC67A', borderColor: '#5AB55A' },
  tfChipText:    { fontSize: 15, fontWeight: '700', color: '#9A9AB0' },
  tfChipTextCorrect: { color: '#fff', fontWeight: '900' },

  pairRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, gap: 6 },
  pairCell:     { flex: 1, alignItems: 'center', gap: 4 },
  pairText:     { fontSize: 13, fontWeight: '600', color: '#1a1a2e', textAlign: 'center' },
  pairTextMuted:{ fontSize: 13, color: '#9A9AB0', textAlign: 'center' },
  pairThumb:    { width: '100%', height: 80, borderRadius: 8 },
  pairArrowWrap:{ width: 28, alignItems: 'center' },
});

const mmDet = StyleSheet.create({
  pairCard: { backgroundColor: '#F8F9FF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8FF', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 5 },
});
