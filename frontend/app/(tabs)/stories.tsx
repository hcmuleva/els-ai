import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  BookOpen, BookOpenCheck, Calendar, ChevronDown, ChevronUp, Clock, Eye,
  Filter, GripVertical, Image as ImageIcon, ListChecks, Mic, Plus,
  Search, Send, Sparkles, Trophy, Video, X, Zap,
} from 'lucide-react-native';

import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import SelectorModal from '../../src/components/SelectorModal';

// ─────────────────────────── types ───────────────────────────
type StoryStatus = 'draft' | 'scheduled' | 'live' | 'ended';
type MediaItem   = { kind: 'image' | 'video' | 'audio'; url: string; caption?: string };
type Section     = {
  id: string; title: string; bodyText: string;
  media: MediaItem[]; quizId: string | null; orderIndex: number;
};
type Story = {
  id: string; title: string; description: string;
  coverImageUrl: string | null; classLevel: string | null;
  scheduledAt: string | null; endedAt: string | null;
  status: StoryStatus; sectionCount?: number; quizCount?: number;
  createdAt?: string;
};
type QuizLite = { id: string; title: string; classLevel?: string; questionCount?: number };

const STATUS_TAG: Record<StoryStatus, { bg: string; text: string; label: string }> = {
  draft:     { bg: '#F0F0F8', text: '#9A9AB0', label: 'Draft' },
  scheduled: { bg: '#FEF3C7', text: '#B45309', label: 'Scheduled' },
  live:      { bg: '#D6F5E0', text: '#118650', label: '● Live' },
  ended:     { bg: '#E8E8F0', text: '#5A6A8A', label: 'Ended' },
};
const CARD_PALETTES = [
  { bg: '#4A90E2', light: '#D6EAFF' },
  { bg: '#9B8EC4', light: '#EDE4FF' },
  { bg: '#7DC67A', light: '#D6F5D6' },
  { bg: '#E6A817', light: '#FFF5CC' },
  { bg: '#F06292', light: '#FFE0EC' },
];

// ─────────────────────────── helpers ──────────────────────────
function moveUp<T>(arr: T[], idx: number): T[] {
  if (idx <= 0) return arr;
  const n = [...arr]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n;
}
function moveDown<T>(arr: T[], idx: number): T[] {
  if (idx >= arr.length - 1) return arr;
  const n = [...arr]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n;
}
function blankSection(order: number): Section {
  return { id: `tmp-${Date.now()}`, title: '', bodyText: '', media: [], quizId: null, orderIndex: order };
}
function resolveMediaUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('/media')) return `${API_BASE_URL}${url}`;
  return url;
}
function extractFileName(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return '';
  try {
    const path = trimmed.split('?')[0].split('#')[0];
    const segment = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
    return segment || 'uploaded-file';
  } catch {
    return 'uploaded-file';
  }
}
function getDateTimeParts(value?: string | null): { date: string; time: string } {
  if (!value) return { date: '—', time: '—' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
  return {
    date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}
type PickedFile = { dataUrl: string; fileName: string; mimeType: string };
async function pickFileAsDataUrl(accept: string, unsupportedMessage: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') throw new Error(unsupportedMessage);
  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) { reject(new Error('File picker is unavailable in this environment.')); return; }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected.')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({
        dataUrl: String(reader.result || ''),
        fileName: file.name || 'uploaded-file',
        mimeType: file.type || '',
      });
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

