/**
 * BookmarksTab — teacher-private collections of reusable Content & Quizzes.
 * Create/edit uses a dual-panel transfer: left = Class → Subject → expandable
 * Topic tree of Content/Quiz items; right = selected items grouped subject-wise.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  Bookmark, BookmarkPlus, ChevronLeft, ChevronDown, ChevronRight,
  Plus, Pencil, Trash2, Search, X, Filter, FolderOpen, Trophy, FileText, Check,
} from 'lucide-react-native';
import { STANDARD_OPTIONS, getStandardLabel } from '../../constants/standards';
import { getAuthorizedClasses, getAuthorizedSubjects } from '../../utils/assignments';
import { AppUser } from '../../types/roles';
import SelectorModal from '../SelectorModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

type CatalogItem = { id: string; classLevel: string; title: string };

type BookmarkRow = {
  id: string;
  name: string;
  description?: string;
  classLevel?: string;
  teacherName?: string;
  itemCount: number;
  contentCount: number;
  quizCount: number;
  subjects: string[];
  createdAt: string;
  updatedAt: string;
};

type SelectedItem = {
  key: string;
  itemType: 'content' | 'quiz';
  resourceId: string;
  title: string;
  subject: string;
  subjectId?: string;
  topicId?: string;
  classLevel?: string;
};

type TopicLite = { id: string; title: string; subject: string; classLevel: string; contentCount?: number; quizCount?: number };
type TopicChildren = { contents: { id: string; title: string }[]; quizzes: { id: string; title: string }[] };

type Props = {
  apiFetch: ApiFetch;
  user: AppUser | null;
};

function itemKey(itemType: 'content' | 'quiz', resourceId: string) {
  return `${itemType}:${resourceId}`;
}

export default function BookmarksTab({ apiFetch, user }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // list filters
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState<'' | 'content' | 'quiz'>('');
  const [classFilterOpen, setClassFilterOpen] = useState(false);
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);

  // editor
  const [editing, setEditing] = useState<null | 'new' | BookmarkRow>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await apiFetch('/catalog/subjects');
      if (!res.ok) return;
      const data = await res.json();
      const items: CatalogItem[] = (data.items || []).map((i: any) => ({
        id: i.id,
        classLevel: i.classLevel || i.class_level,
        title: i.title || i.subject,
      }));
      setCatalog(items);
    } catch {}
  }, [apiFetch]);

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (filterClass) query.set('class_level', filterClass);
      if (filterSubject) query.set('subject', filterSubject);
      if (filterType) query.set('type', filterType);
      const res = await apiFetch(`/bookmarks?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to load bookmarks');
      const data = await res.json();
      setBookmarks(data.bookmarks || []);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load bookmarks' });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, search, filterClass, filterSubject, filterType]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  const classOptions = useMemo(
    () => getAuthorizedClasses(user, STANDARD_OPTIONS.map((o) => o.value)).map((v) => ({ label: getStandardLabel(v), value: v })),
    [user],
  );
  const filterSubjectOptions = useMemo(
    () => getAuthorizedSubjects(user, catalog, (i) => i.classLevel, (i) => i.title, filterClass || undefined).map((t) => ({ label: t, value: t })),
    [user, catalog, filterClass],
  );

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/bookmarks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete bookmark');
      setMessage({ type: 'success', text: 'Bookmark deleted.' });
      loadBookmarks();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete bookmark' });
    }
  };

  return (
    <View style={c.root}>
      <View style={c.pageHeader}>
        <View>
          <Text style={c.pageTitle}>Bookmarks</Text>
          <Text style={c.pageSub}>{bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={c.createBtn} onPress={() => setEditing('new')}>
          <Plus size={14} color="#fff" />
          <Text style={c.createBtnText}>Create Bookmark</Text>
        </Pressable>
      </View>

      {message && (
        <View style={[c.toast, message.type === 'success' ? c.toastSuccess : c.toastError]}>
          <Text style={[c.toastText, message.type === 'success' ? c.toastSuccessText : c.toastErrorText]}>{message.text}</Text>
        </View>
      )}

      <View style={c.filterSection}>
        <View style={c.searchBar}>
          <Search size={14} color="#525C6B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or description..."
            placeholderTextColor="#A0A8C0"
            style={c.searchBarInput}
          />
          {search !== '' && <Pressable onPress={() => setSearch('')}><X size={14} color="#525C6B" /></Pressable>}
        </View>
        <View style={c.filterRow}>
          <Filter size={12} color="#525C6B" />
          <Pressable style={[c.chip, !!filterClass && c.chipActive]} onPress={() => setClassFilterOpen(true)}>
            <Text style={[c.chipText, !!filterClass && c.chipTextActive]}>{filterClass ? getStandardLabel(filterClass) : 'All Classes'}</Text>
          </Pressable>
          <Pressable style={[c.chip, !!filterSubject && c.chipActive]} onPress={() => setSubjectFilterOpen(true)}>
            <Text style={[c.chipText, !!filterSubject && c.chipTextActive]}>{filterSubject || 'All Subjects'}</Text>
          </Pressable>
          <Pressable style={[c.chip, filterType === 'content' && c.chipActive]} onPress={() => setFilterType((p) => (p === 'content' ? '' : 'content'))}>
            <Text style={[c.chipText, filterType === 'content' && c.chipTextActive]}>Content</Text>
          </Pressable>
          <Pressable style={[c.chip, filterType === 'quiz' && c.chipActive]} onPress={() => setFilterType((p) => (p === 'quiz' ? '' : 'quiz'))}>
            <Text style={[c.chipText, filterType === 'quiz' && c.chipTextActive]}>Quiz</Text>
          </Pressable>
          {(filterClass || filterSubject || filterType) && (
            <Pressable style={c.clearChip} onPress={() => { setFilterClass(''); setFilterSubject(''); setFilterType(''); }}>
              <Text style={c.clearChipText}>✕ Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={c.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={c.emptyWrap}><ActivityIndicator size="large" color="#2D5DC9" /></View>
        ) : bookmarks.length === 0 ? (
          <View style={c.emptyWrap}>
            <View style={c.emptyIcon}><Bookmark size={34} color="#2D5DC9" /></View>
            <Text style={c.emptyTitle}>No bookmarks yet</Text>
            <Text style={c.emptySub}>Create a bookmark to save reusable content and quizzes.</Text>
            <Pressable style={c.emptyBtn} onPress={() => setEditing('new')}><Text style={c.emptyBtnText}>Create Bookmark</Text></Pressable>
          </View>
        ) : (
          bookmarks.map((b) => (
            <View key={b.id} style={c.card}>
              <View style={c.cardTop}>
                <View style={c.artBox}><BookmarkPlus size={24} color="#2D5DC9" /></View>
                <View style={c.cardInfo}>
                  <Text style={c.cardTitle} numberOfLines={2}>{b.name}</Text>
                  {b.description ? <Text style={c.cardMeta} numberOfLines={1}>{b.description}</Text> : null}
                  <View style={c.cardChipRow}>
                    {b.classLevel ? <View style={c.cardChip}><Text style={c.cardChipText}>{getStandardLabel(b.classLevel)}</Text></View> : null}
                    <View style={c.cardChip}><Text style={c.cardChipText}>{b.itemCount} item{b.itemCount !== 1 ? 's' : ''}</Text></View>
                    {b.contentCount > 0 ? <View style={c.cardChip}><FileText size={10} color="#3F5D8C" /><Text style={c.cardChipText}>{b.contentCount}</Text></View> : null}
                    {b.quizCount > 0 ? <View style={c.cardChip}><Trophy size={10} color="#B23D00" /><Text style={c.cardChipText}>{b.quizCount}</Text></View> : null}
                  </View>
                  {b.subjects.length > 0 ? (
                    <View style={c.cardChipRow}>
                      {b.subjects.map((s) => <View key={s} style={c.subjectPill}><Text style={c.subjectPillText}>{s}</Text></View>)}
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={c.cardFooter}>
                <Pressable style={[c.footerBtn, { backgroundColor: '#FFF3E0' }]} onPress={() => setEditing(b)}>
                  <Pencil size={13} color="#B23D00" /><Text style={[c.footerBtnText, { color: '#B23D00' }]}>Edit</Text>
                </Pressable>
                <Pressable style={[c.footerBtn, { backgroundColor: '#FEF0ED' }]} onPress={() => handleDelete(b.id)}>
                  <Trash2 size={13} color="#B03A19" /><Text style={[c.footerBtnText, { color: '#B03A19' }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <SelectorModal visible={classFilterOpen} title="Select Class" options={classOptions} selected={filterClass} anyLabel="All Classes" onSelect={(v) => { setFilterClass(v); setFilterSubject(''); setClassFilterOpen(false); }} onClose={() => setClassFilterOpen(false)} />
      <SelectorModal visible={subjectFilterOpen} title="Select Subject" options={filterSubjectOptions} selected={filterSubject} anyLabel="All Subjects" isSubject onSelect={(v) => { setFilterSubject(v); setSubjectFilterOpen(false); }} onClose={() => setSubjectFilterOpen(false)} />

      <BookmarkEditorModal
        editing={editing}
        apiFetch={apiFetch}
        user={user}
        catalog={catalog}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); setMessage({ type: 'success', text: 'Bookmark saved.' }); loadBookmarks(); }}
      />
    </View>
  );
}

function BookmarkEditorModal({ editing, apiFetch, user, catalog, onClose, onSaved }: {
  editing: null | 'new' | BookmarkRow;
  apiFetch: ApiFetch;
  user: AppUser | null;
  catalog: CatalogItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOpen = editing !== null;
  const isEdit = editing !== null && editing !== 'new';
  const editId = isEdit ? (editing as BookmarkRow).id : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());

  const [topics, setTopics] = useState<TopicLite[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, TopicChildren>>({});
  const [loadingChild, setLoadingChild] = useState<Set<string>>(new Set());

  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // reset on open / load existing
  useEffect(() => {
    if (!isOpen) return;
    setToast(null);
    setSubject(''); setTopics([]); setExpanded(new Set()); setChildren({});
    if (!isEdit) {
      setName(''); setDescription(''); setClassLevel(''); setSelected(new Map());
      return;
    }
    setName(''); setDescription(''); setClassLevel(''); setSelected(new Map());
    apiFetch(`/bookmarks/${editId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.bookmark) return;
        const bm = d.bookmark;
        setName(bm.name || '');
        setDescription(bm.description || '');
        setClassLevel(bm.classLevel || '');
        const map = new Map<string, SelectedItem>();
        (bm.items || []).forEach((it: any) => {
          const resourceId = it.itemType === 'content' ? it.contentId : it.quizId;
          if (!resourceId) return;
          const key = itemKey(it.itemType, resourceId);
          map.set(key, {
            key,
            itemType: it.itemType,
            resourceId,
            title: it.title || 'Untitled',
            subject: it.subject || 'Other',
            subjectId: it.subjectId,
            topicId: it.topicId,
            classLevel: it.classLevel,
          });
        });
        setSelected(map);
      })
      .catch(() => {});
  }, [isOpen, editId]);

  const classOptions = useMemo(
    () => getAuthorizedClasses(user, STANDARD_OPTIONS.map((o) => o.value)).map((v) => ({ label: getStandardLabel(v), value: v })),
    [user],
  );
  const subjectOptions = useMemo(
    () => getAuthorizedSubjects(user, catalog, (i) => i.classLevel, (i) => i.title, classLevel || undefined).map((t) => ({ label: t, value: t })),
    [user, catalog, classLevel],
  );

  const resolveSubjectId = useCallback(
    (cls: string, subj: string) => catalog.find((i) => i.classLevel === cls && i.title === subj)?.id,
    [catalog],
  );

  const loadTopics = useCallback(async (cls: string, subj: string) => {
    setLoadingTopics(true);
    try {
      const merged: any[] = [];
      let offset = 0;
      let guard = 0;
      while (guard < 1000) {
        const query = new URLSearchParams();
        query.set('class_level', cls);
        query.set('subject', subj);
        query.set('limit', '150');
        query.set('offset', String(offset));
        const res = await apiFetch(`/topics?${query.toString()}`);
        if (!res.ok) break;
        const data = await res.json();
        const rows = Array.isArray(data.topics) ? data.topics : [];
        merged.push(...rows);
        if (rows.length === 0) break;
        const total = Number(data.total ?? NaN);
        if (Number.isFinite(total)) {
          if (merged.length >= total) break;
        } else if (rows.length < 150) {
          break;
        }
        offset += rows.length;
        guard += 1;
      }
      setTopics(merged.map((t: any) => ({
        id: t.id, title: t.title, subject: t.subject, classLevel: t.classLevel,
        contentCount: t.contentCount, quizCount: t.quizCount,
      })));
    } catch {
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isOpen && classLevel && subject) loadTopics(classLevel, subject);
  }, [isOpen, classLevel, subject, loadTopics]);

  const loadTopicChildren = useCallback(async (topicId: string) => {
    if (children[topicId]) return;
    setLoadingChild((prev) => new Set(prev).add(topicId));
    try {
      const [detailsRes, quizzesRes] = await Promise.all([
        apiFetch(`/topics/${topicId}/details`),
        apiFetch(`/topics/${topicId}/quizzes`),
      ]);
      const details = detailsRes.ok ? await detailsRes.json() : {};
      const quizzes = quizzesRes.ok ? await quizzesRes.json() : {};
      const contents = (details.contentItems || details.contents || []).map((it: any) => ({ id: it.id, title: it.title || 'Untitled' }));
      const quizList = (quizzes.quizzes || []).map((q: any) => ({ id: q.id, title: q.title || 'Untitled' }));
      setChildren((prev) => ({ ...prev, [topicId]: { contents, quizzes: quizList } }));
    } catch {
      setChildren((prev) => ({ ...prev, [topicId]: { contents: [], quizzes: [] } }));
    } finally {
      setLoadingChild((prev) => { const n = new Set(prev); n.delete(topicId); return n; });
    }
  }, [apiFetch, children]);

  const toggleExpand = (topicId: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(topicId)) n.delete(topicId);
      else { n.add(topicId); loadTopicChildren(topicId); }
      return n;
    });
  };

  const addItem = (itemType: 'content' | 'quiz', resourceId: string, title: string, topic: TopicLite) => {
    const key = itemKey(itemType, resourceId);
    setSelected((prev) => {
      const n = new Map(prev);
      n.set(key, {
        key, itemType, resourceId, title,
        subject: topic.subject || subject || 'Other',
        subjectId: resolveSubjectId(topic.classLevel || classLevel, topic.subject || subject),
        topicId: topic.id,
        classLevel: topic.classLevel || classLevel,
      });
      return n;
    });
  };

  const removeItem = (key: string) => {
    setSelected((prev) => { const n = new Map(prev); n.delete(key); return n; });
  };

  const selectAllForTopic = (topic: TopicLite) => {
    const ch = children[topic.id];
    if (!ch) return;
    setSelected((prev) => {
      const n = new Map(prev);
      ch.contents.forEach((it) => {
        const key = itemKey('content', it.id);
        n.set(key, { key, itemType: 'content', resourceId: it.id, title: it.title, subject: topic.subject || subject || 'Other', subjectId: resolveSubjectId(topic.classLevel || classLevel, topic.subject || subject), topicId: topic.id, classLevel: topic.classLevel || classLevel });
      });
      ch.quizzes.forEach((q) => {
        const key = itemKey('quiz', q.id);
        n.set(key, { key, itemType: 'quiz', resourceId: q.id, title: q.title, subject: topic.subject || subject || 'Other', subjectId: resolveSubjectId(topic.classLevel || classLevel, topic.subject || subject), topicId: topic.id, classLevel: topic.classLevel || classLevel });
      });
      return n;
    });
  };

  const selectedBySubject = useMemo(() => {
    const groups = new Map<string, SelectedItem[]>();
    selected.forEach((item) => {
      const arr = groups.get(item.subject) || [];
      arr.push(item);
      groups.set(item.subject, arr);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selected]);

  const handleSave = async () => {
    if (!name.trim()) { setToast('Bookmark name is required.'); return; }
    setSaving(true);
    try {
      const items = Array.from(selected.values()).map((it) => ({
        itemType: it.itemType,
        contentId: it.itemType === 'content' ? it.resourceId : undefined,
        quizId: it.itemType === 'quiz' ? it.resourceId : undefined,
        subjectId: it.subjectId,
        topicId: it.topicId,
        classLevel: it.classLevel,
      }));
      const body = JSON.stringify({ name: name.trim(), description: description.trim() || undefined, classLevel: classLevel || undefined, items });
      const res = await apiFetch(editId ? `/bookmarks/${editId}` : '/bookmarks', {
        method: editId ? 'PUT' : 'POST',
        body,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to save'); }
      onSaved();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to save bookmark');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={c.modalScreen}>
        <View style={[c.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable onPress={onClose} style={c.modalBackBtn}><ChevronLeft size={24} color="#1a1a2e" /></Pressable>
          <Text style={c.modalTitle} numberOfLines={1}>{isEdit ? 'Edit Bookmark' : 'Create Bookmark'}</Text>
          <Pressable style={c.modalSaveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={c.modalSaveBtnText}>Save</Text>}
          </Pressable>
        </View>

        {toast && <View style={c.inlineToast}><Text style={c.inlineToastText}>{toast}</Text></View>}

        <ScrollView contentContainerStyle={c.tabContent}>
          <View style={c.fieldCard}>
            <Text style={c.fieldLabel}>Bookmark Name *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Revision for Final Exams" style={c.fieldInput} placeholderTextColor="#B0B8D0" />
            <View style={c.fieldDivider} />
            <Text style={c.fieldLabel}>Description / Tag</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Optional note" style={c.fieldInput} placeholderTextColor="#B0B8D0" />
          </View>

          <View style={c.fieldCard}>
            <Text style={c.fieldLabel}>Filter Content</Text>
            <View style={c.selectRow}>
              <Pressable style={[c.selectChip, !!classLevel && c.selectChipActive]} onPress={() => setClassOpen(true)}>
                <Text style={[c.selectChipText, !!classLevel && c.selectChipTextActive]}>{classLevel ? getStandardLabel(classLevel) : 'Select Class'}</Text>
              </Pressable>
              <Pressable style={[c.selectChip, !!subject && c.selectChipActive, !classLevel && { opacity: 0.5 }]} onPress={() => classLevel && setSubjectOpen(true)} disabled={!classLevel}>
                <Text style={[c.selectChipText, !!subject && c.selectChipTextActive]}>{subject || 'Select Subject'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Dual panel */}
          <View style={c.panels}>
            {/* Available */}
            <View style={c.panel}>
              <Text style={c.panelTitle}>Available</Text>
              <View style={c.panelBody}>
                {!classLevel || !subject ? (
                  <Text style={c.panelHint}>Select a class and subject to list topics.</Text>
                ) : loadingTopics ? (
                  <ActivityIndicator size="small" color="#2D5DC9" style={{ marginTop: 16 }} />
                ) : topics.length === 0 ? (
                  <Text style={c.panelHint}>No topics found.</Text>
                ) : (
                  topics.map((topic) => {
                    const isOpenTopic = expanded.has(topic.id);
                    const ch = children[topic.id];
                    return (
                      <View key={topic.id} style={c.topicBlock}>
                        <Pressable style={c.topicRow} onPress={() => toggleExpand(topic.id)}>
                          {isOpenTopic ? <ChevronDown size={15} color="#2D5DC9" /> : <ChevronRight size={15} color="#525C6B" />}
                          <FolderOpen size={14} color="#9B8EC4" />
                          <Text style={c.topicTitle} numberOfLines={1}>{topic.title}</Text>
                          <Pressable style={c.selectAllBtn} onPress={() => { if (!ch) { loadTopicChildren(topic.id).then(() => {}); } selectAllForTopic(topic); }}>
                            <Text style={c.selectAllText}>All</Text>
                          </Pressable>
                        </Pressable>
                        {isOpenTopic ? (
                          loadingChild.has(topic.id) ? (
                            <ActivityIndicator size="small" color="#2D5DC9" style={{ marginVertical: 8 }} />
                          ) : (
                            <View style={c.childList}>
                              {(ch?.contents || []).map((it) => {
                                const sel = selected.has(itemKey('content', it.id));
                                return (
                                  <Pressable key={`c-${it.id}`} style={[c.childRow, sel && c.childRowSel]} onPress={() => sel ? removeItem(itemKey('content', it.id)) : addItem('content', it.id, it.title, topic)}>
                                    <View style={[c.checkbox, sel && c.checkboxOn]}>{sel ? <Check size={11} color="#fff" /> : null}</View>
                                    <FileText size={12} color="#3F5D8C" />
                                    <Text style={c.childTitle} numberOfLines={1}>{it.title}</Text>
                                  </Pressable>
                                );
                              })}
                              {(ch?.quizzes || []).map((q) => {
                                const sel = selected.has(itemKey('quiz', q.id));
                                return (
                                  <Pressable key={`q-${q.id}`} style={[c.childRow, sel && c.childRowSel]} onPress={() => sel ? removeItem(itemKey('quiz', q.id)) : addItem('quiz', q.id, q.title, topic)}>
                                    <View style={[c.checkbox, sel && c.checkboxOn]}>{sel ? <Check size={11} color="#fff" /> : null}</View>
                                    <Trophy size={12} color="#B23D00" />
                                    <Text style={c.childTitle} numberOfLines={1}>{q.title}</Text>
                                  </Pressable>
                                );
                              })}
                              {ch && ch.contents.length === 0 && ch.quizzes.length === 0 ? <Text style={c.panelHint}>No items in this topic.</Text> : null}
                            </View>
                          )
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* Selected */}
            <View style={c.panel}>
              <View style={c.panelTitleRow}>
                <Text style={c.panelTitle}>Selected ({selected.size})</Text>
                {selected.size > 0 ? <Pressable onPress={() => setSelected(new Map())}><Text style={c.removeAllText}>Remove all</Text></Pressable> : null}
              </View>
              <View style={c.panelBody}>
                {selected.size === 0 ? (
                  <Text style={c.panelHint}>No items selected yet.</Text>
                ) : (
                  selectedBySubject.map(([subj, items]) => (
                    <View key={subj} style={c.selGroup}>
                      <Text style={c.selGroupTitle}>{subj} ({items.length})</Text>
                      {items.map((it) => (
                        <View key={it.key} style={c.selRow}>
                          {it.itemType === 'content' ? <FileText size={12} color="#3F5D8C" /> : <Trophy size={12} color="#B23D00" />}
                          <Text style={c.selTitle} numberOfLines={1}>{it.title}</Text>
                          <Pressable onPress={() => removeItem(it.key)} style={c.selRemove}><X size={13} color="#B03A19" /></Pressable>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <SelectorModal visible={classOpen} title="Select Class" options={classOptions} selected={classLevel} onSelect={(v) => { setClassLevel(v); setSubject(''); setClassOpen(false); }} onClose={() => setClassOpen(false)} />
      <SelectorModal visible={subjectOpen} title="Select Subject" options={subjectOptions} selected={subject} isSubject onSelect={(v) => { setSubject(v); setSubjectOpen(false); }} onClose={() => setSubjectOpen(false)} />
    </Modal>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  list: { padding: 16, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16 },
  pageTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a2e' },
  pageSub: { fontSize: 12, color: '#525C6B', fontWeight: '500', marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2D5DC9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  toast: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toastSuccess: { backgroundColor: '#D6F5D6', borderWidth: 1, borderColor: '#7DC67A' },
  toastError: { backgroundColor: '#FFE8E8', borderWidth: 1, borderColor: '#D33F13' },
  toastText: { fontSize: 13, fontWeight: '600' },
  toastSuccessText: { color: '#1A6B1A' },
  toastErrorText: { color: '#B91C1C' },

  filterSection: { paddingHorizontal: 16, marginBottom: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F0F0F8' },
  chipActive: { backgroundColor: '#D6EAFF' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#525C6B' },
  chipTextActive: { color: '#1A4DA2', fontWeight: '700' },
  clearChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FEE2E2' },
  clearChipText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FF', borderWidth: 1.5, borderColor: '#E0E4F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchBarInput: { flex: 1, fontSize: 13, color: '#1a1a2e', paddingVertical: 0 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#D6EAFF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#525C6B', textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, backgroundColor: '#2D5DC9', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 14, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 10 },
  artBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D6EAFF' },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', lineHeight: 22 },
  cardMeta: { fontSize: 12, color: '#525C6B', fontWeight: '500' },
  cardChipRow: { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' },
  cardChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cardChipText: { fontSize: 11, fontWeight: '700', color: '#3F5D8C' },
  subjectPill: { backgroundColor: '#EDE4FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  subjectPillText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  cardFooter: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  footerBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  footerBtnText: { fontSize: 11, fontWeight: '800' },

  modalScreen: { flex: 1, backgroundColor: '#F5F7FF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  modalBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  modalSaveBtn: { backgroundColor: '#2D5DC9', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  modalSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  inlineToast: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFE8E8', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#D33F13' },
  inlineToastText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', textAlign: 'center' },

  tabContent: { padding: 16, gap: 16, paddingBottom: 40 },
  fieldCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#525C6B', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  fieldDivider: { height: 1, backgroundColor: '#F0F0F8' },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectChip: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F0F0F8', alignItems: 'center' },
  selectChipActive: { backgroundColor: '#D6EAFF' },
  selectChipText: { fontSize: 13, fontWeight: '600', color: '#525C6B' },
  selectChipTextActive: { color: '#1A4DA2', fontWeight: '700' },

  panels: { flexDirection: 'row', gap: 10 },
  panel: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 10, minHeight: 240, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  panelTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 12, fontWeight: '800', color: '#1a1a2e', marginBottom: 6 },
  removeAllText: { fontSize: 11, fontWeight: '700', color: '#B03A19' },
  panelBody: { gap: 6 },
  panelHint: { fontSize: 12, color: '#525C6B', paddingVertical: 12, textAlign: 'center' },

  topicBlock: { borderRadius: 10, backgroundColor: '#F8F9FF', overflow: 'hidden' },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8 },
  topicTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1a1a2e' },
  selectAllBtn: { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  selectAllText: { fontSize: 10, fontWeight: '800', color: '#1A4DA2' },
  childList: { paddingHorizontal: 8, paddingBottom: 8, gap: 4 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: '#ECEEF4' },
  childRowSel: { borderColor: '#2D5DC9', backgroundColor: '#EBF4FF' },
  childTitle: { flex: 1, fontSize: 12, color: '#1a1a2e', fontWeight: '500' },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#C0C8E0', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#2D5DC9', borderColor: '#2D5DC9' },

  selGroup: { gap: 4, marginBottom: 6 },
  selGroupTitle: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  selTitle: { flex: 1, fontSize: 12, color: '#1a1a2e', fontWeight: '500' },
  selRemove: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#FEF0ED' },
});
