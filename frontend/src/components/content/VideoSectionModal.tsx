import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { X, Play, Minus, Plus } from 'lucide-react-native';
import type { AgeGroup, Difficulty, VideoSection } from '../../types/videoContent';
import { formatTime, parseTime } from '../../utils/timeUtils';
import { validateSection } from '../../utils/sectionValidation';
import type { CreateSectionInput } from '../../api/videoSections';
import SectionValidationMessage from './SectionValidationMessage';
import VideoRangeSlider from './VideoRangeSlider';
import SectionPreviewPlayer, { type SectionPreviewHandle } from '../player/SectionPreviewPlayer';

interface Props {
  visible: boolean;
  editingSection?: VideoSection | null;
  existingSections: VideoSection[];
  videoUrl: string;
  videoDuration?: number | null;
  onSave: (input: CreateSectionInput, sectionId?: string) => Promise<void>;
  onClose: () => void;
}

const AGE_GROUPS: AgeGroup[] = ['5-10', '11-14', '15-18'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export default function VideoSectionModal({
  visible,
  editingSection,
  existingSections,
  videoUrl,
  videoDuration,
  onSave,
  onClose,
}: Props) {
  const previewRef = useRef<SectionPreviewHandle>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [startText, setStartText] = useState('0:00');
  const [endText, setEndText] = useState('0:00');
  const startFocused = useRef(false);
  const endFocused = useRef(false);
  const [duration, setDuration] = useState(0);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [learningObjective, setLearningObjective] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | undefined>();
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDuration(videoDuration || 0);
    setPlayhead(null);
    if (editingSection) {
      setTitle(editingSection.title);
      setDescription(editingSection.description || '');
      setStart(editingSection.startTime);
      setEnd(editingSection.endTime);
      setLearningObjective(editingSection.learningObjective || '');
      setAgeGroup(editingSection.ageGroup);
      setCategory(editingSection.category || '');
      setDifficulty(editingSection.difficulty);
    } else {
      setTitle('');
      setDescription('');
      setStart(0);
      setEnd(videoDuration ? Math.min(videoDuration, 60) : 0);
      setLearningObjective('');
      setAgeGroup(undefined);
      setCategory('');
      setDifficulty(undefined);
    }
    setServerError(null);
  }, [visible, editingSection, videoDuration]);

  const handleReady = (dur: number) => {
    if (dur > 0) setDuration(dur);
    // Give a brand-new section a sensible default end once we know the length.
    if (!editingSection) setEnd((prev) => (prev <= 0 ? Math.min(dur, 60) : prev));
  };

  const validation = useMemo(
    () =>
      validateSection({
        startTime: start,
        endTime: end,
        videoDuration: duration || videoDuration,
        existing: existingSections,
        ignoreId: editingSection?.id,
      }),
    [start, end, duration, videoDuration, existingSections, editingSection],
  );

  const canSave = title.trim().length > 0 && validation.isValid && end > start && !saving;

  useEffect(() => {
    if (!startFocused.current) setStartText(formatTime(start));
  }, [start]);
  useEffect(() => {
    if (!endFocused.current) setEndText(formatTime(end));
  }, [end]);

  const nudge = (which: 'start' | 'end', delta: number) => {
    if (which === 'start') {
      const next = Math.max(0, Math.min(start + delta, end - 1));
      setStart(next);
      previewRef.current?.seekTo(next, false);
      setPlayhead(next);
    } else {
      const cap = duration > 0 ? duration : end + delta;
      const next = Math.min(cap, Math.max(end + delta, start + 1));
      setEnd(next);
      previewRef.current?.seekTo(next, false);
      setPlayhead(next);
    }
  };

  const commitStart = () => {
    const parsed = parseTime(startText);
    if (parsed == null) {
      setStartText(formatTime(start));
      return;
    }
    const next = Math.max(0, Math.min(parsed, Math.max(0, end - 1)));
    setStart(next);
    previewRef.current?.seekTo(next, false);
    setPlayhead(next);
  };

  const commitEnd = () => {
    const parsed = parseTime(endText);
    if (parsed == null) {
      setEndText(formatTime(end));
      return;
    }
    const cap = duration > 0 ? duration : parsed;
    const next = Math.min(cap, Math.max(parsed, start + 1));
    setEnd(next);
    previewRef.current?.seekTo(next, false);
    setPlayhead(next);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setServerError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          startTime: start,
          endTime: end,
          learningObjective: learningObjective.trim() || undefined,
          ageGroup,
          category: category.trim() || undefined,
          difficulty,
        },
        editingSection?.id,
      );
      onClose();
    } catch (e: any) {
      setServerError(e?.message || 'Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{editingSection ? 'Edit video section' : 'Add video section'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color="#5A5A7A" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {videoUrl ? (
              <View style={styles.previewBlock}>
                <SectionPreviewPlayer
                  ref={previewRef}
                  videoUrl={videoUrl}
                  onReady={handleReady}
                  onTick={(t) => setPlayhead(t)}
                />

                {duration > 0 ? (
                  <VideoRangeSlider
                    duration={duration}
                    start={start}
                    end={end}
                    playhead={playhead}
                    onChange={(s, e) => {
                      setStart(s);
                      setEnd(e);
                    }}
                    onScrub={(time) => {
                      setPlayhead(time);
                      previewRef.current?.seekTo(time, false);
                    }}
                  />
                ) : (
                  <Text style={styles.hint}>Loading video timeline…</Text>
                )}

                <View style={styles.controlsRow}>
                  <View style={styles.nudgeGroup}>
                    <Text style={styles.nudgeLabel}>Start</Text>
                    <Pressable style={styles.nudgeBtn} onPress={() => nudge('start', -1)}><Minus size={14} color="#2D5DC9" /></Pressable>
                    <TextInput
                      style={styles.timeInput}
                      value={startText}
                      onChangeText={setStartText}
                      onFocus={() => { startFocused.current = true; }}
                      onBlur={() => { startFocused.current = false; commitStart(); }}
                      onSubmitEditing={commitStart}
                      keyboardType="numbers-and-punctuation"
                      placeholder="0:00"
                      placeholderTextColor="#525C6B"
                      selectTextOnFocus
                      returnKeyType="done"
                    />
                    <Pressable style={styles.nudgeBtn} onPress={() => nudge('start', 1)}><Plus size={14} color="#2D5DC9" /></Pressable>
                  </View>
                  <View style={styles.nudgeGroup}>
                    <Text style={styles.nudgeLabel}>End</Text>
                    <Pressable style={styles.nudgeBtn} onPress={() => nudge('end', -1)}><Minus size={14} color="#2D5DC9" /></Pressable>
                    <TextInput
                      style={styles.timeInput}
                      value={endText}
                      onChangeText={setEndText}
                      onFocus={() => { endFocused.current = true; }}
                      onBlur={() => { endFocused.current = false; commitEnd(); }}
                      onSubmitEditing={commitEnd}
                      keyboardType="numbers-and-punctuation"
                      placeholder="0:00"
                      placeholderTextColor="#525C6B"
                      selectTextOnFocus
                      returnKeyType="done"
                    />
                    <Pressable style={styles.nudgeBtn} onPress={() => nudge('end', 1)}><Plus size={14} color="#2D5DC9" /></Pressable>
                  </View>
                </View>

                <Pressable
                  style={[styles.playBtn, end <= start && styles.disabled]}
                  onPress={() => previewRef.current?.playSegment(start, end)}
                  disabled={end <= start}
                >
                  <Play size={16} color="#FFFFFF" />
                  <Text style={styles.playBtnText}>Play segment ({formatTime(Math.max(0, end - start))})</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.hint}>Add a video URL to the content section first.</Text>
            )}

            {!validation.isValid ? (
              <SectionValidationMessage message={validation.reason} valid={false} />
            ) : (
              <SectionValidationMessage message={`Segment length: ${formatTime(Math.max(0, end - start))}`} valid />
            )}

            <Field label="Section title *">
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Introduction to Water Cycle" placeholderTextColor="#525C6B" />
            </Field>

            <Field label="Description">
              <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Optional description" placeholderTextColor="#525C6B" multiline />
            </Field>

            <Field label="Learning objective">
              <TextInput style={[styles.input, styles.multiline]} value={learningObjective} onChangeText={setLearningObjective} placeholder="What should the student learn?" placeholderTextColor="#525C6B" multiline />
            </Field>

            <Field label="Age group">
              <View style={styles.pillRow}>
                {AGE_GROUPS.map((g) => (
                  <Pill key={g} label={g} active={ageGroup === g} onPress={() => setAgeGroup(ageGroup === g ? undefined : g)} />
                ))}
              </View>
            </Field>

            <Field label="Difficulty">
              <View style={styles.pillRow}>
                {DIFFICULTIES.map((d) => (
                  <Pill key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? undefined : d)} />
                ))}
              </View>
            </Field>

            <Field label="Category">
              <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Science" placeholderTextColor="#525C6B" />
            </Field>

            {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={[styles.btn, styles.secondary]} onPress={onClose}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.primary, !canSave && styles.disabled]} onPress={handleSave} disabled={!canSave}>
              <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save Section'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,20,40,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#2A2A44' },
  field: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#5A5A7A', marginBottom: 6 },
  input: { backgroundColor: '#F5F6FB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#2A2A44', borderWidth: 1, borderColor: '#ECECF4' },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#525C6B', marginTop: 6 },
  previewBlock: { gap: 10, marginBottom: 4 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  nudgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  nudgeLabel: { fontSize: 12, fontWeight: '700', color: '#5A5A7A', width: 34 },
  nudgeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#E9F1FE', alignItems: 'center', justifyContent: 'center' },
  timeInput: { flex: 1, minWidth: 56, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#2A2A44', backgroundColor: '#F5F6FB', borderRadius: 8, borderWidth: 1, borderColor: '#ECECF4', paddingVertical: 6, paddingHorizontal: 4 },
  playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2FA36B', borderRadius: 10, paddingVertical: 11 },
  playBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4FA', borderWidth: 1, borderColor: '#ECECF4' },
  pillActive: { backgroundColor: '#2D5DC9', borderColor: '#2D5DC9' },
  pillText: { fontSize: 13, color: '#5A5A7A', textTransform: 'capitalize' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#D64545', fontSize: 13, marginTop: 12 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13 },
  primary: { backgroundColor: '#2D5DC9' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondary: { backgroundColor: '#F0F0F8' },
  secondaryText: { color: '#5A5A7A', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
