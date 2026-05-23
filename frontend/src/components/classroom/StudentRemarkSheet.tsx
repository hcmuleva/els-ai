/**
 * StudentRemarkSheet — bottom-sheet for teacher feedback per student.
 * Sections: Evaluation Scores · Remark + Media (visible to parents) · Achievements
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

export type Achievement = {
  id: string; name: string; emoji: string; color: string; description?: string; count?: number;
};

export type StudentRemarkData = {
  studentId: string;
  name: string;
  email?: string;
  remarkText?: string;
  parentNote?: string;
  remarkMediaUrl?: string;
  scoreBehavior?: number;
  scoreConfidence?: number;
  scoreParticipation?: number;
  scorePerformance?: number;
  achievements?: Achievement[];
};

type SavePayload = {
  remarkText: string; parentNote: string; remarkMediaUrl: string;
  scoreBehavior: number; scoreConfidence: number;
  scoreParticipation: number; scorePerformance: number;
};

type Props = {
  visible: boolean;
  student: StudentRemarkData | null;
  classroomId: string;
  achievements: Achievement[];
  onClose: () => void;
  onSave: (studentId: string, data: SavePayload) => Promise<void>;
  onGrantAchievement: (studentId: string, achievementId: string) => Promise<void>;
  onUploadMedia: () => Promise<{ url: string }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const SCORE_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
const SCORE_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981'];

function avg(...vals: (number | undefined)[]) {
  const filled = vals.filter((v): v is number => !!v);
  return filled.length ? filled.reduce((s, v) => s + v, 0) / filled.length : 0;
}

// ── Star rating row ───────────────────────────────────────────────────────────
function ScoreRow({ label, emoji, value, onChange }: {
  label: string; emoji: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <View style={sh.scoreRow}>
      <View style={sh.scoreLeft}>
        <Text style={sh.scoreEmoji}>{emoji}</Text>
        <Text style={sh.scoreLabel}>{label}</Text>
      </View>
      <View style={sh.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
            <Text style={[sh.star, n <= value && { color: SCORE_COLORS[value] }]}>
              {n <= value ? '★' : '☆'}
            </Text>
          </Pressable>
        ))}
      </View>
      {value > 0 ? (
        <View style={[sh.scorePill, { backgroundColor: `${SCORE_COLORS[value]}18` }]}>
          <Text style={[sh.scorePillText, { color: SCORE_COLORS[value] }]}>{SCORE_LABELS[value]}</Text>
        </View>
      ) : <View style={{ width: 72 }} />}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StudentRemarkSheet({
  visible, student, classroomId, achievements,
  onClose, onSave, onGrantAchievement, onUploadMedia,
}: Props) {
  const [remarkText, setRemarkText]   = useState('');
  const [parentNote, setParentNote]   = useState('');
  const [mediaUrl, setMediaUrl]       = useState('');
  const [scoreBehavior, setSB]        = useState(0);
  const [scoreConfidence, setSC]      = useState(0);
  const [scoreParticipation, setSP]   = useState(0);
  const [scorePerformance, setSPerf]  = useState(0);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [grantingId, setGrantingId]   = useState<string | null>(null);
  const [grantedIds, setGrantedIds]   = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<'scores' | 'remark' | 'achievements'>('scores');
  const [toast, setToast]             = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !student) return;
    setRemarkText(student.remarkText ?? '');
    setParentNote(student.parentNote ?? '');
    setMediaUrl(student.remarkMediaUrl ?? '');
    setSB(student.scoreBehavior ?? 0);
    setSC(student.scoreConfidence ?? 0);
    setSP(student.scoreParticipation ?? 0);
    setSPerf(student.scorePerformance ?? 0);
    setGrantedIds(new Set((student.achievements ?? []).map((a) => a.id)));
    setActiveSection('scores');
    setToast(null);
  }, [visible, student?.studentId]);

  const overallAvg = avg(scoreBehavior || undefined, scoreConfidence || undefined, scoreParticipation || undefined, scorePerformance || undefined);
  const overallColor = overallAvg >= 4.5 ? '#10B981' : overallAvg >= 3.5 ? '#22C55E' : overallAvg >= 2.5 ? '#F59E0B' : overallAvg >= 1 ? '#F97316' : '#9A9AB0';
  const grantedSummary = Object.values(
    (student?.achievements ?? []).reduce((acc, a) => {
      if (!acc[a.id]) acc[a.id] = { ...a, count: 0 };
      acc[a.id].count = (acc[a.id].count ?? 0) + (a.count ?? 1);
      return acc;
    }, {} as Record<string, Achievement>),
  );

  const handleUpload = async () => {
    setUploading(true);
    try {
      const { url } = await onUploadMedia();
      setMediaUrl(url);
    } catch { setToast('Upload failed. Try again.'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await onSave(student.studentId, {
        remarkText, parentNote, remarkMediaUrl: mediaUrl,
        scoreBehavior, scoreConfidence, scoreParticipation, scorePerformance,
      });
      setToast(null);
      onClose();
    } catch { setToast('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const handleGrant = async (achievementId: string) => {
    if (!student) return;
    setGrantingId(achievementId);
    try {
      await onGrantAchievement(student.studentId, achievementId);
      setGrantedIds((p) => new Set([...p, achievementId]));
    } catch { setToast('Failed to grant achievement.'); }
    finally { setGrantingId(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sh.overlay}>
        <Pressable style={sh.overlayDismiss} onPress={onClose} />
        <View style={sh.sheet}>
          {/* Drag handle */}
          <View style={sh.handle} />

          {/* ── Student header ── */}
          <View style={sh.studentBar}>
            <View style={[sh.avatar, { backgroundColor: student ? `#${((student.name.charCodeAt(0) * 1234567) % 0xffffff).toString(16).padStart(6, '0')}40` : '#D6EAFF' }]}>
              <Text style={sh.avatarText}>{(student?.name ?? '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sh.studentName}>{student?.name ?? ''}</Text>
              {overallAvg > 0 && (
                <View style={sh.overallRow}>
                  <Text style={[sh.overallScore, { color: overallColor }]}>{overallAvg.toFixed(1)}</Text>
                  <Text style={sh.overallLabel}> / 5 overall</Text>
                </View>
              )}
            </View>
            {student?.achievements && student.achievements.length > 0 && (
              <View style={sh.achievIconRow}>
                {student.achievements.slice(0, 3).map((a, i) => (
                  <Text key={i} style={{ fontSize: 18, marginLeft: -4 }}>{a.emoji}</Text>
                ))}
              </View>
            )}
            <Pressable onPress={onClose} style={sh.closeX}><Text style={sh.closeXText}>✕</Text></Pressable>
          </View>

          {/* ── Section tabs ── */}
          <View style={sh.sectionTabs}>
            {([
              ['scores',       '📊 Scores'],
              ['remark',       '💬 Remark'],
              ['achievements', '🏆 Awards'],
            ] as ['scores' | 'remark' | 'achievements', string][]).map(([key, label]) => (
              <Pressable key={key} style={[sh.sectionTab, activeSection === key && sh.sectionTabActive]}
                onPress={() => setActiveSection(key)}>
                <Text style={[sh.sectionTabText, activeSection === key && sh.sectionTabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── Toast ── */}
          {toast && (
            <View style={sh.toastBar}>
              <Text style={sh.toastText}>{toast}</Text>
              <Pressable onPress={() => setToast(null)}><Text style={sh.toastClose}>✕</Text></Pressable>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={sh.body} keyboardShouldPersistTaps="handled">

            {/* ══ SCORES ════════════════════════════════════════════════════ */}
            {activeSection === 'scores' && (
              <View style={sh.sectionContent}>
                <Text style={sh.sectionDesc}>Rate this student across 4 dimensions (1 = Poor · 5 = Excellent)</Text>

                {/* Overall gauge */}
                {overallAvg > 0 && (
                  <View style={[sh.gaugeCard, { borderColor: overallColor, backgroundColor: `${overallColor}0F` }]}>
                    <Text style={[sh.gaugeValue, { color: overallColor }]}>{overallAvg.toFixed(1)}</Text>
                    <View>
                      <Text style={[sh.gaugeLabel, { color: overallColor }]}>{SCORE_LABELS[Math.round(overallAvg)] || 'Rated'}</Text>
                      <Text style={sh.gaugeSubLabel}>Overall Score</Text>
                    </View>
                    <View style={sh.gaugeBarsRow}>
                      {[scoreBehavior, scoreConfidence, scoreParticipation, scorePerformance].map((v, i) => (
                        <View key={i} style={sh.gaugeBar}>
                          <View style={[sh.gaugeBarFill, { height: (v / 5) * 28, backgroundColor: overallColor }]} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={sh.scoresCard}>
                  <ScoreRow label="Behavior"      emoji="🤝" value={scoreBehavior}      onChange={setSB} />
                  <View style={sh.rowDivider} />
                  <ScoreRow label="Confidence"    emoji="💪" value={scoreConfidence}    onChange={setSC} />
                  <View style={sh.rowDivider} />
                  <ScoreRow label="Participation" emoji="🙋" value={scoreParticipation} onChange={setSP} />
                  <View style={sh.rowDivider} />
                  <ScoreRow label="Performance"   emoji="🎯" value={scorePerformance}   onChange={setSPerf} />
                </View>
              </View>
            )}

            {/* ══ REMARK ════════════════════════════════════════════════════ */}
            {activeSection === 'remark' && (
              <View style={sh.sectionContent}>
                {/* Teacher remark */}
                <View style={sh.fieldGroup}>
                  <Text style={sh.fieldLabel}>Teacher Remark</Text>
                  <Text style={sh.fieldHint}>Internal note about this student's session.</Text>
                  <TextInput
                    value={remarkText}
                    onChangeText={setRemarkText}
                    placeholder="e.g. Very attentive today, needs practice on fractions…"
                    multiline style={sh.textArea}
                    placeholderTextColor="#B0B8D0"
                    textAlignVertical="top"
                  />
                </View>

                {/* Parent note */}
                <View style={sh.fieldGroup}>
                  <View style={sh.fieldLabelRow}>
                    <Text style={sh.fieldLabel}>Note for Parents</Text>
                    <View style={sh.parentBadge}><Text style={sh.parentBadgeText}>👨‍👩‍👧 Visible to parents</Text></View>
                  </View>
                  <Text style={sh.fieldHint}>Parents will see this in their dashboard.</Text>
                  <TextInput
                    value={parentNote}
                    onChangeText={setParentNote}
                    placeholder="e.g. Please help your child practice reading at home…"
                    multiline style={sh.textArea}
                    placeholderTextColor="#B0B8D0"
                    textAlignVertical="top"
                  />
                </View>

                {/* Media attachment */}
                <View style={sh.fieldGroup}>
                  <View style={sh.fieldLabelRow}>
                    <Text style={sh.fieldLabel}>Attach Media</Text>
                    <View style={sh.parentBadge}><Text style={sh.parentBadgeText}>👨‍👩‍👧 Visible to parents</Text></View>
                  </View>
                  <Text style={sh.fieldHint}>Upload a photo of work, drawing, or certificate.</Text>

                  {mediaUrl ? (
                    <View style={sh.mediaPreview}>
                      <Image source={{ uri: mediaUrl }} style={sh.mediaImage} resizeMode="cover" />
                      <Pressable style={sh.mediaRemoveBtn} onPress={() => setMediaUrl('')}>
                        <Text style={sh.mediaRemoveText}>✕ Remove</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={sh.mediaBtnRow}>
                    <Pressable style={sh.uploadBtn} onPress={handleUpload} disabled={uploading}>
                      {uploading
                        ? <ActivityIndicator size="small" color="#4A90E2" />
                        : <Text style={sh.uploadBtnText}>⬆ Upload Image</Text>}
                    </Pressable>
                    <TextInput
                      value={mediaUrl}
                      onChangeText={setMediaUrl}
                      placeholder="Or paste URL…"
                      autoCapitalize="none"
                      style={sh.urlInput}
                      placeholderTextColor="#B0B8D0"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* ══ ACHIEVEMENTS ══════════════════════════════════════════════ */}
            {activeSection === 'achievements' && (
              <View style={sh.sectionContent}>
                <Text style={sh.sectionDesc}>Tap to award — can be given multiple times</Text>
                {achievements.length === 0 ? (
                  <View style={sh.emptyAchiev}>
                    <Text style={{ fontSize: 40 }}>🏆</Text>
                    <Text style={sh.emptyAchievText}>No achievements available</Text>
                  </View>
                ) : (
                  <View style={sh.achievGrid}>
                    {achievements.map((a) => {
                      const granted  = grantedIds.has(a.id);
                      const granting = grantingId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          style={[sh.achievCard, { borderColor: granted ? a.color : `${a.color}30`, backgroundColor: `${a.color}0D` }]}
                          onPress={() => handleGrant(a.id)}
                          disabled={granting}
                        >
                          <View style={sh.achievCardTop}>
                            {granting
                              ? <ActivityIndicator size="small" color={a.color} />
                              : <Text style={sh.achievEmoji}>{a.emoji}</Text>}
                            {granted && (
                              <View style={[sh.achievGrantedBadge, { backgroundColor: a.color }]}>
                                <Text style={sh.achievGrantedText}>✓</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[sh.achievName, { color: a.color }]}>{a.name}</Text>
                          {a.description ? <Text style={sh.achievDesc} numberOfLines={2}>{a.description}</Text> : null}
                          <View style={[sh.achievTapHint, { backgroundColor: `${a.color}18` }]}>
                            <Text style={[sh.achievTapText, { color: a.color }]}>
                              {granted ? 'Award again' : 'Tap to award'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Already granted list */}
                {grantedSummary.length > 0 && (
                  <View style={sh.grantedList}>
                    <Text style={sh.grantedListTitle}>Already awarded this session</Text>
                    {grantedSummary.map((a) => (
                      <View key={a.id} style={sh.grantedRow}>
                        <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
                        <Text style={[sh.grantedName, { color: a.color }]}>{a.name}</Text>
                        {(a.count ?? 1) > 1 && (
                          <View style={[sh.grantedCountPill, { backgroundColor: `${a.color}20` }]}>
                            <Text style={[sh.grantedCountText, { color: a.color }]}>x{a.count}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* ── Footer save ── */}
          <View style={sh.footer}>
            <Pressable style={sh.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={sh.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={sh.saveBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={sh.saveBtnText}>Save Feedback</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  overlayDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  handle:         { width: 44, height: 5, backgroundColor: '#E0E4F0', borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 2 },

  studentBar:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  avatar:        { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarText:    { fontSize: 19, fontWeight: '900', color: '#1a1a2e' },
  studentName:   { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  overallRow:    { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  overallScore:  { fontSize: 15, fontWeight: '900' },
  overallLabel:  { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  achievIconRow: { flexDirection: 'row', alignItems: 'center' },
  closeX:        { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  closeXText:    { fontSize: 13, color: '#9A9AB0', fontWeight: '700' },

  sectionTabs:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F8', paddingHorizontal: 6 },
  sectionTab:        { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sectionTabActive:  { borderBottomColor: '#4A90E2' },
  sectionTabText:    { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  sectionTabTextActive: { color: '#4A90E2', fontWeight: '800' },

  toastBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFE8E8', margin: 12, borderRadius: 10, padding: 10, gap: 8 },
  toastText:  { flex: 1, fontSize: 13, color: '#B91C1C', fontWeight: '600' },
  toastClose: { fontSize: 14, color: '#B91C1C', fontWeight: '700' },

  body:           { paddingHorizontal: 0 },
  sectionContent: { padding: 16, gap: 14 },
  sectionDesc:    { fontSize: 12, color: '#9A9AB0', fontWeight: '500', lineHeight: 18 },

  // Scores
  gaugeCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 14 },
  gaugeValue:   { fontSize: 32, fontWeight: '900' },
  gaugeLabel:   { fontSize: 14, fontWeight: '800' },
  gaugeSubLabel:{ fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  gaugeBarsRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 4, height: 32 },
  gaugeBar:     { width: 12, height: 32, backgroundColor: '#F0F0F8', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  gaugeBarFill: { width: '100%', borderRadius: 4 },

  scoresCard: { backgroundColor: '#F8F9FF', borderRadius: 18, overflow: 'hidden' },
  scoreRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  scoreLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, width: 120 },
  scoreEmoji: { fontSize: 18 },
  scoreLabel: { fontSize: 13, fontWeight: '700', color: '#3D4860' },
  starsRow:   { flexDirection: 'row', gap: 6 },
  star:       { fontSize: 23, color: '#DDE1EE' },
  scorePill:  { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, minWidth: 72, alignItems: 'center' },
  scorePillText: { fontSize: 11, fontWeight: '800' },
  rowDivider: { height: 1, backgroundColor: '#ECEEF6', marginHorizontal: 16 },

  // Remark fields
  fieldGroup:    { backgroundColor: '#F8F9FF', borderRadius: 16, padding: 14, gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel:    { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  fieldHint:     { fontSize: 11, color: '#9A9AB0', lineHeight: 17 },
  parentBadge:   { borderRadius: 999, backgroundColor: '#D6EAFF', paddingHorizontal: 8, paddingVertical: 3 },
  parentBadgeText:{ fontSize: 10, fontWeight: '700', color: '#1A4DA2' },
  textArea:      { backgroundColor: '#fff', borderRadius: 12, padding: 12, minHeight: 88, fontSize: 14, color: '#1a1a2e', lineHeight: 22, borderWidth: 1, borderColor: '#E0E4F0', marginTop: 4 },

  mediaPreview:   { borderRadius: 14, overflow: 'hidden', marginBottom: 6, position: 'relative' },
  mediaImage:     { width: '100%', height: 160, backgroundColor: '#F0F0F8' },
  mediaRemoveBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  mediaRemoveText:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  mediaBtnRow:    { flexDirection: 'row', gap: 8, alignItems: 'center' },
  uploadBtn:      { borderRadius: 12, backgroundColor: '#EBF4FF', paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#D6EAFF', minWidth: 130, alignItems: 'center' },
  uploadBtnText:  { fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  urlInput:       { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: '#1a1a2e', borderWidth: 1, borderColor: '#E0E4F0' },

  // Achievements
  achievGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievCard:    { width: '47%', borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 6, position: 'relative' },
  achievCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  achievEmoji:   { fontSize: 32 },
  achievGrantedBadge:{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  achievGrantedText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  achievName:    { fontSize: 13, fontWeight: '900', lineHeight: 18 },
  achievDesc:    { fontSize: 10, color: '#9A9AB0', lineHeight: 14 },
  achievTapHint: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', marginTop: 4 },
  achievTapText: { fontSize: 11, fontWeight: '800' },

  emptyAchiev:     { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyAchievText: { fontSize: 14, fontWeight: '700', color: '#9A9AB0' },

  grantedList:      { marginTop: 8, backgroundColor: '#F8F9FF', borderRadius: 14, padding: 12, gap: 6 },
  grantedListTitle: { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  grantedRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grantedName:      { fontSize: 13, fontWeight: '700' },
  grantedCountPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  grantedCountText: { fontSize: 10, fontWeight: '800' },

  footer:      { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F8' },
  cancelBtn:   { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#D0D8F0', paddingVertical: 14, alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '700', color: '#9A9AB0' },
  saveBtn:     { flex: 2, borderRadius: 14, backgroundColor: '#4A90E2', paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