// ─────────────────────────── main screen ──────────────────────
export default function StoriesScreen() {
  const { apiFetch } = useAuth();

  // list
  const [stories, setStories]     = useState<Story[]>([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [storiesPage, setStoriesPage] = useState(1);
  const STORIES_PAGE_SIZE = 10;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStories, setHistoryStories] = useState<Story[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  // story editor
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab]   = useState<'setup' | 'sections' | 'actions'>('setup');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [readOnlyEndedView, setReadOnlyEndedView] = useState(false);
  // form fields
  const [fTitle, setFTitle]       = useState('');
  const [fDesc, setFDesc]         = useState('');
  const [fCover, setFCover]       = useState('');
  const [fCoverLabel, setFCoverLabel] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [fClass, setFClass]       = useState('');
  // sections
  const [sections, setSections]   = useState<Section[]>([]);

  // section editor
  const [secModalOpen, setSecModalOpen]   = useState(false);
  const [secModalTab, setSecModalTab]     = useState<'content' | 'quiz'>('content');
  const [editingSec, setEditingSec]       = useState<Section | null>(null);
  const [secSaving, setSecSaving]         = useState(false);
  const [secMediaSource, setSecMediaSource] = useState<'upload' | 'link'>('upload');
  const [secMediaUploading, setSecMediaUploading] = useState(false);

  // quiz picker (inside section editor)
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [pickerSearch, setPickerSearch]   = useState('');
  const [quizLibrary, setQuizLibrary]     = useState<QuizLite[]>([]);

  // schedule – day picker
  const [occupiedDays, setOccupiedDays]   = useState<string[]>([]);
  const [selectedDay, setSelectedDay]     = useState<string | null>(null); // YYYY-MM-DD
  const [schedSaving, setSchedSaving]     = useState(false);

  // class selector
  const [classSelectorOpen, setClassSelectorOpen] = useState(false);
  const viewportWidth = Dimensions.get('window').width;
  const storiesColumns = viewportWidth >= 760 ? 2 : 1;
  const storyCardWidth = storiesColumns === 2 ? '48.5%' : '100%';
  const historyCardWidth = viewportWidth >= 760 ? '48.5%' : '100%';

  // ── data loading ──
  const loadStories = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [liveR, scheduledR, draftR] = await Promise.all([
        apiFetch('/stories?status=live&limit=200'),
        apiFetch('/stories?status=scheduled&limit=200'),
        apiFetch('/stories?status=draft&limit=200'),
      ]);
      const readStories = async (r: Response) => (r.ok ? ((await r.json()).stories || []) : []);
      const allActive = [
        ...(await readStories(liveR)),
        ...(await readStories(scheduledR)),
        ...(await readStories(draftR)),
      ] as Story[];

      const total = allActive.length;
      const totalPages = Math.max(1, Math.ceil(total / STORIES_PAGE_SIZE));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const offset = (safePage - 1) * STORIES_PAGE_SIZE;
      const pageItems = allActive.slice(offset, offset + STORIES_PAGE_SIZE);
      const enriched = await Promise.all(pageItems.map(async (story) => {
        try {
          const detailR = await apiFetch(`/stories/${story.id}`);
          if (!detailR.ok) return { ...story, quizCount: story.quizCount ?? 0 };
          const detail = await detailR.json();
          const secs = (detail.sections || []) as Array<{ quizId?: string | null }>;
          return {
            ...story,
            sectionCount: typeof story.sectionCount === 'number' ? story.sectionCount : secs.length,
            quizCount: secs.filter((s) => !!s.quizId).length,
          };
        } catch {
          return { ...story, quizCount: story.quizCount ?? 0 };
        }
      }));
      setStories(enriched);
      setStoriesTotal(total);
      setStoriesPage(safePage);
    } finally { setLoading(false); }
  }, [apiFetch]);

  const loadQuizLibrary = useCallback(async () => {
    try {
      const r = await apiFetch('/quizzes/teacher/library?status=all&limit=200');
      if (r.ok) {
        const d = await r.json();
        setQuizLibrary((d.quizzes || d.items || []).map((q: any) => ({
          id: q.id, title: q.title || q.quiz_title || 'Untitled',
          classLevel: q.class_level || q.classLevel,
          questionCount: q.question_count ?? q.questionCount,
        })));
      }
    } catch { /* ignore */ }
  }, [apiFetch]);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const r = await apiFetch('/stories?status=ended&limit=400&offset=0');
      if (!r.ok) return;
      const data = await r.json();
      const allEnded = (data.stories || []) as Story[];
      const enriched = await Promise.all(allEnded.map(async (story) => {
        try {
          const detailR = await apiFetch(`/stories/${story.id}`);
          if (!detailR.ok) return { ...story, quizCount: story.quizCount ?? 0 };
          const detail = await detailR.json();
          const secs = (detail.sections || []) as Array<{ quizId?: string | null }>;
          return {
            ...story,
            sectionCount: typeof story.sectionCount === 'number' ? story.sectionCount : secs.length,
            quizCount: secs.filter((s) => !!s.quizId).length,
          };
        } catch {
          return { ...story, quizCount: story.quizCount ?? 0 };
        }
      }));
      const total = enriched.length;
      const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const offset = (safePage - 1) * HISTORY_PAGE_SIZE;
      setHistoryStories(enriched.slice(offset, offset + HISTORY_PAGE_SIZE));
      setHistoryTotal(total);
      setHistoryPage(safePage);
    } finally { setHistoryLoading(false); }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => {
    loadStories(1); loadQuizLibrary();
  }, [loadStories, loadQuizLibrary]));

  // ── open editor ──
  const openNew = () => {
    setReadOnlyEndedView(false);
    setEditingId(null); setFTitle(''); setFDesc(''); setFCover(''); setFCoverLabel(''); setFClass(''); setSections([]);
    setModalTab('setup'); setModalOpen(true);
  };

  const openEdit = async (story: Story) => {
    setReadOnlyEndedView(story.status === 'ended');
    setEditingId(story.id); setFTitle(story.title); setFDesc(story.description || '');
    setFCover(story.coverImageUrl || '');
    setFCoverLabel(story.coverImageUrl ? extractFileName(story.coverImageUrl) : '');
    setFClass(story.classLevel || '');
    setModalTab('setup'); setSections([]);
    setModalOpen(true);
    try {
      const r = await apiFetch(`/stories/${story.id}`);
      if (r.ok) {
        const secs = (await r.json()).sections || [];
        setSections(secs.map((sec: Section) => ({ ...sec, media: sec.media?.length ? [sec.media[0]] : [] })));
      }
    } catch { /* ignore */ }
  };

  const uploadPickedFileToS3 = async (picked: PickedFile, mediaType: 'image' | 'audio' | 'video') => {
    const res = await apiFetch('/assets/upload', {
      method: 'POST',
      body: JSON.stringify({
        dataUrl: picked.dataUrl,
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        mediaType,
        context: 'story_management',
      }),
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to upload media');
    }
    const payload = await res.json();
    return {
      url: String(payload.url || ''),
      fileName: String(payload.fileName || picked.fileName || 'uploaded-file'),
    };
  };

  const uploadCoverImage = async () => {
    try {
      setCoverUploading(true);
      const picked = await pickFileAsDataUrl('image/*', 'Image upload is available on web. On mobile, please use web for upload.');
      const uploaded = await uploadPickedFileToS3(picked, 'image');
      setFCover(uploaded.url);
      setFCoverLabel(uploaded.fileName);
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Failed to upload cover image');
    } finally { setCoverUploading(false); }
  };

  const ensureSingleMedia = (sec: Section): MediaItem | null => sec.media?.[0] || null;

  const uploadSectionMedia = async () => {
    if (!editingSec) return;
    const media = ensureSingleMedia(editingSec);
    const kind: MediaItem['kind'] = media?.kind || 'image';
    const accept = kind === 'image' ? 'image/*' : kind === 'audio' ? 'audio/*' : 'video/*';
    const mediaType: 'image' | 'audio' | 'video' = kind === 'video' ? 'video' : kind;
    try {
      setSecMediaUploading(true);
      const picked = await pickFileAsDataUrl(accept, 'Upload is available on web. On mobile, use paste-link mode.');
      const uploaded = await uploadPickedFileToS3(picked, mediaType);
      setEditingSec({
        ...editingSec,
        media: [{ kind, url: uploaded.url, caption: uploaded.fileName }],
      });
      setSecMediaSource('upload');
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Failed to upload media');
    } finally { setSecMediaUploading(false); }
  };

  // ── save story ──
  const saveStory = async (): Promise<string | null> => {
    if (!fTitle.trim()) { Alert.alert('Story title is required'); return null; }
    setSaving(true);
    try {
      const body = JSON.stringify({
        title: fTitle.trim(), description: fDesc.trim() || null,
        coverImageUrl: fCover.trim() || null, classLevel: fClass || null,
      });
      const r = editingId
        ? await apiFetch(`/stories/${editingId}`, { method: 'PATCH', body })
        : await apiFetch('/stories', { method: 'POST', body });
      if (!r.ok) { Alert.alert('Failed to save', await r.text()); return null; }
      const { story } = await r.json();
      if (!editingId) setEditingId(story.id);
      await loadStories(storiesPage);
      return story.id;
    } finally { setSaving(false); }
  };

  // ── section save ──
  const saveSec = async (sec: Section) => {
    let storyId = editingId;
    if (!storyId) {
      if (!fTitle.trim()) { Alert.alert('Enter a story title first', 'Go to Setup and fill in the title.'); setModalTab('setup'); return; }
      storyId = await saveStory();
      if (!storyId) return;
    }
    setSecSaving(true);
    try {
      const oneMedia = (sec.media || []).slice(0, 1).filter((m) => !!m.url?.trim()).map((m) => ({
        ...m,
        url: m.url.trim(),
        caption: m.caption?.trim() || extractFileName(m.url || ''),
      }));
      const body = JSON.stringify({
        title: sec.title.trim() || 'Section', bodyText: sec.bodyText || null,
        media: oneMedia, quizId: sec.quizId || null, orderIndex: sec.orderIndex,
      });
      const isNew = !sections.find((x) => x.id === sec.id);
      const r = isNew
        ? await apiFetch(`/stories/${storyId}/sections`, { method: 'POST', body })
        : await apiFetch(`/stories/${storyId}/sections/${sec.id}`, { method: 'PATCH', body });
      if (!r.ok) { Alert.alert('Section save failed', await r.text()); return; }
      const saved: Section = (await r.json()).section;
      setSections((prev) => {
        const i = prev.findIndex((x) => x.id === sec.id || x.id === saved.id);
        if (i >= 0) { const c = [...prev]; c[i] = saved; return c; }
        return [...prev, saved].sort((a, b) => a.orderIndex - b.orderIndex);
      });
      setSecModalOpen(false);
      setEditingSec(null);
    } finally { setSecSaving(false); }
  };

  const deleteSec = async (sec: Section) => {
    if (!editingId) { setSections((p) => p.filter((x) => x.id !== sec.id)); return; }
    try {
      await apiFetch(`/stories/${editingId}/sections/${sec.id}`, { method: 'DELETE' });
      setSections((p) => p.filter((x) => x.id !== sec.id));
    } catch { /* ignore */ }
  };

  // ── story actions ──
  const publish = async (id: string) => {
    await apiFetch(`/stories/${id}/publish`, { method: 'PATCH' });
    await loadStories(storiesPage);
  };
  const endStory = async (id: string) => {
    await apiFetch(`/stories/${id}/end`, { method: 'PATCH' });
    await loadStories(storiesPage);
  };
  const deleteStory = async (id: string) => {
    await apiFetch(`/stories/${id}`, { method: 'DELETE' });
    setModalOpen(false); await loadStories(storiesPage);
  };
  const loadOccupiedDays = useCallback(async (classLevel?: string) => {
    try {
      const qs = classLevel ? `?class_level=${encodeURIComponent(classLevel)}` : '';
      const r = await apiFetch(`/stories/scheduled-days${qs}`);
      if (r.ok) {
        const next = ((await r.json()).occupiedDays || []) as string[];
        setOccupiedDays(Array.from(new Set(next)).sort());
      }
    } catch { /* ignore */ }
  }, [apiFetch]);

  const scheduleStory = async () => {
    if (!selectedDay) { Alert.alert('Pick a day first'); return; }
    const dayToMark = selectedDay;
    let storyId = editingId;
    if (!storyId) { storyId = await saveStory(); if (!storyId) return; }
    // Schedule for 9:00 AM on the selected day
    const scheduledAt = new Date(`${dayToMark}T09:00:00`).toISOString();
    setSchedSaving(true);
    try {
      const r = await apiFetch(`/stories/${storyId}/schedule`, {
        method: 'PATCH', body: JSON.stringify({ scheduledAt }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        Alert.alert('Schedule failed', data.message || 'Unknown error');
        return;
      }
      // Immediately mark this day as occupied so the picker reflects it without reopening
      setOccupiedDays((prev) => Array.from(new Set([...prev, dayToMark])).sort());
      setSelectedDay(dayToMark);
      await loadOccupiedDays(fClass || undefined);
      await loadStories(storiesPage);
    } finally { setSchedSaving(false); }
  };

  // ── story list card ──
  const renderCard = ({ item, index }: { item: Story; index: number }) => {
    const pal = CARD_PALETTES[index % CARD_PALETTES.length];
    const tag = STATUS_TAG[item.status];
    const displayTs = item.scheduledAt || item.createdAt || null;
    const dt = getDateTimeParts(displayTs);
    return (
      <View style={[s.classCard, { backgroundColor: pal.light, width: storyCardWidth }]}>
        <View style={s.classCardTop}>
          <View style={[s.classArtBox, { backgroundColor: `${pal.bg}22` }]}>
            <BookOpen size={24} color={pal.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.classCardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={s.classModeRow}>
              {!!item.classLevel && (
                <View style={s.classModeChip}>
                  <Text style={s.classModeChipLabel}>Class</Text>
                  <Text style={s.classModeChipValue}>{getStandardLabel(item.classLevel)}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[s.statusTag, { backgroundColor: tag.bg }]}>
            <Text style={[s.statusTagText, { color: tag.text }]}>{tag.label}</Text>
          </View>
        </View>
        {!!item.description && (
          <Text style={s.classCardDesc} numberOfLines={1}>{item.description}</Text>
        )}
        <View style={s.classMetaGrid}>
          <View style={s.classMetaItem}>
            <Text style={s.classMetaLabel}>Date</Text>
            <Text style={s.classMetaValue}>{dt.date}</Text>
          </View>
          <View style={s.classMetaItem}>
            <Text style={s.classMetaLabel}>Time</Text>
            <Text style={s.classMetaValue}>{dt.time}</Text>
          </View>
        </View>
        <View style={s.classCountsRow}>
          <View style={s.classCountChip}>
            <BookOpen size={11} color="#5A7AB0" />
            <Text style={s.classCountChipText}>{item.sectionCount || 0} sections</Text>
          </View>
          <View style={s.classCountChip}>
            <Trophy size={11} color="#7C3AED" />
            <Text style={s.classCountChipText}>{item.quizCount || 0} quizzes</Text>
          </View>
        </View>
        <View style={s.classCardFooter}>
          <Pressable style={[s.footerBtn, { backgroundColor: '#EBF4FF' }]} onPress={() => openEdit(item)}>
            <Text style={[s.footerBtnText, { color: '#1A4DA2' }]}>Edit</Text>
          </Pressable>
          {item.status === 'draft' && (
            <Pressable style={[s.footerBtn, { backgroundColor: '#D6F5E0' }]} onPress={() => publish(item.id)}>
              <Text style={[s.footerBtnText, { color: '#118650' }]}>Publish</Text>
            </Pressable>
          )}
          {item.status === 'live' && (
            <Pressable style={[s.footerBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => endStory(item.id)}>
              <Text style={[s.footerBtnText, { color: '#DC2626' }]}>End</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderHistoryCard = ({ item, index }: { item: Story; index: number }) => {
    const startedAt = getDateTimeParts(item.createdAt || null);
    const endedAt = getDateTimeParts(item.endedAt || null);
    return (
      <View style={[s.historyCard, { width: historyCardWidth }]}>
        <View style={s.historyCardTop}>
          <View style={s.historyCardIcon}>
            <BookOpen size={22} color="#4A90E2" />
          </View>
          <View style={s.historyCardBody}>
            <Text style={s.historyCardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={s.historyModeRow}>
              {!!item.classLevel && (
                <View style={s.historyModeChip}>
                  <Text style={s.historyModeChipLabel}>Class</Text>
                  <Text style={s.historyModeChipValue}>{getStandardLabel(item.classLevel)}</Text>
                </View>
              )}
              <View style={s.historyModeChip}>
                <Text style={s.historyModeChipLabel}>Type</Text>
                <Text style={s.historyModeChipValue}>Story</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.historyMetaGrid}>
          <View style={s.historyMetaItem}>
            <Text style={s.historyMetaLabel}>Started</Text>
            <View style={s.historyMetaRow}>
              <Calendar size={11} color="#7A869F" />
              <Text style={s.historyMetaRowText}>{startedAt.date}</Text>
            </View>
            <View style={s.historyMetaRow}>
              <Clock size={11} color="#7A869F" />
              <Text style={s.historyMetaRowText}>{startedAt.time}</Text>
            </View>
          </View>
          <View style={s.historyMetaItem}>
            <Text style={s.historyMetaLabel}>Ended</Text>
            <View style={s.historyMetaRow}>
              <Calendar size={11} color="#7A869F" />
              <Text style={s.historyMetaRowText}>{endedAt.date}</Text>
            </View>
            <View style={s.historyMetaRow}>
              <Clock size={11} color="#7A869F" />
              <Text style={s.historyMetaRowText}>{endedAt.time}</Text>
            </View>
          </View>
        </View>

        <View style={s.historyChipRow}>
          <View style={s.historyChip}>
            <BookOpen size={11} color="#5A7AB0" />
            <Text style={s.historyChipText}>{item.sectionCount || 0} sections</Text>
          </View>
          <View style={s.historyChip}>
            <Trophy size={11} color="#7C3AED" />
            <Text style={s.historyChipText}>{item.quizCount || 0} quizzes</Text>
          </View>
        </View>

        <View style={s.historyCardFooter}>
          <Pressable style={s.historyDetailBtn} onPress={() => { setHistoryOpen(false); openEdit(item); }}>
            <Text style={s.historyDetailBtnText}>View Story</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const currentStory = stories.find((x) => x.id === editingId);

  // ─────────────────────────── render ──────────────────────────
  return (
    <View style={s.screen}>

      {/* ── Top Header ── */}
      <View style={s.topHeader}>
        <View style={s.topHeaderLeft}>
          <Text style={s.topHeading}>Stories</Text>
          <Text style={s.topSub} numberOfLines={2}>Manage and schedule your story sessions</Text>
        </View>
        <View style={s.headerActionRow}>
          <Pressable style={s.historyBtnSmall} onPress={async () => { setHistoryOpen(true); await loadHistory(1); }}>
            <Clock size={13} color="#5A6A8A" />
            <Text style={s.historyBtnSmallText}>History</Text>
          </Pressable>
          <Pressable style={s.newBtn} onPress={openNew}>
            <Text style={s.newBtnText}>+ New</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={historyOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setHistoryOpen(false)}>
        <View style={s.historyScreen}>
          <View style={[s.historyHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setHistoryOpen(false)} style={s.historyBackBtn}>
              <Text style={s.historyBackArrow}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.historyTitle}>Previous Stories</Text>
              <Text style={s.historySubtitle}>All your ended story sessions</Text>
            </View>
          </View>
          {historyLoading ? (
            <View style={s.historyCenter}>
              <ActivityIndicator color="#4A90E2" size="large" />
            </View>
          ) : (
            <FlatList
              key={`history-grid-${storiesColumns}`}
              data={historyStories}
              numColumns={storiesColumns}
              keyExtractor={(x) => x.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
              columnWrapperStyle={storiesColumns === 2 ? { justifyContent: 'space-between' } : undefined}
              renderItem={renderHistoryCard}
              ListEmptyComponent={(
                <View style={s.historyCenter}>
                  <Text style={s.emptySub}>No ended stories yet.</Text>
                </View>
              )}
              ListFooterComponent={historyStories.length > 0 ? (
                <View style={s.pagerRow}>
                  <Pressable
                    style={[s.pagerBtn, (historyPage <= 1 || historyLoading) && s.pagerBtnDisabled]}
                    disabled={historyPage <= 1 || historyLoading}
                    onPress={() => loadHistory(historyPage - 1)}
                  >
                    <Text style={[s.pagerBtnText, (historyPage <= 1 || historyLoading) && s.pagerBtnTextDisabled]}>Previous</Text>
                  </Pressable>
                  <Text style={s.pagerText}>
                    Page {historyPage} of {Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))}
                  </Text>
                  <Pressable
                    style={[s.pagerBtn, (historyLoading || historyPage >= Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))) && s.pagerBtnDisabled]}
                    disabled={historyLoading || historyPage >= Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))}
                    onPress={() => loadHistory(historyPage + 1)}
                  >
                    <Text style={[s.pagerBtnText, (historyLoading || historyPage >= Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))) && s.pagerBtnTextDisabled]}>Next</Text>
                  </Pressable>
                </View>
              ) : null}
            />
          )}
        </View>
      </Modal>

      {/* ── Story List ── */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color="#4A90E2" size="large" /></View>
      ) : stories.length === 0 ? (
        <View style={s.emptyBox}>
          <BookOpenCheck size={56} color="#D0D8F0" />
          <Text style={s.emptyTitle}>No stories yet</Text>
          <Text style={s.emptySub}>Create your first immersive story experience for your class.</Text>
          <Pressable style={s.newBtn} onPress={openNew}>
            <Plus size={16} color="#fff" /><Text style={s.newBtnText}>Create First Story</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={`stories-grid-${storiesColumns}`}
          data={stories}
          numColumns={storiesColumns}
          keyExtractor={(x) => x.id}
          renderItem={renderCard}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          columnWrapperStyle={storiesColumns === 2 ? { justifyContent: 'space-between' } : undefined}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await loadStories(1); setRefreshing(false); }}
          ListFooterComponent={(
            <View style={s.pagerRow}>
              <Pressable
                style={[s.pagerBtn, (storiesPage <= 1 || loading) && s.pagerBtnDisabled]}
                disabled={storiesPage <= 1 || loading}
                onPress={() => loadStories(storiesPage - 1)}
              >
                <Text style={[s.pagerBtnText, (storiesPage <= 1 || loading) && s.pagerBtnTextDisabled]}>Previous</Text>
              </Pressable>
              <Text style={s.pagerText}>
                Page {storiesPage} of {Math.max(1, Math.ceil(storiesTotal / STORIES_PAGE_SIZE))}
              </Text>
              <Pressable
                style={[s.pagerBtn, (loading || storiesPage >= Math.max(1, Math.ceil(storiesTotal / STORIES_PAGE_SIZE))) && s.pagerBtnDisabled]}
                disabled={loading || storiesPage >= Math.max(1, Math.ceil(storiesTotal / STORIES_PAGE_SIZE))}
                onPress={() => loadStories(storiesPage + 1)}
              >
                <Text style={[s.pagerBtnText, (loading || storiesPage >= Math.max(1, Math.ceil(storiesTotal / STORIES_PAGE_SIZE))) && s.pagerBtnTextDisabled]}>Next</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* ════════════════ STORY EDITOR MODAL ════════════════ */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setModalOpen(false)}>
        <View style={s.modalScreen}>

          {/* Header */}
          <View style={[s.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setModalOpen(false)} style={s.modalBackBtn}>
              <Text style={s.modalBackArrow}>‹</Text>
            </Pressable>
            <Text style={s.modalTitle} numberOfLines={1}>
              {editingId ? `${readOnlyEndedView ? 'View' : 'Edit'}: ${fTitle || 'Story'}` : 'New Story'}
            </Text>
            {!readOnlyEndedView && (
              <Pressable style={s.modalSaveBtn} onPress={saveStory} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnText}>Save</Text>}
              </Pressable>
            )}
          </View>

          {/* Tab bar */}
          <View style={s.modalTabBar}>
            {([
              ['setup',    'Setup',    BookOpen],
              ['sections', 'Sections', ListChecks],
              ...(!readOnlyEndedView ? [['actions',  'Actions',  Zap] as [typeof modalTab, string, any]] : []),
            ] as [typeof modalTab, string, any][]).map(([tab, label, Icon]) => (
              <Pressable key={tab} style={[s.modalTab, modalTab === tab && s.modalTabActive]} onPress={() => setModalTab(tab)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon size={13} color={modalTab === tab ? '#4A90E2' : '#9A9AB0'} />
                  <Text style={[s.modalTabText, modalTab === tab && s.modalTabTextActive]}>{label}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* ── SETUP tab ── */}
          {modalTab === 'setup' && (
            <ScrollView contentContainerStyle={s.tabContent}>

              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>BASIC INFO</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Story Title *</Text>
                  <TextInput value={fTitle} onChangeText={setFTitle} editable={!readOnlyEndedView} placeholder="e.g. The Adventure of Baby Dinosaur" style={s.fieldInput} placeholderTextColor="#B0B8D0" />
                  <View style={s.fieldDivider} />
                  <Text style={s.fieldLabel}>Description</Text>
                  <TextInput value={fDesc} onChangeText={setFDesc} editable={!readOnlyEndedView} placeholder="A short hook for students…" style={[s.fieldInput, { minHeight: 60 }]} multiline placeholderTextColor="#B0B8D0" />
                  <View style={s.fieldDivider} />
                  <Text style={s.fieldLabel}>Cover Image *</Text>
                  {!readOnlyEndedView && (
                    <Pressable style={s.uploadBtn} onPress={uploadCoverImage} disabled={coverUploading}>
                      {coverUploading
                        ? <ActivityIndicator size="small" color="#4A90E2" />
                        : <Text style={s.uploadBtnText}>Upload Cover Image</Text>}
                    </Pressable>
                  )}
                  {!!fCover && (
                    <View style={s.fileCard}>
                      <Image source={{ uri: resolveMediaUrl(fCover) }} style={s.fileCardThumb} resizeMode="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.fileCardTitle} numberOfLines={1}>{fCoverLabel || extractFileName(fCover)}</Text>
                        <Text style={s.fileCardMeta}>Image file</Text>
                      </View>
                      {!readOnlyEndedView && (
                        <Pressable onPress={() => { setFCover(''); setFCoverLabel(''); }} style={s.removeSectionBtn}>
                          <Text style={s.removeSectionBtnText}>✕</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>AUDIENCE</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Class Level</Text>
                  <Pressable style={s.selectorRow} disabled={readOnlyEndedView} onPress={() => setClassSelectorOpen(true)}>
                    <Text style={fClass ? s.selectorVal : s.selectorPlaceholder}>
                      {fClass ? getStandardLabel(fClass) : 'Select Class Level'}
                    </Text>
                    <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                  </Pressable>
                </View>
              </View>

              {editingId && currentStory && (
                <View style={s.fieldGroup}>
                  <Text style={s.groupLabel}>STATUS</Text>
                  <View style={s.fieldCard}>
                    <View style={[s.statusTagLg, { backgroundColor: STATUS_TAG[currentStory.status].bg }]}>
                      <Text style={[s.statusTagLgText, { color: STATUS_TAG[currentStory.status].text }]}>
                        {STATUS_TAG[currentStory.status].label}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── SECTIONS tab ── */}
          {modalTab === 'sections' && (
            <ScrollView contentContainerStyle={s.tabContent}>
              <View style={s.secGroup}>
                <View style={s.secGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} color="#4A90E2" />
                    <Text style={s.secGroupTitle}>Story Sections</Text>
                    <View style={s.countBadge}><Text style={s.countBadgeText}>{sections.length}</Text></View>
                  </View>
                  {!readOnlyEndedView && (
                    <Pressable
                      style={s.addSecBtn}
                      onPress={async () => {
                        let sid = editingId;
                        if (!sid) {
                          if (!fTitle.trim()) { Alert.alert('Title required', 'Fill in the story title in Setup first.'); setModalTab('setup'); return; }
                          sid = await saveStory();
                          if (!sid) return;
                        }
                        setEditingSec(blankSection(sections.length));
                        setSecMediaSource('upload');
                        setSecModalTab('content');
                        setSecModalOpen(true);
                      }}
                    >
                      <Text style={s.addSecBtnText}>+ Add Section</Text>
                    </Pressable>
                  )}
                </View>
                {sections.length === 0 ? (
                  <Text style={s.secEmptyText}>No sections yet — add your first story section above.</Text>
                ) : (
                  sections.map((sec, idx) => (
                    <View key={sec.id} style={s.sectionItem}>
                      <View style={s.dragHandle}>
                        <GripVertical size={16} color="#B0B8D0" />
                        <Text style={s.sectionItemOrder}>{idx + 1}</Text>
                      </View>
                      <View style={s.sectionItemBody}>
                        <Text style={s.sectionItemTitle} numberOfLines={1}>{sec.title || 'Untitled section'}</Text>
                        <Text style={s.sectionItemMeta}>
                          {[
                            sec.media.length > 0 && `${sec.media.length} media`,
                            sec.quizId && 'Quiz',
                            sec.bodyText && 'Text',
                          ].filter(Boolean).join(' · ') || 'Empty section'}
                        </Text>
                      </View>
                      <View style={s.sectionItemActions}>
                        <TouchableOpacity
                          onPress={() => setSections((p) => moveUp(p, idx))}
                          disabled={readOnlyEndedView || idx === 0}
                          style={[s.orderBtn, (readOnlyEndedView || idx === 0) && { opacity: 0.2 }]}
                        >
                          <ChevronUp size={14} color="#4A90E2" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setSections((p) => moveDown(p, idx))}
                          disabled={readOnlyEndedView || idx === sections.length - 1}
                          style={[s.orderBtn, (readOnlyEndedView || idx === sections.length - 1) && { opacity: 0.2 }]}
                        >
                          <ChevronDown size={14} color="#4A90E2" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.orderBtn, { backgroundColor: '#EBF4FF' }, readOnlyEndedView && { opacity: 0.5 }]}
                          onPress={() => {
                            setEditingSec({ ...sec, media: sec.media?.length ? [sec.media[0]] : [] });
                            setSecMediaSource(sec.media?.[0]?.url && !sec.media?.[0]?.caption ? 'link' : 'upload');
                            setSecModalTab('content');
                            setSecModalOpen(true);
                          }}
                        >
                          <Eye size={13} color="#4A90E2" />
                        </TouchableOpacity>
                        {!readOnlyEndedView && (
                          <TouchableOpacity style={s.removeSectionBtn} onPress={() => deleteSec(sec)}>
                            <Text style={s.removeSectionBtnText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {/* ── ACTIONS tab ── */}
          {modalTab === 'actions' && (
            <ScrollView contentContainerStyle={s.tabContent}>
              {!editingId && (
                <View style={s.infoBox}>
                  <Text style={s.infoBoxText}>⚠ Save the story first (tap Save above) before running actions.</Text>
                </View>
              )}
              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>PUBLISH</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Publish Now</Text>
                  <Text style={[s.fieldInput, { color: '#9A9AB0', fontSize: 12 }]}>
                    Makes the story immediately live and notifies all students.
                  </Text>
                  <View style={s.fieldDivider} />
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: '#D6F5E0' }, !editingId && { opacity: 0.4 }]}
                    disabled={!editingId}
                    onPress={async () => { if (editingId) { await publish(editingId); setModalOpen(false); } }}
                  >
                    <Send size={14} color="#118650" />
                    <Text style={[s.actionBtnText, { color: '#118650' }]}>Publish Now</Text>
                  </Pressable>
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.groupLabel}>SCHEDULE</Text>
                <View style={s.fieldCard}>
                  <Text style={s.fieldLabel}>Pick a Day</Text>
                  <Text style={[s.fieldInput, { color: '#9A9AB0', fontSize: 12, marginBottom: 4 }]}>
                    One story per class per day. Story goes live at 9 AM automatically. Greyed days are already taken.
                  </Text>
                  <DayPicker
                    occupiedDays={occupiedDays}
                    selectedDay={selectedDay}
                    onSelect={setSelectedDay}
                    onVisible={() => loadOccupiedDays(fClass || undefined)}
                  />
                  {!!selectedDay && (
                    <>
                      <View style={s.fieldDivider} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Calendar size={14} color="#B45309" />
                        <Text style={[s.fieldInput, { color: '#B45309', paddingVertical: 0 }]}>
                          Scheduled for {new Date(`${selectedDay}T09:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })} at 9:00 AM
                        </Text>
                      </View>
                    </>
                  )}
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: '#FEF3C7', marginTop: 8 }, (!editingId && !fTitle.trim()) && { opacity: 0.4 }]}
                    disabled={schedSaving}
                    onPress={scheduleStory}
                  >
                    {schedSaving
                      ? <ActivityIndicator color="#B45309" size="small" />
                      : <><Calendar size={14} color="#B45309" /><Text style={[s.actionBtnText, { color: '#B45309' }]}>Schedule Story</Text></>}
                  </Pressable>
                </View>
              </View>

              {editingId && currentStory?.status === 'live' && (
                <View style={s.fieldGroup}>
                  <Text style={s.groupLabel}>END STORY</Text>
                  <View style={s.fieldCard}>
                    <Text style={[s.fieldInput, { color: '#9A9AB0', fontSize: 12 }]}>
                      Moves the story to the ended/archive state. Students can still replay.
                    </Text>
                    <Pressable style={[s.actionBtn, { backgroundColor: '#FEE2E2', marginTop: 8 }]}
                      onPress={async () => { if (editingId) { await endStory(editingId); setModalOpen(false); } }}>
                      <Text style={[s.actionBtnText, { color: '#DC2626' }]}>End Story</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {editingId && (
                <View style={s.fieldGroup}>
                  <Text style={s.groupLabel}>DANGER ZONE</Text>
                  <View style={[s.fieldCard, { borderColor: '#FCA5A5', borderWidth: 1 }]}>
                    <Pressable style={[s.actionBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => { if (editingId) deleteStory(editingId); }}>
                      <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Delete Story Permanently</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ════════════════ SECTION EDITOR MODAL ════════════════ */}
      <Modal visible={secModalOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setSecModalOpen(false)}>
        <View style={s.modalScreen}>
          <View style={[s.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
            <Pressable onPress={() => setSecModalOpen(false)} style={s.modalBackBtn}>
              <Text style={s.modalBackArrow}>‹</Text>
            </Pressable>
            <Text style={s.modalTitle} numberOfLines={1}>
              {readOnlyEndedView ? 'Section Preview' : (editingSec && sections.find((x) => x.id === editingSec.id) ? 'Edit Section' : 'New Section')}
            </Text>
            {!readOnlyEndedView && (
              <Pressable style={s.modalSaveBtn} onPress={() => editingSec && saveSec(editingSec)} disabled={secSaving}>
                {secSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnText}>Save</Text>}
              </Pressable>
            )}
          </View>

          <View style={s.modalTabBar}>
            {([
              ['content', 'Content', BookOpen],
              ['quiz',    'Quiz',    Trophy],
            ] as [typeof secModalTab, string, any][]).map(([tab, label, Icon]) => (
              <Pressable key={tab} style={[s.modalTab, secModalTab === tab && s.modalTabActive]} onPress={() => setSecModalTab(tab)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon size={13} color={secModalTab === tab ? '#4A90E2' : '#9A9AB0'} />
                  <Text style={[s.modalTabText, secModalTab === tab && s.modalTabTextActive]}>{label}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {editingSec && (
            <>
              {/* Content tab */}
              {secModalTab === 'content' && (
                <ScrollView contentContainerStyle={s.tabContent}>
                  <View style={s.fieldGroup}>
                    <Text style={s.groupLabel}>SECTION INFO</Text>
                    <View style={s.fieldCard}>
                      <Text style={s.fieldLabel}>Section Title *</Text>
                      <TextInput
                        value={editingSec.title}
                        onChangeText={(v) => setEditingSec({ ...editingSec, title: v })}
                        editable={!readOnlyEndedView}
                        placeholder="e.g. Chapter 1: The Forest"
                        style={s.fieldInput}
                        placeholderTextColor="#B0B8D0"
                      />
                      <View style={s.fieldDivider} />
                      <Text style={s.fieldLabel}>Body Text</Text>
                      <TextInput
                        value={editingSec.bodyText}
                        onChangeText={(v) => setEditingSec({ ...editingSec, bodyText: v })}
                        editable={!readOnlyEndedView}
                        placeholder="Narrative content for this section…"
                        style={[s.fieldInput, { minHeight: 120, textAlignVertical: 'top' }]}
                        multiline
                        placeholderTextColor="#B0B8D0"
                      />
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={s.groupLabel}>MEDIA</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                        {([['image', ImageIcon], ['video', Video], ['audio', Mic]] as [MediaItem['kind'], any][]).map(([kind, Icon]) => (
                          (() => {
                            const current = ensureSingleMedia(editingSec);
                            const active = current?.kind === kind;
                            return (
                          <Pressable key={kind} disabled={readOnlyEndedView} style={[s.mediaAddPill, readOnlyEndedView && { opacity: 0.5 }]}
                            onPress={() => setEditingSec({ ...editingSec, media: [{ kind, url: '', caption: '' }] })}>
                            <Icon size={11} color={active ? '#1A4DA2' : '#4A90E2'} />
                            <Text style={[s.mediaAddPillText, active && { color: '#1A4DA2' }]}>{kind[0].toUpperCase() + kind.slice(1)}</Text>
                          </Pressable>
                            );
                          })()
                        ))}
                      </View>
                    </View>
                    <View style={s.fieldCard}>
                      {(() => {
                        const media = ensureSingleMedia(editingSec) || { kind: 'image' as MediaItem['kind'], url: '', caption: '' };
                        const mediaName = media.caption?.trim() || extractFileName(media.url || '');
                        const isImage = media.kind === 'image';
                        return (
                          <View style={{ gap: 10 }}>
                            <View style={s.sourceToggleRow}>
                              <Pressable disabled={readOnlyEndedView} style={[s.sourceToggleBtn, secMediaSource === 'upload' && s.sourceToggleBtnActive, readOnlyEndedView && { opacity: 0.5 }]} onPress={() => setSecMediaSource('upload')}>
                                <Text style={[s.sourceToggleText, secMediaSource === 'upload' && s.sourceToggleTextActive]}>Upload</Text>
                              </Pressable>
                              <Pressable disabled={readOnlyEndedView} style={[s.sourceToggleBtn, secMediaSource === 'link' && s.sourceToggleBtnActive, readOnlyEndedView && { opacity: 0.5 }]} onPress={() => setSecMediaSource('link')}>
                                <Text style={[s.sourceToggleText, secMediaSource === 'link' && s.sourceToggleTextActive]}>Paste Link</Text>
                              </Pressable>
                            </View>

                            {!readOnlyEndedView && secMediaSource === 'upload' ? (
                              <Pressable style={s.uploadBtn} onPress={uploadSectionMedia} disabled={secMediaUploading}>
                                {secMediaUploading
                                  ? <ActivityIndicator size="small" color="#4A90E2" />
                                  : <Text style={s.uploadBtnText}>Upload {media.kind[0].toUpperCase() + media.kind.slice(1)}</Text>}
                              </Pressable>
                            ) : secMediaSource === 'link' && !readOnlyEndedView ? (
                              <TextInput
                                value={media.url}
                                onChangeText={(v) => setEditingSec({ ...editingSec, media: [{ ...media, url: v, caption: extractFileName(v) }] })}
                                placeholder={`Paste ${media.kind} link`}
                                style={s.fieldInput}
                                placeholderTextColor="#B0B8D0"
                                autoCapitalize="none"
                              />
                            ) : null}

                            {!!media.url && (
                              <View style={s.fileCard}>
                                {isImage ? (
                                  <Image source={{ uri: resolveMediaUrl(media.url) }} style={s.fileCardThumb} resizeMode="cover" />
                                ) : (
                                  <View style={s.fileCardIcon}>
                                    {media.kind === 'video' ? <Video size={18} color="#B45309" /> : <Mic size={18} color="#7C3AED" />}
                                  </View>
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={s.fileCardTitle} numberOfLines={1}>{mediaName || `${media.kind} file`}</Text>
                                  <Text style={s.fileCardMeta}>{media.kind.toUpperCase()} file</Text>
                                </View>
                                {!readOnlyEndedView && (
                                  <Pressable onPress={() => setEditingSec({ ...editingSec, media: [{ ...media, url: '', caption: '' }] })} style={s.removeSectionBtn}>
                                    <Text style={s.removeSectionBtnText}>✕</Text>
                                  </Pressable>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                </ScrollView>
              )}

              {/* Quiz tab */}
              {secModalTab === 'quiz' && (
                <ScrollView contentContainerStyle={s.tabContent}>
                  {editingSec.quizId ? (
                    <View style={s.fieldGroup}>
                      <Text style={s.groupLabel}>ATTACHED QUIZ</Text>
                      <View style={s.fieldCard}>
                        {(() => {
                          const q = quizLibrary.find((x) => x.id === editingSec.quizId);
                          return (
                            <View style={s.sectionItem}>
                              <View style={[s.dragHandle, { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFE7FB', alignItems: 'center', justifyContent: 'center' }]}>
                                <Trophy size={16} color="#7C3AED" />
                              </View>
                              <View style={s.sectionItemBody}>
                                <Text style={s.sectionItemTitle}>{q?.title || `Quiz #${editingSec.quizId.slice(0, 8)}`}</Text>
                                <Text style={s.sectionItemMeta}>{q?.classLevel ? getStandardLabel(q.classLevel) : 'Any class'} · {q?.questionCount ?? 0} questions</Text>
                              </View>
                              {!readOnlyEndedView && (
                                <TouchableOpacity style={s.removeSectionBtn}
                                  onPress={() => setEditingSec({ ...editingSec, quizId: null })}>
                                  <Text style={s.removeSectionBtnText}>✕</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                  ) : (
                    readOnlyEndedView ? (
                      <View style={s.fieldGroup}>
                        <Text style={s.groupLabel}>QUIZ</Text>
                        <View style={s.fieldCard}>
                          <Text style={[s.fieldInput, { color: '#9A9AB0', fontSize: 12 }]}>No quiz attached to this section.</Text>
                        </View>
                      </View>
                    ) : (
                    <>
                      <View style={s.fieldGroup}>
                        <Text style={s.groupLabel}>PICK FROM LIBRARY</Text>
                        <Pressable style={s.fieldCard} onPress={() => { setPickerSearch(''); setPickerOpen(true); }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ListChecks size={20} color="#4A90E2" />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.fieldInput, { paddingVertical: 0 }]}>Browse Quiz Library</Text>
                              <Text style={[s.fieldLabel, { marginTop: 2 }]}>{quizLibrary.length} quizzes available</Text>
                            </View>
                            <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                          </View>
                        </Pressable>
                      </View>
                    </>
                    )
                  )}
                </ScrollView>
              )}
            </>
          )}

          {/* ── Quiz Picker Overlay (inside section modal) ── */}
          {pickerOpen && (
            <View style={s.pickerOverlay}>
              <View style={[s.modalHeader, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
                <Pressable onPress={() => setPickerOpen(false)} style={s.modalBackBtn}>
                  <Text style={s.modalBackArrow}>‹</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>Quiz Library</Text>
                </View>
              </View>
              <View style={s.pickerToolbar}>
                <View style={s.searchRow}>
                  <Search size={15} color="#9A9AB0" />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Search quizzes…"
                    placeholderTextColor="#A0A8C0"
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    autoCapitalize="none"
                  />
                  {pickerSearch !== '' && (
                    <Pressable onPress={() => setPickerSearch('')}><X size={15} color="#9A9AB0" /></Pressable>
                  )}
                </View>
              </View>
              {(() => {
                const base = fClass ? quizLibrary.filter((q) => !q.classLevel || q.classLevel === fClass) : quizLibrary;
                const all = base.length === 0 && fClass ? quizLibrary : base;
                const list = pickerSearch.trim()
                  ? all.filter((q) => q.title.toLowerCase().includes(pickerSearch.toLowerCase()))
                  : all;
                return (
                  <FlatList
                    data={list}
                    keyExtractor={(q) => q.id}
                    contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const sel = editingSec?.quizId === item.id;
                      return (
                        <Pressable
                          style={[s.questionCard, sel && s.questionCardSelected]}
                          onPress={() => {
                            if (editingSec) setEditingSec({ ...editingSec, quizId: item.id });
                            setPickerOpen(false);
                          }}
                        >
                          <View style={s.questionMeta}>
                            <View style={s.questionBadge}><Text style={s.questionBadgeText}>{item.classLevel ? getStandardLabel(item.classLevel) : 'Any'}</Text></View>
                            <View style={[s.questionBadge, { backgroundColor: '#EDE4FF' }]}>
                              <ListChecks size={10} color="#7B5EA7" />
                              <Text style={[s.questionBadgeText, { color: '#7B5EA7', marginLeft: 3 }]}>{item.questionCount ?? 0} Q</Text>
                            </View>
                            {sel && <View style={[s.questionBadge, { backgroundColor: '#D6F5E0' }]}><Text style={[s.questionBadgeText, { color: '#118650' }]}>✓ Selected</Text></View>}
                          </View>
                          <Text style={s.questionTitle} numberOfLines={2}>{item.title}</Text>
                          <View style={s.questionFooter}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Trophy size={11} color="#9A9AB0" />
                              <Text style={{ fontSize: 11, color: '#9A9AB0', fontWeight: '600' }}>Quiz</Text>
                            </View>
                            <View style={[s.attachPill, sel && { backgroundColor: '#118650' }]}>
                              <Text style={s.attachPillText}>{sel ? '✓ Attached' : '+ Attach'}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    }}
                    ListEmptyComponent={(
                      <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
                        <ListChecks size={40} color="#D0D8F0" />
                        <Text style={{ fontSize: 15, fontWeight: '900', color: '#1a1a2e' }}>No quizzes found</Text>
                        <Text style={{ fontSize: 12, color: '#9A9AB0', textAlign: 'center', paddingHorizontal: 32 }}>
                          {pickerSearch ? 'Try a different search.' : 'Create a quiz first or use the inline option.'}
                        </Text>
                      </View>
                    )}
                  />
                );
              })()}
            </View>
          )}
        </View>
      </Modal>

      <SelectorModal
        visible={classSelectorOpen}
        title="Class Level"
        options={STANDARD_OPTIONS}
        selected={fClass}
        onSelect={(v) => { setFClass(v); setClassSelectorOpen(false); }}
        onClose={() => setClassSelectorOpen(false)}
      />
    </View>
  );
}

// ─────────────────────────── styles ──────────────────────────
// ─────────────────────── DayPicker component ─────────────────────────────────
function DayPicker({
  occupiedDays, selectedDay, onSelect, onVisible,
}: {
  occupiedDays: string[];
  selectedDay: string | null;
  onSelect: (day: string | null) => void;
  onVisible: () => void;
}) {
  const loadedRef = React.useRef(false);
  React.useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; onVisible(); }
  }, [onVisible]);

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const occupiedSet = React.useMemo(() => new Set(occupiedDays), [occupiedDays]);

  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1);
    return d.toISOString().slice(0, 10);
  });

  return (
    <View style={s.dayPickerWrap}>
      <Text style={s.dayPickerHint}>Tap a date. Red cards are already occupied.</Text>
      <View style={s.dayLegend}>
        <View style={s.dayLegendItem}><View style={[s.dayLegendDot, { backgroundColor: '#4A90E2' }]} /><Text style={s.dayLegendText}>Selected</Text></View>
        <View style={s.dayLegendItem}><View style={[s.dayLegendDot, { backgroundColor: '#EEF2FF' }]} /><Text style={s.dayLegendText}>Available</Text></View>
        <View style={s.dayLegendItem}><View style={[s.dayLegendDot, { backgroundColor: '#FEE2E2' }]} /><Text style={s.dayLegendText}>Already taken</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayScroll}>
        {days.map((day) => {
          const occupied = occupiedSet.has(day);
          const selected = selectedDay === day;
          const d = new Date(`${day}T00:00:00`);
          const isT = day === tomorrowStr;
          return (
            <Pressable
              key={day}
              onPress={() => !occupied && onSelect(selected ? null : day)}
              style={[
                s.daySimpleCard,
                selected && s.daySimpleCardSelected,
                occupied && s.daySimpleCardOccupied,
              ]}
            >
              <Text style={[s.daySimpleDow, selected && { color: '#fff' }, occupied && { color: '#B45309' }]}>
                {isT ? 'Tomorrow' : DOW[d.getDay()]}
              </Text>
              <Text style={[s.daySimpleDate, selected && { color: '#fff' }, occupied && { color: '#7F1D1D' }]}>
                {d.getDate()} {MON[d.getMonth()]}
              </Text>
              <View style={[s.daySimpleBadge, occupied ? s.daySimpleBadgeTaken : (selected ? s.daySimpleBadgeSelected : s.daySimpleBadgeOpen)]}>
                <Text style={[s.daySimpleBadgeText, occupied && { color: '#7F1D1D' }, selected && { color: '#fff' }]}>
                  {occupied ? 'Taken' : (selected ? 'Selected' : 'Open')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: '#F5F7FF' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  emptySub:   { fontSize: 13, color: '#9A9AB0', textAlign: 'center' },

  topHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 2 : 8 },
  topHeaderLeft:{ flex: 1, minWidth: 0, paddingRight: 8, flexShrink: 1 },
  topHeading:   { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  topSub:       { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 2, flexShrink: 1 },
  headerActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  historyBtnSmall:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#D0D8F0', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  historyBtnSmallText: { fontSize: 11, fontWeight: '700', color: '#5A6A8A' },
  newBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A90E2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  newBtnText:   { color: '#fff', fontWeight: '800', fontSize: 13 },
  pagerRow:     { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pagerBtn:     { borderRadius: 10, backgroundColor: '#EBF4FF', paddingHorizontal: 14, paddingVertical: 8 },
  pagerBtnDisabled: { backgroundColor: '#F0F0F8' },
  pagerBtnText: { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  pagerBtnTextDisabled: { color: '#B0B8D0' },
  pagerText:    { fontSize: 12, color: '#7A7A9A', fontWeight: '700' },
  historyScreen:     { flex: 1, backgroundColor: '#F5F7FF' },
  historyHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  historyBackBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center' },
  historyBackArrow:  { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  historyTitle:      { fontSize: 18, fontWeight: '900', color: '#1a1a2e' },
  historySubtitle:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500', marginTop: 1 },
  historyCenter:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  historyCard:       { backgroundColor: '#fff', borderRadius: 20, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden', marginBottom: 12 },
  historyCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 8 },
  historyCardIcon:   { width: 46, height: 46, borderRadius: 13, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  historyCardBody:   { flex: 1, gap: 6 },
  historyCardTitle:  { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  historyModeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyModeChip:   { borderRadius: 999, backgroundColor: '#F2F6FF', paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyModeChipLabel: { fontSize: 10, fontWeight: '700', color: '#7A869F', textTransform: 'uppercase' },
  historyModeChipValue: { fontSize: 11, fontWeight: '800', color: '#334155' },
  historyCardMeta:   { fontSize: 12, color: '#9A9AB0', fontWeight: '500', paddingHorizontal: 16, marginTop: 2 },
  historyMetaGrid:   { flexDirection: 'row', columnGap: 10, rowGap: 8, paddingHorizontal: 16, marginTop: 6 },
  historyMetaItem:   { flexBasis: '48%', flexGrow: 1, minWidth: 130 },
  historyMetaLabel:  { fontSize: 10, fontWeight: '800', color: '#7A869F', textTransform: 'uppercase', letterSpacing: 0.4 },
  historyMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  historyMetaRowText:{ fontSize: 11, fontWeight: '600', color: '#475569' },
  historyChipRow:    { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', paddingHorizontal: 16 },
  historyChip:       { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F0F4FF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyChipText:   { fontSize: 11, fontWeight: '700', color: '#5A7AB0' },
  historyCardFooter: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  historyDetailBtn:  { flex: 1, borderRadius: 12, backgroundColor: '#EBF4FF', paddingVertical: 10, alignItems: 'center' },
  historyDetailBtnText: { fontSize: 13, fontWeight: '800', color: '#1A4DA2' },

  // card list
  classCard:       { borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, gap: 8 },
  classCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  classArtBox:     { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  classCardTitle:  { fontSize: 15, fontWeight: '900', color: '#1a1a2e', marginBottom: 2 },
  classModeRow:    { flexDirection: 'column', gap: 4, alignItems: 'flex-start' },
  classModeChip:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classModeChipLabel: { fontSize: 10, fontWeight: '700', color: '#7A869F', textTransform: 'uppercase' },
  classModeChipValue: { fontSize: 11, fontWeight: '800', color: '#334155' },
  classCardDesc:   { fontSize: 11, color: '#5A6A8A', marginBottom: 4, lineHeight: 16 },
  classMetaGrid:   { flexDirection: 'row', columnGap: 10, rowGap: 8 },
  classMetaItem:   { flexBasis: '48%', flexGrow: 1, minWidth: 96 },
  classMetaLabel:  { fontSize: 10, color: '#9A9AB0', fontWeight: '700', textTransform: 'uppercase' },
  classMetaValue:  { fontSize: 12, color: '#1a1a2e', fontWeight: '700', marginTop: 1 },
  classCountsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -2 },
  classCountChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.45)', paddingHorizontal: 9, paddingVertical: 4 },
  classCountChipText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  statusTag:       { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusTagText:   { fontSize: 11, fontWeight: '800' },
  classCardFooter: { flexDirection: 'row', gap: 6, paddingTop: 0 },
  footerBtn:       { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  footerBtnDisabled: { backgroundColor: '#F0F0F8' },
  footerBtnText:   { fontSize: 11, fontWeight: '800' },
  footerBtnTextDisabled: { color: '#9A9AB0' },

  // modal
  modalScreen:    { flex: 1, backgroundColor: '#F5F7FF' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalBackBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBackArrow: { fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  modalTitle:     { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  modalSaveBtn:   { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalTabBar:    { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalTab:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modalTabActive: { borderBottomColor: '#4A90E2' },
  modalTabText:   { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  modalTabTextActive: { color: '#4A90E2', fontWeight: '800' },
  tabContent:     { padding: 16, gap: 16, paddingBottom: 48 },

  // form
  fieldGroup:   { gap: 8 },
  groupLabel:   { fontSize: 10, fontWeight: '800', color: '#9A9AB0', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  fieldCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:   { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  fieldDivider: { height: 1, backgroundColor: '#F0F0F8' },
  selectorRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  selectorVal:  { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  selectorPlaceholder: { fontSize: 14, color: '#B0B8D0' },
  uploadBtn:    { borderRadius: 10, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 11, alignItems: 'center' },
  uploadBtnText:{ fontSize: 13, fontWeight: '800', color: '#4A90E2' },
  fileCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ECEEF4', backgroundColor: '#F8F9FF', padding: 10 },
  fileCardThumb:{ width: 52, height: 52, borderRadius: 8 },
  fileCardIcon: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center' },
  fileCardTitle:{ fontSize: 12, fontWeight: '800', color: '#1a1a2e' },
  fileCardMeta: { fontSize: 10, color: '#9A9AB0', marginTop: 2, fontWeight: '700' },
  sourceToggleRow: { flexDirection: 'row', gap: 6 },
  sourceToggleBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F8' },
  sourceToggleBtnActive: { backgroundColor: '#D6EAFF' },
  sourceToggleText: { fontSize: 11, fontWeight: '700', color: '#9A9AB0' },
  sourceToggleTextActive: { color: '#1A4DA2' },
  infoBox:      { backgroundColor: '#FEF9EC', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  infoBoxText:  { fontSize: 13, color: '#92400E', fontWeight: '600' },
  statusTagLg:  { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  statusTagLgText: { fontSize: 13, fontWeight: '800' },
  dateTimeRow:  { flexDirection: 'row', gap: 10 },
  dateTimeCol:  { flex: 1 },
  dateTimeLabel:{ fontSize: 10, fontWeight: '700', color: '#9A9AB0', marginBottom: 4 },
  dtPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F0F8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  dtPillText:   { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },

  dayPickerWrap: { marginTop: 8 },
  dayPickerHint: { fontSize: 11, color: '#7A869F', fontWeight: '600', marginBottom: 8 },
  dayScroll:     { gap: 8, paddingVertical: 2, paddingRight: 6 },
  daySimpleCard: { width: 104, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#DFE7FF', gap: 4 },
  daySimpleCardSelected: { backgroundColor: '#4A90E2', borderColor: '#3070C0' },
  daySimpleCardOccupied: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  daySimpleDow:  { fontSize: 10, fontWeight: '800', color: '#475569' },
  daySimpleDate: { fontSize: 14, fontWeight: '900', color: '#1a1a2e' },
  daySimpleBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  daySimpleBadgeOpen: { backgroundColor: '#D6E4FF' },
  daySimpleBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
  daySimpleBadgeTaken: { backgroundColor: '#FCA5A5' },
  daySimpleBadgeText: { fontSize: 10, fontWeight: '800', color: '#1A4DA2' },

  dayWeekLabel: { fontSize: 10, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  dayWeekRow:   { flexDirection: 'row', gap: 6 },
  dayCell:      { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 2, backgroundColor: '#F0F0F8', alignItems: 'center', gap: 1, borderWidth: 1.5, borderColor: 'transparent', minHeight: 72 },
  dayCellSelected: { backgroundColor: '#4A90E2', borderColor: '#3070C0' },
  dayCellOccupied: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  dayCellDow:   { fontSize: 8, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.3 },
  dayCellNum:   { fontSize: 18, fontWeight: '900', color: '#1a1a2e', lineHeight: 22 },
  dayCellMon:   { fontSize: 8, fontWeight: '700', color: '#9A9AB0' },
  dayCellTakenBadge: { marginTop: 3, backgroundColor: '#FCA5A5', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  dayCellTakenText: { fontSize: 7, fontWeight: '900', color: '#7F1D1D', textTransform: 'uppercase', letterSpacing: 0.3 },
  dayCellCheckBadge: { marginTop: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  dayCellCheckText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  dayLegend:     { flexDirection: 'row', gap: 12, marginBottom: 10 },
  dayLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayLegendDot:  { width: 10, height: 10, borderRadius: 5 },
  dayLegendText: { fontSize: 10, color: '#9A9AB0', fontWeight: '700' },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  actionBtnText:{ fontSize: 14, fontWeight: '800' },

  // sections
  secGroup:         { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secGroupHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  secGroupTitle:    { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  countBadge:       { backgroundColor: '#EBF4FF', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText:   { fontSize: 11, fontWeight: '800', color: '#1A4DA2' },
  addSecBtn:        { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  addSecBtnText:    { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },
  secEmptyText:     { fontSize: 13, color: '#B0B8D0', padding: 16, textAlign: 'center' },
  sectionItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  dragHandle:       { alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  sectionItemOrder: { fontSize: 10, fontWeight: '800', color: '#B0B8D0' },
  sectionItemBody:  { flex: 1, gap: 2 },
  sectionItemTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  sectionItemMeta:  { fontSize: 11, color: '#9A9AB0' },
  sectionItemActions: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  orderBtn:         { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#F5F7FF' },
  removeSectionBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FFE8E8', marginLeft: 2 },
  removeSectionBtnText: { fontSize: 11, fontWeight: '800', color: '#FF7043' },

  mediaAddPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EBF4FF', borderRadius: 999 },
  mediaAddPillText: { fontSize: 10, fontWeight: '800', color: '#4A90E2' },
  mediaBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  mediaBadgeText:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  // picker overlay
  pickerOverlay:  { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#F5F7FF', zIndex: 10, elevation: 10 },
  pickerToolbar:  { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },
  questionCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1.5, borderColor: '#ECEEF4' },
  questionCardSelected: { borderColor: '#86BFFF', backgroundColor: '#F0F7FF' },
  questionMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  questionBadge:  { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#E8ECF8' },
  questionBadgeText: { fontSize: 10, fontWeight: '800', color: '#5A6A8A' },
  questionTitle:  { fontSize: 13, fontWeight: '700', color: '#1a1a2e', lineHeight: 19 },
  questionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attachPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#4A90E2' },
  attachPillText: { fontSize: 11, fontWeight: '800', color: '#fff' },
});
