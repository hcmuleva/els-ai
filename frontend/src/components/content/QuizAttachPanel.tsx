import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, X, CheckCircle2, ChevronDown, Plus } from 'lucide-react-native';
import SelectorModal, { type SelectorOption } from '../SelectorModal';
import { getStandardLabel } from '../../constants/standards';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

interface QuizLibraryItem {
  id: string;
  title: string;
  classLevel?: string;
  subject?: string;
  questionCount: number;
}

interface Props {
  visible: boolean;
  apiFetch: ApiFetch;
  classLevel?: string;
  subject?: string;
  currentQuizId?: string;
  onAttach: (quizId: string) => Promise<void> | void;
  onDetach?: () => Promise<void> | void;
  onCreateNew?: () => void;
  onClose: () => void;
}

// Lets a creator pick a quiz from the library to attach to a section. A quiz can
// be attached to multiple sections. Tapping the currently selected quiz
// unselects (detaches) it.
export default function QuizAttachPanel({
  visible,
  apiFetch,
  currentQuizId,
  onAttach,
  onDetach,
  onCreateNew,
  onClose,
}: Props) {
  const [library, setLibrary] = useState<QuizLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fClass, setFClass] = useState<string>('');
  const [fSubject, setFSubject] = useState<string>('');
  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default to showing every quiz on open so the list is never empty; the user
  // can narrow by class/subject to attach a quiz from any class or subject.
  useEffect(() => {
    if (!visible) return;
    setFClass('');
    setFSubject('');
    setSearch('');
  }, [visible]);

  // Load the whole library once; class/subject filtering happens client-side so
  // changing a filter never triggers an empty server response.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/quizzes/teacher/library?status=all&limit=500&offset=0`)
      .then((r) => (r.ok ? r.json() : { quizzes: [] }))
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.quizzes) ? d.quizzes : Array.isArray(d.items) ? d.items : [];
        setLibrary(
          rows.map((q: any) => ({
            id: q.id,
            title: q.title || 'Untitled',
            classLevel: q.class_level,
            subject: q.subject,
            questionCount: q.total_questions ?? q.questionCount ?? 0,
          })),
        );
      })
      .catch(() => !cancelled && setLibrary([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, apiFetch]);

  const classOptions = useMemo(
    () => (Array.from(new Set(library.map((q) => q.classLevel).filter(Boolean))) as string[]).sort(),
    [library],
  );
  const subjectOptions = useMemo(
    () => (Array.from(new Set(library.map((q) => q.subject).filter(Boolean))) as string[]).sort(),
    [library],
  );

  const classSelectorOptions: SelectorOption[] = useMemo(
    () => classOptions.map((cl) => ({ label: getStandardLabel(cl), value: cl })),
    [classOptions],
  );
  const subjectSelectorOptions: SelectorOption[] = useMemo(
    () => subjectOptions.map((sub) => ({ label: sub, value: sub })),
    [subjectOptions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.filter(
      (item) =>
        (!fClass || item.classLevel === fClass) &&
        (!fSubject || item.subject === fSubject) &&
        (!q || item.title.toLowerCase().includes(q)),
    );
  }, [library, search, fClass, fSubject]);

  const handleAttach = async (quizId: string) => {
    // Tapping the already-selected quiz unselects (detaches) it.
    if (quizId === currentQuizId) {
      if (!onDetach) { onClose(); return; }
      setAttachingId(quizId);
      setError(null);
      try {
        await onDetach();
        onClose();
      } catch (e: any) {
        setError(e?.message || 'Failed to remove quiz');
      } finally {
        setAttachingId(null);
      }
      return;
    }
    setAttachingId(quizId);
    setError(null);
    try {
      await onAttach(quizId);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to attach quiz');
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Attach quiz</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color="#5A5A7A" />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} color="#525C6B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search quizzes"
              placeholderTextColor="#525C6B"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.filtersRow}>
            <Pressable style={styles.selector} onPress={() => setClassOpen(true)}>
              <Text style={styles.selectorLabel}>Class</Text>
              <View style={styles.selectorValRow}>
                <Text style={[styles.selectorVal, !fClass && styles.selectorPlaceholder]} numberOfLines={1}>
                  {fClass ? getStandardLabel(fClass) : 'All'}
                </Text>
                <ChevronDown size={16} color="#B0B8D0" />
              </View>
            </Pressable>
            <Pressable style={styles.selector} onPress={() => setSubjectOpen(true)}>
              <Text style={styles.selectorLabel}>Subject</Text>
              <View style={styles.selectorValRow}>
                <Text style={[styles.selectorVal, !fSubject && styles.selectorPlaceholder]} numberOfLines={1}>
                  {fSubject || 'All'}
                </Text>
                <ChevronDown size={16} color="#B0B8D0" />
              </View>
            </Pressable>
          </View>

          {onCreateNew ? (
            <Pressable style={styles.createBtn} onPress={onCreateNew}>
              <Plus size={16} color="#2D5DC9" />
              <Text style={styles.createBtnText}>Create new quiz</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2D5DC9" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={{ marginTop: 8 }}
              ListEmptyComponent={<Text style={styles.empty}>No quizzes match. Try selecting "All" for class or subject.</Text>}
              renderItem={({ item }) => {
                const isCurrent = item.id === currentQuizId;
                return (
                  <Pressable
                    style={[styles.row, isCurrent && styles.rowCurrent]}
                    onPress={() => handleAttach(item.id)}
                    disabled={attachingId != null}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowMeta}>
                        {item.questionCount} question{item.questionCount === 1 ? '' : 's'}
                        {item.subject ? ` · ${item.subject}` : ''}
                      </Text>
                    </View>
                    {isCurrent ? <Text style={styles.unselectHint}>Tap to unselect</Text> : null}
                    {isCurrent ? <CheckCircle2 size={18} color="#2FA36B" /> : null}
                    {attachingId === item.id ? <ActivityIndicator color="#2D5DC9" /> : null}
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <SelectorModal
          visible={classOpen}
          title="Filter by Class"
          options={classSelectorOptions}
          selected={fClass}
          anyLabel="All classes"
          onSelect={setFClass}
          onClose={() => setClassOpen(false)}
        />
        <SelectorModal
          visible={subjectOpen}
          title="Filter by Subject"
          options={subjectSelectorOptions}
          selected={fSubject}
          isSubject
          anyLabel="All subjects"
          onSelect={setFSubject}
          onClose={() => setSubjectOpen(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,20,40,0.45)', justifyContent: 'flex-end' },
  filtersRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  selector: { flex: 1, backgroundColor: '#F3F4FA', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#ECECF4' },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: '#8A8AA0', marginBottom: 2 },
  selectorValRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  selectorVal: { flex: 1, fontSize: 14, color: '#2A2A44', fontWeight: '600' },
  selectorPlaceholder: { color: '#B0B8D0', fontWeight: '500' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#2A2A44' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4FA', borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#2A2A44' },
  error: { color: '#D64545', fontSize: 13, marginTop: 10 },
  empty: { textAlign: 'center', color: '#8A8AA0', marginTop: 24, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FBFBFD', marginBottom: 8, borderWidth: 1, borderColor: '#EEEFF4' },
  rowCurrent: { borderColor: '#2FA36B', backgroundColor: '#F0FBF5' },
  rowDisabled: { opacity: 0.55, backgroundColor: '#F5F5F8' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#2A2A44' },
  rowTitleDisabled: { color: '#525C6B' },
  rowMeta: { fontSize: 12, color: '#8A8AA0', marginTop: 2 },
  usedBadge: { fontSize: 11, fontWeight: '700', color: '#B0651A', backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  unselectHint: { fontSize: 11, fontWeight: '700', color: '#2FA36B', marginRight: 6 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#86BFFF', backgroundColor: '#EBF4FF', borderStyle: 'dashed' },
  createBtnText: { fontSize: 13, fontWeight: '800', color: '#2D5DC9' },
});
