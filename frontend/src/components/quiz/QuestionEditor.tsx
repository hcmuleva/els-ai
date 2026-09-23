/**
 * Reusable Question Editor.
 *
 * Owns all draft state and handlers for the Setup / Options / Preview tabs,
 * supporting all 10 question types (single_choice, multi_choice, true_false,
 * guess_image, guess_audio, drag_drop_match, logico, memory_match, fill_blank,
 * jigsaw). Used by:
 *   - frontend/src/components/quiz/CreateQuizModal.tsx
 *   - frontend/app/(tabs)/manage.tsx
 *
 * Props:
 *   - apiFetch: authenticated fetch wrapper
 *   - mode: 'create' | 'edit'
 *   - subjectCatalog: list of class+subject pairings used to derive subject options
 *   - editingQuestion: required when mode === 'edit'
 *   - quizId: optional — if set, the created/edited question is attached to that quiz
 *   - onSaved: called after a successful save with `{ id }` of the question
 *   - onClose: close handler (called from the back button)
 *   - defaultClassLevel/defaultSubject: pre-fill values for create mode
 *   - embedded: hide the page-level header when nested inside another full-screen modal
 *   - hideTypeSelector: hide the question-type chips in setup
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Maximize2, ZoomIn, X } from 'lucide-react-native';
import SelectorModal, { SelectorOption } from '../SelectorModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LatexText from '../common/LatexText';
import SafeImage from './SafeImage';
import MediaUploader from '../media/MediaUploader';
import LogicoButtonBadge from './LogicoButtonBadge';
import JigsawRenderer from './JigsawRenderer';
import SingleQuestionPlayer from './SingleQuestionPlayer';
import { API_BASE_URL } from '../../context/AuthContext';
import { AudioManager } from '../../utils/audio';
import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import { getAuthorizedClasses, getAuthorizedSubjects } from '../../utils/assignments';
import { AppUser } from '../../types/roles';
import { frameButtons } from '../../../app/modules/logicopiccolo/generated/buttons';
import {
  GRID_COLS,
  GRID_PAIR_COUNTS,
  MEMORY_ASSETS,
  MemoryAsset,
  pickRandomAssets,
} from '../../data/memoryAssets';

import {
  MatchPairDraft,
  MediaRemovalRequest,
  OptionDraft,
  OptionRemovalRequest,
  QTYPES_BG,
  QTYPES_COLOR,
  QTYPES_EMOJI,
  QUESTION_TYPE_CHOICES,
  QuestionDraft,
  QuestionItemForEdit,
  SupportedQuestionType,
} from './questionEditor.types';
import { uploadPickedFileToS3 } from '../../utils/fileUpload';
import {
  buildDraftPreviewPayload,
  draftToPayload,
  getDefaultInstructionByType,
  getQuestionEditorMode,
  getQuestionTypeLabel,
  hydrateDraftFromQuestion,
  makeDefaultOptionsByType,
  makeEmptyMatchPair,
  makeEmptyOption,
  makeInitialDraft,
  makeTrueFalseOptions,
  normalizeQuestionType,
  pickAudioAsDataUrl,
  pickImageOrVideoAsDataUrl,
  pickMediaAsDataUrl,
  resolveMediaUrl,
  resolvePickedMediaKind,
  toMediaLabel,
  QEApiFetch,
} from './questionEditor.helpers';
import { fbS, mmS, qFormS } from './questionEditor.styles';

export type SubjectCatalogItem = {
  title: string;
  classLevel: string;
  coverImage?: string;
  iconImage?: string;
  iconBgColor?: string;
};

export type QuestionEditorProps = {
  apiFetch: QEApiFetch;
  mode: 'create' | 'edit';
  subjectCatalog?: SubjectCatalogItem[];
  /** Required when mode === 'edit' */
  editingQuestion?: QuestionItemForEdit | null;
  /** When provided, newly-created questions are auto-attached to this quiz. */
  quizId?: string;
  onSaved?: (created: { id: string }) => void;
  onClose: () => void;
  defaultClassLevel?: string;
  defaultSubject?: string;
  embedded?: boolean;
  hideTypeSelector?: boolean;
  user: AppUser | null;
};

type SelectorField = 'classLevel' | 'subject' | null;

