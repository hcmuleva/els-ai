/**
 * ContentTab — full-screen classroom-style create/edit/details modals.
 * Matches TopicsTab UI style exactly.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  ChevronDown, ChevronUp, GripVertical, ChevronLeft,
  Play, Video as VideoIcon, Headphones, Image as ImageIcon, BookOpen,
  FileText, Film, Link, Layers, Plus, FolderOpen, Pencil, Trash2, Eye,
  Filter, LayoutList, Trophy, ListChecks, Search, X, Info,
} from 'lucide-react-native';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import { getAuthorizedClasses, getAuthorizedSubjects } from '../../utils/assignments';
import { AppUser } from '../../types/roles';
import SelectorModal from '../SelectorModal';
import PaginationControls from '../common/PaginationControls';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { createOffsetPageFetcher } from '../../utils/paginationFetcher';
import { API_BASE_URL } from '../../context/AuthContext';
import CreateQuizModal from '../quiz/CreateQuizModal';
import ConfirmModal from '../common/ConfirmModal';
import StudentContentViewer, { type StudentContentItem, type StudentTopicMeta } from '../subject/StudentContentViewer';
import MediaUploader from '../media/MediaUploader';
import VideoSectionBuilder from '../content/VideoSectionBuilder';
import QuizAttachPanel from '../content/QuizAttachPanel';
import { createVideoSectionsApi } from '../../api/videoSections';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Types ─────────────────────────────────────────────────────────────────────
export type LearningContentItem = {
  id: string; classLevel: string; subject: string;
  title: string; contentType: string; sectionCount?: number; quizCount?: number;
  mediaUrl?: string; externalUrl?: string; textContent?: string;
  sections?: ContentSection[];
  assignedTopics?: { topicId: string; title: string; classLevel: string; subject: string }[];
};

type ContentSection = {
  id?: string; sectionOrder?: number; title?: string;
  contentType: string; mediaUrl?: string; externalUrl?: string; textContent?: string;
  quizId?: string | null;
};

type SectionDraft = {
  draftId: string; title: string;
  contentType: 'youtube_url' | 'reel_url' | 'image' | 'audio' | 'text';
  mediaUrl: string; externalUrl: string; textContent: string;
  quizId: string | null;
};

type QuizLite = { id: string; title: string; classLevel?: string; subject?: string; questionCount?: number };

type ModalTab = 'setup' | 'sections' | 'preview';
type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveUrl(url?: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}
let _uid = 0;
function uid() { return `d-${++_uid}`; }
function makeSection(): SectionDraft {
  return { draftId: uid(), title: '', contentType: 'youtube_url', mediaUrl: '', externalUrl: '', textContent: '', quizId: null };
}
function moveUp<T>(arr: T[], idx: number): T[] {
  if (idx === 0) return arr;
  const a = [...arr]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a;
}
function moveDown<T>(arr: T[], idx: number): T[] {
  if (idx >= arr.length - 1) return arr;
  const a = [...arr]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a;
}

const CONTENT_COLORS  = ['#D6EAFF', '#FFE8D6', '#D6F5D6', '#EDE4FF', '#FFF5CC', '#FFE0F0'];
type SubjectCatalogItem = { classLevel: string; title: string; coverImage?: string; iconImage?: string; iconBgColor?: string };

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;
type TypeCfg = { Icon: LucideIcon; color: string; bg: string; label: string };
const TYPE_STYLE: Record<string, TypeCfg> = {
  video:       { Icon: Play,       color: '#FF4444', bg: '#FFE8D6', label: 'Video' },
  youtube_url: { Icon: Play,       color: '#FF4444', bg: '#FFE8D6', label: 'YouTube' },
  reel_url:    { Icon: Film,       color: '#E91E8C', bg: '#FFE0F0', label: 'Reel' },
  reel:        { Icon: Film,       color: '#E91E8C', bg: '#FFE0F0', label: 'Reel' },
  audio:       { Icon: Headphones, color: '#9B8EC4', bg: '#EDE4FF', label: 'Audio' },
  image:       { Icon: ImageIcon,  color: '#4A90E2', bg: '#D6EAFF', label: 'Image / Video' },
  text:        { Icon: BookOpen,   color: '#7DC67A', bg: '#D6F5D6', label: 'Text' },
  document:    { Icon: FileText,   color: '#4A90E2', bg: '#D6EAFF', label: 'Doc' },
};
const DEFAULT_TYPE: TypeCfg = { Icon: Layers, color: '#9A9AB0', bg: '#F4F4FB', label: '' };
function ts(t: string): TypeCfg { return TYPE_STYLE[t] ?? { ...DEFAULT_TYPE, label: t }; }

const SECTION_TYPE_CHOICES: { value: SectionDraft['contentType']; label: string; Icon: LucideIcon; color: string }[] = [
  { value: 'youtube_url', label: 'YouTube', Icon: Play,       color: '#FF4444' },
  { value: 'reel_url',    label: 'Reel URL', Icon: Film,      color: '#E91E8C' },
  { value: 'image',       label: 'Image / Video',    Icon: ImageIcon, color: '#4A90E2' },
  { value: 'audio',       label: 'Audio',    Icon: Headphones,color: '#9B8EC4' },
  { value: 'text',        label: 'Text',     Icon: BookOpen,  color: '#7DC67A' },
];

// SelectorSheet → replaced by shared SelectorModal component

// ── Content Details Modal ─────────────────────────────────────────────────────
function ContentDetailsModal({ item, apiFetch, onClose, onEdit }: {
  item: LearningContentItem | null;
  apiFetch: ApiFetch;
  onClose: () => void;
  onEdit: (item: LearningContentItem) => void;
}) {
  const [loading, setLoading]       = useState(false);
  const [detail, setDetail]         = useState<LearningContentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    if (!item) { setDetail(null); setPreviewOpen(false); return; }
    setLoading(true);
    apiFetch(`/content/items/${item.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setDetail(d as LearningContentItem); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item?.id]);

  const data = detail ?? item;
  const sections = data?.sections ?? [];
  const topics   = data?.assignedTopics ?? [];
  const style    = ts(data?.contentType ?? '');

  // Map content sections → StudentContentItem[]
  const previewContents: StudentContentItem[] = sections.map((sec, i) => ({
    id: sec.id ?? `sec-${i}`,
    title: sec.title || data?.title || '',
    contentType: sec.contentType,
    mediaUrl: sec.mediaUrl,
    externalUrl: sec.externalUrl,
    textContent: sec.textContent,
    quizId: sec.quizId,
    sortOrder: i,
  }));
  const previewTopic: StudentTopicMeta = {
    id: data?.id ?? '',
    classLevel: data?.classLevel ?? '',
    subject: data?.subject ?? '',
    title: data?.title ?? '',
  };

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[c.modalScreen, isDesktop && c.modalScreenDesktop]}>
        <View style={[c.modalInner, isDesktop && c.modalInnerDesktop]}>
          <View style={[c.modalHeader, { paddingTop: Math.max(insets.top, isDesktop ? 12 : 12) }]}>
            <Pressable onPress={onClose} style={c.modalBackBtn}><ChevronLeft size={24} color="#1a1a2e" /></Pressable>
            <Text style={c.modalTitle} numberOfLines={1}>Content Details</Text>
            {data && previewContents.length > 0 && (
              <Pressable style={c.previewBtn} onPress={() => setPreviewOpen(true)}>
                <Eye size={14} color="#7DC67A" />
                <Text style={c.previewBtnText}>Preview</Text>
              </Pressable>
            )}
            {data && (
              <Pressable style={c.modalSaveBtn} onPress={() => { onClose(); onEdit(data); }}>
                <Text style={c.modalSaveBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>

          {loading ? (
            <View style={c.centerWrap}><ActivityIndicator size="large" color="#4A90E2" /><Text style={c.loadingText}>Loading…</Text></View>
          ) : data ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Hero */}
              <View style={[c.detailHero, { backgroundColor: style.bg }]}>
                <View style={c.detailHeroIcon}>
                  <style.Icon size={48} color={style.color} />
                </View>
                <View style={c.detailHeroInfo}>
                  <View style={c.detailBadgeRow}>
                    <View style={[c.detailBadge, { backgroundColor: `${style.color}20` }]}>
                      <Text style={[c.detailBadgeText, { color: style.color }]}>{style.label}</Text>
                    </View>
                    <View style={c.detailBadge}>
                      <Text style={c.detailBadgeText}>{getStandardLabel(data.classLevel)} · {data.subject}</Text>
                    </View>
                  </View>
                  <Text style={c.detailTitle}>{data.title}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={c.statsRow}>
                <View style={c.statCard}>
                  <Text style={c.statVal}>{sections.length || data.sectionCount || 1}</Text>
                  <Text style={c.statLabel}>Sections</Text>
                </View>
                <View style={c.statCard}>
                  <Text style={c.statVal}>{topics.length}</Text>
                  <Text style={c.statLabel}>Topics</Text>
                </View>
              </View>

              {/* Sections */}
              <View style={c.detailSection}>
                <View style={c.detailSectionTitleRow}>
                  <LayoutList size={14} color="#4A90E2" />
                  <Text style={c.detailSectionTitle}>Sections</Text>
                </View>
                {sections.length === 0 ? (
                  <View style={c.emptyCard}><Text style={c.emptyText}>No sections loaded.</Text></View>
                ) : sections.map((sec, idx) => {
                  const ss = ts(sec.contentType);
                  const url = resolveUrl(sec.mediaUrl ?? sec.externalUrl);
                  return (
                    <View key={sec.id ?? idx} style={c.itemCard}>
                      <View style={[c.itemIcon, { backgroundColor: ss.bg }]}>
                        <ss.Icon size={20} color={ss.color} />
                      </View>
                      <View style={c.itemInfo}>
                        <Text style={c.itemTitle}>{sec.title || `Section ${idx + 1}`}</Text>
                        <View style={[c.typeChip, { backgroundColor: ss.bg, alignSelf: 'flex-start' }]}>
                          <Text style={[c.typeChipText, { color: ss.color }]}>{ss.label}</Text>
                        </View>
                        {sec.textContent ? <Text style={c.itemMeta} numberOfLines={2}>{sec.textContent}</Text> : null}
                        {url ? <Text style={c.itemMeta} numberOfLines={1}>{url}</Text> : null}
                      </View>
                      <View style={c.orderBadge}><Text style={c.orderBadgeText}>{idx + 1}</Text></View>
                    </View>
                  );
                })}
              </View>

              {/* Assigned topics */}
              {topics.length > 0 && (
                <View style={c.detailSection}>
                  <View style={c.detailSectionTitleRow}>
                    <FolderOpen size={14} color="#9B8EC4" />
                    <Text style={c.detailSectionTitle}>Assigned Topics</Text>
                  </View>
                  {topics.map((t) => (
                    <View key={t.topicId} style={c.topicRow}>
                      <Text style={c.topicRowTitle}>{t.title}</Text>
                      <Text style={c.topicRowMeta}>{getStandardLabel(t.classLevel)} · {t.subject}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
      {/* Student Preview */}
      <StudentContentViewer
        visible={previewOpen && previewContents.length > 0}
        contents={previewContents}
        startIdx={0}
        topic={previewTopic}
        onClose={() => setPreviewOpen(false)}
      />
    </Modal>
  );
}

// ── Content Create/Edit Modal ─────────────────────────────────────────────────
function ContentFormModal({ editingItem, apiFetch, topics, subjectCatalog, user, onClose, onSuccess, onUploadMedia }: {
  editingItem: LearningContentItem | null | 'new';
  apiFetch: ApiFetch;
  topics: { id: string; title: string; classLevel: string; subject: string }[];
  subjectCatalog: SubjectCatalogItem[];
  user: AppUser | null;
  onClose: () => void;
  onSuccess: () => void;
  onUploadMedia: (sectionDraftId: string, onProgress?: (pct: number) => void) => Promise<{ url: string; contentType: SectionDraft['contentType'] }>;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isOpen   = editingItem !== null;
  const isEdit   = editingItem !== null && editingItem !== 'new';
  const editId   = isEdit ? (editingItem as LearningContentItem).id : null;

  const [tab, setTab]           = useState<ModalTab>('setup');
  const [title, setTitle]       = useState('');
  const [classLevel, setClass]  = useState('');
  const [subject, setSubject]   = useState('');
  const [sections, setSections] = useState<SectionDraft[]>([makeSection()]);
  const [saving, setSaving]     = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [toast, setToast]       = useState<string | null>(null);
  const [classOpen, setClassOpen]   = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  // quiz attach (per section), story-style picker
  const [quizLibrary, setQuizLibrary] = useState<QuizLite[]>([]);
  const [quizPickerFor, setQuizPickerFor] = useState<string | null>(null); // section draftId
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const insets = useSafeAreaInsets();

  // Auto-load draft
  useEffect(() => {
    if (editingItem === 'new') {
      AsyncStorage.getItem('els_content_draft').then((str) => {
        if (str) {
          try {
            const parsed = JSON.parse(str);
            if (parsed.title) setTitle(parsed.title);
            if (parsed.classLevel) setClass(parsed.classLevel);
            if (parsed.subject) setSubject(parsed.subject);
            if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
              setSections(parsed.sections);
            }
          } catch (e) {}
        }
        setHasLoadedDraft(true);
      });
    } else {
      setHasLoadedDraft(true);
    }
  }, [editingItem]);

  // Auto-save draft
  useEffect(() => {
    if (editingItem === 'new' && hasLoadedDraft) {
      AsyncStorage.setItem('els_content_draft', JSON.stringify({
        title, classLevel, subject, sections
      }));
    }
  }, [title, classLevel, subject, sections, editingItem, hasLoadedDraft]);

  const [quizCreatorFor, setQuizCreatorFor] = useState<string | null>(null); // section draftId
  const [studentPreviewOpen, setStudentPreviewOpen] = useState(false);
  // Id of a content item saved from within this modal (new-content flow), so the
  // Video Section Builder can attach sections before the modal is closed.
  const [savedContentId, setSavedContentId] = useState<string | null>(null);
  // Per-content-section video builder: which content section (1-based order) is
  // open in the modal, plus that section's video URL.
  const [videoSectionModalFor, setVideoSectionModalFor] = useState<{ order: number; url: string } | null>(null);
  // Live count of video learning sections per content section order.
  const [videoSectionCounts, setVideoSectionCounts] = useState<Record<number, number>>({});
  // Toggles the quiz/video mutual-exclusivity info note in the Sections header.
  const [showSectionInfo, setShowSectionInfo] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const run = async () => {
      try {
        const merged: any[] = [];
        let offset = 0;
        let guard = 0;
        while (!cancelled && guard < 1000) {
          // Load the full library so any quiz (any class/subject) can be attached.
          const query = new URLSearchParams({ status: 'all', limit: '200', offset: String(offset) });
          const r = await apiFetch(`/quizzes/teacher/library?${query.toString()}`);
          if (!r.ok) break;
          const d = await r.json();
          const rows = Array.isArray(d.quizzes) ? d.quizzes : Array.isArray(d.items) ? d.items : [];
          merged.push(...rows);
          if (rows.length === 0) break;
          const total = Number(d.total ?? NaN);
          if (Number.isFinite(total)) {
            if (merged.length >= total) break;
          } else if (rows.length < 200) {
            break;
          }
          offset += rows.length;
          guard += 1;
        }
        if (cancelled) return;
        setQuizLibrary(merged.map((q: any) => ({
          id: q.id, title: q.title || 'Untitled', classLevel: q.class_level, subject: q.subject,
          questionCount: q.total_questions ?? q.questionCount ?? 0,
        })));
      } catch {
        if (!cancelled) setQuizLibrary([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, isOpen]);

  const classOptions = useMemo(() =>
    getAuthorizedClasses(user, STANDARD_OPTIONS.map((o) => o.value))
      .map((v) => ({ label: getStandardLabel(v), value: v })),
    [user]
  );
  const subjectOptions = useMemo(() => {
    const authorizedItems = getAuthorizedSubjects(user, subjectCatalog, (i) => i.classLevel, (i) => i.title, classLevel || undefined);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    authorizedItems.forEach((title) => {
      if (!byTitle.has(title)) {
        const meta = subjectCatalog.find((i) => i.title.trim() === title && (!classLevel || i.classLevel === classLevel || i.classLevel === 'ANY'));
        byTitle.set(title, { coverImage: meta?.coverImage, iconUrl: meta?.iconImage, iconBgColor: meta?.iconBgColor });
      }
    });
    if (subject && !byTitle.has(subject)) byTitle.set(subject, {});
    return Array.from(byTitle.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, icon]) => ({
        label: title,
        value: title,
        coverImage: icon.coverImage,
        iconUrl: icon.iconUrl,
        iconBgColor: icon.iconBgColor,
      }));
  }, [classLevel, subject, subjectCatalog, user]);

  // The content id sections attach to: an existing item when editing, or the id
  // returned after saving a brand-new content item from this modal.
  const effectiveContentId = editId || savedContentId;

  // A content section can host video learning sections when it is a video URL
  // section (YouTube or reel) that carries a URL.
  const sectionVideoUrl = useCallback((sec: SectionDraft): string => {
    if (sec.contentType === 'youtube_url' || sec.contentType === 'reel_url') {
      return sec.externalUrl?.trim() || sec.mediaUrl?.trim() || '';
    }
    return '';
  }, []);

  // Load counts of video learning sections grouped by content section order.
  const loadVideoSectionCounts = useCallback(async () => {
    if (!effectiveContentId) { setVideoSectionCounts({}); return; }
    try {
      const rows = await createVideoSectionsApi(apiFetch).list(effectiveContentId);
      const counts: Record<number, number> = {};
      rows.forEach((r) => {
        const ord = r.contentSectionOrder ?? 1;
        counts[ord] = (counts[ord] || 0) + 1;
      });
      setVideoSectionCounts(counts);
    } catch {
      /* keep last known counts on failure */
    }
  }, [effectiveContentId, apiFetch]);

  // Quiz and video sections are mutually exclusive per content section: when a
  // quiz is attached to a section, any video sections on it are removed.
  const removeVideoSectionsForDraft = useCallback(async (draftId: string) => {
    const order = sections.findIndex((s) => s.draftId === draftId) + 1;
    if (order < 1) return;
    if (effectiveContentId) {
      try {
        const api = createVideoSectionsApi(apiFetch);
        const rows = await api.list(effectiveContentId, order);
        await Promise.all(rows.map((r) => api.remove(r.id)));
      } catch {
        /* best-effort cleanup */
      }
    }
    setVideoSectionCounts((prev) => ({ ...prev, [order]: 0 }));
  }, [sections, effectiveContentId, apiFetch]);

  useEffect(() => {
    if (isOpen && tab === 'sections') loadVideoSectionCounts();
  }, [isOpen, tab, loadVideoSectionCounts]);

  // Load existing data when editing
  useEffect(() => {
    if (!isOpen) return;
    setTab('setup'); setToast(null); setStudentPreviewOpen(false); setSavedContentId(null);
    if (!isEdit) {
      setTitle(''); setClass(''); setSubject('');
      setSections([makeSection()]);
      return;
    }
    setLoadingEdit(true);
    apiFetch(`/content/items/${editId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: LearningContentItem | null) => {
        if (!d) return;
        setTitle(d.title); setClass(d.classLevel); setSubject(d.subject);
        const rawSections = d.sections?.length ? d.sections : [{
          contentType: d.contentType, mediaUrl: d.mediaUrl ?? '',
          externalUrl: d.externalUrl ?? '', textContent: d.textContent ?? '',
        }];
        setSections(rawSections.map((s) => ({
          draftId: uid(),
          title: s.title ?? '',
          contentType: (s.contentType as SectionDraft['contentType']) ?? 'youtube_url',
          mediaUrl: s.mediaUrl ?? '',
          externalUrl: s.externalUrl ?? '',
          textContent: s.textContent ?? '',
          quizId: s.quizId ?? null,
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingEdit(false));
  }, [isOpen, editId]);

  useEffect(() => {
    if (tab !== 'preview') {
      setStudentPreviewOpen(false);
    }
  }, [tab]);

  const updateSection = useCallback((id: string, patch: Partial<SectionDraft>) => {
    setSections((p) => p.map((s) => s.draftId === id ? { ...s, ...patch } : s));
  }, []);

  const previewTopic: StudentTopicMeta = useMemo(() => ({
    id: editId || 'preview',
    classLevel: classLevel || '',
    subject: subject || '',
    title: title.trim() || 'Preview',
  }), [classLevel, editId, subject, title]);

  const previewContents: StudentContentItem[] = useMemo(
    () =>
      sections.map((section, index) => ({
        id: section.draftId,
        title: section.title.trim() || `Section ${index + 1}`,
        contentType: section.contentType,
        mediaUrl: section.mediaUrl.trim() || undefined,
        externalUrl: section.externalUrl.trim() || undefined,
        textContent: section.textContent.trim() || undefined,
        quizId: section.quizId || undefined,
        sortOrder: index + 1,
      })),
    [sections],
  );

  const handleUpload = async (draftId: string) => {
    setUploadingId(draftId);
    setUploadProgress(0);
    try {
      const { url, contentType } = await onUploadMedia(draftId, setUploadProgress);
      updateSection(draftId, { mediaUrl: url, contentType, externalUrl: '', textContent: '' });
    } catch (e: any) {
      if (e?.message !== 'UPLOAD_CANCELLED') setToast('Upload failed.'); 
    }
    finally { 
      setUploadingId(null); 
      setUploadProgress(null);
    }
  };

  // Persists the content (create or update) and returns the content id, without
  // closing the modal. Returns null on validation/request failure.
  const persistContent = async (): Promise<string | null> => {
    if (!title.trim() || !classLevel || !subject) {
      setToast('Title, class and subject are required.'); return null;
    }
    const normalized = sections.map((s) => ({
      title: s.title.trim() || undefined,
      contentType: s.contentType,
      mediaUrl: s.mediaUrl.trim() || undefined,
      externalUrl: s.externalUrl.trim() || undefined,
      textContent: s.textContent.trim() || undefined,
      quizId: s.quizId || undefined,
    }));
    const invalid = normalized.findIndex((s) => {
      if (s.contentType === 'text') return !s.textContent;
      if (s.contentType === 'youtube_url' || s.contentType === 'reel_url') return !s.externalUrl;
      return !s.mediaUrl;
    });
    if (invalid > -1) { setToast(`Section ${invalid + 1} is incomplete.`); return null; }

    setSaving(true);
    try {
      const targetId = editId || savedContentId;
      const endpoint = targetId ? `/content/items/${targetId}` : '/content/items';
      const method   = targetId ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify({ classLevel, subject, title: title.trim(), sections: normalized }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed'); }
      const data = await res.json().catch(() => ({}));
      if (editingItem === 'new') {
        AsyncStorage.removeItem('els_content_draft');
      }
      return targetId || (data?.id as string | undefined) || null;
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to save');
      return null;
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    const id = await persistContent();
    if (id) { onSuccess(); onClose(); }
  };

  // Persist the content (so DB section_order matches the UI order) then open the
  // per-section video builder modal for the content section at `order`.
  const openVideoSectionsFor = async (order: number, url: string) => {
    if (!url) { setToast('Add a video URL to this section first.'); return; }
    const id = await persistContent();
    if (!id) return;
    setSavedContentId(id);
    setVideoSectionModalFor({ order, url });
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[c.modalScreen, isDesktop && c.modalScreenDesktop]}>
        <View style={[c.modalInner, isDesktop && c.modalInnerDesktop]}>
          {/* Header */}
        <View style={[c.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable onPress={onClose} style={c.modalBackBtn}><ChevronLeft size={24} color="#1a1a2e" /></Pressable>
          <Text style={c.modalTitle} numberOfLines={1}>{isEdit ? 'Edit Content' : 'New Content'}</Text>
          <Pressable style={c.modalSaveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={c.modalSaveBtnText}>Save</Text>}
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={c.modalTabBar}>
          {([
            ['setup', '⚙ Setup'],
            ['sections', '📄 Sections'],
            ['preview', '👁 Preview'],
          ] as [ModalTab, string][]).map(([t, l]) => (
            <Pressable
              key={t}
              style={[c.modalTab, tab === t && c.modalTabActive]}
              onPress={() => {
                setTab(t as ModalTab);
                if (t === 'preview') setStudentPreviewOpen(true);
              }}
            >
              <Text style={[c.modalTabText, tab === t && c.modalTabTextActive]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {toast && (
          <View style={c.inlineToast}><Text style={c.inlineToastText}>{toast}</Text></View>
        )}

        {loadingEdit ? (
          <View style={c.centerWrap}><ActivityIndicator size="large" color="#4A90E2" /></View>
        ) : (
          <>
            {/* ── SETUP ── */}
            {tab === 'setup' && (
              <ScrollView contentContainerStyle={c.tabContent}>
                <View style={c.fieldGroup}>
                  <Text style={c.groupLabel}>BASIC INFO</Text>
                  <View style={c.fieldCard}>
                    <Text style={c.fieldLabel}>Content Title *</Text>
                    <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Story of the Lion" style={c.fieldInput} placeholderTextColor="#B0B8D0" />
                  </View>
                </View>
                <View style={c.fieldGroup}>
                  <Text style={c.groupLabel}>CLASS SETTINGS</Text>
                  <View style={c.fieldCard}>
                    <Text style={c.fieldLabel}>Standard / Class *</Text>
                    <Pressable style={c.selectorRow} onPress={() => setClassOpen(true)}>
                      <Text style={classLevel ? c.selectorVal : c.selectorPlaceholder}>{classLevel ? getStandardLabel(classLevel) : 'Select Standard'}</Text>
                      <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                    </Pressable>
                    <View style={c.fieldDivider} />
                    <Text style={c.fieldLabel}>Subject *</Text>
                    <Pressable style={c.selectorRow} onPress={() => setSubjectOpen(true)}>
                      <Text style={subject ? c.selectorVal : c.selectorPlaceholder}>{subject || 'Select Subject'}</Text>
                      <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* ── SECTIONS ── */}
            {tab === 'sections' && (
              <ScrollView contentContainerStyle={c.tabContent}>
                <View style={c.secGroup}>
                  <View style={c.secGroupHeader}>
                    <Text style={c.secGroupTitle}>📄 Content Sections</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Pressable onPress={() => setShowSectionInfo((v) => !v)} hitSlop={8} style={c.secInfoBtn}>
                        <Info size={18} color="#4A90E2" />
                      </Pressable>
                      <Pressable style={c.addSecBtn} onPress={() => setSections((p) => [...p, makeSection()])}>
                        <Text style={c.addSecBtnText}>+ Add</Text>
                      </Pressable>
                    </View>
                  </View>

                  {showSectionInfo && (
                    <View style={c.secInfoNote}>
                      <Info size={14} color="#4A90E2" />
                      <Text style={c.secInfoNoteText}>
                        A section can have either a Quick Challenge quiz or Video Sections, not both. Attaching or creating a quiz removes that section's video sections, and adding video sections hides the quiz options.
                      </Text>
                    </View>
                  )}

                  {sections.map((sec, idx) => {
                    const isUrl  = sec.contentType === 'youtube_url' || sec.contentType === 'reel_url';
                    const isText = sec.contentType === 'text';
                    const isMedia = !isUrl && !isText;
                    const hasVideoSections = (videoSectionCounts[idx + 1] || 0) > 0;

                    return (
                      <View key={sec.draftId} style={c.sectionBlock}>
                        {/* Section header with order controls */}
                        <View style={c.sectionBlockHeader}>
                          <View style={c.dragHandle}><GripVertical size={16} color="#B0B8D0" /><Text style={c.sectionItemOrder}>{idx + 1}</Text></View>
                          <TextInput
                            value={sec.title}
                            onChangeText={(v) => updateSection(sec.draftId, { title: v })}
                            placeholder={`Section ${idx + 1} title (optional)`}
                            style={c.sectionTitleInput}
                            placeholderTextColor="#B0B8D0"
                          />
                          <View style={c.sectionHeaderActions}>
                            <TouchableOpacity onPress={() => setSections((p) => moveUp(p, idx))} disabled={idx === 0} style={[c.orderBtn, idx === 0 && { opacity: 0.2 }]}>
                              <ChevronUp size={14} color="#4A90E2" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setSections((p) => moveDown(p, idx))} disabled={idx === sections.length - 1} style={[c.orderBtn, idx === sections.length - 1 && { opacity: 0.2 }]}>
                              <ChevronDown size={14} color="#4A90E2" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setSections((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p)} style={c.removeBtn}>
                              <Text style={c.removeBtnText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Type chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingBottom: 10 }}>
                          {SECTION_TYPE_CHOICES.map((choice) => {
                            const active = sec.contentType === choice.value;
                            const cs = ts(choice.value);
                            return (
                              <Pressable
                                key={choice.value}
                                style={[c.typeChipBtn, active && { backgroundColor: cs.bg, borderColor: cs.color }]}
                                onPress={() => updateSection(sec.draftId, { contentType: choice.value, mediaUrl: '', externalUrl: '', textContent: '' })}
                              >
                                <choice.Icon size={14} color={active ? cs.color : '#9A9AB0'} />
                                <Text style={[c.typeChipBtnText, active && { color: cs.color, fontWeight: '800' }]}>{choice.label}</Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>

                        {/* Content input */}
                        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                          {isText ? (
                            <TextInput
                              value={sec.textContent}
                              onChangeText={(v) => updateSection(sec.draftId, { textContent: v })}
                              placeholder="Enter text content…"
                              multiline style={[c.fieldInput, { minHeight: 80, backgroundColor: '#F8F9FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#ECEEF4' }]}
                              placeholderTextColor="#B0B8D0"
                            />
                          ) : isUrl ? (
                            <TextInput
                              value={sec.externalUrl}
                              onChangeText={(v) => updateSection(sec.draftId, { externalUrl: v })}
                              placeholder={sec.contentType === 'youtube_url' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                              autoCapitalize="none"
                              style={[c.fieldInput, { backgroundColor: '#F8F9FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#ECEEF4' }]}
                              placeholderTextColor="#B0B8D0"
                            />
                          ) : (
                            <View style={{ gap: 8 }}>
                              {!sec.mediaUrl && (
                                <TextInput
                                  value={sec.mediaUrl}
                                  onChangeText={(v) => updateSection(sec.draftId, { mediaUrl: v })}
                                  placeholder="Or paste media URL…"
                                  autoCapitalize="none"
                                  style={[c.fieldInput, { backgroundColor: '#F8F9FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#ECEEF4' }]}
                                  placeholderTextColor="#B0B8D0"
                                />
                              )}
                              <MediaUploader
                                accept={sec.contentType === 'audio' ? 'audio/*' : 'image/*,video/*'}
                                mediaType={sec.contentType === 'audio' ? 'audio' : 'image'}
                                value={sec.mediaUrl}
                                fileName={sec.mediaUrl ? sec.mediaUrl.split('/').pop() : ''}
                                onUploadSuccess={(url) => updateSection(sec.draftId, { mediaUrl: url })}
                                onClear={() => updateSection(sec.draftId, { mediaUrl: '' })}
                                buttonLabel={`Upload ${sec.contentType === 'audio' ? 'Audio' : 'Image / Video'}`}
                              />
                            </View>
                          )}
                        </View>

                        {/* Quiz attach (Quick Challenge, story-style) */}
                        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
                          <Text style={c.quizAttachLabel}>QUICK CHALLENGE QUIZ</Text>
                          {sec.quizId ? (() => {
                            const q = quizLibrary.find((x) => x.id === sec.quizId);
                            return (
                              <View style={c.quizAttachedCard}>
                                <View style={c.quizAttachedIcon}><Trophy size={15} color="#7C3AED" /></View>
                                <View style={{ flex: 1 }}>
                                  <Text style={c.quizAttachedTitle} numberOfLines={1}>{q?.title || `Quiz #${sec.quizId.slice(0, 8)}`}</Text>
                                  <Text style={c.quizAttachedMeta}>{q?.questionCount ?? 0} questions</Text>
                                </View>
                                <TouchableOpacity onPress={() => updateSection(sec.draftId, { quizId: null })} style={c.removeBtn}>
                                  <Text style={c.removeBtnText}>✕</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })() : hasVideoSections ? (
                            <View style={c.quizBlockedNote}>
                              <Info size={13} color="#9A9AB0" />
                              <Text style={c.quizBlockedNoteText}>Not available — this section has video sections.</Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Pressable
                                style={[c.quizAttachBtn, { flex: 1 }]}
                                onPress={() => setQuizPickerFor(sec.draftId)}
                              >
                                <ListChecks size={16} color="#7C3AED" />
                                <Text style={c.quizAttachBtnText}>Attach a quiz</Text>
                              </Pressable>
                              <Pressable
                                style={[c.quizAttachBtn, { flex: 1, borderColor: '#86BFFF', backgroundColor: '#EBF4FF' }]}
                                onPress={() => setQuizCreatorFor(sec.draftId)}
                              >
                                <Plus size={16} color="#4A90E2" />
                                <Text style={[c.quizAttachBtnText, { color: '#4A90E2' }]}>Create new quiz</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>

                        {/* Per-section video learning sections (hidden when a quiz is attached) */}
                        {sectionVideoUrl(sec) && !sec.quizId ? (
                          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                            <Pressable style={c.videoSecBtn} onPress={() => openVideoSectionsFor(idx + 1, sectionVideoUrl(sec))}>
                              <Film size={16} color="#2FA36B" />
                              <Text style={c.videoSecBtnText}>Video Sections ({videoSectionCounts[idx + 1] || 0})</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

              </ScrollView>
            )}

            {/* ── PREVIEW ── */}
            {tab === 'preview' && (
              <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
                <View style={c.previewCard}>
                  <View style={[c.previewHeader, { backgroundColor: '#4A7FE0' }]}>
                    <Text style={c.previewTitle}>Student View Preview</Text>
                    <Text style={c.previewSub}>Uses the same student renderer with media players and quiz player.</Text>
                  </View>
                  <View style={[c.previewBody, { gap: 12 }]}>
                    <Text style={c.previewItemMeta}>
                      {previewContents.length} section{previewContents.length !== 1 ? 's' : ''} · {classLevel ? getStandardLabel(classLevel) : 'No class'} · {subject || 'No subject'}
                    </Text>
                    <Pressable style={c.uploadBtn} onPress={() => setStudentPreviewOpen(true)} disabled={previewContents.length === 0}>
                      <Text style={c.uploadBtnText}>Open Full Student Preview</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <SelectorModal visible={classOpen}   title="Select Class"   options={classOptions}   selected={classLevel} onSelect={(v) => { setClass(v); setSubject(''); }}   onClose={() => setClassOpen(false)} />
      <SelectorModal visible={subjectOpen} title="Select Subject" options={subjectOptions} selected={subject}     isSubject onSelect={setSubject} onClose={() => setSubjectOpen(false)} />

      {/* Per-content-section video learning sections builder */}
      <Modal
        visible={videoSectionModalFor !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { setVideoSectionModalFor(null); loadVideoSectionCounts(); }}
      >
        <View style={c.modalScreen}>
          <View style={[c.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable onPress={() => { setVideoSectionModalFor(null); loadVideoSectionCounts(); }} style={c.modalBackBtn}>
              <ChevronLeft size={24} color="#1a1a2e" />
            </Pressable>
            <Text style={c.modalTitle} numberOfLines={1}>🎬 Video Sections</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={c.tabContent}>
            {videoSectionModalFor && effectiveContentId ? (
              <View style={{ paddingBottom: 24 }}>
                <Text style={{ fontSize: 13, color: '#5A5A7A', lineHeight: 19, marginBottom: 12 }}>
                  Divide this video into timed learning sections, each with its own quiz.
                </Text>
                <VideoSectionBuilder
                  contentId={effectiveContentId}
                  contentSectionOrder={videoSectionModalFor.order}
                  videoUrl={videoSectionModalFor.url}
                  apiFetch={apiFetch}
                  classLevel={classLevel}
                  subject={subject}
                  user={user}
                  subjectCatalog={subjectCatalog}
                  onSectionsChange={(rows) =>
                    setVideoSectionCounts((prev) => ({ ...prev, [videoSectionModalFor.order]: rows.length }))
                  }
                />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <CreateQuizModal
        visible={quizCreatorFor !== null}
        apiFetch={apiFetch}
        user={user}
        initialClassLevel={classLevel || undefined}
        initialSubject={subject || undefined}
        subjectCatalog={subjectCatalog}
        onClose={() => setQuizCreatorFor(null)}
        onCreated={(quiz) => {
          setQuizLibrary((prev) => {
            if (prev.some((q) => q.id === quiz.id)) return prev;
            return [
              { id: quiz.id, title: quiz.title, classLevel: quiz.classLevel, subject: quiz.subject, questionCount: quiz.questionCount },
              ...prev,
            ];
          });
          if (quizCreatorFor) { const d = quizCreatorFor; updateSection(d, { quizId: quiz.id }); removeVideoSectionsForDraft(d); }
          setQuizCreatorFor(null);
        }}
      />

      {/* ── Quiz picker (per section) — same panel as the video sections ── */}
      <QuizAttachPanel
        visible={quizPickerFor !== null}
        apiFetch={apiFetch}
        classLevel={classLevel || undefined}
        subject={subject || undefined}
        currentQuizId={sections.find((s) => s.draftId === quizPickerFor)?.quizId || undefined}
        onAttach={(quizId) => { if (quizPickerFor) { const d = quizPickerFor; updateSection(d, { quizId }); removeVideoSectionsForDraft(d); } }}
        onDetach={() => { if (quizPickerFor) updateSection(quizPickerFor, { quizId: null }); }}
        onCreateNew={() => { const s = quizPickerFor; setQuizPickerFor(null); setQuizCreatorFor(s); }}
        onClose={() => setQuizPickerFor(null)}
      />
      <StudentContentViewer
        visible={studentPreviewOpen && tab === 'preview' && previewContents.length > 0}
        contents={previewContents}
        startIdx={0}
        topic={previewTopic}
        onClose={() => setStudentPreviewOpen(false)}
      />
      </View>
    </Modal>
  );
}

// ── Content card ──────────────────────────────────────────────────────────────
function ContentCard({ item, idx, onAction }: {
  item: LearningContentItem; idx: number;
  onAction: (a: 'details' | 'edit' | 'delete') => void;
}) {
  const style = ts(item.contentType);
  const bg    = CONTENT_COLORS[idx % CONTENT_COLORS.length];
  const topics = item.assignedTopics ?? [];

  return (
    <View style={c.card}>
      <View style={c.cardTop}>
        <View style={[c.artBox, { backgroundColor: bg }]}>
          <style.Icon size={26} color={style.color} />
        </View>
        <View style={c.cardInfo}>
          <Text style={c.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={c.cardMeta}>{getStandardLabel(item.classLevel)} · {item.subject}</Text>
          <View style={c.cardChipRow}>
            <View style={[c.typeTag, { backgroundColor: style.bg }]}>
              <style.Icon size={10} color={style.color} />
              <Text style={[c.typeTagText, { color: style.color }]}>{style.label}</Text>
            </View>
            <View style={c.cardChip}>
              <LayoutList size={10} color="#5A7AB0" />
              <Text style={c.cardChipText}>{item.sectionCount ?? 1} section{(item.sectionCount ?? 1) !== 1 ? 's' : ''}</Text>
            </View>
            {topics.length > 0 && (
              <View style={c.cardChip}>
                <FolderOpen size={10} color="#9B8EC4" />
                <Text style={c.cardChipText}>{topics.length} topic{topics.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
            {(item.quizCount ?? 0) > 0 && (
              <View style={c.cardChip}>
                <Trophy size={10} color="#E65100" />
                <Text style={c.cardChipText}>{item.quizCount} quiz{(item.quizCount ?? 0) !== 1 ? 'zes' : ''}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={c.cardFooter}>
        <Pressable style={[c.footerBtn, { backgroundColor: '#EBF4FF' }]} onPress={() => onAction('details')}>
          <Eye size={13} color="#1A4DA2" />
          <Text style={[c.footerBtnText, { color: '#1A4DA2' }]}>Details</Text>
        </Pressable>
        <Pressable style={[c.footerBtn, { backgroundColor: '#FFF3E0' }]} onPress={() => onAction('edit')}>
          <Pencil size={13} color="#E65100" />
          <Text style={[c.footerBtnText, { color: '#E65100' }]}>Edit</Text>
        </Pressable>
        <Pressable style={[c.footerBtn, { backgroundColor: '#FEF0ED' }]} onPress={() => onAction('delete')}>
          <Trash2 size={13} color="#E05A3A" />
          <Text style={[c.footerBtnText, { color: '#E05A3A' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  enabled: boolean;
  reloadToken: number;
  deletingContentId: string | null;
  filters: { classLevel: string; subject: string };
  subjectCatalog: SubjectCatalogItem[];
  topics: { id: string; title: string; classLevel: string; subject: string }[];
  apiFetch: ApiFetch;
  user: AppUser | null;
  onFiltersChange: (f: { classLevel: string; subject: string }) => void;
  onApplyFilters: () => void;
  onDeleteContent: (id: string) => void;
  onRefresh: () => void;
  onUploadMedia: (draftId: string) => Promise<{ url: string; contentType: 'youtube_url' | 'reel_url' | 'image' | 'audio' | 'text' }>;
  message?: { type: 'success' | 'error'; text: string } | null;
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ContentTab({
  enabled, reloadToken, deletingContentId, filters, topics,
  subjectCatalog, user,
  apiFetch, onFiltersChange, onApplyFilters, onDeleteContent, onRefresh,
  onUploadMedia, message,
}: Props) {
  const { width } = useWindowDimensions();
  const numCols = width >= 768 ? 2 : 1;

  const [classFilterOpen, setClassFilterOpen]       = useState(false);
  const [subjectFilterOpen, setSubjectFilterOpen]   = useState(false);
  const [editingItem, setEditingItem]               = useState<LearningContentItem | null | 'new'>(null);
  const [detailsItem, setDetailsItem]               = useState<LearningContentItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem]   = useState<LearningContentItem | null>(null);
  const [searchQuery, setSearchQuery]               = useState('');

  const classOptions = useMemo(() =>
    getAuthorizedClasses(user, STANDARD_OPTIONS.map((o) => o.value))
      .map((v) => ({ label: getStandardLabel(v), value: v })),
    [user]
  );
  const subjectOptions = useMemo(() => {
    const authorizedItems = getAuthorizedSubjects(user, subjectCatalog, (i) => i.classLevel, (i) => i.title, filters.classLevel || undefined);
    const byTitle = new Map<string, { coverImage?: string; iconUrl?: string; iconBgColor?: string }>();
    authorizedItems.forEach((title) => {
      if (!byTitle.has(title)) {
        const meta = subjectCatalog.find((i) => i.title.trim() === title && (!filters.classLevel || i.classLevel === filters.classLevel || i.classLevel === 'ANY'));
        byTitle.set(title, { coverImage: meta?.coverImage, iconUrl: meta?.iconImage, iconBgColor: meta?.iconBgColor });
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
  }, [filters.classLevel, filters.subject, subjectCatalog, user]);

  // Debounce the search box into an applied (server-side) search term.
  const [appliedSearch, setAppliedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const pageSize = 10;
  const cacheKey = useMemo(
    () => `content|${filters.classLevel}|${filters.subject}|${appliedSearch}`,
    [filters.classLevel, filters.subject, appliedSearch],
  );
  const fetchPage = useMemo(() => {
    const baseQuery = new URLSearchParams();
    if (filters.classLevel.trim()) baseQuery.set('class_level', filters.classLevel.trim());
    if (filters.subject.trim()) baseQuery.set('subject', filters.subject.trim());
    if (appliedSearch.trim()) baseQuery.set('search', appliedSearch.trim());
    return createOffsetPageFetcher<LearningContentItem>({ apiFetch, endpoint: '/content/items', dataKey: 'items', baseQuery });
  }, [apiFetch, filters.classLevel, filters.subject, appliedSearch]);

  const pager = usePaginatedResource<LearningContentItem>({ cacheKey, pageSize, fetchPage, enabled, persist: true });
  const loadingContent = pager.loading;

  const firstReloadRef = useRef(true);
  useEffect(() => {
    if (firstReloadRef.current) { firstReloadRef.current = false; return; }
    pager.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return (
    <View style={c.root}>
      {/* Header */}
      <View style={c.pageHeader}>
        <View>
          <Text style={c.pageTitle}>Content</Text>
          <Text style={c.pageSub}>{pager.totalCount} item{pager.totalCount !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={c.createBtn} onPress={() => setEditingItem('new')}>
          <Plus size={14} color="#fff" />
          <Text style={c.createBtnText}>New Content</Text>
        </Pressable>
      </View>

      {/* Toast */}
      {message && (
        <View style={[c.toast, message.type === 'success' ? c.toastSuccess : c.toastError]}>
          <Text style={[c.toastText, message.type === 'success' ? c.toastSuccessText : c.toastErrorText]}>{message.text}</Text>
        </View>
      )}

      {/* Filters */}
      <View style={c.filterSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Filter size={11} color="#9A9AB0" />
          <Text style={[c.filterLabel, { marginBottom: 0 }]}>Filters</Text>
        </View>
        <View style={c.searchBar}>
          <Search size={14} color="#9A9AB0" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search content..."
            placeholderTextColor="#A0A8C0"
            style={c.searchBarInput}
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={14} color="#9A9AB0" />
            </Pressable>
          )}
        </View>
        <View style={c.filterRow}>
          <Pressable style={[c.chip, !!filters.classLevel && c.chipActive]} onPress={() => setClassFilterOpen(true)}>
            <Text style={[c.chipText, !!filters.classLevel && c.chipTextActive]}>
              {filters.classLevel ? getStandardLabel(filters.classLevel) : 'All Classes'}
            </Text>
          </Pressable>
          <Pressable style={[c.chip, !!filters.subject && c.chipActive]} onPress={() => setSubjectFilterOpen(true)}>
            <Text style={[c.chipText, !!filters.subject && c.chipTextActive]}>{filters.subject || 'All Subjects'}</Text>
          </Pressable>
          {(filters.classLevel || filters.subject) && (
            <Pressable style={c.clearChip} onPress={() => { onFiltersChange({ classLevel: '', subject: '' }); onApplyFilters(); }}>
              <Text style={c.clearChipText}>✕ Clear</Text>
            </Pressable>
          )}
          <Pressable style={c.applyBtn} onPress={onApplyFilters} disabled={loadingContent}>
            {loadingContent ? <ActivityIndicator size="small" color="#fff" /> : <Text style={c.applyBtnText}>Apply</Text>}
          </Pressable>
        </View>
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        <FlashList
          key={numCols}
          data={pager.data}
          keyExtractor={(item) => item.id}
          numColumns={numCols}
          contentContainerStyle={c.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={numCols === 2 ? { flex: 1, marginHorizontal: 6 } : undefined}>
              <ContentCard
                item={item}
                idx={(pager.currentPage - 1) * pager.pageSize + index}
                onAction={(action) => {
                  if (action === 'details') setDetailsItem(item);
                  else if (action === 'edit') setEditingItem(item);
                  else if (action === 'delete') setConfirmDeleteItem(item);
                }}
              />
            </View>
          )}
          ListEmptyComponent={
            loadingContent ? (
              <View style={c.emptyWrap}><ActivityIndicator size="large" color="#4A90E2" /><Text style={c.loadingText}>Loading content…</Text></View>
            ) : pager.error ? (
              <View style={c.emptyWrap}>
                <VideoIcon size={36} color="#D0D8F0" />
                <Text style={c.emptyTitle}>Couldn’t load content</Text>
                <Text style={c.emptySub}>{pager.error}</Text>
                <Pressable style={c.emptyBtn} onPress={pager.retry}><Text style={c.emptyBtnText}>Retry</Text></Pressable>
              </View>
            ) : (
              <View style={c.emptyWrap}>
                <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#FFE8D6', alignItems: 'center', justifyContent: 'center' }}>
                  <VideoIcon size={36} color="#FF4444" />
                </View>
                <Text style={c.emptyTitle}>{appliedSearch ? `No content matches "${appliedSearch}"` : 'No content yet'}</Text>
                <Text style={c.emptySub}>{appliedSearch ? 'Try a different search or clear filters.' : 'Create your first content item to get started.'}</Text>
                <Pressable style={c.emptyBtn} onPress={() => setEditingItem('new')}><Text style={c.emptyBtnText}>Create Content</Text></Pressable>
              </View>
            )
          }
          ListFooterComponent={
            pager.data.length > 0 ? (
              <PaginationControls
                currentPage={pager.currentPage}
                totalPages={pager.totalPages}
                totalCount={pager.totalCount}
                loading={pager.loading}
                itemLabel="items"
                onFirst={pager.goFirst}
                onPrev={pager.goPrev}
                onNext={pager.goNext}
                onLast={pager.goLast}
              />
            ) : null
          }
        />
      </View>

      {/* Filter selectors */}
      <SelectorModal visible={classFilterOpen}   title="Select Class"   options={classOptions}   selected={filters.classLevel} anyLabel="All Classes"   onSelect={(v) => { onFiltersChange({ classLevel: v, subject: '' }); setClassFilterOpen(false); }}   onClose={() => setClassFilterOpen(false)} />
      <SelectorModal visible={subjectFilterOpen} title="Select Subject" options={subjectOptions} selected={filters.subject}     anyLabel="All Subjects" isSubject onSelect={(v) => { onFiltersChange({ ...filters, subject: v }); setSubjectFilterOpen(false); }} onClose={() => setSubjectFilterOpen(false)} />

      {/* Details modal */}
      <ContentDetailsModal
        item={detailsItem}
        apiFetch={apiFetch}
        onClose={() => setDetailsItem(null)}
        onEdit={(item) => { setDetailsItem(null); setEditingItem(item); }}
      />

      {/* Create / Edit modal */}
      <ContentFormModal
        editingItem={editingItem}
        apiFetch={apiFetch}
        topics={topics}
        subjectCatalog={subjectCatalog}
        user={user}
        onClose={() => setEditingItem(null)}
        onSuccess={onRefresh}
        onUploadMedia={onUploadMedia}
      />

      <ConfirmModal
        visible={confirmDeleteItem !== null}
        title="Delete Content"
        itemName={confirmDeleteItem?.title}
        loading={deletingContentId === confirmDeleteItem?.id}
        onConfirm={async () => {
          if (confirmDeleteItem) {
            await onDeleteContent(confirmDeleteItem.id);
            setConfirmDeleteItem(null);
          }
        }}
        onClose={() => setConfirmDeleteItem(null)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  list: { padding: 16, paddingBottom: 40 },

  pageHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  pageTitle:     { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  pageSub:       { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2 },
  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4A90E2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  toast:            { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError:       { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#FF7043' },
  toastText:        { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText:   { color: '#B91C1C' },

  filterSection:  { paddingHorizontal: 16, marginBottom: 10 },
  filterLabel:    { fontSize: 11, fontWeight: '800', color: '#9A9AB0', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  filterRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F0F0F8' },
  chipActive:     { backgroundColor: '#D6EAFF' },
  chipText:       { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  chipTextActive: { color: '#1A4DA2', fontWeight: '700' },
  clearChip:      { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FEE2E2' },
  clearChipText:  { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  applyBtn:       { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#4A90E2' },
  applyBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchBarInput: { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  paginationWrap:       { paddingTop: 14, paddingBottom: 4, gap: 10, alignItems: 'center' },
  paginationButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, width: '100%' },
  pageBtn:              { minWidth: 88, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#EAF2FF', borderRadius: 10, borderWidth: 1, borderColor: '#DCE9FF', alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled:      { backgroundColor: '#F2F5FB', borderColor: '#E3E8F4' },
  pageBtnText:          { fontSize: 14, fontWeight: '700', color: '#2B6FD5' },
  pageBtnTextDisabled:  { color: '#9BAAC2' },
  pageText:             { fontSize: 14, fontWeight: '700', color: '#4B5B78', textAlign: 'center' },

  emptyWrap:    { alignItems: 'center', paddingVertical: 60, gap: 8 },
  loadingText:  { fontSize: 13, color: '#9A9AB0', fontWeight: '500' },
  emptyTitle:   { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub:     { fontSize: 13, color: '#9A9AB0', textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { marginTop: 8, backgroundColor: '#4A90E2', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  card:          { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 10 },
  artBox:        { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardInfo:      { flex: 1, gap: 3 },
  cardTitle:     { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  cardMeta:      { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  cardChipRow:   { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' },
  cardChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cardChipText:  { fontSize: 11, fontWeight: '700', color: '#5A7AB0' },
  typeTag:       { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeTagText:   { fontSize: 10, fontWeight: '800' },
  cardFooter:    { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  footerBtn:     { flex: 1, borderRadius: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  footerBtnText: { fontSize: 11, fontWeight: '800' },



  // Full-screen modal shared styles
  modalScreen:       { flex: 1, backgroundColor: '#F5F7FF' },
  modalScreenDesktop:{ backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  modalInner:        { flex: 1, width: '100%', backgroundColor: '#F5F7FF', overflow: 'hidden' },
  modalInnerDesktop: { flex: undefined as any, width: '100%', maxWidth: 900, maxHeight: '92%', borderRadius: 20, overflow: 'hidden' },
  previewBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EDF9F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#BFE6D2' },
  previewBtnText:    { color: '#4CAF82', fontWeight: '800', fontSize: 12 },
  modalHeader:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalBackBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBackArrow:    { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  modalTitle:        { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  modalSaveBtn:      { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalSaveBtnText:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalTabBar:       { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalTab:          { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modalTabActive:    { borderBottomColor: '#4A90E2' },
  modalTabText:      { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  modalTabTextActive:{ color: '#4A90E2', fontWeight: '800' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText2:{ fontSize: 13, color: '#9A9AB0' },

  inlineToast:     { marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFE8E8', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FF7043' },
  inlineToastText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', textAlign: 'center' },

  tabContent:  { padding: 16, gap: 16, paddingBottom: 40 },
  fieldGroup:  { gap: 8 },
  groupLabel:  { fontSize: 10, fontWeight: '800', color: '#9A9AB0', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  fieldCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:  { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  fieldDivider:{ height: 1, backgroundColor: '#F0F0F8' },
  selectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  selectorVal: { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  selectorPlaceholder:{ fontSize: 14, color: '#B0B8D0' },

  secGroup:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  secGroupTitle:  { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  secInfoBtn:     { padding: 2, borderRadius: 999 },
  secInfoNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#EBF4FF', borderBottomWidth: 1, borderBottomColor: '#DCEBFF' },
  secInfoNoteText:{ flex: 1, fontSize: 12, color: '#2A5F9E', fontWeight: '500', lineHeight: 17 },
  addSecBtn:      { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  addSecBtnText:  { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  quizBlockedNote:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: '#ECEEF4' },
  quizBlockedNoteText:{ flex: 1, fontSize: 12, color: '#9A9AB0', fontWeight: '600' },

  sectionBlock:       { borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  sectionBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10 },
  sectionTitleInput:  { flex: 1, fontSize: 13, color: '#1a1a2e', fontWeight: '500', backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#ECEEF4' },
  sectionHeaderActions:{ flexDirection: 'row', gap: 2 },

  dragHandle:          { alignItems: 'center', gap: 2, paddingHorizontal: 2 },
  sectionItemOrder:    { fontSize: 10, fontWeight: '800', color: '#B0B8D0' },
  orderBtn:            { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F5F7FF' },
  removeBtn:           { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FFE8E8', marginLeft: 2 },
  removeBtnText:       { fontSize: 11, fontWeight: '800', color: '#FF7043' },

  videoSecBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#BFE6D2', backgroundColor: '#EDF9F2', borderStyle: 'dashed' },
  videoSecBtnText:   { fontSize: 13, fontWeight: '800', color: '#2FA36B' },
  quizAttachLabel:   { fontSize: 10, fontWeight: '800', color: '#9A9AB0', letterSpacing: 0.5, marginBottom: 2 },
  quizAttachBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5D9F8', backgroundColor: '#F7F2FE', borderStyle: 'dashed' },
  quizAttachBtnText: { fontSize: 13, fontWeight: '800', color: '#7C3AED' },
  quizAttachedCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: '#F5EFFE', borderWidth: 1, borderColor: '#E5D9F8' },
  quizAttachedIcon:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' },
  quizAttachedTitle: { fontSize: 13, fontWeight: '800', color: '#5B21B6' },
  quizAttachedMeta:  { fontSize: 11, color: '#7C3AED', marginTop: 1, fontWeight: '600' },
  pickerBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  pickerHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  pickerTitle:       { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  pickerSearchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F4F4FB' },
  pickerEmpty:       { textAlign: 'center', color: '#9A9AB0', fontSize: 13, paddingVertical: 30 },
  quizPickRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: '#FAFAFE', borderWidth: 1, borderColor: '#EEF0F6' },
  quizPickAttach:    { fontSize: 12, fontWeight: '800', color: '#7C3AED' },

  typeChipBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F8', borderWidth: 1, borderColor: 'transparent' },

  typeChipBtnText: { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },

  uploadBtn:       { borderRadius: 8, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 10, alignItems: 'center' },
  uploadBtnText:   { fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  mediaPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, gap: 12, flex: 1 },
  badgeInfo: { flex: 1, gap: 4 },
  badgeTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  badgeSubtitle: { fontSize: 11, color: '#6B7280' },
  mediaRemoveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFE8E8', justifyContent: 'center', alignItems: 'center' },
  mediaRemoveBtnText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  mediaThumb:      { width: 60, height: 40, borderRadius: 8 },
  previewHeader:      { padding: 20, gap: 6 },
  previewTitle:       { fontSize: 20, fontWeight: '900', color: '#fff' },
  previewSub:         { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  previewStatsRow:    { flexDirection: 'row', gap: 20, marginTop: 8 },
  previewStat:        { alignItems: 'center', gap: 2 },
  previewStatVal:     { fontSize: 22, fontWeight: '900', color: '#fff' },
  previewStatLabel:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  previewBody:        { padding: 16, gap: 6 },
  previewItem:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  previewItemDot:     { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewItemTitle:   { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  previewItemMeta:    { fontSize: 11, color: '#9A9AB0', marginTop: 1 },

  // Details modal
  detailHero:     { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, borderRadius: 20, padding: 20 },
  detailHeroIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  detailHeroInfo: { flex: 1, gap: 8 },
  detailBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detailBadge:    { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  detailBadgeText:{ fontSize: 11, fontWeight: '700', color: '#5A6A8A' },
  detailTitle:    { fontSize: 18, fontWeight: '900', color: '#1a1a2e', lineHeight: 24 },

  statsRow:  { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  statCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statVal:   { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },

  detailSection:         { marginHorizontal: 16, marginBottom: 16 },
  detailSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  detailSectionTitle:    { fontSize: 15, fontWeight: '900', color: '#1a1a2e' },
  emptyCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', gap: 6 },
  emptyText2: { fontSize: 14, fontWeight: '700', color: '#9A9AB0' },
  emptyText:  { fontSize: 14, fontWeight: '700', color: '#9A9AB0' },

  itemCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  itemIcon:    { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemInfo:    { flex: 1, gap: 5 },
  itemTitle:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e', lineHeight: 20 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeChip:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeChipText:{ fontSize: 10, fontWeight: '800' },
  itemMeta:    { fontSize: 11, color: '#9A9AB0', fontWeight: '500' },
  orderBadge:  { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center' },
  orderBadgeText:{ fontSize: 12, fontWeight: '900', color: '#9A9AB0' },

  topicRow:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  topicRowTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  topicRowMeta:  { fontSize: 12, color: '#9A9AB0', marginTop: 2 },
});
