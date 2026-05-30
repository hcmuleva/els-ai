import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, HelpCircle, Trophy } from 'lucide-react-native';

import QuestionEditor, { SubjectCatalogItem } from './QuestionEditor';
import QuizForm, { CreatedQuizSummary } from './QuizForm';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;
type Tab = 'quiz' | 'question';

export type CreateQuizModalProps = {
  visible: boolean;
  apiFetch: ApiFetch;
  initialClassLevel?: string;
  initialSubject?: string;
  /** Optional subject catalog forwarded to inline question creation. */
  subjectCatalog?: SubjectCatalogItem[];
  onClose: () => void;
  /** Fired when the user finishes creating a quiz. The parent can attach it. */
  onCreated?: (quiz: CreatedQuizSummary) => void;
  title?: string;
};

export default function CreateQuizModal({
  visible,
  apiFetch,
  initialClassLevel,
  initialSubject,
  subjectCatalog,
  onClose,
  onCreated,
  title = 'Create Quiz',
}: CreateQuizModalProps) {
  const [tab, setTab] = useState<Tab>('quiz');
  const [extraSelectedIds, setExtraSelectedIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTab('quiz');
      setExtraSelectedIds([]);
      setRefreshKey(0);
      setToast(null);
    }
  }, [visible]);

  const handleQuestionSaved = (q: { id: string }) => {
    if (q.id) {
      setExtraSelectedIds((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));
    }
    setRefreshKey((k) => k + 1);
    setToast('Question created and selected. Switch to Create Quiz to publish.');
    setTab('quiz');
    setTimeout(() => setToast(null), 3500);
  };

  const handleQuizCreated = (summary: CreatedQuizSummary) => {
    onCreated?.(summary);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={onClose} style={s.backBtn}>
            <ChevronLeft size={24} color="#1a1a2e" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{title}</Text>
            <Text style={s.headerSub}>Build a quiz or add a fresh question to your bank</Text>
          </View>
        </View>

        <View style={s.tabBar}>
          <Pressable
            style={[s.tab, tab === 'quiz' && s.tabActive]}
            onPress={() => setTab('quiz')}
          >
            <Trophy size={14} color={tab === 'quiz' ? '#4A90E2' : '#9A9AB0'} />
            <Text style={[s.tabText, tab === 'quiz' && s.tabTextActive]}>Create Quiz</Text>
          </Pressable>
          <Pressable
            style={[s.tab, tab === 'question' && s.tabActive]}
            onPress={() => setTab('question')}
          >
            <HelpCircle size={14} color={tab === 'question' ? '#4A90E2' : '#9A9AB0'} />
            <Text style={[s.tabText, tab === 'question' && s.tabTextActive]}>Create Question</Text>
          </Pressable>
        </View>

        {toast && (
          <View style={s.toast}>
            <Text style={s.toastText}>{toast}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {tab === 'quiz' ? (
            <QuizForm
              apiFetch={apiFetch}
              initialClassLevel={initialClassLevel}
              initialSubject={initialSubject}
              extraSelectedIds={extraSelectedIds}
              refreshKey={refreshKey}
              onCreated={handleQuizCreated}
              embedded
            />
          ) : (
            <QuestionEditor
              apiFetch={apiFetch}
              mode="create"
              subjectCatalog={subjectCatalog}
              defaultClassLevel={initialClassLevel}
              defaultSubject={initialSubject}
              onSaved={handleQuestionSaved}
              onClose={() => setTab('quiz')}
              embedded
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#ECEEF4',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  headerSub: { fontSize: 11, color: '#9A9AB0', fontWeight: '600', marginTop: 1 },

  tabBar: {
    flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#ECEEF4',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E4F0', backgroundColor: '#F8F9FF',
  },
  tabActive: { backgroundColor: '#EBF4FF', borderColor: '#93c5fd' },
  tabText: { fontSize: 13, fontWeight: '800', color: '#9A9AB0' },
  tabTextActive: { color: '#4A90E2' },

  toast: {
    margin: 12, padding: 12, borderRadius: 10,
    backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC',
  },
  toastText: { color: '#166534', fontWeight: '700', fontSize: 12 },
});