export default function QuestionEditor({
  apiFetch,
  mode,
  subjectCatalog = [],
  editingQuestion = null,
  quizId,
  onSaved,
  onClose,
  defaultClassLevel,
  defaultSubject,
  embedded = false,
  hideTypeSelector = false,
  user,
}: QuestionEditorProps) {
  const initialDraft = useMemo<QuestionDraft>(() => {
    if (mode === 'edit' && editingQuestion) {
      return hydrateDraftFromQuestion(editingQuestion);
    }
    const base = makeInitialDraft('guess_image');
    return {
      ...base,
      classLevel: defaultClassLevel || base.classLevel,
      subject: defaultSubject || base.subject,
    };
  }, [mode, editingQuestion, defaultClassLevel, defaultSubject]);

  const [draft, setDraft] = useState<QuestionDraft>(initialDraft);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);

  // Auto-load draft
  useEffect(() => {
    if (mode === 'create') {
      AsyncStorage.getItem('els_question_draft').then((str) => {
        if (str) {
          try {
            const parsed = JSON.parse(str);
            if (parsed && typeof parsed === 'object') {
              setDraft((c) => ({ ...c, ...parsed }));
            }
          } catch (e) {}
        }
        setHasLoadedDraft(true);
      });
    } else {
      setHasLoadedDraft(true);
    }
  }, [mode]);

  // Auto-save draft
  useEffect(() => {
    if (mode === 'create' && hasLoadedDraft) {
      AsyncStorage.setItem('els_question_draft', JSON.stringify(draft));
    }
  }, [draft, mode, hasLoadedDraft]);
  const [tab, setTab] = useState<'setup' | 'options' | 'preview'>('setup');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ id: string; pct: number } | null>(null);
  const [actionBadge, setActionBadge] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectorField, setSelectorField] = useState<SelectorField>(null);
  const [pendingMediaRemoval, setPendingMediaRemoval] = useState<MediaRemovalRequest | null>(null);
  const [pendingOptionRemoval, setPendingOptionRemoval] = useState<OptionRemovalRequest | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<{ pairIdx: number } | null>(null);
  const [isLogicoImageExpanded, setIsLogicoImageExpanded] = useState(false);
  const [showLogicoPositionNumbers, setShowLogicoPositionNumbers] = useState(true);
  const insets = useSafeAreaInsets();

  const actionBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (actionBadgeTimerRef.current) clearTimeout(actionBadgeTimerRef.current);
  }, []);

  const showActionBadge = (text: string) => {
    setActionBadge(text);
    if (actionBadgeTimerRef.current) clearTimeout(actionBadgeTimerRef.current);
    actionBadgeTimerRef.current = setTimeout(() => setActionBadge(null), 1800);
  };

  const updateField = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setQuestionType = (questionType: SupportedQuestionType) => {
    setDraft((current) => ({
      ...current,
      questionType,
      questionInstruction: getDefaultInstructionByType(questionType),
      mainImage:
        questionType === 'guess_image' || questionType === 'logico' || questionType === 'jigsaw'
          ? current.mainImage
          : '',
      mainImageLabel:
        questionType === 'guess_image' || questionType === 'logico' || questionType === 'jigsaw'
          ? current.mainImageLabel
          : '',
      mainImageAssetId:
        questionType === 'guess_image' || questionType === 'logico' || questionType === 'jigsaw'
          ? current.mainImageAssetId
          : '',
      mainAudio: questionType === 'guess_audio' ? current.mainAudio : '',
      mainAudioLabel: questionType === 'guess_audio' ? current.mainAudioLabel : '',
      mainAudioAssetId: questionType === 'guess_audio' ? current.mainAudioAssetId : '',
      options: makeDefaultOptionsByType(questionType),
      rawQuestionData:
        questionType === 'jigsaw'
          ? { gridSize: '3x3', difficulty: 'medium', clickLimit: 20 }
          : {},
    }));
  };

  // ── Media uploads ─────────────────────────────────────────────────────────
  const uploadAudio = async () => {
    try {
      const picked = await pickAudioAsDataUrl();
      setUploadProgress({ id: 'mainAudio', pct: 0 });
      const uploaded = await uploadPickedFileToS3(picked, 'audio', 'question_management', (pct) => setUploadProgress({ id: 'mainAudio', pct }));
      setDraft((c) => ({
        ...c,
        mainAudio: uploaded.canonicalUrl || uploaded.url,
        mainAudioLabel: uploaded.fileName,
        mainAudioAssetId: uploaded.assetId,
      }));
    } catch (e: any) {
      if (e?.message === 'UPLOAD_CANCELLED') return;
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to upload audio' });
    } finally {
      setUploadProgress(null);
    }
  };

  const uploadImage = async () => {
    try {
      const picked = await pickImageOrVideoAsDataUrl();
      setUploadProgress({ id: 'mainImage', pct: 0 });
      const uploaded = await uploadPickedFileToS3(picked, 'image', 'question_management', (pct) => setUploadProgress({ id: 'mainImage', pct }));
      setDraft((c) => ({
        ...c,
        mainImage: uploaded.canonicalUrl || uploaded.url,
        mainImageLabel: uploaded.fileName,
        mainImageAssetId: uploaded.assetId,
      }));
    } catch (e: any) {
      if (e?.message === 'UPLOAD_CANCELLED') return;
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to upload image' });
    } finally {
      setUploadProgress(null);
    }
  };

  const clearQuestionImage = () =>
    setDraft((c) => ({ ...c, mainImage: '', mainImageLabel: '', mainImageAssetId: '' }));
  const clearQuestionAudio = () =>
    setDraft((c) => ({ ...c, mainAudio: '', mainAudioLabel: '', mainAudioAssetId: '' }));

  const playAudioPreview = async (audioUrl: string) => {
    const url = audioUrl.trim();
    if (!url) {
      setMessage({ type: 'error', text: 'Add or upload an audio URL before preview.' });
      return;
    }
    try {
      await AudioManager.playSound(resolveMediaUrl(url));
    } catch (e: any) {
      if (e?.message === 'UPLOAD_CANCELLED') return;
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to play audio preview' });
    }
  };

  // ── Option helpers ────────────────────────────────────────────────────────
  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setDraft((c) => ({
      ...c,
      options: c.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  };

  const setCorrectOption = (index: number) => {
    setDraft((c) => {
      const activeType = normalizeQuestionType(c.questionType);
      const next =
        activeType === 'multi_choice'
          ? c.options.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o))
          : c.options.map((o, i) => ({ ...o, isCorrect: i === index }));
      return { ...c, options: next };
    });
  };

  const addOption = () => {
    if (normalizeQuestionType(draft.questionType) === 'true_false') {
      setMessage({ type: 'error', text: 'True / False always has exactly two options.' });
      return;
    }
    setDraft((c) => ({ ...c, options: [makeEmptyOption(), ...c.options] }));
    showActionBadge('Option added');
  };

  const removeOption = (index: number) => {
    if (normalizeQuestionType(draft.questionType) === 'true_false') {
      setMessage({ type: 'error', text: 'True / False requires both True and False options.' });
      return;
    }
    setDraft((c) => {
      const remaining = c.options.filter((_, i) => i !== index);
      return { ...c, options: remaining.length ? remaining : [makeEmptyOption()] };
    });
  };

  const uploadMediaForOption = async (index: number) => {
    try {
      const picked = await pickMediaAsDataUrl();
      const kind = resolvePickedMediaKind(picked);
      setUploadProgress({ id: `option-${index}`, pct: 0 });
      if (kind === 'image') {
        const uploaded = await uploadPickedFileToS3(picked, 'image', 'question_management', (pct) => setUploadProgress({ id: `option-${index}`, pct }));
        updateOption(index, {
          image: uploaded.canonicalUrl || uploaded.url,
          imageLabel: uploaded.fileName,
          imageAssetId: uploaded.assetId,
        });
        return;
      }
      if (kind === 'audio') {
        const uploaded = await uploadPickedFileToS3(picked, 'audio', 'question_management', (pct) => setUploadProgress({ id: `option-${index}`, pct }));
        updateOption(index, {
          audio: uploaded.canonicalUrl || uploaded.url,
          audioLabel: uploaded.fileName,
          audioAssetId: uploaded.assetId,
        });
        return;
      }
      setMessage({ type: 'error', text: 'Unsupported media type. Please upload image or audio.' });
    } catch (e: any) {
      if (e?.message === 'UPLOAD_CANCELLED') return;
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to upload media' });
    } finally {
      setUploadProgress(null);
    }
  };

  const clearOptionMedia = (index: number, mediaType: 'image' | 'audio') => {
    if (mediaType === 'image') updateOption(index, { image: '', imageLabel: '', imageAssetId: '' });
    else updateOption(index, { audio: '', audioLabel: '', audioAssetId: '' });
  };

  // ── Match pair helpers ────────────────────────────────────────────────────
  const updateMatchPair = (index: number, patch: Partial<MatchPairDraft>) => {
    setDraft((c) => ({
      ...c,
      matchPairs: c.matchPairs.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };
  const addMatchPair = () =>
    setDraft((c) => ({ ...c, matchPairs: [...c.matchPairs, makeEmptyMatchPair()] }));
  const removeMatchPair = (index: number) =>
    setDraft((c) => {
      const remaining = c.matchPairs.filter((_, i) => i !== index);
      return { ...c, matchPairs: remaining.length ? remaining : [makeEmptyMatchPair()] };
    });
  const uploadMediaForMatchPair = async (index: number) => {
    try {
      const picked = await pickMediaAsDataUrl();
      const kind = resolvePickedMediaKind(picked);
      setUploadProgress({ id: `pair-${index}`, pct: 0 });
      if (kind === 'image') {
        const uploaded = await uploadPickedFileToS3(picked, 'image', 'question_management', (pct) => setUploadProgress({ id: `pair-${index}`, pct }));
        updateMatchPair(index, {
          image: uploaded.canonicalUrl || uploaded.url,
          imageLabel: uploaded.fileName,
          imageAssetId: uploaded.assetId,
        });
        return;
      }
      if (kind === 'audio') {
        const uploaded = await uploadPickedFileToS3(picked, 'audio', 'question_management', (pct) => setUploadProgress({ id: `pair-${index}`, pct }));
        updateMatchPair(index, {
          audio: uploaded.canonicalUrl || uploaded.url,
          audioLabel: uploaded.fileName,
          audioAssetId: uploaded.assetId,
        });
        return;
      }
      setMessage({ type: 'error', text: 'Unsupported media type. Please upload image or audio.' });
    } catch (e: any) {
      if (e?.message === 'UPLOAD_CANCELLED') return;
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to upload media' });
    } finally {
      setUploadProgress(null);
    }
  };
  const clearPairMedia = (index: number, mediaType: 'image' | 'audio') => {
    if (mediaType === 'image') updateMatchPair(index, { image: '', imageLabel: '', imageAssetId: '' });
    else updateMatchPair(index, { audio: '', audioLabel: '', audioAssetId: '' });
  };

  const requestMediaRemoval = (request: MediaRemovalRequest) => setPendingMediaRemoval(request);
  const confirmMediaRemoval = () => {
    if (!pendingMediaRemoval) return;
    if (pendingMediaRemoval.scope === 'question') {
      pendingMediaRemoval.mediaType === 'image' ? clearQuestionImage() : clearQuestionAudio();
    } else if (pendingMediaRemoval.scope === 'option') {
      clearOptionMedia(pendingMediaRemoval.index, pendingMediaRemoval.mediaType);
    } else {
      clearPairMedia(pendingMediaRemoval.index, pendingMediaRemoval.mediaType);
    }
    showActionBadge(`${pendingMediaRemoval.mediaType === 'image' ? 'Image' : 'Audio'} removed`);
    setPendingMediaRemoval(null);
  };
  const requestOptionRemoval = (request: OptionRemovalRequest) => setPendingOptionRemoval(request);
  const confirmOptionRemoval = () => {
    if (!pendingOptionRemoval) return;
    removeOption(pendingOptionRemoval.index);
    showActionBadge('Option removed');
    setPendingOptionRemoval(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = draftToPayload(draft);
      if (mode === 'create' && quizId) {
        payload.quizId = quizId;
      }
      const res =
        mode === 'edit' && editingQuestion
          ? await apiFetch(`/questions/${editingQuestion.id}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            })
          : await apiFetch('/questions', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to save question');
      }
      const saved = await res.json().catch(() => ({}));
      const id =
        typeof saved.id === 'string'
          ? saved.id
          : typeof saved.questionId === 'string'
          ? saved.questionId
          : editingQuestion?.id || '';
      if (mode === 'create') {
        AsyncStorage.removeItem('els_question_draft');
      }
      onSaved?.({ id });
      onClose();
    } catch (e: any) {
      if (e?.message === 'UPLOAD_CANCELLED') return;
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save question' });
    } finally {
      setSaving(false);
    }
  };

  // ── Selector options ──────────────────────────────────────────────────────
  const classOptions = useMemo<SelectorOption[]>(
    () =>
      getAuthorizedClasses(
        user,
        STANDARD_OPTIONS.map((o) => o.value)
      ).map((v) => ({ label: getStandardLabel(v), value: v })),
    [user]
  );
  const subjectOptions = useMemo<SelectorOption[]>(() => {
    const titles = getAuthorizedSubjects(
      user,
      subjectCatalog,
      (i) => i.classLevel,
      (i) => i.title,
      draft.classLevel || undefined
    );
    const byTitle = new Map<
      string,
      { coverImage?: string; iconUrl?: string; iconBgColor?: string }
    >();
    titles.forEach((title) => {
      const meta = subjectCatalog.find(
        (i) =>
          i.title.trim() === title &&
          (!draft.classLevel || i.classLevel === draft.classLevel)
      );
      byTitle.set(title, {
        coverImage: meta?.coverImage,
        iconUrl: meta?.iconImage,
        iconBgColor: meta?.iconBgColor,
      });
    });
    if (draft.subject && !byTitle.has(draft.subject)) byTitle.set(draft.subject, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [subjectCatalog, draft.classLevel, draft.subject, user]);

  // ── Derived display state ────────────────────────────────────────────────
  const normalizedQuestionType = normalizeQuestionType(draft.questionType);
  const editorMode = getQuestionEditorMode(draft.questionType);
  const isLogicoMode = editorMode === 'logico';
  const isMemoryMatchMode = editorMode === 'memory_match';
  const isFillBlankMode = editorMode === 'fill_blank';
  const isJigsawMode = editorMode === 'jigsaw';
  const isGameMode = isMemoryMatchMode || isFillBlankMode || isJigsawMode;
  const hasOptions = (editorMode === 'choice' || isLogicoMode) && !isGameMode;
  const hasPairs = editorMode === 'drag_drop';
  const tab2Label = hasPairs
    ? 'Pairs'
    : isLogicoMode
    ? 'Mappings'
    : isGameMode
    ? 'Game Config'
    : 'Options';

  const logicoSlotStats = isLogicoMode
    ? draft.options.reduce(
        (acc, option) => {
          const slot = Number(option.slotPosition);
          const isValid = Number.isInteger(slot) && slot >= 1 && slot <= 10;
          if (!isValid) {
            acc.invalidCount += 1;
            return acc;
          }
          acc.slotCounts.set(slot, (acc.slotCounts.get(slot) || 0) + 1);
          return acc;
        },
        { slotCounts: new Map<number, number>(), invalidCount: 0 },
      )
    : null;
  const duplicateLogicoSlots = logicoSlotStats
    ? Array.from(logicoSlotStats.slotCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([slot]) => slot)
    : [];
  const hasLogicoMappingBlocker = Boolean(
    isLogicoMode &&
      ((logicoSlotStats?.invalidCount || 0) > 0 || duplicateLogicoSlots.length > 0),
  );
  const canSave = !saving && !hasLogicoMappingBlocker;
  const dialogTitle = mode === 'edit' ? 'Edit Question' : 'New Question';

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={qFormS.screen}>
      {!embedded && (
        <View style={[qFormS.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable onPress={onClose} style={qFormS.backBtn}>
            <Text style={qFormS.backArrow}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={qFormS.titleText}>{dialogTitle}</Text>
            {mode === 'edit' ? (
              <Text style={qFormS.subTitle}>{getQuestionTypeLabel(draft.questionType)}</Text>
            ) : null}
          </View>
          <Pressable
            style={[qFormS.saveBtn, !canSave && qFormS.saveBtnDisabled]}
            onPress={save}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator accessibilityLabel="Loading" color="#fff" size="small" />
            ) : (
              <Text style={qFormS.saveBtnText}>Save</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Tab bar */}
      <View style={qFormS.tabBar}>
        {([
          ['setup', '⚙ Setup'],
          ...(hasOptions || hasPairs || isGameMode ? [['options', tab2Label] as [string, string]] : []),
          ['preview', '👁 Preview'],
        ] as [string, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            style={[qFormS.tab, tab === key && qFormS.tabActive]}
            onPress={() => setTab(key as 'setup' | 'options' | 'preview')}
          >
            <Text style={[qFormS.tabText, tab === key && qFormS.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Embedded mode save bar */}
      {embedded && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <Pressable
            style={[qFormS.saveBtn, !canSave && qFormS.saveBtnDisabled]}
            onPress={save}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator accessibilityLabel="Loading" color="#fff" size="small" />
            ) : (
              <Text style={qFormS.saveBtnText}>{quizId ? 'Save & Attach' : 'Save'}</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Toast */}
      {actionBadge ? (
        <View style={qFormS.toast}>
          <Text style={qFormS.toastText}>{actionBadge}</Text>
        </View>
      ) : null}
      {message ? (
        <View
          style={[qFormS.toast, message.type === 'error' ? qFormS.toastError : qFormS.toastSuccess]}
        >
          <Text
            style={[
              qFormS.toastText,
              message.type === 'error' ? qFormS.toastErrorText : qFormS.toastSuccessText,
            ]}
          >
            {message.text}
          </Text>
        </View>
      ) : null}

      {/* SETUP TAB */}
      {(() => {
        const renderSetupContent = () => (
          <>
            {mode === 'create' && !hideTypeSelector ? (
              <View style={qFormS.group}>
                <Text style={qFormS.groupLabel}>QUESTION TYPE</Text>
                <View style={qFormS.fieldCard}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {QUESTION_TYPE_CHOICES.map((choice) => {
                      const sel = draft.questionType === choice.value;
                      const ec = QTYPES_COLOR[choice.value] ?? '#2D5DC9';
                      const eb = QTYPES_BG[choice.value] ?? '#D6EAFF';
                      const ee = QTYPES_EMOJI[choice.value] ?? '';
                      return (
                        <Pressable
                          key={choice.value}
                          style={[qFormS.qtypeChip, sel && { backgroundColor: eb, borderColor: ec }]}
                          onPress={() => setQuestionType(choice.value)}
                        >
                          <Text style={qFormS.qtypeEmoji}>{ee}</Text>
                          <Text
                            style={[qFormS.qtypeLabel, sel && { color: ec, fontWeight: '800' }]}
                          >
                            {choice.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {QUESTION_TYPE_CHOICES.find((c) => c.value === draft.questionType) ? (
                    <Text style={qFormS.qtypeDesc}>
                      {QUESTION_TYPE_CHOICES.find((c) => c.value === draft.questionType)!.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={qFormS.group}>
              <Text style={qFormS.groupLabel}>BASIC INFO</Text>
              <View style={qFormS.fieldCard}>
                <Text style={qFormS.fieldLabel}>Question Title</Text>
                <TextInput
                  value={draft.questionTitle}
                  onChangeText={(v) => updateField('questionTitle', v)}
                  placeholder="e.g. What animal says Moo? or $x^2 + y^2 = r^2$"
                  style={qFormS.input}
                  placeholderTextColor="#B0B8D0"
                />
                {draft.questionTitle.trim() ? (
                  <View style={{ marginTop: 6, padding: 10, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>LaTeX Preview</Text>
                    <LatexText content={draft.questionTitle} compact background="transparent" style={{ fontSize: 14, color: '#1E293B' }} />
                  </View>
                ) : null}
                <View style={qFormS.divider} />
                <Text style={qFormS.fieldLabel}>Instruction (optional)</Text>
                <TextInput
                  value={draft.questionInstruction}
                  onChangeText={(v) => updateField('questionInstruction', v)}
                  placeholder="e.g. Listen and choose the correct animal"
                  style={[qFormS.input, { minHeight: 52 }]}
                  multiline
                  placeholderTextColor="#B0B8D0"
                />
                <View style={qFormS.divider} />
                <Text style={qFormS.fieldLabel}>Explanation (optional)</Text>
                <TextInput
                  value={draft.explanation}
                  onChangeText={(v) => updateField('explanation', v)}
                  placeholder="Explain why the correct answer is right. Shown to students as the solution."
                  style={[qFormS.input, { minHeight: 72 }]}
                  multiline
                  placeholderTextColor="#B0B8D0"
                />
                {draft.explanation.trim() ? (
                  <View style={{ marginTop: 6, padding: 10, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#1D4ED8', textTransform: 'uppercase', marginBottom: 4 }}>Explanation Preview</Text>
                    <LatexText content={draft.explanation} compact background="transparent" style={{ fontSize: 13, color: '#1E3A8A' }} />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={qFormS.group}>
              <Text style={qFormS.groupLabel}>CLASS SETTINGS</Text>
              <View style={qFormS.fieldCard}>
                <Text style={qFormS.fieldLabel}>Standard / Class</Text>
                <Pressable
                  style={qFormS.selectorRow}
                  onPress={() => setSelectorField('classLevel')}
                >
                  <Text
                    style={draft.classLevel ? qFormS.selectorVal : qFormS.selectorPlaceholder}
                  >
                    {draft.classLevel ? getStandardLabel(draft.classLevel) : 'Select Standard'}
                  </Text>
                  <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                </Pressable>
                <View style={qFormS.divider} />
                <Text style={qFormS.fieldLabel}>Subject</Text>
                <Pressable
                  style={qFormS.selectorRow}
                  onPress={() => setSelectorField('subject')}
                >
                  <Text style={draft.subject ? qFormS.selectorVal : qFormS.selectorPlaceholder}>
                    {draft.subject || 'Select Subject'}
                  </Text>
                  <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                </Pressable>
              </View>
            </View>

            <View style={qFormS.group}>
              <Text style={qFormS.groupLabel}>SCORING</Text>
              <View style={qFormS.fieldCard}>
                <View style={qFormS.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={qFormS.fieldLabel}>Points</Text>
                    <TextInput
                      value={draft.points}
                      onChangeText={(v) => updateField('points', v)}
                      placeholder="10"
                      style={qFormS.input}
                      keyboardType="numeric"
                      placeholderTextColor="#B0B8D0"
                    />
                  </View>
                  <View style={qFormS.colDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={qFormS.fieldLabel}>Time Limit (s)</Text>
                    <TextInput
                      value={draft.timeLimitSeconds}
                      onChangeText={(v) => updateField('timeLimitSeconds', v)}
                      placeholder="30"
                      style={qFormS.input}
                      keyboardType="numeric"
                      placeholderTextColor="#B0B8D0"
                    />
                  </View>
                </View>
              </View>
            </View>

            {(normalizedQuestionType === 'guess_image' ||
              normalizedQuestionType === 'logico' ||
              normalizedQuestionType === 'jigsaw') && (
              <View style={qFormS.group}>
                <Text style={qFormS.groupLabel}>
                  {normalizedQuestionType === 'logico'
                    ? 'WORKSHEET IMAGE'
                    : normalizedQuestionType === 'jigsaw'
                    ? 'PUZZLE IMAGE'
                    : 'PROMPT IMAGE / VIDEO'}
                </Text>
                <View style={qFormS.fieldCard}>
                  <MediaUploader
                    accept={normalizedQuestionType === 'logico' || normalizedQuestionType === 'jigsaw' ? 'image/*' : 'image/*,video/*'}
                    mediaType="image"
                    value={draft.mainImage.trim() || null}
                    fileName={draft.mainImageLabel || (draft.mainImage.trim() ? draft.mainImage.split('/').pop() : '')}
                    thumbnailUrl={draft.mainImage.trim() ? resolveMediaUrl(draft.mainImage.trim()) : undefined}
                    onUploadSuccess={(url, name) => {
                      updateField('mainImage', url);
                      updateField('mainImageLabel', name);
                    }}
                    onClear={() => requestMediaRemoval({ scope: 'question', mediaType: 'image' })}
                    buttonLabel={
                      normalizedQuestionType === 'logico'
                        ? 'Upload Worksheet Image'
                        : normalizedQuestionType === 'jigsaw'
                        ? 'Upload Puzzle Image'
                        : 'Upload Prompt Image / Video'
                    }
                  />
                </View>
              </View>
            )}

            {normalizedQuestionType === 'guess_audio' && (
              <View style={qFormS.group}>
                <Text style={qFormS.groupLabel}>PROMPT AUDIO</Text>
                <View style={qFormS.fieldCard}>
                  <MediaUploader
                    accept="audio/*"
                    mediaType="audio"
                    value={draft.mainAudio.trim() || null}
                    fileName={draft.mainAudioLabel || (draft.mainAudio.trim() ? draft.mainAudio.split('/').pop() : '')}
                    onPlayPreview={() => playAudioPreview(draft.mainAudio)}
                    onUploadSuccess={(url, name) => {
                      updateField('mainAudio', url);
                      updateField('mainAudioLabel', name);
                    }}
                    onClear={() => requestMediaRemoval({ scope: 'question', mediaType: 'audio' })}
                    buttonLabel="Upload Prompt Audio"
                  />
                </View>
              </View>
            )}
          </>
        );

        if (tab !== 'setup') return null;

        if (isDesktop) {
          return (
            <View style={qFormS.desktopLayout}>
              <View style={qFormS.desktopLeftCol}>
                <View style={qFormS.formCardWrap}>
                  <View style={qFormS.formCardHeader}>
                    <Text style={qFormS.cardTitleHeader}>Question Setup</Text>
                    <Text style={qFormS.cardSubHeader}>Configure core details, stimulus & scoring</Text>
                  </View>
                  <ScrollView
                    style={qFormS.innerScrollList}
                    contentContainerStyle={{ gap: 14, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {renderSetupContent()}
                  </ScrollView>
                </View>
              </View>
              <View style={qFormS.desktopRightCol}>
                <View style={qFormS.formCardWrap}>
                  <View style={qFormS.formCardHeader}>
                    <Text style={qFormS.cardTitleHeader}>Live Preview Stage</Text>
                    <Text style={qFormS.cardSubHeader}>Real-time interactive student perspective</Text>
                  </View>
                  <ScrollView
                    style={qFormS.innerScrollList}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <PreviewTab
                      draft={draft}
                      editorMode={editorMode}
                      isLogicoMode={isLogicoMode}
                      isMemoryMatchMode={isMemoryMatchMode}
                      isFillBlankMode={isFillBlankMode}
                      isJigsawMode={isJigsawMode}
                      hasOptions={hasOptions}
                      hasPairs={hasPairs}
                      normalizedQuestionType={normalizedQuestionType}
                      compact
                    />
                  </ScrollView>
                </View>
              </View>
            </View>
          );
        }

        return (
          <ScrollView contentContainerStyle={qFormS.tabContent}>
            {renderSetupContent()}
          </ScrollView>
        );
      })()}

      {/* OPTIONS TAB */}
      {tab === 'options' && (() => {
        const renderChoiceOptionsContent = () => (
          <View style={qFormS.secGroup}>
            <View style={qFormS.secHeader}>
              <Text style={qFormS.secTitle}>
                {isLogicoMode ? 'Logico Button Mapping' : 'Answer Options'}
              </Text>
              {!isLogicoMode && normalizedQuestionType !== 'true_false' && (
                <Pressable style={qFormS.addBtn} onPress={addOption}>
                  <Text style={qFormS.addBtnText}>+ Add</Text>
                </Pressable>
              )}
            </View>
            {isLogicoMode ? (
              <>
                <Text style={qFormS.secHint}>
                  Assign each Logico button to one unique option position (1-10).
                </Text>

                <View style={isDesktop ? qFormS.logicoTwoColContainer : undefined}>
                  {/* LEFT COLUMN: Button Mapping Grid */}
                  <View style={isDesktop ? qFormS.logicoLeftCol : undefined}>
                    {hasLogicoMappingBlocker ? (
                      <View style={qFormS.logicoBlockerBanner}>
                        <Text style={qFormS.logicoBlockerText}>
                          {(logicoSlotStats?.invalidCount || 0) > 0
                            ? 'All positions must be between 1 and 10.'
                            : `Duplicate positions found: ${duplicateLogicoSlots.join(', ')}.`}
                        </Text>
                      </View>
                    ) : null}
                    <View style={qFormS.logicoGrid}>
                      {draft.options.map((option, index) => (
                        <View key={`logico-${option.id || index}`} style={isDesktop ? qFormS.logicoCardDesktop : qFormS.logicoCard}>
                          <View style={qFormS.logicoButtonCell}>
                            <LogicoButtonBadge buttonId={option.id} />
                            <Text style={qFormS.logicoButtonLabel}>
                              {frameButtons.find((b) => b.id === option.id)?.label || option.id}
                            </Text>
                          </View>
                          <View style={qFormS.logicoSlotCell}>
                            <Text style={qFormS.fieldLabel}>Position</Text>
                            <TextInput
                              value={String(option.slotPosition || '')}
                              onChangeText={(value) => {
                                const parsed = Number(value.replace(/[^0-9]/g, ''));
                                updateOption(index, {
                                  slotPosition: Number.isFinite(parsed) ? parsed : 0,
                                });
                              }}
                              keyboardType="numeric"
                              placeholder="1-10"
                              placeholderTextColor="#B0B8D0"
                              style={qFormS.logicoSlotInput}
                            />
                          </View>
                          <View style={qFormS.logicoLabelCell}>
                            <Text style={qFormS.fieldLabel}>Option label</Text>
                            <TextInput
                              value={option.label}
                              onChangeText={(value) => updateOption(index, { label: value })}
                              placeholder="e.g. Elephant"
                              placeholderTextColor="#B0B8D0"
                              style={qFormS.optInput}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* RIGHT COLUMN: Worksheet Image Preview with Logico Slot Numbers & Expand */}
                  <View style={isDesktop ? qFormS.logicoRightCol : { marginTop: 16 }}>
                    <View style={qFormS.logicoImageCardHeader}>
                      <Text style={qFormS.fieldLabel}>Worksheet Reference</Text>
                      <View style={qFormS.logicoHeaderActions}>
                        <Pressable
                          style={[
                            qFormS.logicoToggleBtn,
                            showLogicoPositionNumbers && qFormS.logicoToggleBtnActive,
                          ]}
                          onPress={() =>
                            setShowLogicoPositionNumbers((prev) => !prev)
                          }
                        >
                          <Text
                            style={[
                              qFormS.logicoToggleBtnText,
                              showLogicoPositionNumbers &&
                                qFormS.logicoToggleBtnTextActive,
                            ]}
                          >
                            {showLogicoPositionNumbers ? 'Hide Slots' : 'Show Slots'}
                          </Text>
                        </Pressable>
                        {draft.mainImage.trim() ? (
                          <Pressable
                            style={qFormS.expandBtn}
                            onPress={() => setIsLogicoImageExpanded(true)}
                          >
                            <Text style={qFormS.expandBtnText}>⤢ Expand</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    {draft.mainImage.trim() ? (
                      <LogicoWorksheetImageOverlay
                        imageUri={resolveMediaUrl(draft.mainImage.trim())}
                        options={draft.options}
                        onPress={() => setIsLogicoImageExpanded(true)}
                        height={isDesktop ? 420 : 280}
                        showOverlay={showLogicoPositionNumbers}
                      />
                    ) : (
                      <View style={qFormS.logicoNoImageCard}>
                        <Text style={qFormS.logicoNoImageText}>No worksheet image uploaded yet.</Text>
                        <Pressable style={qFormS.uploadSwitchBtn} onPress={() => setTab('setup')}>
                          <Text style={qFormS.uploadSwitchBtnText}>Upload Worksheet Image</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={qFormS.secHint}>
                  {normalizedQuestionType === 'multi_choice'
                    ? 'Mark all correct options.'
                    : 'Mark exactly one correct option.'}
                </Text>
                {draft.options.map((option, index) => (
                  <View key={`opt-${index}`} style={qFormS.optBlock}>
                    <View style={qFormS.optBlockHeader}>
                      <View
                        style={[
                          qFormS.optNumBadge,
                          option.isCorrect && { backgroundColor: '#7DC67A' },
                        ]}
                      >
                        <Text
                          style={[qFormS.optNum, option.isCorrect && { color: '#fff' }]}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          value={option.label}
                          onChangeText={(v) => updateOption(index, { label: v })}
                          placeholder={`Option ${index + 1} label`}
                          style={qFormS.optInput}
                          placeholderTextColor="#B0B8D0"
                        />
                      </View>
                      <Pressable
                        style={[qFormS.correctBtn, option.isCorrect && qFormS.correctBtnActive]}
                        onPress={() => setCorrectOption(index)}
                      >
                        <Text
                          style={[
                            qFormS.correctBtnText,
                            option.isCorrect && qFormS.correctBtnTextActive,
                          ]}
                        >
                          {option.isCorrect ? '✓' : '○'}
                        </Text>
                      </Pressable>
                      {normalizedQuestionType !== 'true_false' && (
                        <Pressable
                          onPress={() => requestOptionRemoval({ index })}
                          style={qFormS.removeBtnWide}
                        >
                          <Text style={qFormS.removeBtnText}>✕ Remove</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                      {option.label.trim() ? (
                        <View style={{ marginBottom: 10, padding: 8, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>LaTeX Preview</Text>
                          <LatexText content={option.label} compact background="transparent" style={{ fontSize: 13, color: '#1E293B' }} />
                        </View>
                      ) : null}
                      <MediaUploader
                        accept="image/*,audio/*"
                        mediaType={option.image.trim() ? 'image' : option.audio.trim() ? 'audio' : 'document'}
                        value={option.image.trim() || option.audio.trim() || null}
                        fileName={option.imageLabel || option.audioLabel || ''}
                        thumbnailUrl={option.image.trim() ? resolveMediaUrl(option.image.trim()) : undefined}
                        onPlayPreview={option.audio.trim() ? () => playAudioPreview(option.audio) : undefined}
                        onUploadSuccess={(url, name, kind) => {
                          if (kind === 'image') updateOption(index, { image: url, imageLabel: name, audio: '', audioLabel: '' });
                          else if (kind === 'audio') updateOption(index, { audio: url, audioLabel: name, image: '', imageLabel: '' });
                        }}
                        onClear={() => {
                          requestMediaRemoval({ scope: 'option', index, mediaType: option.image.trim() ? 'image' : 'audio' });
                        }}
                        buttonLabel="Upload Image / Audio"
                      />
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        );

        const renderPairsContent = () => (
          <View style={qFormS.secGroup}>
            <View style={qFormS.secHeader}>
              <Text style={qFormS.secTitle}>🔀 Match Pairs</Text>
              <Pressable style={qFormS.addBtn} onPress={addMatchPair}>
                <Text style={qFormS.addBtnText}>+ Add</Text>
              </Pressable>
            </View>
            <Text style={qFormS.secHint}>
              Each pair: one draggable item ↔ one matching target.
            </Text>
            {draft.matchPairs.map((pair, index) => (
              <View key={`pair-${index}`} style={qFormS.optBlock}>
                <View style={qFormS.pairHeaderRow}>
                  <Text style={qFormS.pairNum}>Pair {index + 1}</Text>
                  <Pressable
                    onPress={() => removeMatchPair(index)}
                    style={qFormS.removeBtnWide}
                  >
                    <Text style={qFormS.removeBtnText}>✕ Remove</Text>
                  </Pressable>
                </View>
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                  <View>
                    <Text style={qFormS.fieldLabel}>Item (draggable)</Text>
                    <TextInput
                      value={pair.itemLabel}
                      onChangeText={(v) => updateMatchPair(index, { itemLabel: v })}
                      placeholder="e.g. Lion"
                      style={qFormS.optInput}
                      placeholderTextColor="#B0B8D0"
                    />
                  </View>
                  <View>
                    <Text style={qFormS.fieldLabel}>Target (matching)</Text>
                    <TextInput
                      value={pair.targetLabel}
                      onChangeText={(v) => updateMatchPair(index, { targetLabel: v })}
                      placeholder="e.g. Den"
                      style={qFormS.optInput}
                      placeholderTextColor="#B0B8D0"
                    />
                  </View>
                  <MediaUploader
                    accept="image/*,audio/*"
                    mediaType={pair.image.trim() ? 'image' : pair.audio.trim() ? 'audio' : 'document'}
                    value={pair.image.trim() || pair.audio.trim() || null}
                    fileName={pair.imageLabel || pair.audioLabel || ''}
                    thumbnailUrl={pair.image.trim() ? resolveMediaUrl(pair.image.trim()) : undefined}
                    onPlayPreview={pair.audio.trim() ? () => playAudioPreview(pair.audio) : undefined}
                    onUploadSuccess={(url, name, kind) => {
                      if (kind === 'image') updateMatchPair(index, { image: url, imageLabel: name, audio: '', audioLabel: '' });
                      else if (kind === 'audio') updateMatchPair(index, { audio: url, audioLabel: name, image: '', imageLabel: '' });
                    }}
                    onClear={() => {
                      updateMatchPair(index, { image: '', imageLabel: '', audio: '', audioLabel: '' });
                    }}
                    buttonLabel="Upload Image / Audio"
                  />
                </View>
              </View>
            ))}
          </View>
        );

        if (isDesktop) {
          return (
            <View style={qFormS.desktopLayout}>
              <View style={qFormS.desktopLeftCol}>
                <View style={qFormS.formCardWrap}>
                  <View style={qFormS.formCardHeader}>
                    <Text style={qFormS.cardTitleHeader}>{tab2Label}</Text>
                    <Text style={qFormS.cardSubHeader}>Configure response choices & answer keys</Text>
                  </View>
                  <View style={qFormS.innerScrollList}>
                    {hasOptions && (
                      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                        {renderChoiceOptionsContent()}
                      </ScrollView>
                    )}
                    {hasPairs && (
                      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                        {renderPairsContent()}
                      </ScrollView>
                    )}
                    {isMemoryMatchMode && (
                      <MemoryMatchTab
                        draft={draft}
                        updateRaw={(patch) =>
                          updateField('rawQuestionData', { ...((draft.rawQuestionData as any) ?? {}), ...patch })
                        }
                        assetPickerOpen={assetPickerOpen}
                        assetPickerTarget={assetPickerTarget}
                        openAssetPicker={(pairIdx) => {
                          setAssetPickerTarget({ pairIdx });
                          setAssetPickerOpen(true);
                        }}
                        closeAssetPicker={() => {
                          setAssetPickerOpen(false);
                          setAssetPickerTarget(null);
                        }}
                      />
                    )}
                    {isJigsawMode && (
                      <JigsawConfigTab
                        draft={draft}
                        updateRaw={(patch) =>
                          updateField('rawQuestionData', { ...((draft.rawQuestionData as any) ?? {}), ...patch })
                        }
                      />
                    )}
                    {isFillBlankMode && (
                      <FillBlankTab
                        draft={draft}
                        updateRaw={(patch) =>
                          updateField('rawQuestionData', { ...((draft.rawQuestionData as any) ?? {}), ...patch })
                        }
                      />
                    )}
                  </View>
                </View>
              </View>
              <View style={qFormS.desktopRightCol}>
                <View style={qFormS.formCardWrap}>
                  <View style={qFormS.formCardHeader}>
                    <Text style={qFormS.cardTitleHeader}>Live Preview Stage</Text>
                    <Text style={qFormS.cardSubHeader}>Real-time student perspective & player</Text>
                  </View>
                  <ScrollView
                    style={qFormS.innerScrollList}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <PreviewTab
                      draft={draft}
                      editorMode={editorMode}
                      isLogicoMode={isLogicoMode}
                      isMemoryMatchMode={isMemoryMatchMode}
                      isFillBlankMode={isFillBlankMode}
                      isJigsawMode={isJigsawMode}
                      hasOptions={hasOptions}
                      hasPairs={hasPairs}
                      normalizedQuestionType={normalizedQuestionType}
                      compact
                    />
                  </ScrollView>
                </View>
              </View>
            </View>
          );
        }

        return (
          <>
            {hasOptions && (
              <ScrollView contentContainerStyle={qFormS.tabContent}>
                {renderChoiceOptionsContent()}
              </ScrollView>
            )}
            {hasPairs && (
              <ScrollView contentContainerStyle={qFormS.tabContent}>
                {renderPairsContent()}
              </ScrollView>
            )}
            {isMemoryMatchMode && (
              <MemoryMatchTab
                draft={draft}
                updateRaw={(patch) =>
                  updateField('rawQuestionData', { ...((draft.rawQuestionData as any) ?? {}), ...patch })
                }
                assetPickerOpen={assetPickerOpen}
                assetPickerTarget={assetPickerTarget}
                openAssetPicker={(pairIdx) => {
                  setAssetPickerTarget({ pairIdx });
                  setAssetPickerOpen(true);
                }}
                closeAssetPicker={() => {
                  setAssetPickerOpen(false);
                  setAssetPickerTarget(null);
                }}
              />
            )}
            {isJigsawMode && (
              <JigsawConfigTab
                draft={draft}
                updateRaw={(patch) =>
                  updateField('rawQuestionData', { ...((draft.rawQuestionData as any) ?? {}), ...patch })
                }
              />
            )}
            {isFillBlankMode && (
              <FillBlankTab
                draft={draft}
                updateRaw={(patch) =>
                  updateField('rawQuestionData', { ...((draft.rawQuestionData as any) ?? {}), ...patch })
                }
              />
            )}
          </>
        );
      })()}

      {/* PREVIEW TAB */}
      {tab === 'preview' && (
        isDesktop ? (
          <View style={qFormS.desktopLayout}>
            <View style={qFormS.desktopLeftCol}>
              <View style={qFormS.formCardWrap}>
                <View style={qFormS.formCardHeader}>
                  <Text style={qFormS.cardTitleHeader}>Question Prompt & Stimulus</Text>
                  <Text style={qFormS.cardSubHeader}>Stimulus material & question context</Text>
                </View>
                <ScrollView
                  style={qFormS.innerScrollList}
                  contentContainerStyle={{ paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  <PreviewTab
                    draft={draft}
                    editorMode={editorMode}
                    isLogicoMode={isLogicoMode}
                    isMemoryMatchMode={isMemoryMatchMode}
                    isFillBlankMode={isFillBlankMode}
                    isJigsawMode={isJigsawMode}
                    hasOptions={hasOptions}
                    hasPairs={hasPairs}
                    normalizedQuestionType={normalizedQuestionType}
                    stage="prompt"
                  />
                </ScrollView>
              </View>
            </View>
            <View style={qFormS.desktopRightCol}>
              <View style={qFormS.formCardWrap}>
                <View style={qFormS.formCardHeader}>
                  <Text style={qFormS.cardTitleHeader}>Interactive Player & Solution</Text>
                  <Text style={qFormS.cardSubHeader}>Student response & verification stage</Text>
                </View>
                <ScrollView
                  style={qFormS.innerScrollList}
                  contentContainerStyle={{ paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  <PreviewTab
                    draft={draft}
                    editorMode={editorMode}
                    isLogicoMode={isLogicoMode}
                    isMemoryMatchMode={isMemoryMatchMode}
                    isFillBlankMode={isFillBlankMode}
                    isJigsawMode={isJigsawMode}
                    hasOptions={hasOptions}
                    hasPairs={hasPairs}
                    normalizedQuestionType={normalizedQuestionType}
                    stage="response"
                  />
                </ScrollView>
              </View>
            </View>
          </View>
        ) : (
          <PreviewTab
            draft={draft}
            editorMode={editorMode}
            isLogicoMode={isLogicoMode}
            isMemoryMatchMode={isMemoryMatchMode}
            isFillBlankMode={isFillBlankMode}
            isJigsawMode={isJigsawMode}
            hasOptions={hasOptions}
            hasPairs={hasPairs}
            normalizedQuestionType={normalizedQuestionType}
          />
        )
      )}

      {/* Selector modal */}
      <SelectorModal
        visible={selectorField === 'classLevel'}
        title="Select Standard"
        options={classOptions}
        selected={draft.classLevel}
        onSelect={(v) => {
          setDraft((c) => ({ ...c, classLevel: v, subject: '' }));
          setSelectorField(null);
        }}
        onClose={() => setSelectorField(null)}
      />
      <SelectorModal
        visible={selectorField === 'subject'}
        title="Select Subject"
        options={subjectOptions}
        selected={draft.subject}
        isSubject
        onSelect={(v) => {
          setDraft((c) => ({ ...c, subject: v }));
          setSelectorField(null);
        }}
        onClose={() => setSelectorField(null)}
      />

      {/* Confirm: media removal */}
      <Modal
        visible={!!pendingMediaRemoval}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingMediaRemoval(null)}
      >
        <View style={confirmStyles.overlay}>
          <View style={confirmStyles.box}>
            <Text style={confirmStyles.title}>
              Remove {pendingMediaRemoval?.mediaType === 'image' ? 'image' : 'audio'}?
            </Text>
            <Text style={confirmStyles.body}>
              This action cannot be undone.
            </Text>
            <View style={confirmStyles.row}>
              <Pressable
                style={[confirmStyles.btn, confirmStyles.btnSecondary]}
                onPress={() => setPendingMediaRemoval(null)}
              >
                <Text style={confirmStyles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[confirmStyles.btn, confirmStyles.btnDanger]}
                onPress={confirmMediaRemoval}
              >
                <Text style={confirmStyles.btnDangerText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm: option removal */}
      <Modal
        visible={!!pendingOptionRemoval}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingOptionRemoval(null)}
      >
        <View style={confirmStyles.overlay}>
          <View style={confirmStyles.box}>
            <Text style={confirmStyles.title}>Remove option?</Text>
            <Text style={confirmStyles.body}>This option will be deleted.</Text>
            <View style={confirmStyles.row}>
              <Pressable
                style={[confirmStyles.btn, confirmStyles.btnSecondary]}
                onPress={() => setPendingOptionRemoval(null)}
              >
                <Text style={confirmStyles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[confirmStyles.btn, confirmStyles.btnDanger]}
                onPress={confirmOptionRemoval}
              >
                <Text style={confirmStyles.btnDangerText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expanded Logico Worksheet Image Lightbox Modal */}
      {isLogicoImageExpanded && draft.mainImage.trim() ? (
        <Modal
          visible={isLogicoImageExpanded}
          transparent
          animationType="fade"
          onRequestClose={() => setIsLogicoImageExpanded(false)}
        >
          <View style={qFormS.modalBackdrop}>
            <View style={qFormS.modalHeaderRow}>
              <Text style={qFormS.modalImageTitle}>
                {draft.mainImageLabel || 'Logico Worksheet Image'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  style={[
                    qFormS.logicoToggleBtn,
                    showLogicoPositionNumbers && qFormS.logicoToggleBtnActive,
                    { backgroundColor: 'rgba(255, 255, 255, 0.25)', borderColor: 'rgba(255, 255, 255, 0.4)' },
                  ]}
                  onPress={() => setShowLogicoPositionNumbers((prev) => !prev)}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {showLogicoPositionNumbers ? 'Numbers 1-10 ✓' : 'Numbers 1-10'}
                  </Text>
                </Pressable>
                <Pressable style={qFormS.modalCloseBtn} onPress={() => setIsLogicoImageExpanded(false)}>
                  <X size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
            <View style={qFormS.modalImageBody}>
              <LogicoWorksheetImageOverlay
                imageUri={resolveMediaUrl(draft.mainImage.trim())}
                options={draft.options}
                height="100%"
                showOverlay={showLogicoPositionNumbers}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

// ── Logico Worksheet Image Overlay Sub-component ────────────────────────────

function LogicoWorksheetImageOverlay({
  imageUri,
  options,
  onPress,
  height = 420,
  showOverlay = true,
}: {
  imageUri: string;
  options: OptionDraft[];
  onPress?: () => void;
  height?: DimensionValue;
  showOverlay?: boolean;
}) {
  const slotMap = useMemo(() => {
    const map = new Map<number, OptionDraft>();
    options.forEach((opt) => {
      const pos = Number(opt.slotPosition);
      if (pos >= 1 && pos <= 10) {
        map.set(pos, opt);
      }
    });
    return map;
  }, [options]);

  return (
    <Pressable
      style={[qFormS.logicoOverlayCardWrap, { height }]}
      onPress={onPress}
    >
      <SafeImage
        uri={imageUri}
        style={qFormS.logicoOverlayImage}
        resizeMode="stretch"
      />
      {showOverlay ? (
        <View style={qFormS.logicoOverlayRailContainer} pointerEvents="none">
          <View style={qFormS.logicoOverlayHeaderSpacer} />
          <View style={qFormS.logicoOverlaySlotColumn}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((slotId) => {
              const mappedOpt = slotMap.get(slotId);
              return (
                <View key={`overlay-slot-${slotId}`} style={qFormS.logicoOverlaySlotRow}>
                  <View
                    style={[
                      qFormS.logicoPositionBadge,
                      mappedOpt ? qFormS.logicoPositionBadgeMapped : qFormS.logicoPositionBadgeUnmapped,
                    ]}
                  >
                    <Text style={qFormS.logicoPositionBadgeText}>{slotId}</Text>
                  </View>
                  {mappedOpt ? (
                    <View style={qFormS.logicoOverlayMappedPill}>
                      <LogicoButtonBadge buttonId={mappedOpt.id} size={16} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

type MMPair = {
  id: number;
  label: string;
  imageUrl?: string;
  image?: string;
  emoji?: string;
  isPlaceholder?: boolean;
};

function MemoryMatchTab({
  draft,
  updateRaw,
  assetPickerOpen,
  assetPickerTarget,
  openAssetPicker,
  closeAssetPicker,
}: {
  draft: QuestionDraft;
  updateRaw: (patch: object) => void;
  assetPickerOpen: boolean;
  assetPickerTarget: { pairIdx: number } | null;
  openAssetPicker: (pairIdx: number) => void;
  closeAssetPicker: () => void;
}) {
  const insets = useSafeAreaInsets();
  const mmGrid = ((draft.rawQuestionData as any)?.grid as string) || '4x4';
  const mmPairs = (((draft.rawQuestionData as any)?.pairs ?? []) as MMPair[]);
  const required = GRID_PAIR_COUNTS[mmGrid] ?? 8;
  const cols = GRID_COLS[mmGrid] ?? 4;

  const randomFill = () => {
    const picked = pickRandomAssets(required);
    updateRaw({
      grid: mmGrid,
      pairs: picked.map((a, i) => ({ id: i + 1, label: a.label, imageUrl: a.mediaPath })),
    });
  };

  const applyAsset = (asset: MemoryAsset) => {
    if (!assetPickerTarget) return;
    const { pairIdx } = assetPickerTarget;
    const updated = mmPairs.map((p, i) =>
      i === pairIdx ? { ...p, label: asset.label, imageUrl: asset.mediaPath } : p,
    );
    updateRaw({ pairs: updated });
    closeAssetPicker();
  };

  const handleGridChange = (g: string) => {
    const need = GRID_PAIR_COUNTS[g] ?? 6;
    let newPairs = [...mmPairs];
    if (newPairs.length > need) newPairs = newPairs.slice(0, need);
    if (newPairs.length < need) {
      const extra = pickRandomAssets(
        need - newPairs.length,
        newPairs.map((p) => p.imageUrl?.split('/').pop()?.replace('.svg', '') ?? ''),
      );
      extra.forEach((a) =>
        newPairs.push({ id: newPairs.length + 1, label: a.label, imageUrl: a.mediaPath }),
      );
    }
    const cleanPairs = newPairs.slice(0, need).map((p, idx) => ({ ...p, id: idx + 1 }));
    updateRaw({ grid: g, pairs: cleanPairs });
  };

  const [pairsContainerWidth, setPairsContainerWidth] = useState(0);

  const SW = Dimensions.get('window').width;
  const SECTION_H_PAD = 16;
  const TAB_H_PAD = 16;
  const fallbackAvailW = Math.max(220, Math.min(SW - TAB_H_PAD * 2 - SECTION_H_PAD * 2, 500));
  const availW = pairsContainerWidth > 0 ? Math.min(pairsContainerWidth, 500) : fallbackAvailW;
  const CARD_GAP = cols === 6 ? 6 : 8;
  const maxCardW = cols === 6 ? 60 : cols === 4 ? 74 : 92;
  const cardW = Math.min(maxCardW, Math.max(34, Math.floor((availW - CARD_GAP * (cols - 1)) / cols)));
  const pairIconW = Math.min(24, Math.max(14, cardW * 0.44));

  const MODAL_ASSET_COLS = 4;
  const MODAL_H_PAD = 16;
  const assetInnerW = Math.min(SW - MODAL_H_PAD * 2, 460);
  const ASSET_GAP = 8;
  const assetCellW = Math.floor(
    (assetInnerW - ASSET_GAP * (MODAL_ASSET_COLS - 1)) / MODAL_ASSET_COLS,
  );

  const curLimit = (draft.rawQuestionData as any)?.clickLimit ?? 0;
  const isUnlimited = curLimit === 0;

  return (
    <ScrollView contentContainerStyle={qFormS.tabContent}>
      <LinearGradient colors={['#F4EFFF', '#EDE4FF']} style={mmS.section}>
        <Text style={mmS.sectionTitle}>Grid Size</Text>
        <Text style={mmS.sectionHint}>Choose how many pairs students must find.</Text>
        <View style={mmS.gridRow}>
          {(['2x2', '4x4', '6x6'] as const).map((g) => {
            const n = GRID_PAIR_COUNTS[g];
            const sel = mmGrid === g;
            const label = `${n} Pairs`;
            const sub = `${n * 2} cards`;
            return (
              <Pressable key={g} onPress={() => handleGridChange(g)} style={{ flex: 1 }}>
                {sel ? (
                  <LinearGradient colors={['#9B6CF5', '#7B4FCA']} style={mmS.gridChipSel}>
                    <Text style={mmS.gridChipMainSel}>{label}</Text>
                    <Text style={mmS.gridChipSubSel}>{sub}</Text>
                  </LinearGradient>
                ) : (
                  <View style={mmS.gridChip}>
                    <Text style={mmS.gridChipMain}>{label}</Text>
                    <Text style={mmS.gridChipSub}>{sub}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

      <View style={mmS.section}>
        <Text style={mmS.sectionTitle}>Click Limit</Text>
        <Text style={[mmS.sectionHint, { marginBottom: 8 }]}>
          Max card flips — prevents spam clicking.
        </Text>
        <Pressable onPress={() => updateRaw({ clickLimit: 0 })} style={{ marginBottom: 8 }}>
          {isUnlimited ? (
            <LinearGradient colors={['#9B6CF5', '#7B4FCA']} style={mmS.unlimitedChipSel}>
              <Text style={mmS.unlimitedChipTextSel}>Unlimited</Text>
              <Text style={mmS.unlimitedChipSubSel}>No flip restriction</Text>
            </LinearGradient>
          ) : (
            <View style={mmS.unlimitedChip}>
              <Text style={mmS.unlimitedChipText}>Unlimited</Text>
              <Text style={mmS.unlimitedChipSub}>No flip restriction</Text>
            </View>
          )}
        </Pressable>
        <View style={mmS.clickGrid}>
          {([10, 20, 30, 40] as const).map((n) => {
            const sel = curLimit === n;
            return (
              <Pressable
                key={n}
                onPress={() => updateRaw({ clickLimit: n })}
                style={{ width: '48%' }}
              >
                {sel ? (
                  <LinearGradient colors={['#9B6CF5', '#7B4FCA']} style={mmS.clickChipSel}>
                    <Text style={mmS.clickChipNumSel}>{n}</Text>
                    <Text style={mmS.clickChipSubSel}>clicks max</Text>
                  </LinearGradient>
                ) : (
                  <View style={mmS.clickChip}>
                    <Text style={mmS.clickChipNum}>{n}</Text>
                    <Text style={mmS.clickChipSub}>clicks max</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={mmS.section}>
        <View style={mmS.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={mmS.sectionTitle}>
              Pairs{' '}
              <Text style={{ color: '#9B6CF5', fontWeight: '900' }}>
                {mmPairs.length}/{required}
              </Text>
            </Text>
            <Text style={mmS.sectionHint}>Tap any card to swap its image.</Text>
          </View>
          <Pressable onPress={randomFill}>
            <LinearGradient colors={['#9B6CF5', '#7B4FCA']} style={mmS.randomBtn}>
              <Text style={mmS.randomBtnText}>Randomize All</Text>
            </LinearGradient>
          </Pressable>
        </View>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - pairsContainerWidth) > 2) {
              setPairsContainerWidth(w);
            }
          }}
        >
          {Array.from({ length: required }).map((_, idx) => {
            const pair = mmPairs[idx];
            const imgUrl = pair?.imageUrl ? `${API_BASE_URL}${pair.imageUrl}` : undefined;
            return (
              <Pressable
                key={idx}
                style={[mmS.pairCard, { width: cardW }, !pair && mmS.pairCardEmpty]}
                onPress={() => openAssetPicker(idx)}
              >
                {imgUrl ? (
                  <Image
                    source={{ uri: imgUrl }}
                    style={{ width: pairIconW, height: pairIconW }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      mmS.pairImgPlaceholder,
                      { width: pairIconW + 8, height: pairIconW + 8, borderRadius: 8 },
                    ]}
                  >
                    <Text style={mmS.pairImgPlaceholderText}>+</Text>
                  </View>
                )}
                <Text style={[mmS.pairLabel, cols === 6 && { fontSize: 8 }]} numberOfLines={1}>
                  {pair?.label ?? '—'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Modal
        visible={assetPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={closeAssetPicker}
      >
        <View style={mmS.modalOverlay}>
          <View style={[mmS.modalSheet, { paddingBottom: Math.max(insets.bottom, 32) }]}>
            <LinearGradient colors={['#F4EFFF', '#EDE4FF']} style={mmS.modalHeaderGrad}>
              <View style={mmS.modalHeaderRow}>
                <View>
                  <Text style={mmS.modalTitle}>Choose Image</Text>
                  <Text style={mmS.modalHint}>
                    {assetPickerTarget != null
                      ? `Slot ${assetPickerTarget.pairIdx + 1} — already-used are dimmed`
                      : ''}
                  </Text>
                </View>
                <Pressable onPress={closeAssetPicker} style={mmS.modalClose}>
                  <Text style={mmS.modalCloseText}>✕</Text>
                </Pressable>
              </View>
            </LinearGradient>
            <ScrollView
              contentContainerStyle={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                padding: MODAL_H_PAD,
                gap: ASSET_GAP,
              }}
              showsVerticalScrollIndicator={false}
            >
              {MEMORY_ASSETS.map((asset) => {
                const alreadyUsed =
                  assetPickerTarget != null
                    ? mmPairs.some(
                        (p, i) =>
                          i !== assetPickerTarget.pairIdx && p.imageUrl === asset.mediaPath,
                      )
                    : false;
                const isCurrent =
                  assetPickerTarget != null &&
                  mmPairs[assetPickerTarget.pairIdx]?.imageUrl === asset.mediaPath;
                return (
                  <Pressable
                    key={asset.id}
                    onPress={() => !alreadyUsed && applyAsset(asset)}
                    style={[
                      mmS.assetCell,
                      { width: assetCellW },
                      isCurrent && mmS.assetCellCurrent,
                      alreadyUsed && mmS.assetCellUsed,
                    ]}
                  >
                    {isCurrent && (
                      <View style={mmS.assetCurrentBadge}>
                        <Text style={mmS.assetCurrentBadgeText}>✓</Text>
                      </View>
                    )}
                    <Image
                      source={{ uri: `${API_BASE_URL}${asset.mediaPath}` }}
                      style={{ width: assetCellW * 0.58, height: assetCellW * 0.58 }}
                      resizeMode="contain"
                    />
                    <Text
                      style={[mmS.assetLabel, alreadyUsed && { color: '#C0C0D0' }]}
                      numberOfLines={1}
                    >
                      {asset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function JigsawConfigTab({
  draft,
  updateRaw,
}: {
  draft: QuestionDraft;
  updateRaw: (patch: Record<string, unknown>) => void;
}) {
  const raw = (draft.rawQuestionData as any) ?? {};
  const gridSize = ['2x2', '3x3', '4x4', '5x5'].includes(raw.gridSize) ? raw.gridSize : '3x3';
  const difficulty = ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium';
  const clickLimit = Number(raw.clickLimit ?? 20);

  return (
    <ScrollView contentContainerStyle={qFormS.tabContent}>
      <View style={mmS.section}>
        <Text style={mmS.sectionTitle}>Puzzle Settings</Text>
        <Text style={mmS.sectionHint}>Configure jigsaw board and challenge level.</Text>

        <Text style={[qFormS.fieldLabel, { marginTop: 6 }]}>Grid Size</Text>
        <View style={mmS.gridRow}>
          {(['2x2', '3x3', '4x4', '5x5'] as const).map((g) => {
            const sel = gridSize === g;
            return (
              <Pressable key={g} style={{ flex: 1 }} onPress={() => updateRaw({ gridSize: g })}>
                {sel ? (
                  <LinearGradient colors={['#0EA5E9', '#0284C7']} style={mmS.gridChipSel}>
                    <Text style={mmS.gridChipMainSel}>{g}</Text>
                    <Text style={mmS.gridChipSubSel}>
                      {Number(g.split('x')[0]) ** 2} pieces
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={mmS.gridChip}>
                    <Text style={mmS.gridChipMain}>{g}</Text>
                    <Text style={mmS.gridChipSub}>{Number(g.split('x')[0]) ** 2} pieces</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[qFormS.fieldLabel, { marginTop: 14 }]}>Difficulty</Text>
        <View style={mmS.clickGrid}>
          {(['easy', 'medium', 'hard'] as const).map((level) => {
            const sel = difficulty === level;
            return (
              <Pressable
                key={level}
                style={{ width: '31%' }}
                onPress={() => updateRaw({ difficulty: level })}
              >
                {sel ? (
                  <LinearGradient colors={['#0EA5E9', '#0284C7']} style={mmS.clickChipSel}>
                    <Text style={mmS.clickChipNumSel}>{level.toUpperCase()}</Text>
                    <Text style={mmS.clickChipSubSel}>mode</Text>
                  </LinearGradient>
                ) : (
                  <View style={mmS.clickChip}>
                    <Text style={mmS.clickChipNum}>{level.toUpperCase()}</Text>
                    <Text style={mmS.clickChipSub}>mode</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[qFormS.fieldLabel, { marginTop: 14 }]}>
          Move Limit (0 = Unlimited)
        </Text>
        <View style={mmS.clickGrid}>
          {[0, 20, 40, 60].map((limit) => {
            const sel = clickLimit === limit;
            return (
              <Pressable
                key={limit}
                style={{ width: '48%' }}
                onPress={() => updateRaw({ clickLimit: limit })}
              >
                {sel ? (
                  <LinearGradient colors={['#0EA5E9', '#0284C7']} style={mmS.clickChipSel}>
                    <Text style={mmS.clickChipNumSel}>{limit === 0 ? '∞' : limit}</Text>
                    <Text style={mmS.clickChipSubSel}>moves</Text>
                  </LinearGradient>
                ) : (
                  <View style={mmS.clickChip}>
                    <Text style={mmS.clickChipNum}>{limit === 0 ? '∞' : limit}</Text>
                    <Text style={mmS.clickChipSub}>moves</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function FillBlankTab({
  draft,
  updateRaw,
}: {
  draft: QuestionDraft;
  updateRaw: (patch: Record<string, unknown>) => void;
}) {
  const sentence: string = (draft.rawQuestionData as any)?.sentence ?? '';
  const answer: string = (draft.rawQuestionData as any)?.answer ?? '';
  const opts = (((draft.rawQuestionData as any)?.options ?? []) as string[]);
  const parts = sentence.split('___');
  const optCount = opts.length;
  const atMax = optCount >= 4;

  const setRaw = (patch: Record<string, unknown>) => updateRaw(patch);

  return (
    <ScrollView contentContainerStyle={[qFormS.tabContent, { gap: 16 }]}>
      {sentence.includes('___') && (
        <View style={fbS.previewBox}>
          <Text style={fbS.previewLabel}>PREVIEW</Text>
          <Text style={fbS.previewSentence}>
            <Text>{parts[0]}</Text>
            <Text
              style={[
                fbS.previewBlank,
                {
                  borderBottomColor: answer ? '#4CAF50' : '#2D5DC9',
                  color: answer ? '#2E7D32' : '#2D5DC9',
                },
              ]}
            >
              {' '}
              {answer || '___'}{' '}
            </Text>
            <Text>{parts[1] ?? ''}</Text>
          </Text>
        </View>
      )}

      <View style={fbS.section}>
        <View style={fbS.sectionHeader}>
          <View style={[fbS.sectionIcon, { backgroundColor: '#E8F4FF' }]}>
            <Text style={{ fontSize: 14 }}>📝</Text>
          </View>
          <View>
            <Text style={fbS.sectionTitle}>Sentence</Text>
            <Text style={fbS.sectionHint}>Use ___ to mark the blank</Text>
          </View>
        </View>
        <TextInput
          value={sentence}
          onChangeText={(v) => setRaw({ sentence: v })}
          placeholder="The ___ shines during the day."
          style={fbS.textArea}
          placeholderTextColor="#B0B8D0"
          multiline
        />
      </View>

      <View style={qFormS.secGroup}>
        <View style={qFormS.secHeader}>
          <Text style={qFormS.secTitle}>
            Answer Options{' '}
            <Text style={{ color: '#525C6B', fontWeight: '500', fontSize: 12 }}>
              ({optCount}/4)
            </Text>
          </Text>
          <Pressable
            disabled={atMax}
            style={[qFormS.addBtn, atMax && { backgroundColor: '#E8E8F0', opacity: 0.5 }]}
            onPress={() => setRaw({ options: [...opts, ''] })}
          >
            <Text style={[qFormS.addBtnText, atMax && { color: '#525C6B' }]}>+ Add</Text>
          </Pressable>
        </View>
        <Text style={qFormS.secHint}>
          Tap ○ next to an option to mark it as the correct answer.
        </Text>

        {optCount === 0 && (
          <Pressable
            style={fbS.emptyOptions}
            onPress={() => setRaw({ options: ['', '', ''] })}
          >
            <Text style={{ fontSize: 20, marginBottom: 6 }}>＋</Text>
            <Text style={fbS.emptyOptionsTxt}>Tap to add 3 starter options</Text>
          </Pressable>
        )}

        {opts.map((opt, idx) => {
          const isCorrect = opt !== '' && opt.toLowerCase() === answer.toLowerCase();
          return (
            <View key={idx} style={qFormS.optBlock}>
              <View style={qFormS.optBlockHeader}>
                <View
                  style={[qFormS.optNumBadge, isCorrect && { backgroundColor: '#7DC67A' }]}
                >
                  <Text style={[qFormS.optNum, isCorrect && { color: '#fff' }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={opt}
                    onChangeText={(v) => {
                      const updated = opts.map((o, i) => (i === idx ? v : o));
                      const newData: Record<string, unknown> = { options: updated };
                      if (isCorrect) newData.answer = v;
                      setRaw(newData);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    style={qFormS.optInput}
                    placeholderTextColor="#B0B8D0"
                  />
                </View>
                <Pressable
                  style={[qFormS.correctBtn, isCorrect && qFormS.correctBtnActive]}
                  onPress={() => {
                    if (opt.trim()) setRaw({ answer: opt.trim() });
                  }}
                >
                  <Text
                    style={[qFormS.correctBtnText, isCorrect && qFormS.correctBtnTextActive]}
                  >
                    {isCorrect ? '✓' : '○'}
                  </Text>
                </Pressable>
                <Pressable
                  style={qFormS.removeBtnWide}
                  onPress={() => {
                    const removed = opts.filter((_, i) => i !== idx);
                    const newData: Record<string, unknown> = { options: removed };
                    if (isCorrect) newData.answer = '';
                    setRaw(newData);
                  }}
                >
                  <Text style={qFormS.removeBtnText}>✕ Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={fbS.section}>
        <View style={fbS.sectionHeader}>
          <View style={[fbS.sectionIcon, { backgroundColor: '#FFF8E1' }]}>
            <Text style={{ fontSize: 14 }}>💡</Text>
          </View>
          <View>
            <Text style={fbS.sectionTitle}>
              Hint <Text style={fbS.optional}>(optional)</Text>
            </Text>
            <Text style={fbS.sectionHint}>Starting letters shown to students, e.g. "su"</Text>
          </View>
        </View>
        <TextInput
          value={(draft.rawQuestionData as any)?.hint ?? ''}
          onChangeText={(v) => setRaw({ hint: v })}
          placeholder="e.g. su"
          style={fbS.textInput}
          placeholderTextColor="#B0B8D0"
        />
      </View>
    </ScrollView>
  );
}

function PreviewTab({
  draft,
  editorMode,
  isLogicoMode,
  isMemoryMatchMode,
  isFillBlankMode,
  isJigsawMode,
  hasOptions,
  hasPairs,
  normalizedQuestionType,
  stage = 'all',
  compact = false,
}: {
  draft: QuestionDraft;
  editorMode: ReturnType<typeof getQuestionEditorMode>;
  isLogicoMode: boolean;
  isMemoryMatchMode: boolean;
  isFillBlankMode: boolean;
  isJigsawMode: boolean;
  hasOptions: boolean;
  hasPairs: boolean;
  normalizedQuestionType: string;
  stage?: 'prompt' | 'response' | 'all';
  compact?: boolean;
}) {
  const [memoryPreviewWidth, setMemoryPreviewWidth] = useState(0);
  const livePlayerConfig = useMemo(() => {
    return buildDraftPreviewPayload(draft, normalizedQuestionType);
  }, [draft, normalizedQuestionType]);

  const renderPromptStage = () => (
    <View style={qFormS.previewCard}>
      <View
        style={[
          qFormS.previewHero,
          { backgroundColor: QTYPES_BG[normalizedQuestionType] ?? '#D6EAFF' },
        ]}
      >
        <Text style={{ fontSize: compact ? 32 : 42 }}>{QTYPES_EMOJI[normalizedQuestionType] ?? ''}</Text>
        <View style={{ flex: 1 }}>
          <View
            style={[
              qFormS.previewTypeBadge,
              {
                backgroundColor: `${QTYPES_COLOR[normalizedQuestionType] ?? '#2D5DC9'}25`,
              },
            ]}
          >
            <Text
              style={[
                qFormS.previewTypeBadgeText,
                { color: QTYPES_COLOR[normalizedQuestionType] ?? '#2D5DC9' },
              ]}
            >
              {getQuestionTypeLabel(draft.questionType)}
            </Text>
          </View>
          <LatexText
            content={draft.questionTitle || 'Untitled Question'}
            style={qFormS.previewTitle}
            background="transparent"
          />
          {draft.classLevel ? (
            <Text style={qFormS.previewMeta}>
              {getStandardLabel(draft.classLevel)} · {draft.subject}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={qFormS.previewStats}>
        <View style={qFormS.previewStat}>
          <Text style={qFormS.previewStatVal}>{draft.points || '–'}</Text>
          <Text style={qFormS.previewStatLabel}>pts</Text>
        </View>
        <View style={qFormS.previewStat}>
          <Text style={qFormS.previewStatVal}>{draft.timeLimitSeconds || '–'}s</Text>
          <Text style={qFormS.previewStatLabel}>time</Text>
        </View>
        <View style={qFormS.previewStat}>
          <Text style={qFormS.previewStatVal}>
            {isFillBlankMode
              ? (((draft.rawQuestionData as any)?.options ?? []) as string[]).length
              : isJigsawMode
              ? Number(
                  (((draft.rawQuestionData as any)?.gridSize ?? '3x3').split('x')[0]) ** 2 || 9,
                )
              : isMemoryMatchMode
              ? (((draft.rawQuestionData as any)?.pairs ?? []) as MMPair[]).length
              : isLogicoMode
              ? 10
              : hasOptions
              ? draft.options.length
              : hasPairs
              ? draft.matchPairs.length
              : '–'}
          </Text>
          <Text style={qFormS.previewStatLabel}>
            {hasPairs
              ? 'pairs'
              : isMemoryMatchMode
              ? 'pairs'
              : isLogicoMode
              ? 'slots'
              : isJigsawMode
              ? 'pieces'
              : 'opts'}
          </Text>
        </View>
      </View>
      {draft.questionInstruction ? (
        <View style={qFormS.previewInstBlock}>
          <Text style={qFormS.previewInstText}>💬 {draft.questionInstruction}</Text>
        </View>
      ) : null}
      {draft.mainImage.trim() ? (
        <View style={{ padding: 14 }}>
          <SafeImage
            uri={resolveMediaUrl(draft.mainImage.trim())}
            style={[qFormS.previewImage, { borderRadius: 12 }]}
            resizeMode="contain"
          />
        </View>
      ) : null}
      {draft.explanation.trim() ? (
        <View
          style={{
            marginHorizontal: 14,
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            backgroundColor: '#EFF6FF',
            borderWidth: 1,
            borderColor: '#BFDBFE',
            gap: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#1D4ED8',
              textTransform: 'uppercase',
            }}
          >
            Solution Explanation
          </Text>
          <LatexText
            content={draft.explanation}
            background="transparent"
            style={{ fontSize: 13, color: '#1E3A8A' }}
          />
        </View>
      ) : null}
    </View>
  );

  const renderResponseStage = () => (
    <View style={qFormS.previewCard}>
      <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={qFormS.groupLabel}>LIVE STUDENT PLAYER</Text>
          {livePlayerConfig.isComplete ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#ECFDF5',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#A7F3D0',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#047857' }}>✓ Ready to Play</Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#FEF3C7',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#FDE68A',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#B45309' }}>Interactive Draft</Text>
            </View>
          )}
        </View>

        {!livePlayerConfig.isComplete && (
          <View
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#FED7AA',
              backgroundColor: '#FFFBEB',
              paddingHorizontal: 10,
              paddingVertical: 7,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 13 }}>💡</Text>
            <Text style={{ fontSize: 11, color: '#92400E', flex: 1, fontWeight: '500' }}>
              Draft preview simulation active. To finalize: {livePlayerConfig.error}
            </Text>
          </View>
        )}

        <SingleQuestionPlayer
          key={`live-${livePlayerConfig.questionType}-${(livePlayerConfig.questionData as any)?.grid ?? ''}-${((livePlayerConfig.questionData as any)?.pairs?.length ?? 0)}`}
          questionType={livePlayerConfig.questionType}
          questionTitle={draft.questionTitle || 'Untitled Question'}
          questionInstruction={draft.questionInstruction}
          questionAudio={livePlayerConfig.questionAudio}
          questionData={livePlayerConfig.questionData}
        />
      </View>

      {/* Logico Type Stage */}
      {isLogicoMode && (
        <View style={{ padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={qFormS.groupLabel}>LOGICO WORKSHEET & BUTTON MAPPINGS</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
              10 Buttons · 10 Slots
            </Text>
          </View>

          {draft.mainImage.trim() ? (
            <View style={{ alignItems: 'center' }}>
              <LogicoWorksheetImageOverlay
                imageUri={resolveMediaUrl(draft.mainImage.trim())}
                options={draft.options}
                height={280}
              />
            </View>
          ) : (
            <View
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 16,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                No Worksheet Image Set
              </Text>
              <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>
                Add your Logico card image in the Setup tab to see the interactive overlay preview here.
              </Text>
            </View>
          )}

          <View style={qFormS.logicoPreviewWrap}>
            {Array.from({ length: 10 }, (_, index) => {
              const slotId = index + 1;
              const mapped = draft.options.find(
                (o) => Number(o.slotPosition) === slotId,
              );
              return (
                <View
                  key={`logico-preview-slot-${slotId}`}
                  style={qFormS.logicoPreviewRow}
                >
                  <View style={qFormS.logicoPositionBadge}>
                    <Text style={qFormS.logicoPositionBadgeText}>{slotId}</Text>
                  </View>
                  <Text style={qFormS.logicoPreviewOptionText} numberOfLines={1}>
                    {mapped?.label || `Position ${slotId}`}
                  </Text>
                  {mapped ? (
                    <LogicoButtonBadge buttonId={mapped.id} size={24} />
                  ) : (
                    <View style={qFormS.logicoPreviewEmptyButton} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Choice Questions Type Stage */}
      {hasOptions && !isLogicoMode && (
        <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={qFormS.groupLabel}>ANSWER OPTIONS & SOLUTION KEY</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
              {draft.options.length} options
            </Text>
          </View>
          {draft.options.map((opt, i) => (
            <View
              key={i}
              style={[
                qFormS.previewOptRow,
                opt.isCorrect && { borderColor: '#7DC67A', borderWidth: 1.5 },
              ]}
            >
              <View
                style={[
                  qFormS.previewOptDot,
                  { backgroundColor: opt.isCorrect ? '#7DC67A' : '#E0E4F0' },
                ]}
              >
                <Text
                  style={{
                    color: opt.isCorrect ? '#fff' : '#525C6B',
                    fontSize: 11,
                    fontWeight: '800',
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={qFormS.previewOptText}>{opt.label || `Option ${i + 1}`}</Text>
                {opt.image ? (
                  <SafeImage
                    uri={resolveMediaUrl(opt.image)}
                    style={{ width: 44, height: 44, borderRadius: 6 }}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
              {opt.isCorrect ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    backgroundColor: '#ECFDF5',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#047857', fontWeight: '800' }}>✓ Correct</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Drag & Drop Pairs Type Stage */}
      {hasPairs && (
        <View style={{ padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={qFormS.groupLabel}>MATCHING PAIRS & DROP TARGETS</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
              {draft.matchPairs.length} pair{draft.matchPairs.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {draft.matchPairs.map((pair, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E8ECF4',
                padding: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E8ECF4',
                  padding: 8,
                }}
              >
                {pair.image ? (
                  <SafeImage
                    uri={resolveMediaUrl(pair.image)}
                    style={{ width: 36, height: 36, borderRadius: 6 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: '#EFF6FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>🎯</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>
                    {pair.itemLabel || `Item ${i + 1}`}
                  </Text>
                  {pair.audio ? (
                    <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '600' }}>🎵 Audio</Text>
                  ) : null}
                </View>
              </View>

              <Text style={{ color: '#64748B', fontWeight: '800', fontSize: 14 }}>↔</Text>

              <View
                style={{
                  flex: 1,
                  backgroundColor: '#EFF6FF',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                  padding: 10,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }} numberOfLines={1}>
                  {pair.targetLabel || `Target ${i + 1}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Fill in the Blank Type Stage */}
      {isFillBlankMode && (() => {
        const sentence: string = (draft.rawQuestionData as any)?.sentence ?? '';
        const answer: string = (draft.rawQuestionData as any)?.answer ?? '';
        const hint: string = (draft.rawQuestionData as any)?.hint ?? '';
        const fbOpts = (((draft.rawQuestionData as any)?.options ?? []) as string[]);
        const parts = sentence.split('___');
        return (
          <View style={{ padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <View
              style={{
                backgroundColor: '#F0F7FF',
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: '#C5D8F8',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: '#2D5DC9',
                  letterSpacing: 1,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Sentence Preview
              </Text>
              {sentence ? (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#1a1a2e',
                    textAlign: 'center',
                    lineHeight: 26,
                  }}
                >
                  <Text>{parts[0] ?? ''}</Text>
                  <Text
                    style={{
                      fontWeight: '900',
                      color: answer ? '#2E7D32' : '#2D5DC9',
                      borderBottomWidth: 2,
                      borderBottomColor: answer ? '#4CAF50' : '#2D5DC9',
                    }}
                  >
                    {' '}
                    {answer || (hint ? `${hint}___` : '___')}{' '}
                  </Text>
                  <Text>{parts[1] ?? ''}</Text>
                </Text>
              ) : (
                <Text
                  style={{
                    color: '#525C6B',
                    textAlign: 'center',
                    fontStyle: 'italic',
                  }}
                >
                  No sentence yet — use ___ to mark the blank
                </Text>
              )}
              {hint ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 10,
                    alignSelf: 'center',
                    backgroundColor: '#FFF8E1',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>💡</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#E6A020' }}>
                    Hint: "{hint}"
                  </Text>
                </View>
              ) : null}
            </View>
            {fbOpts.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#525C6B',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Options
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {fbOpts.map((opt, i) => {
                    const isCorrect =
                      answer && opt.toLowerCase() === answer.toLowerCase();
                    return (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 12,
                          borderWidth: isCorrect ? 2 : 1.5,
                          borderColor: isCorrect ? '#4CAF50' : '#D0D4E8',
                          backgroundColor: isCorrect ? '#E8F5E9' : '#F4F6FF',
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: isCorrect ? '#4CAF50' : '#C0C8D8',
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isCorrect ? '800' : '600',
                            color: isCorrect ? '#2E7D32' : '#3A3A5A',
                          }}
                        >
                          {opt}
                        </Text>
                        {isCorrect && (
                          <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '900' }}>
                            ✓
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                {!answer && (
                  <Text style={{ fontSize: 11, color: '#F97316', fontWeight: '600' }}>
                    ⚠ No correct answer selected yet
                  </Text>
                )}
              </View>
            )}
            {fbOpts.length === 0 && (
              <Text
                style={{
                  fontSize: 12,
                  color: '#525C6B',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}
              >
                No options added yet
              </Text>
            )}
          </View>
        );
      })()}

      {/* Memory Match Type Stage */}
      {isMemoryMatchMode && (() => {
        const pvGrid = ((draft.rawQuestionData as any)?.grid as string) || '4x4';
        const pvPairs = (((draft.rawQuestionData as any)?.pairs ?? []) as MMPair[]);
        const pvCols = GRID_COLS[pvGrid] ?? 4;
        const pvNeeded = GRID_PAIR_COUNTS[pvGrid] ?? 4;

        const displayPairs = [...pvPairs];
        const starterEmojis = ['🌟', '🍎', '🚀', '🐱', '🎨', '⚽', '🎸', '🌈'];
        const starterLabels = ['Star', 'Apple', 'Rocket', 'Cat', 'Art', 'Ball', 'Music', 'Rainbow'];
        while (displayPairs.length < pvNeeded) {
          const idx = displayPairs.length;
          displayPairs.push({
            id: 2000 + idx,
            label: `${starterLabels[idx % starterLabels.length]} (Slot ${idx + 1})`,
            emoji: starterEmojis[idx % starterEmojis.length],
          } as MMPair);
        }

        const allCards: (MMPair & { isPlaceholder?: boolean })[] = [];
        displayPairs.slice(0, pvNeeded).forEach((pair, pIdx) => {
          const isPlaceholder = pIdx >= pvPairs.length;
          allCards.push({ ...pair, isPlaceholder });
          allCards.push({ ...pair, isPlaceholder });
        });

        const fallbackW = Math.max(220, Math.min(Dimensions.get('window').width - 96, 520));
        const previewW = memoryPreviewWidth > 0 ? Math.min(memoryPreviewWidth, 520) : fallbackW;
        const GAP = pvCols === 6 ? 6 : 8;
        const maxPvCardW = pvCols === 6 ? 50 : pvCols === 4 ? 64 : 84;
        const pvCardW = Math.min(maxPvCardW, Math.max(30, Math.floor((previewW - GAP * (pvCols - 1)) / pvCols)));
        const pvRows: (MMPair & { isPlaceholder?: boolean })[][] = [];
        for (let i = 0; i < allCards.length; i += pvCols) {
          pvRows.push(allCards.slice(i, i + pvCols));
        }

        return (
          <View style={{ padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={qFormS.groupLabel}>MEMORY MATCH BOARD PREVIEW</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View
                  style={{
                    backgroundColor: '#EDE9FE',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#6D28D9' }}>Grid {pvGrid}</Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#F1F5F9',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#475569' }}>
                    {pvPairs.length}/{pvNeeded} Pairs
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ alignItems: 'center' }}>
              <View
                style={{ width: '100%', gap: GAP }}
                onLayout={(event) =>
                  setMemoryPreviewWidth(Math.max(220, event.nativeEvent.layout.width))
                }
              >
                {pvRows.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={{ flexDirection: 'row', gap: GAP, justifyContent: 'center' }}
                  >
                    {row.map((card, cIdx) => {
                      const imgUrl = (card?.imageUrl || card?.image)
                        ? resolveMediaUrl(card.imageUrl || card.image || '')
                        : undefined;
                      const isPlaceholder = card.isPlaceholder;
                      const pvIconW = Math.min(22, Math.max(13, pvCardW * 0.42));

                      return (
                        <View
                          key={cIdx}
                          style={{
                            width: pvCardW,
                            height: pvCardW,
                            backgroundColor: isPlaceholder ? '#F8FAFC' : '#EFF6FF',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: isPlaceholder ? '#CBD5E1' : '#BFDBFE',
                            borderStyle: isPlaceholder ? 'dashed' : 'solid',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            gap: 2,
                          }}
                        >
                          {imgUrl ? (
                            <SafeImage
                              uri={imgUrl}
                              style={{ width: pvIconW, height: pvIconW, borderRadius: 4 }}
                              resizeMode="contain"
                            />
                          ) : card.emoji ? (
                            <Text style={{ fontSize: Math.min(18, Math.max(11, pvCardW * 0.35)) }}>{card.emoji}</Text>
                          ) : (
                            <Text style={{ fontSize: 13, color: '#94A3B8' }}>🃏</Text>
                          )}
                          <Text
                            style={{
                              fontSize: pvCols === 6 ? 7.5 : 8.5,
                              fontWeight: '700',
                              color: isPlaceholder ? '#64748B' : '#1E40AF',
                              textAlign: 'center',
                            }}
                            numberOfLines={1}
                          >
                            {card.label || `Card`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {pvPairs.length < pvNeeded && (
              <View
                style={{
                  backgroundColor: '#FFFBEB',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#FDE68A',
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '700' }}>
                  {pvNeeded - pvPairs.length} more pair{pvNeeded - pvPairs.length > 1 ? 's' : ''} needed to complete the {pvGrid} board ({pvNeeded * 2} cards total).
                </Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Jigsaw Type Stage */}
      {isJigsawMode && (() => {
        const raw = (draft.rawQuestionData as any) ?? {};
        const gridSize = ['2x2', '3x3', '4x4', '5x5'].includes(raw.gridSize)
          ? raw.gridSize
          : '3x3';
        const difficulty = ['easy', 'medium', 'hard'].includes(raw.difficulty)
          ? raw.difficulty
          : 'medium';
        const clickLimit = Number(raw.clickLimit ?? 20);
        const puzzleImg = draft.mainImage.trim()
          ? resolveMediaUrl(draft.mainImage.trim())
          : 'https://placehold.co/600x600/E0F2FE/0369A1?text=Jigsaw+Puzzle+Preview';

        return (
          <View style={{ padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={qFormS.groupLabel}>JIGSAW PUZZLE BOARD</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={qFormS.previewTypeBadge}>
                  <Text style={qFormS.previewTypeBadgeText}>Grid {gridSize}</Text>
                </View>
                <View style={qFormS.previewTypeBadge}>
                  <Text style={qFormS.previewTypeBadgeText}>Difficulty {difficulty}</Text>
                </View>
                <View style={qFormS.previewTypeBadge}>
                  <Text style={qFormS.previewTypeBadgeText}>
                    {clickLimit > 0 ? `${clickLimit} moves` : 'Unlimited moves'}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E8ECF4',
                overflow: 'hidden',
              }}
            >
              <JigsawRenderer
                questionData={{
                  image: puzzleImg,
                  gridSize,
                  difficulty,
                  clickLimit,
                }}
                onComplete={() => {}}
                theme={{
                  bg: '#E0F2FE',
                  cardBg: '#F0F9FF',
                  accent: '#0EA5E9',
                  textColor: '#0C4A6E',
                  emoji: '🧩',
                  label: 'Jigsaw Puzzle',
                }}
              />
            </View>
          </View>
        );
      })()}
    </View>
  );

  if (stage === 'prompt') {
    return renderPromptStage();
  }
  if (stage === 'response') {
    return renderResponseStage();
  }
  if (compact) {
    return (
      <View style={{ gap: 14 }}>
        {renderPromptStage()}
        {renderResponseStage()}
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 40,
        width: '100%',
        maxWidth: 960,
        alignSelf: 'center',
        gap: 14,
      }}
    >
      {renderPromptStage()}
      {renderResponseStage()}
    </ScrollView>
  );
}

import { StyleSheet } from 'react-native';
const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,10,40,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  body: { fontSize: 13, color: '#5A6A8A' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { backgroundColor: '#F4F6FF', borderWidth: 1.5, borderColor: '#E0E4F0' },
  btnSecondaryText: { color: '#5A6A8A', fontWeight: '800', fontSize: 13 },
  btnDanger: { backgroundColor: '#FEE2E2', borderWidth: 1.5, borderColor: '#FECACA' },
  btnDangerText: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },
});
