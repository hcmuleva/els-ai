import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity, BookOpen, ChevronLeft, ChevronRight, CreditCard, FileSpreadsheet, Flag, FlaskConical, Globe, GraduationCap, Hash, Languages, Leaf, Monitor, Palette, Plus, Search, Shield, Sparkles, Users, UserCheck, X, Check, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react-native';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import SelectorModal from '../../src/components/SelectorModal';
import { BillingPanel } from '../../src/components/billing/BillingPanel';
import { QuestionDumpTab } from '../../src/components/admin/QuestionDumpTab';
import { SchoolAnalyticsTab } from '../../src/components/admin/SchoolAnalyticsTab';
import { FeatureFlagsTab } from '../../src/components/admin/FeatureFlagsTab';
import { useFeatureFlag } from '../../src/hooks/useFeatureFlags';
import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../../src/theme';
import { UserRole } from '../../src/types/roles';

type IconComp = React.ComponentType<{ size?: number; color?: string }>;

type ManagedRole = Extract<UserRole, 'student' | 'teacher' | 'parent' | 'admin'>;
type AdminTab = 'subject' | 'student' | 'teacher' | 'parent' | 'billing' | 'question_dump' | 'analytics' | 'feature_flags';
type DialogMode = 'create' | 'edit';

type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  classLevel?: string;
  activeRole: UserRole;
  roles: UserRole[];
};

type AssignmentPair = {
  classLevel: string;
  subject: string;
};

export interface TeacherClassAssignment {
  classLevel: string;
  allSubjects: boolean;
  assignedSubjects: string[];
}

// Sorts a class assignment list by canonical STANDARD_OPTIONS order
const STANDARD_ORDER = new Map(STANDARD_OPTIONS.map((s, i) => [s.value, i]));
function sortByStandard(list: TeacherClassAssignment[]): TeacherClassAssignment[] {
  return [...list].sort((a, b) => (STANDARD_ORDER.get(a.classLevel) ?? 99) - (STANDARD_ORDER.get(b.classLevel) ?? 99));
}

type TeacherAssignmentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  assignments: AssignmentPair[];
  classAssignments?: TeacherClassAssignment[];
};

type ParentStudent = {
  id: string;
  firstName: string;
  lastName: string;
  classLevel?: string;
};

type ParentAssignmentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  students: ParentStudent[];
};

type StudentSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  classLevel?: string;
};

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  classLevel: string;
  password: string;
  role: ManagedRole;
};

type SubjectAuthorUser = {
  id: string;
  firstName: string;
  lastName: string;
  mobileNumber?: string;
  profileImage?: string;
};

type SubjectRecord = {
  id: string;
  coverImage?: string;
  iconImage?: string;
  iconBgColor?: string;
  title: string;
  description?: string;
  author?: string;
  authorUserId?: string;
  authorUser?: SubjectAuthorUser;
  isExternalAuthor?: boolean;
  classLevel: string;
};

type SubjectFormState = {
  coverImage: string;
  iconImage: string;
  iconBgColor: string;
  title: string;
  description: string;
  isExternalAuthor: boolean;
  authorName: string;
  authorUserId: string;
  authorUserDisplayName: string;
  authorUserMobileNumber: string;
  authorUserProfileImage: string;
  classLevel: string;
};

type AuthorSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  mobileNumber?: string;
  profileImage?: string;
};

type PickedFile = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

const roleOptions: ManagedRole[] = ['student', 'teacher', 'parent', 'admin'];
const TAB_OPTIONS: Array<{ key: AdminTab; label: string; description: string; tint: string; tintLight: string; activeFill?: string; Icon: IconComp }> = [
  { key: 'subject', label: 'Subjects', description: 'Create and manage curriculum subjects for each standard.', tint: Colors.accent, tintLight: Colors.accentLight, Icon: BookOpen },
  { key: 'student', label: 'Students', description: 'Manage student records, classes, and profile details.', tint: Colors.primary, tintLight: Colors.primaryLight, Icon: GraduationCap },
  { key: 'teacher', label: 'Teachers', description: 'Assign standards and subjects to teachers in one place.', tint: Colors.purple, tintLight: Colors.purpleLight, Icon: UserCheck },
  { key: 'parent', label: 'Parents', description: 'Map student accounts with parents for visibility and reports.', tint: Colors.success, tintLight: Colors.successLight, Icon: Users },
  // tint doubles as the active tile's solid fill behind white text; Colors.warning
  // and #0EA5E9 only give white text 2.06:1 / 2.77:1, so activeFill overrides just that fill.
  { key: 'billing', label: 'Billing', description: 'Track subscriptions and organizational billing settings.', tint: Colors.warning, tintLight: Colors.warningLight, activeFill: '#A6541B', Icon: CreditCard },
  { key: 'question_dump', label: 'Question Dump', description: 'Bulk create questions from JSON format.', tint: '#0EA5E9', tintLight: '#E0F2FE', activeFill: '#0369A1', Icon: FileSpreadsheet },
  { key: 'analytics', label: 'Analytics', description: 'School-wide risk distribution, at-risk students, and performance forecasts.', tint: '#B71C1C', tintLight: '#FEE2E2', Icon: Activity },
  { key: 'feature_flags', label: 'Feature Flags', description: 'Turn features on or off for your organization without a deploy.', tint: '#6D28D9', tintLight: '#EDE9FE', Icon: Flag },
];
const TABLE_PAGE_SIZE = 8;
const ADMIN_ACTIVE_TAB_KEY = 'admin:activeTab';
const ADMIN_TAB_KEYS: AdminTab[] = ['subject', 'student', 'teacher', 'parent', 'billing', 'question_dump', 'analytics', 'feature_flags'];

const EMPTY_USER_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  classLevel: '',
  password: '',
  role: 'student',
};

const EMPTY_SUBJECT_FORM: SubjectFormState = {
  coverImage: '',
  iconImage: '',
  iconBgColor: '#D6EAFF',
  title: '',
  description: '',
  isExternalAuthor: false,
  authorName: '',
  authorUserId: '',
  authorUserDisplayName: '',
  authorUserMobileNumber: '',
  authorUserProfileImage: '',
  classLevel: '',
};

const SUBJECT_ICON_BG_OPTIONS = ['#D6EAFF', '#D6F5D6', '#EDE4FF', '#FFE8D6', '#FFF5CC', '#FFE0F0', '#F1F5F9', '#DCFCE7'];
const SUBJECT_ICON_LIBRARY: Array<{ key: string; label: string; Icon: IconComp; color: string }> = [
  { key: 'book-open', label: 'Book', Icon: BookOpen, color: '#2D5DC9' },
  { key: 'hash', label: 'Math', Icon: Hash, color: '#D33F13' },
  { key: 'flask', label: 'Science', Icon: FlaskConical, color: '#7DC67A' },
  { key: 'leaf', label: 'Nature', Icon: Leaf, color: '#4CAF50' },
  { key: 'languages', label: 'Language', Icon: Languages, color: '#9B8EC4' },
  { key: 'globe', label: 'GK', Icon: Globe, color: '#F97316' },
  { key: 'monitor', label: 'Computer', Icon: Monitor, color: '#0EA5E9' },
  { key: 'sparkles', label: 'Rhymes', Icon: Sparkles, color: '#7C3AED' },
  { key: 'activity', label: 'Activity', Icon: Activity, color: '#22C55E' },
  { key: 'palette', label: 'Art', Icon: Palette, color: '#F59E0B' },
];
const SUBJECT_ICON_LIBRARY_MAP = SUBJECT_ICON_LIBRARY.reduce<Record<string, { Icon: IconComp; color: string }>>((acc, item) => {
  acc[item.key] = { Icon: item.Icon, color: item.color };
  return acc;
}, {});

const pairKey = (pair: AssignmentPair) => `${pair.classLevel}::${pair.subject}`;

const getAvatarInitials = (label: string) =>
  label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const extractFileName = (source: string): string => {
  const trimmed = source.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('symbol:')) {
    const key = trimmed.slice('symbol:'.length);
    return `icon-${key || 'symbol'}`;
  }
  if (trimmed.startsWith('data:')) {
    const mime = trimmed.slice(5, trimmed.indexOf(';') > -1 ? trimmed.indexOf(';') : undefined).trim();
    const extension = mime.includes('/') ? mime.split('/')[1] : 'file';
    return `uploaded-file.${extension || 'file'}`;
  }
  try {
    const normalized = resolveMediaUrl(trimmed);
    const path = normalized.split('?')[0].split('#')[0];
    const segment = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
    return segment || 'uploaded-file';
  } catch {
    return 'uploaded-file';
  }
};

const resolveIconSymbol = (value?: string) => {
  const trimmed = (value || '').trim().toLowerCase();
  if (!trimmed.startsWith('symbol:')) return null;
  const symbol = trimmed.slice('symbol:'.length);
  return SUBJECT_ICON_LIBRARY_MAP[symbol] ? symbol : null;
};

const toMediaLabel = (source: string, fallback: string) => {
  if (!source.trim()) return `No ${fallback} selected`;
  return extractFileName(source);
};

const toPersistentMediaUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('X-Amz-') && !trimmed.includes('x-amz-')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
};

const resolveMediaUrl = (url?: string) => {
  const value = (url || '').trim();
  if (!value) return '';
  if (value.startsWith('/media')) return `${API_BASE_URL}${value}`;
  return value;
};

async function pickImageAsDataUrl(): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    throw new Error('Image upload is currently available on web. On mobile, use cover image URL for now.');
  }

  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) {
      reject(new Error('File picker is unavailable in this environment.'));
      return;
    }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No image selected.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          dataUrl: String(reader.result || ''),
          fileName: file.name || 'cover-image',
          mimeType: file.type || 'image/*',
        });
      reader.onerror = () => reject(new Error('Failed to read selected image.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export default function AdminScreen() {
  const { user, apiFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AdminTab>('subject');
  // Demonstrates the feature-flags mechanism end-to-end: the Analytics tab
  // (the most recently-added, explicitly-heuristic-based feature — see
  // PENDING_ITEMS.md #10) can be turned off per-organization from the new
  // Feature Flags tab below without a deploy. Fails open (tab stays
  // visible) while loading or on error — see useFeatureFlag's docstring.
  const analyticsEnabled = useFeatureFlag('admin_school_analytics');
  const visibleTabOptions = useMemo(
    () => TAB_OPTIONS.filter((tab) => tab.key !== 'analytics' || analyticsEnabled),
    [analyticsEnabled],
  );
  useEffect(() => {
    if (!analyticsEnabled && activeTab === 'analytics') setActiveTab('subject');
  }, [analyticsEnabled, activeTab]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [students, setStudents] = useState<ManagedUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherAssignmentUser[]>([]);
  const [parents, setParents] = useState<ParentAssignmentUser[]>([]);
  const [tabPage, setTabPage] = useState<Record<AdminTab, number>>({
    subject: 1,
    student: 1,
    teacher: 1,
    parent: 1,
    billing: 1,
    question_dump: 1,
    analytics: 1,
    feature_flags: 1,
  });
  const [adminCounts, setAdminCounts] = useState({ subjects: 0, students: 0, teachers: 0, parents: 0 });
  const [assignmentCatalog, setAssignmentCatalog] = useState<AssignmentPair[]>([]);
  const [studentFilters, setStudentFilters] = useState({ search: '', classLevel: '' });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectClassFilter, setSubjectClassFilter] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [pendingDeleteSubject, setPendingDeleteSubject] = useState<SubjectRecord | null>(null);
  const [savingTeacherAssignments, setSavingTeacherAssignments] = useState(false);
  const [savingParentStudents, setSavingParentStudents] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toast, setToast] = useState<{ text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [subjectDialogMode, setSubjectDialogMode] = useState<DialogMode | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(EMPTY_SUBJECT_FORM);
  const [authorSearchEmail, setAuthorSearchEmail] = useState('');
  const [authorSearchResults, setAuthorSearchResults] = useState<AuthorSearchResult[]>([]);
  const [loadingAuthorSearch, setLoadingAuthorSearch] = useState(false);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [subjectLogoLibraryOpen, setSubjectLogoLibraryOpen] = useState(false);

  const [teacherModalUser, setTeacherModalUser] = useState<TeacherAssignmentUser | null>(null);
  const [teacherSelectedPairs, setTeacherSelectedPairs] = useState<AssignmentPair[]>([]); // Deprecated, will be removed soon
  const [teacherSelectedClasses, setTeacherSelectedClasses] = useState<TeacherClassAssignment[]>([]);
  const [teacherManageTab, setTeacherManageTab] = useState<'class' | 'subject'>('class');
  const [teacherSubjectTargetClass, setTeacherSubjectTargetClass] = useState<string>('');

  const [parentModalUser, setParentModalUser] = useState<ParentAssignmentUser | null>(null);
  const [parentStudentSearch, setParentStudentSearch] = useState('');
  const [parentStudentClassLevel, setParentStudentClassLevel] = useState('');
  const [parentStudentResults, setParentStudentResults] = useState<StudentSearchResult[]>([]);
  const [parentSelectedStudentIds, setParentSelectedStudentIds] = useState<string[]>([]);
  const [loadingParentStudents, setLoadingParentStudents] = useState(false);
  const [viewMoreParent, setViewMoreParent] = useState<ParentAssignmentUser | null>(null);
  const [viewMoreSearch, setViewMoreSearch] = useState('');
  const [viewMoreClassFilter, setViewMoreClassFilter] = useState('');
  const [viewMorePage, setViewMorePage] = useState(1);
  const [standardSelectorTarget, setStandardSelectorTarget] = useState<
    'userFormClassLevel' | 'parentStudentClassLevel' | 'subjectFormClassLevel' | 'subjectFilterClassLevel' | 'studentFilterClassLevel' | 'viewMoreClassLevel' | 'viewMoreTeacherClassLevel' | 'teacherAssignClass' | null
  >(null);

  const showToast = (text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const [teacherAssignSearch, setTeacherAssignSearch] = useState('');
  const [pendingRemoveTeacherPair, setPendingRemoveTeacherPair] = useState<AssignmentPair | null>(null);
  const [pendingBulkSubjectAction, setPendingBulkSubjectAction] = useState<'add' | 'remove' | null>(null);
  const [pendingBulkClassAction, setPendingBulkClassAction] = useState<'add' | 'remove' | null>(null);
  const [pendingRemoveTeacherClass, setPendingRemoveTeacherClass] = useState<string | null>(null);
  
  const [viewMoreTeacher, setViewMoreTeacher] = useState<TeacherAssignmentUser | null>(null);
  const [viewMoreTeacherSearch, setViewMoreTeacherSearch] = useState('');
  const [viewMoreTeacherClassFilter, setViewMoreTeacherClassFilter] = useState('');
  const [viewMoreTeacherPage, setViewMoreTeacherPage] = useState(1);

  const isAdminView = user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const loadSubjects = useCallback(async () => {
    if (!isAdminView) return;
    const res = await apiFetch('/users/subjects?limit=500');
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load subjects');
    }
    const payload = await res.json();
    const fetchedSubjects = (payload.subjects || []) as SubjectRecord[];
    const mediaUrls = [
      ...new Set(
        fetchedSubjects
          .flatMap((subject) => [subject.coverImage || '', subject.iconImage || '', subject.authorUser?.profileImage || ''])
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
    if (mediaUrls.length === 0) {
      setSubjects(fetchedSubjects);
      return;
    }

    try {
      const resolveRes = await apiFetch('/assets/resolve/batch', {
        method: 'POST',
        body: JSON.stringify({ urls: mediaUrls }),
      });
      if (!resolveRes.ok) {
        setSubjects(fetchedSubjects);
        return;
      }
      const resolvedPayload = await resolveRes.json().catch(() => ({ items: [] }));
      const lookup = new Map<string, string>();
      ((resolvedPayload.items || []) as Array<{ sourceUrl?: string; canonicalUrl?: string; url?: string }>).forEach((item) => {
        if (item.sourceUrl && item.url) lookup.set(item.sourceUrl, item.url);
        if (item.canonicalUrl && item.url) lookup.set(item.canonicalUrl, item.url);
      });
      setSubjects(
        fetchedSubjects.map((subject) => ({
          ...subject,
          coverImage: subject.coverImage ? lookup.get(subject.coverImage) || subject.coverImage : subject.coverImage,
          iconImage: subject.iconImage ? lookup.get(subject.iconImage) || subject.iconImage : subject.iconImage,
          authorUser: subject.authorUser
            ? {
                ...subject.authorUser,
                profileImage: subject.authorUser.profileImage
                  ? lookup.get(subject.authorUser.profileImage) || subject.authorUser.profileImage
                  : subject.authorUser.profileImage,
              }
            : subject.authorUser,
        })),
      );
    } catch {
      setSubjects(fetchedSubjects);
    }
  }, [apiFetch, isAdminView]);

  const loadStudents = useCallback(async () => {
    if (!isAdminView) return;
    const query = new URLSearchParams();
    query.set('role', 'student');
    if (studentFilters.search.trim()) query.set('search', studentFilters.search.trim());
    if (studentFilters.classLevel) query.set('classLevel', studentFilters.classLevel);
    const res = await apiFetch(`/users?${query.toString()}`);
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load students');
    }
    const payload = await res.json();
    setStudents((payload.users || []) as ManagedUser[]);
  }, [apiFetch, isAdminView, studentFilters.classLevel, studentFilters.search]);

  const loadTeachers = useCallback(async () => {
    if (!isAdminView) return;
    const res = await apiFetch('/users/teachers/assignments');
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load teachers');
    }
    const payload = await res.json();
    setTeachers((payload.teachers || []) as TeacherAssignmentUser[]);
  }, [apiFetch, isAdminView]);

  const loadParents = useCallback(async () => {
    if (!isAdminView) return;
    const res = await apiFetch('/users/parents/assignments');
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load parents');
    }
    const payload = await res.json();
    setParents((payload.parents || []) as ParentAssignmentUser[]);
  }, [apiFetch, isAdminView]);

  const loadAdminCounts = useCallback(async () => {
    if (!isAdminView) return;
    try {
      const res = await apiFetch('/users/admin/counts');
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      const counts = (payload?.counts || {}) as Partial<typeof adminCounts>;
      setAdminCounts({
        subjects: Number(counts.subjects) || 0,
        students: Number(counts.students) || 0,
        teachers: Number(counts.teachers) || 0,
        parents: Number(counts.parents) || 0,
      });
    } catch {
      // ignore
    }
  }, [apiFetch, isAdminView]);

  const loadAssignmentCatalog = useCallback(async () => {
    if (!isAdminView) return;
    const res = await apiFetch('/users/subjects?limit=500');
    if (!res.ok) {
      setAssignmentCatalog([]);
      return;
    }
    const payload = await res.json().catch(() => ({ subjects: [] }));
    const rawPairs = ((payload.subjects || []) as SubjectRecord[])
      .map((item) => ({ classLevel: (item.classLevel || '').trim(), subject: (item.title || '').trim() }))
      .filter((pair) => pair.classLevel && pair.subject);
    const uniquePairs = Array.from(new Map(rawPairs.map((pair) => [pairKey(pair), pair])).values()).sort((a, b) =>
      `${a.classLevel}-${a.subject}`.localeCompare(`${b.classLevel}-${b.subject}`),
    );
    setAssignmentCatalog(uniquePairs);
  }, [apiFetch, isAdminView]);

  const loadActiveTab = useCallback(async () => {
    if (!isAdminView) return;
    setLoadingTable(true);
    setMessage(null);
    try {
      if (activeTab === 'subject') {
        await loadSubjects();
      } else if (activeTab === 'student') {
        await loadStudents();
      } else if (activeTab === 'teacher') {
        await Promise.all([loadTeachers(), loadAssignmentCatalog()]);
      } else {
        await Promise.all([loadParents(), loadStudents()]);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load admin data';
      setMessage({ type: 'error', text });
    } finally {
      setLoadingTable(false);
    }
  }, [activeTab, isAdminView, loadAssignmentCatalog, loadParents, loadStudents, loadSubjects, loadTeachers]);

  useEffect(() => {
    loadActiveTab();
  }, [loadActiveTab]);

  useEffect(() => {
    loadAdminCounts();
  }, [loadAdminCounts]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ADMIN_ACTIVE_TAB_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        if ((ADMIN_TAB_KEYS as string[]).includes(stored)) {
          setActiveTab(stored as AdminTab);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeTab).catch(() => undefined);
  }, [activeTab]);

  const [refreshingStudents, setRefreshingStudents] = useState(false);

  useEffect(() => {
    if (!isAdminView || activeTab !== 'student') return;
    const timeoutId = setTimeout(async () => {
      setRefreshingStudents(true);
      try {
        await loadStudents();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to load students';
        setMessage({ type: 'error', text });
      } finally {
        setRefreshingStudents(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [activeTab, isAdminView, loadStudents, studentFilters.classLevel, studentFilters.search]);

  const openCreateDialog = (roleFromTab?: ManagedRole) => {
    const role =
      roleFromTab || (activeTab === 'student' ? 'student' : activeTab === 'teacher' ? 'teacher' : activeTab === 'parent' ? 'parent' : 'student');
    setDialogMode('create');
    setEditingUserId(null);
    setUserForm({ ...EMPTY_USER_FORM, role });
    setMessage(null);
  };

  const openEditDialog = (managedUser: ManagedUser) => {
    const roleFallback: ManagedRole =
      managedUser.activeRole === 'student' || managedUser.activeRole === 'teacher' || managedUser.activeRole === 'parent' || managedUser.activeRole === 'admin'
        ? managedUser.activeRole
        : 'student';
    setDialogMode('edit');
    setEditingUserId(managedUser.id);
    setUserForm({
      firstName: managedUser.firstName,
      lastName: managedUser.lastName,
      email: managedUser.email,
      mobileNumber: managedUser.mobileNumber || '',
      classLevel: managedUser.classLevel || '',
      password: '',
      role: roleFallback,
    });
    setMessage(null);
  };

  const submitUserDialog = async () => {
    if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()) {
      setMessage({ type: 'error', text: 'First name, last name, and email are required.' });
      return;
    }

    setSavingUser(true);
    setMessage(null);
    try {
      if (dialogMode === 'create') {
        const res = await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            firstName: userForm.firstName.trim(),
            lastName: userForm.lastName.trim(),
            email: userForm.email.trim().toLowerCase(),
            mobileNumber: userForm.mobileNumber.trim() || undefined,
            classLevel: userForm.classLevel.trim() || undefined,
            password: userForm.password.trim() || undefined,
            role: userForm.role,
          }),
        });
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Failed to create user');
        }
      } else if (dialogMode === 'edit' && editingUserId) {
        const res = await apiFetch(`/users/${editingUserId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: userForm.firstName.trim(),
            lastName: userForm.lastName.trim(),
            email: userForm.email.trim().toLowerCase(),
            mobileNumber: userForm.mobileNumber.trim() || undefined,
            classLevel: userForm.classLevel.trim() || undefined,
            password: userForm.password.trim() || undefined,
            activeRole: userForm.role,
          }),
        });
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Failed to update user');
        }
      }

      setDialogMode(null);
      setEditingUserId(null);
      setUserForm(EMPTY_USER_FORM);
      showToast(dialogMode === 'create' ? 'User created successfully.' : 'User updated successfully.');
      await Promise.all([loadStudents(), loadTeachers(), loadParents(), loadAdminCounts()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : dialogMode === 'create' ? 'Failed to create user' : 'Failed to update user';
      setMessage({ type: 'error', text });
    } finally {
      setSavingUser(false);
    }
  };

  const searchAuthorUsers = async () => {
    const query = authorSearchEmail.trim();
    if (!query) {
      setAuthorSearchResults([]);
      return;
    }
    setLoadingAuthorSearch(true);
    try {
      const params = new URLSearchParams();
      params.set('search', query);
      params.set('limit', '30');
      const res = await apiFetch(`/users/authors/search?${params.toString()}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to search authors');
      }
      const payload = await res.json();
      setAuthorSearchResults((payload.authors || []) as AuthorSearchResult[]);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to search authors' });
    } finally {
      setLoadingAuthorSearch(false);
    }
  };

  const uploadCoverImage = async () => {
    try {
      setUploadingCoverImage(true);
      const picked = await pickImageAsDataUrl();
      const res = await apiFetch('/assets/upload', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl: picked.dataUrl,
          fileName: picked.fileName,
          mimeType: picked.mimeType,
          mediaType: 'image',
          context: 'subject_cover',
        }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to upload cover image');
      }
      const payload = await res.json();
      setSubjectForm((current) => ({ ...current, coverImage: String(payload.url || payload.canonicalUrl || '') }));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload cover image' });
    } finally {
      setUploadingCoverImage(false);
    }
  };

  const selectInternalAuthor = (author: AuthorSearchResult) => {
    setSubjectForm((current) => ({
      ...current,
      isExternalAuthor: false,
      authorUserId: author.id,
      authorUserDisplayName: `${author.firstName} ${author.lastName}`.trim(),
      authorUserMobileNumber: author.mobileNumber || '',
      authorUserProfileImage: author.profileImage || '',
      authorName: '',
    }));
    setAuthorSearchResults([]);
  };

  const openCreateSubjectDialog = () => {
    setSubjectDialogMode('create');
    setEditingSubjectId(null);
    setSubjectForm(EMPTY_SUBJECT_FORM);
    setAuthorSearchEmail('');
    setAuthorSearchResults([]);
    setMessage(null);
  };

  const openEditSubjectDialog = (subject: SubjectRecord) => {
    setSubjectDialogMode('edit');
    setEditingSubjectId(subject.id);
    setSubjectForm({
      coverImage: subject.coverImage || '',
      iconImage: subject.iconImage || '',
      iconBgColor: subject.iconBgColor || '#D6EAFF',
      title: subject.title,
      description: subject.description || '',
      isExternalAuthor: subject.isExternalAuthor ?? !subject.authorUserId,
      authorName: subject.isExternalAuthor ? subject.author || '' : '',
      authorUserId: subject.authorUserId || '',
      authorUserDisplayName: subject.authorUser ? `${subject.authorUser.firstName} ${subject.authorUser.lastName}`.trim() : '',
      authorUserMobileNumber: subject.authorUser?.mobileNumber || '',
      authorUserProfileImage: subject.authorUser?.profileImage || '',
      classLevel: subject.classLevel,
    });
    setAuthorSearchEmail('');
    setAuthorSearchResults([]);
    setMessage(null);
  };

  const submitSubjectDialog = async () => {
    if (!subjectForm.title.trim() || !subjectForm.classLevel.trim()) {
      setMessage({ type: 'error', text: 'Title and standard are required for subject.' });
      return;
    }

    setSavingSubject(true);
    setMessage(null);
    try {
      const payload = {
        coverImage: toPersistentMediaUrl(subjectForm.coverImage.trim()) || undefined,
        iconImage: toPersistentMediaUrl(subjectForm.iconImage.trim()) || undefined,
        iconBgColor: subjectForm.iconBgColor.trim() || undefined,
        title: subjectForm.title.trim(),
        description: subjectForm.description.trim() || undefined,
        isExternalAuthor: subjectForm.isExternalAuthor,
        authorName: subjectForm.isExternalAuthor ? subjectForm.authorName.trim() || undefined : undefined,
        authorUserId: subjectForm.isExternalAuthor ? undefined : subjectForm.authorUserId || null,
        classLevel: subjectForm.classLevel.trim(),
      };
      const endpoint = subjectDialogMode === 'create' ? '/users/subjects' : `/users/subjects/${editingSubjectId}`;
      const method = subjectDialogMode === 'create' ? 'POST' : 'PATCH';
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || (subjectDialogMode === 'create' ? 'Failed to create subject' : 'Failed to update subject'));
      }

      setSubjectDialogMode(null);
      setEditingSubjectId(null);
      setSubjectForm(EMPTY_SUBJECT_FORM);
      setAuthorSearchEmail('');
      setAuthorSearchResults([]);
      showToast(subjectDialogMode === 'create' ? 'Subject created successfully.' : 'Subject updated successfully.');
      await Promise.all([loadSubjects(), loadAssignmentCatalog(), loadAdminCounts()]);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : subjectDialogMode === 'create'
            ? 'Failed to create subject'
            : 'Failed to update subject';
      setMessage({ type: 'error', text });
    } finally {
      setSavingSubject(false);
    }
  };

  const requestDeleteSubject = (subject: SubjectRecord) => {
    setPendingDeleteSubject(subject);
  };

  const confirmDeleteSubject = async () => {
    if (!pendingDeleteSubject) return;
    setDeletingSubjectId(pendingDeleteSubject.id);
    setMessage(null);
    try {
      const res = await apiFetch(`/users/subjects/${pendingDeleteSubject.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to delete subject');
      }
      setMessage({ type: 'success', text: 'Subject deleted successfully.' });
      setPendingDeleteSubject(null);
      await Promise.all([loadSubjects(), loadAssignmentCatalog(), loadTeachers(), loadAdminCounts()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to delete subject';
      setMessage({ type: 'error', text });
    } finally {
      setDeletingSubjectId(null);
    }
  };

  const openTeacherAssignmentDialog = (teacher: TeacherAssignmentUser) => {
    setTeacherModalUser(teacher);
    if (teacher.classAssignments && teacher.classAssignments.length > 0) {
      setTeacherSelectedClasses(teacher.classAssignments);
      setTeacherSubjectTargetClass(teacher.classAssignments[0].classLevel);
    } else {
      const grouped = new Map<string, string[]>();
      (teacher.assignments || []).forEach(a => {
        if (!grouped.has(a.classLevel)) grouped.set(a.classLevel, []);
        grouped.get(a.classLevel)!.push(a.subject);
      });
      const parsed: TeacherClassAssignment[] = sortByStandard(
        Array.from(grouped.entries()).map(([classLevel, subjects]) => {
          const totalInCatalog = assignmentCatalog.filter(c => c.classLevel === classLevel).length;
          const allSubjects = subjects.length === totalInCatalog && totalInCatalog > 0;
          return { classLevel, allSubjects, assignedSubjects: subjects };
        })
      );
      setTeacherSelectedClasses(parsed);
      setTeacherSubjectTargetClass(parsed.length > 0 ? parsed[0].classLevel : '');
    }
    setTeacherManageTab('class');
  };

  const toggleTeacherClassAllSubjects = (classLevel: string, allSubjects: boolean) => {
    setTeacherSelectedClasses(current => current.map(c => 
      c.classLevel === classLevel ? { ...c, allSubjects, assignedSubjects: allSubjects ? [] : c.assignedSubjects } : c
    ));
  };

  const addTeacherClass = (classLevel: string) => {
    setTeacherSelectedClasses(current => {
      if (current.some(c => c.classLevel === classLevel)) return current;
      const updated = sortByStandard([...current, { classLevel, allSubjects: true, assignedSubjects: [] }]);
      if (current.length === 0) setTeacherSubjectTargetClass(classLevel);
      return updated;
    });
  };

  const removeTeacherClass = (classLevel: string) => {
    setTeacherSelectedClasses(current => {
      const updated = current.filter(c => c.classLevel !== classLevel);
      if (teacherSubjectTargetClass === classLevel) {
        setTeacherSubjectTargetClass(updated.length > 0 ? updated[0].classLevel : '');
      }
      return updated;
    });
  };

  const toggleTeacherSubject = (classLevel: string, subjectTitle: string) => {
    setTeacherSelectedClasses(current => current.map(c => {
      if (c.classLevel !== classLevel) return c;
      const hasSubject = c.assignedSubjects.includes(subjectTitle);
      if (hasSubject) {
        return { ...c, assignedSubjects: c.assignedSubjects.filter(s => s !== subjectTitle) };
      }
      return { ...c, assignedSubjects: [...c.assignedSubjects, subjectTitle] };
    }));
  };

  const assignAllSubjectsForClass = (classLevel: string) => {
    const allSubjectsForClass = assignmentCatalog
      .filter(a => a.classLevel === classLevel)
      .map(a => a.subject);
    setTeacherSelectedClasses(current => current.map(c =>
      c.classLevel === classLevel ? { ...c, assignedSubjects: allSubjectsForClass } : c
    ));
  };

  const removeAllSubjectsForClass = (classLevel: string) => {
    setTeacherSelectedClasses(current => current.map(c =>
      c.classLevel === classLevel ? { ...c, assignedSubjects: [] } : c
    ));
  };

  const assignAllClasses = () => {
    setTeacherSelectedClasses(current => {
      const alreadyAssigned = new Set(current.map(c => c.classLevel));
      const newClasses = STANDARD_OPTIONS
        .filter(s => !alreadyAssigned.has(s.value))
        .map(s => ({ classLevel: s.value, allSubjects: true, assignedSubjects: [] }));
      return sortByStandard([...current, ...newClasses]);
    });
  };

  const removeAllClasses = () => {
    setTeacherSelectedClasses([]);
    setTeacherSubjectTargetClass('');
  };

  const saveTeacherAssignments = async () => {
    if (!teacherModalUser) return;
    setSavingTeacherAssignments(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/users/teachers/${teacherModalUser.id}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ classAssignments: sortByStandard(teacherSelectedClasses) }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to assign standards and subjects');
      }
      setTeacherModalUser(null);
      showToast('Teacher assignments updated successfully.');
      await loadTeachers();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to assign standards and subjects';
      setMessage({ type: 'error', text });
    } finally {
      setSavingTeacherAssignments(false);
    }
  };

  const searchStudentsForParent = useCallback(
    async (query: string, classLevel: string) => {
      if (!isAdminView) return;
      setLoadingParentStudents(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('query', query.trim());
        if (classLevel.trim()) params.set('classLevel', classLevel.trim());
        params.set('limit', '200');
        const res = await apiFetch(`/users/students/search?${params.toString()}`);
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Failed to search students');
        }
        const payload = await res.json();
        setParentStudentResults((payload.students || []) as StudentSearchResult[]);
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to search students';
        setMessage({ type: 'error', text });
      } finally {
        setLoadingParentStudents(false);
      }
    },
    [apiFetch, isAdminView],
  );

  const openParentAssignmentDialog = async (parent: ParentAssignmentUser) => {
    setParentModalUser(parent);
    setParentSelectedStudentIds(parent.students.map((student) => student.id));
    setParentStudentSearch('');
    setParentStudentClassLevel('');
    await searchStudentsForParent('', '');
  };

  const toggleParentStudent = (studentId: string) => {
    setParentSelectedStudentIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId],
    );
  };

  const saveParentStudents = async () => {
    if (!parentModalUser) return;
    setSavingParentStudents(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/users/parents/${parentModalUser.id}/students`, {
        method: 'PUT',
        body: JSON.stringify({ studentIds: parentSelectedStudentIds }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to assign students to parent');
      }
      setParentModalUser(null);
      showToast('Parent student mapping updated successfully.');
      await loadParents();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to assign students to parent';
      setMessage({ type: 'error', text });
    } finally {
      setSavingParentStudents(false);
    }
  };

  const availableTeacherPairs = useMemo(() => {
    const selected = new Set(teacherSelectedPairs.map((pair) => pairKey(pair)));
    const base = [...assignmentCatalog];
    if (teacherModalUser) {
      (teacherModalUser.assignments || []).forEach((pair) => {
        if (!base.some((item) => pairKey(item) === pairKey(pair))) {
          base.push(pair);
        }
      });
    }
    return base.filter((pair) => !selected.has(pairKey(pair)));
  }, [assignmentCatalog, teacherModalUser, teacherSelectedPairs]);

  const filteredAvailableTeacherPairs = useMemo(() => {
    let list = availableTeacherPairs;
    if (teacherAssignSearch.trim()) {
      const q = teacherAssignSearch.toLowerCase().trim();
      list = list.filter(pair => 
        (pair.subject || '').toLowerCase().includes(q) ||
        getStandardLabel(pair.classLevel).toLowerCase().includes(q)
      );
    }
    return list;
  }, [availableTeacherPairs, teacherAssignSearch]);

  const filteredParentStudentResults = useMemo(() => {
    if (!parentStudentClassLevel) return parentStudentResults;
    return parentStudentResults.filter((student) => (student.classLevel || '') === parentStudentClassLevel);
  }, [parentStudentClassLevel, parentStudentResults]);

  useEffect(() => {
    setTabPage((current) => ({ ...current, [activeTab]: 1 }));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'student') return;
    setTabPage((current) => ({ ...current, student: 1 }));
  }, [activeTab, studentFilters.classLevel, studentFilters.search]);

  useEffect(() => {
    if (activeTab !== 'teacher') return;
    setTabPage((current) => ({ ...current, teacher: 1 }));
  }, [activeTab, teacherSearch]);

  useEffect(() => {
    if (activeTab !== 'parent') return;
    setTabPage((current) => ({ ...current, parent: 1 }));
  }, [activeTab, parentSearch]);

  useEffect(() => {
    if (activeTab !== 'subject') return;
    setTabPage((current) => ({ ...current, subject: 1 }));
  }, [activeTab, subjectClassFilter, subjectSearch]);

  const toPaginationMeta = useCallback(
    (tab: AdminTab, totalItems: number) => {
      const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
      const page = Math.max(1, Math.min(tabPage[tab] || 1, totalPages));
      const start = (page - 1) * TABLE_PAGE_SIZE;
      const end = start + TABLE_PAGE_SIZE;
      const from = totalItems === 0 ? 0 : start + 1;
      const to = totalItems === 0 ? 0 : Math.min(end, totalItems);
      return { page, totalPages, start, end, from, to, totalItems };
    },
    [tabPage],
  );

  const filteredSubjects = useMemo(() => {
    let result = subjects;
    if (subjectClassFilter) {
      result = result.filter((subject) => (subject.classLevel || '').trim() === subjectClassFilter.trim());
    }
    if (subjectSearch.trim()) {
      const q = subjectSearch.toLowerCase().trim();
      result = result.filter((subject) => (subject.title || '').toLowerCase().includes(q));
    }
    return result;
  }, [subjectClassFilter, subjectSearch, subjects]);

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.toLowerCase().trim();
    return teachers.filter((t) => 
      t.firstName?.toLowerCase().includes(q) ||
      t.lastName?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.mobileNumber?.toLowerCase().includes(q) ||
      t.id?.toLowerCase().includes(q)
    );
  }, [teacherSearch, teachers]);

  const filteredParents = useMemo(() => {
    if (!parentSearch.trim()) return parents;
    const q = parentSearch.toLowerCase().trim();
    return parents.filter((p) => 
      p.firstName?.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.mobileNumber?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  }, [parentSearch, parents]);

  const subjectPagination = useMemo(() => toPaginationMeta('subject', filteredSubjects.length), [filteredSubjects.length, toPaginationMeta]);
  const studentPagination = useMemo(() => toPaginationMeta('student', students.length), [students.length, toPaginationMeta]);
  const teacherPagination = useMemo(() => toPaginationMeta('teacher', filteredTeachers.length), [filteredTeachers.length, toPaginationMeta]);
  const parentPagination = useMemo(() => toPaginationMeta('parent', filteredParents.length), [filteredParents.length, toPaginationMeta]);

  const paginatedSubjects = useMemo(
    () => filteredSubjects.slice(subjectPagination.start, subjectPagination.end),
    [filteredSubjects, subjectPagination.end, subjectPagination.start],
  );
  const paginatedStudents = useMemo(
    () => students.slice(studentPagination.start, studentPagination.end),
    [students, studentPagination.end, studentPagination.start],
  );
  const paginatedTeachers = useMemo(
    () => filteredTeachers.slice(teacherPagination.start, teacherPagination.end),
    [filteredTeachers, teacherPagination.end, teacherPagination.start],
  );
  const paginatedParents = useMemo(
    () => filteredParents.slice(parentPagination.start, parentPagination.end),
    [filteredParents, parentPagination.end, parentPagination.start],
  );

  const filteredViewMoreStudents = useMemo(() => {
    if (!viewMoreParent) return [];
    let students = viewMoreParent.students || [];
    if (viewMoreClassFilter) {
      students = students.filter(s => (s.classLevel || '').trim() === viewMoreClassFilter.trim());
    }
    if (viewMoreSearch.trim()) {
      const q = viewMoreSearch.toLowerCase().trim();
      students = students.filter(s => 
        (s.firstName || '').toLowerCase().includes(q) ||
        (s.lastName || '').toLowerCase().includes(q)
      );
    }
    return students;
  }, [viewMoreParent, viewMoreClassFilter, viewMoreSearch]);

  const viewMorePagination = useMemo(() => {
    const totalItems = filteredViewMoreStudents.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
    const page = Math.max(1, Math.min(viewMorePage, totalPages));
    const start = (page - 1) * TABLE_PAGE_SIZE;
    const end = start + TABLE_PAGE_SIZE;
    const from = totalItems === 0 ? 0 : start + 1;
    const to = totalItems === 0 ? 0 : Math.min(end, totalItems);
    return { page, totalPages, start, end, from, to, totalItems };
  }, [filteredViewMoreStudents.length, viewMorePage]);

  const paginatedViewMoreStudents = useMemo(
    () => filteredViewMoreStudents.slice(viewMorePagination.start, viewMorePagination.end),
    [filteredViewMoreStudents, viewMorePagination.start, viewMorePagination.end]
  );

  const updateTabPage = (tab: AdminTab, nextPage: number) => {
    setTabPage((current) => ({ ...current, [tab]: Math.max(1, nextPage) }));
  };

  const activeTabMeta = useMemo(() => TAB_OPTIONS.find((item) => item.key === activeTab) || TAB_OPTIONS[0], [activeTab]);
  const dashboardStats = useMemo(
    () => [
      { key: 'subjects', label: 'Subjects', value: adminCounts.subjects, tint: Colors.accent, tintLight: Colors.accentLight },
      { key: 'students', label: 'Students', value: adminCounts.students, tint: Colors.primary, tintLight: Colors.primaryLight },
      { key: 'teachers', label: 'Teachers', value: adminCounts.teachers, tint: Colors.purple, tintLight: Colors.purpleLight },
      { key: 'parents', label: 'Parents', value: adminCounts.parents, tint: Colors.success, tintLight: Colors.successLight },
    ],
    [adminCounts.subjects, adminCounts.students, adminCounts.teachers, adminCounts.parents],
  );

  const viewMoreGroupedClasses = useMemo(() => {
    if (!viewMoreTeacher) return [];
    let grouped: { classLevel: string; allSubjects: boolean; assignedSubjects: string[] }[] = [];
    
    if (viewMoreTeacher.classAssignments && viewMoreTeacher.classAssignments.length > 0) {
      grouped = viewMoreTeacher.classAssignments.map(ca => ({
        classLevel: ca.classLevel,
        allSubjects: ca.allSubjects,
        assignedSubjects: [...ca.assignedSubjects]
      }));
    } else if (viewMoreTeacher.assignments) {
      const classMap = new Map<string, Set<string>>();
      viewMoreTeacher.assignments.forEach(a => {
        if (!a.classLevel) return;
        if (!classMap.has(a.classLevel)) classMap.set(a.classLevel, new Set());
        classMap.get(a.classLevel)!.add(a.subject || '');
      });
      grouped = Array.from(classMap.entries()).map(([classLevel, subjects]) => {
        const hasAll = subjects.has('All Subjects');
        return {
          classLevel,
          allSubjects: hasAll,
          assignedSubjects: hasAll ? [] : Array.from(subjects)
        };
      });
    }
    
    if (viewMoreTeacherClassFilter) {
      grouped = grouped.filter(g => (g.classLevel || '').trim() === viewMoreTeacherClassFilter.trim());
    }
    if (viewMoreTeacherSearch.trim()) {
      const q = viewMoreTeacherSearch.toLowerCase().trim();
      grouped = grouped.map(g => {
        if (g.allSubjects) return g;
        return {
          ...g,
          assignedSubjects: g.assignedSubjects.filter(s => s.toLowerCase().includes(q))
        };
      }).filter(g => g.allSubjects || g.assignedSubjects.length > 0);
    }
    return grouped;
  }, [viewMoreTeacher, viewMoreTeacherClassFilter, viewMoreTeacherSearch]);

  const applyStandardSelection = (value: string) => {
    if (standardSelectorTarget === 'userFormClassLevel') {
      setUserForm((current) => ({ ...current, classLevel: value }));
    }
    if (standardSelectorTarget === 'parentStudentClassLevel') {
      setParentStudentClassLevel(value);
    }
    if (standardSelectorTarget === 'subjectFormClassLevel') {
      setSubjectForm((current) => ({ ...current, classLevel: value }));
    }
    if (standardSelectorTarget === 'subjectFilterClassLevel') {
      setSubjectClassFilter(value);
    }
    if (standardSelectorTarget === 'studentFilterClassLevel') {
      setStudentFilters((current) => ({ ...current, classLevel: value }));
    }
    if (standardSelectorTarget === 'viewMoreClassLevel') {
      setViewMoreClassFilter(value);
      setViewMorePage(1);
    }
    if (standardSelectorTarget === 'viewMoreTeacherClassLevel') {
      setViewMoreTeacherClassFilter(value);
      setViewMoreTeacherPage(1);
    }
    if (standardSelectorTarget === 'teacherAssignClass') {
      addTeacherClass(value);
    }
    setStandardSelectorTarget(null);
  };

  const renderSubjectIconVisual = (input: { title: string; coverImage?: string; iconImage?: string; iconBgColor?: string }, imageSize = 28) => {
    const cover = input.coverImage?.trim();
    const iconImage = input.iconImage?.trim();
    const symbol = resolveIconSymbol(iconImage);
    const bgColor = input.iconBgColor || '#D6EAFF';

    if (cover) {
      return <Image source={{ uri: resolveMediaUrl(cover) }} style={[styles.subjectCoverThumb, { width: imageSize, height: imageSize }]} />;
    }

    if (symbol) {
      const entry = SUBJECT_ICON_LIBRARY_MAP[symbol];
      return (
        <View style={[styles.subjectIconBubble, { backgroundColor: bgColor }]}>
          <entry.Icon size={18} color={entry.color} />
        </View>
      );
    }

    if (iconImage) {
      return (
        <View style={[styles.subjectIconBubble, { backgroundColor: bgColor }]}>
          <Image source={{ uri: resolveMediaUrl(iconImage) }} style={[styles.subjectCoverThumb, { width: imageSize, height: imageSize }]} />
        </View>
      );
    }

    return (
      <View style={styles.subjectCoverPlaceholder}>
        <Text style={styles.subjectCoverPlaceholderText}>{getAvatarInitials(input.title)}</Text>
      </View>
    );
  };

  const renderPagination = (tab: AdminTab, label: string, pagination: { page: number; totalPages: number; from: number; to: number; totalItems: number }) => (
    <View style={styles.paginationRow}>
      <Text style={styles.paginationInfo}>
        {pagination.totalItems === 0 ? `No ${label.toLowerCase()} found.` : `Showing ${pagination.from}-${pagination.to} of ${pagination.totalItems} ${label.toLowerCase()}`}
      </Text>
      {pagination.totalItems > 0 ? (
        <View style={styles.paginationControls}>
          <Pressable
            style={[styles.paginationButton, pagination.page <= 1 && styles.paginationButtonDisabled]}
            disabled={pagination.page <= 1}
            onPress={() => updateTabPage(tab, pagination.page - 1)}
          >
            <ChevronLeft size={14} color={pagination.page <= 1 ? Colors.textMuted : Colors.primaryDark} />
            <Text style={[styles.paginationButtonText, pagination.page <= 1 && styles.paginationButtonTextDisabled]}>Prev</Text>
          </Pressable>
          <Text style={styles.paginationPageText}>Page {pagination.page} of {pagination.totalPages}</Text>
          <Pressable
            style={[styles.paginationButton, pagination.page >= pagination.totalPages && styles.paginationButtonDisabled]}
            disabled={pagination.page >= pagination.totalPages}
            onPress={() => updateTabPage(tab, pagination.page + 1)}
          >
            <Text style={[styles.paginationButtonText, pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled]}>Next</Text>
            <ChevronRight size={14} color={pagination.page >= pagination.totalPages ? Colors.textMuted : Colors.primaryDark} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (!isAdminView) {
    return (
      <ScreenTemplate title="Admin">
        <Text style={styles.errorText}>You do not have permission to access admin controls.</Text>
      </ScreenTemplate>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Floating Toast (Rendered outside ScrollView so it stays fixed relative to the screen) */}
      {toast && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastCard}>
            <CheckCircle2 size={18} color={Colors.success} />
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        </View>
      )}
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <View style={styles.heroBadge}>
            <Shield size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>Admin Console</Text>
          </View>
          <Text style={styles.heroTitle}>Welcome back,{'\n'}{user?.firstName || 'Admin'}</Text>
          <Text style={styles.heroSub}>{activeTabMeta.description}</Text>
        </View>
        <View style={styles.heroIconWrap}>
          <Sparkles size={36} color="#fff" />
        </View>
      </View>

      <View style={styles.metricRow}>
        {dashboardStats.map((item) => (
          <View key={item.key} style={[styles.metricCard, { backgroundColor: item.tintLight }]}>
            <Text style={[styles.metricValue, { color: item.tint }]}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {message && (
        <View style={[styles.message, message.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
            {message.text}
          </Text>
        </View>
      )}


      <View style={styles.tabGrid}>
        {visibleTabOptions.map((tab) => {
          const active = activeTab === tab.key;
          const TabIcon = tab.Icon;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tabTile,
                { backgroundColor: active ? (tab.activeFill ?? tab.tint) : Colors.surface, borderColor: active ? tab.tint : Colors.borderLight },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <View
                style={[
                  styles.tabTileIcon,
                  { backgroundColor: active ? 'rgba(255,255,255,0.22)' : tab.tintLight },
                ]}
              >
                <TabIcon size={20} color={active ? '#fff' : tab.tint} />
              </View>
              <Text style={[styles.tabTileText, { color: active ? '#fff' : Colors.textSecondary }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'subject' ? (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.accentLight }]}>
                <BookOpen size={18} color={Colors.accent} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Subjects</Text>
                <Text style={styles.cardCount}>{adminCounts.subjects} total</Text>
              </View>
            </View>
            <Pressable style={[styles.cta, { backgroundColor: Colors.accent }]} onPress={openCreateSubjectDialog}>
              <Plus size={14} color="#fff" />
              <Text style={styles.ctaText}>New Subject</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Keep subject title, class standard, and author details up to date for smooth content publishing.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable style={styles.filterChipBtn} onPress={() => setStandardSelectorTarget('subjectFilterClassLevel')}>
                <Text style={subjectClassFilter ? styles.filterChipActive : styles.filterChipPlaceholder}>
                  {subjectClassFilter ? getStandardLabel(subjectClassFilter) : 'Standard ▾'}
                </Text>
              </Pressable>
              {subjectClassFilter ? (
                <Pressable style={styles.filterChipBtn} onPress={() => setSubjectClassFilter('')}>
                  <Text style={[styles.filterChipActive, { color: '#DC2626' }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={[styles.searchBar, { flex: 1, width: 'auto' }]}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search subjects..."
                placeholderTextColor={Colors.textMuted}
                value={subjectSearch}
                onChangeText={setSubjectSearch}
                returnKeyType="search"
              />
              {subjectSearch ? (
                <Pressable onPress={() => setSubjectSearch('')} style={{ padding: 4 }}>
                  <X size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
          {loadingTable && subjects.length === 0 ? (
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
          ) : (
            <View style={{ position: 'relative' }}>
              {loadingTable ? (
                <View style={styles.refreshOverlay}>
                  <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
                </View>
              ) : null}
              <View style={styles.listContainer}>
                {paginatedSubjects.map((subject) => (
                  <View key={subject.id} style={styles.listCard}>
                    <View style={styles.listMainRow}>
                      <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden' }}>
                        {renderSubjectIconVisual(subject, 44)}
                      </View>
                      <View style={styles.listMeta}>
                        <Text style={styles.listTitle}>{subject.title}</Text>
                        <Text style={styles.listSub} numberOfLines={1}>
                          {getStandardLabel(subject.classLevel)} • {subject.author || 'Unknown Author'}
                        </Text>
                        {subject.description ? (
                          <Text style={[styles.listSub, { marginTop: 2 }]} numberOfLines={1}>
                            {subject.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.listActions}>
                      <Pressable style={styles.ghostBtn} onPress={() => openEditSubjectDialog(subject)}>
                        <Text style={styles.ghostBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={styles.dangerBtn}
                        onPress={() => requestDeleteSubject(subject)}
                        disabled={deletingSubjectId === subject.id}
                      >
                        {deletingSubjectId === subject.id ? (
                          <ActivityIndicator accessibilityLabel="Loading" size="small" color="#b91c1c" />
                        ) : (
                          <Text style={styles.dangerBtnText}>Delete</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          {renderPagination('subject', 'Subjects', subjectPagination)}
        </View>
      ) : null}

      {activeTab === 'student' ? (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                <GraduationCap size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Students</Text>
                <Text style={styles.cardCount}>{adminCounts.students} total</Text>
              </View>
            </View>
            <Pressable style={[styles.cta, { backgroundColor: Colors.primary }]} onPress={() => openCreateDialog('student')}>
              <Plus size={14} color="#fff" />
              <Text style={styles.ctaText}>New Student</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Use this table to update student profile details and verify standard assignments quickly.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable style={styles.filterChipBtn} onPress={() => setStandardSelectorTarget('studentFilterClassLevel')}>
                <Text style={studentFilters.classLevel ? styles.filterChipActive : styles.filterChipPlaceholder}>
                  {studentFilters.classLevel ? getStandardLabel(studentFilters.classLevel) : 'Standard ▾'}
                </Text>
              </Pressable>
              {studentFilters.classLevel ? (
                <Pressable style={styles.filterChipBtn} onPress={() => setStudentFilters(curr => ({...curr, classLevel: ''}))}>
                  <Text style={[styles.filterChipActive, { color: '#DC2626' }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={[styles.searchBar, { flex: 1, width: 'auto' }]}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search..."
                placeholderTextColor={Colors.textMuted}
                value={studentFilters.search}
                onChangeText={(text) => setStudentFilters(curr => ({...curr, search: text}))}
                returnKeyType="search"
              />
              {studentFilters.search ? (
                <Pressable onPress={() => setStudentFilters(curr => ({...curr, search: ''}))} style={{ padding: 4 }}>
                  <X size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
            {loadingTable && students.length === 0 ? (
              <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
            ) : (
              <View style={{ position: 'relative' }}>
                {refreshingStudents ? (
                  <View style={styles.refreshOverlay}>
                    <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
                  </View>
                ) : null}
              <View style={styles.listContainer}>
                {paginatedStudents.map((student) => (
                  <View key={student.id} style={styles.listCard}>
                    <View style={styles.listMainRow}>
                      <View style={styles.listAvatar}>
                        <Text style={styles.listAvatarText}>
                          {(student.firstName?.[0] || '').toUpperCase()}{(student.lastName?.[0] || '').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.listMeta}>
                        <Text style={styles.listTitle}>{student.firstName} {student.lastName}</Text>
                        <Text style={styles.listSub} numberOfLines={1}>
                          {student.email} {student.mobileNumber ? `• ${student.mobileNumber}` : ''}
                        </Text>
                        <Text style={styles.listRole}>{getStandardLabel(student.classLevel).toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.listActions}>
                      <Pressable style={styles.ghostBtn} onPress={() => openEditDialog(student)}>
                        <Text style={styles.ghostBtnText}>Edit</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
              </View>
            )}
            {renderPagination('student', 'Students', studentPagination)}
          </View>
      ) : null}

      {activeTab === 'teacher' ? (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.purpleLight }]}>
                <UserCheck size={18} color={Colors.purple} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Teachers</Text>
                <Text style={styles.cardCount}>{adminCounts.teachers} total</Text>
              </View>
            </View>
            <Pressable style={[styles.cta, { backgroundColor: Colors.purple }]} onPress={() => openCreateDialog('teacher')}>
              <Plus size={14} color="#fff" />
              <Text style={styles.ctaText}>New Teacher</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Manage teacher assignments by standard and subject to keep classroom ownership clear.</Text>
          <View style={[styles.searchBar, { marginBottom: 12 }]}>
            <Search size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search by name, email or mobile..."
              placeholderTextColor={Colors.textMuted}
              value={teacherSearch}
              onChangeText={setTeacherSearch}
              returnKeyType="search"
            />
            {teacherSearch ? (
              <Pressable onPress={() => setTeacherSearch('')} style={{ padding: 4 }}>
                <X size={16} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {loadingTable && teachers.length === 0 ? (
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
          ) : (
            <View style={{ position: 'relative' }}>
              {loadingTable ? (
                <View style={styles.refreshOverlay}>
                  <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
                </View>
              ) : null}
              <View style={styles.listContainer}>
                {paginatedTeachers.map((teacher) => (
                  <View key={teacher.id} style={styles.listCardCol}>
                    <View style={styles.listMainCol}>
                      <View style={[styles.listAvatar, { backgroundColor: Colors.purpleLight }]}>
                        <Text style={[styles.listAvatarText, { color: Colors.purple }]}>
                          {(teacher.firstName?.[0] || '').toUpperCase()}{(teacher.lastName?.[0] || '').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.listMeta}>
                        <Text style={styles.listTitle}>{teacher.firstName} {teacher.lastName}</Text>
                        <Text style={styles.listSub} numberOfLines={1}>{teacher.email}</Text>
                      </View>
                      <View style={styles.listActions}>
                        <Pressable style={styles.actionBtn} onPress={() => openTeacherAssignmentDialog(teacher)}>
                          <Text style={styles.actionBtnText}>Manage</Text>
                        </Pressable>
                        <Pressable style={styles.ghostBtn} onPress={() => openEditDialog({ id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, mobileNumber: teacher.mobileNumber, classLevel: '', activeRole: 'teacher', roles: ['teacher'] })}>
                          <Text style={styles.ghostBtnText}>Edit</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.listPillsWrap}>
                      {(() => {
                        let totalCount = 0;
                        let firstText = '';
                        if (teacher.classAssignments && teacher.classAssignments.length > 0) {
                           totalCount = teacher.classAssignments.reduce((acc, ca) => acc + (ca.allSubjects ? 1 : ca.assignedSubjects.length), 0);
                           if (totalCount > 0) {
                             const ca = teacher.classAssignments[0];
                             firstText = `${getStandardLabel(ca.classLevel)} • ${ca.allSubjects ? 'All Subjects' : (ca.assignedSubjects.length > 0 ? ca.assignedSubjects[0] : 'None')}`;
                           }
                        } else {
                           totalCount = (teacher.assignments || []).length;
                           if (totalCount > 0) {
                             const a = teacher.assignments[0];
                             firstText = `${getStandardLabel(a.classLevel)} • ${a.subject}`;
                           }
                        }

                        if (totalCount === 0) {
                          return <Text style={styles.metaText}>No assignments</Text>;
                        }
                        
                        return (
                          <>
                            <View style={styles.pill}>
                              <Text style={styles.pillText}>{firstText}</Text>
                            </View>
                            {totalCount > 1 && (
                              <Pressable style={styles.pillMore} onPress={() => { setViewMoreTeacher(teacher); setViewMoreTeacherSearch(''); setViewMoreTeacherClassFilter(''); setViewMoreTeacherPage(1); }}>
                                <Text style={styles.pillMoreText}>+{totalCount - 1} more</Text>
                              </Pressable>
                            )}
                          </>
                        );
                      })()}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          {renderPagination('teacher', 'Teachers', teacherPagination)}
        </View>
      ) : null}

      {activeTab === 'billing' ? (
        <BillingPanel
          mode="admin"
          organizations={user?.organizationId ? [{ id: user.organizationId, name: 'My Organization', subdomain: '' }] : []}
          currentOrganizationId={user?.organizationId}
          selectedOrgId={user?.organizationId || ''}
        />
      ) : null}

      {activeTab === 'question_dump' ? (
        <QuestionDumpTab apiFetch={apiFetch} subjectCatalog={assignmentCatalog} />
      ) : null}

      {activeTab === 'analytics' ? <SchoolAnalyticsTab apiFetch={apiFetch} /> : null}

      {activeTab === 'feature_flags' ? <FeatureFlagsTab apiFetch={apiFetch} /> : null}

      {activeTab === 'parent' ? (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.successLight }]}>
                <Users size={18} color={Colors.success} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Parents</Text>
                <Text style={styles.cardCount}>{adminCounts.parents} total</Text>
              </View>
            </View>
            <Pressable style={[styles.cta, { backgroundColor: Colors.success }]} onPress={() => openCreateDialog('parent')}>
              <Plus size={14} color="#fff" />
              <Text style={styles.ctaText}>New Parent</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Link parents with students so they can track attendance, progress, and assignments.</Text>
          <View style={[styles.searchBar, { marginBottom: 12 }]}>
            <Search size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search by name, email or mobile..."
              placeholderTextColor={Colors.textMuted}
              value={parentSearch}
              onChangeText={setParentSearch}
              returnKeyType="search"
            />
            {parentSearch ? (
              <Pressable onPress={() => setParentSearch('')} style={{ padding: 4 }}>
                <X size={16} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {loadingTable && parents.length === 0 ? (
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
          ) : (
            <View style={{ position: 'relative' }}>
              {loadingTable ? (
                <View style={styles.refreshOverlay}>
                  <ActivityIndicator accessibilityLabel="Loading" size="small" color={Colors.primary} />
                </View>
              ) : null}
              <View style={styles.listContainer}>
                {paginatedParents.map((parent) => (
                  <View key={parent.id} style={styles.listCardCol}>
                    <View style={styles.listMainCol}>
                      <View style={[styles.listAvatar, { backgroundColor: Colors.successLight }]}>
                        <Text style={[styles.listAvatarText, { color: Colors.success }]}>
                          {(parent.firstName?.[0] || '').toUpperCase()}{(parent.lastName?.[0] || '').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.listMeta}>
                        <Text style={styles.listTitle}>{parent.firstName} {parent.lastName}</Text>
                        <Text style={styles.listSub} numberOfLines={1}>{parent.email}</Text>
                      </View>
                      <View style={styles.listActions}>
                        <Pressable style={styles.actionBtn} onPress={() => openParentAssignmentDialog(parent)}>
                          <Text style={styles.actionBtnText}>Students</Text>
                        </Pressable>
                        <Pressable style={styles.ghostBtn} onPress={() => openEditDialog({ id: parent.id, firstName: parent.firstName, lastName: parent.lastName, email: parent.email, mobileNumber: parent.mobileNumber, classLevel: '', activeRole: 'parent', roles: ['parent'] })}>
                          <Text style={styles.ghostBtnText}>Edit</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.listPillsWrap}>
                      {parent.students.length === 0 ? (
                        <Text style={styles.metaText}>No students assigned</Text>
                      ) : (
                        <>
                          {parent.students.slice(0, 1).map((student) => (
                            <View key={student.id} style={styles.pill}>
                              <Text style={styles.pillText}>
                                {student.firstName} {student.lastName}
                                {student.classLevel ? ` (${getStandardLabel(student.classLevel)})` : ''}
                              </Text>
                            </View>
                          ))}
                          {parent.students.length > 1 && (
                            <Pressable style={styles.pillMore} onPress={() => { setViewMoreParent(parent); setViewMoreSearch(''); setViewMoreClassFilter(''); setViewMorePage(1); }}>
                              <Text style={styles.pillMoreText}>+{parent.students.length - 1} more</Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          {renderPagination('parent', 'Parents', parentPagination)}
        </View>
      ) : null}

      {viewMoreParent !== null && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewMoreParent(null)}>
        <View style={[styles.sheetContainer, { paddingTop: insets.top }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                <Users size={18} color={Colors.primary} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>Assigned Students</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{viewMoreParent?.firstName} {viewMoreParent?.lastName}</Text>
              </View>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setViewMoreParent(null)}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Pressable style={styles.filterChipBtn} onPress={() => setStandardSelectorTarget('viewMoreClassLevel')}>
                <Text style={viewMoreClassFilter ? styles.filterChipActive : styles.filterChipPlaceholder}>
                  {viewMoreClassFilter ? getStandardLabel(viewMoreClassFilter) : 'Standard ▾'}
                </Text>
              </Pressable>
              {viewMoreClassFilter ? (
                <Pressable style={styles.filterChipBtn} onPress={() => { setViewMoreClassFilter(''); setViewMorePage(1); }}>
                  <Text style={[styles.filterChipActive, { color: '#DC2626' }]}>Clear</Text>
                </Pressable>
              ) : null}
              <View style={[styles.searchBar, { flex: 1, width: 'auto', marginBottom: 0 }]}>
                <Search size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search students..."
                  placeholderTextColor={Colors.textMuted}
                  value={viewMoreSearch}
                  onChangeText={(text) => { setViewMoreSearch(text); setViewMorePage(1); }}
                  returnKeyType="search"
                />
                {viewMoreSearch ? (
                  <Pressable onPress={() => { setViewMoreSearch(''); setViewMorePage(1); }} style={{ padding: 4 }}>
                    <X size={16} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            <View style={styles.listContainer}>
              {paginatedViewMoreStudents.length === 0 ? (
                <Text style={styles.metaText}>No students found.</Text>
              ) : (
                paginatedViewMoreStudents.map((student) => (
                  <View key={student.id} style={styles.listCard}>
                    <View style={styles.listMainRow}>
                      <View style={styles.listAvatar}>
                        <Text style={styles.listAvatarText}>
                          {(student.firstName?.[0] || '').toUpperCase()}{(student.lastName?.[0] || '').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.listMeta}>
                        <Text style={styles.listTitle}>{student.firstName} {student.lastName}</Text>
                        <Text style={styles.listRole}>{getStandardLabel(student.classLevel).toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
          <View style={[styles.sheetFooter, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={styles.paginationRow}>
              <Text style={styles.paginationInfo}>
                {viewMorePagination.totalItems > 0
                  ? `Showing ${viewMorePagination.from}-${viewMorePagination.to} of ${viewMorePagination.totalItems}`
                  : 'No results'}
              </Text>
              <View style={styles.paginationControls}>
                <Pressable
                  style={[styles.paginationButton, viewMorePagination.page <= 1 && styles.paginationButtonDisabled]}
                  onPress={() => setViewMorePage(p => Math.max(1, p - 1))}
                  disabled={viewMorePagination.page <= 1}
                >
                  <ChevronLeft size={14} color={viewMorePagination.page <= 1 ? Colors.textMuted : Colors.primaryDark} />
                  <Text style={[styles.paginationButtonText, viewMorePagination.page <= 1 && styles.paginationButtonTextDisabled]}>Prev</Text>
                </Pressable>
                <Text style={styles.paginationPageText}>Page {viewMorePagination.page} of {viewMorePagination.totalPages}</Text>
                <Pressable
                  style={[styles.paginationButton, viewMorePagination.page >= viewMorePagination.totalPages && styles.paginationButtonDisabled]}
                  onPress={() => setViewMorePage(p => Math.min(viewMorePagination.totalPages, p + 1))}
                  disabled={viewMorePagination.page >= viewMorePagination.totalPages}
                >
                  <Text style={[styles.paginationButtonText, viewMorePagination.page >= viewMorePagination.totalPages && styles.paginationButtonTextDisabled]}>Next</Text>
                  <ChevronRight size={14} color={viewMorePagination.page >= viewMorePagination.totalPages ? Colors.textMuted : Colors.primaryDark} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
        </Modal>
      )}

      {dialogMode !== null && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDialogMode(null)}>
        <View style={[styles.sheetContainer, { paddingTop: insets.top }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                <Users size={18} color={Colors.primary} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{dialogMode === 'create' ? 'Create User' : 'Edit User'}</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{dialogMode === 'create' ? 'Add a new member to your organization' : 'Update profile details'}</Text>
              </View>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setDialogMode(null)}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.fieldLabel}>First Name *</Text>
                <TextInput
                  value={userForm.firstName}
                  onChangeText={(firstName) => setUserForm((current) => ({ ...current, firstName }))}
                  placeholder="First name"
                  style={styles.input}
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.fieldLabel}>Last Name *</Text>
                <TextInput
                  value={userForm.lastName}
                  onChangeText={(lastName) => setUserForm((current) => ({ ...current, lastName }))}
                  placeholder="Last name"
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Email *</Text>
            <TextInput
              value={userForm.email}
              onChangeText={(email) => setUserForm((current) => ({ ...current, email }))}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <TextInput
              value={userForm.mobileNumber}
              onChangeText={(mobileNumber) => setUserForm((current) => ({ ...current, mobileNumber }))}
              placeholder="Mobile number"
              keyboardType="phone-pad"
              style={styles.input}
            />
            {userForm.role === 'student' ? (
              <>
                <Text style={styles.fieldLabel}>Standard</Text>
                <Pressable style={styles.selectorInput} onPress={() => setStandardSelectorTarget('userFormClassLevel')}>
                  <Text style={userForm.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                    {userForm.classLevel ? getStandardLabel(userForm.classLevel) : 'Select standard'}
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              value={userForm.password}
              onChangeText={(password) => setUserForm((current) => ({ ...current, password }))}
              placeholder={dialogMode === 'create' ? 'Password (optional)' : 'New password (optional)'}
              secureTextEntry
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Role *</Text>
            <View style={styles.roleRow}>
              {(['student', 'teacher', 'parent', 'admin'] as const).map((r) => {
                const isActive = userForm.role === r;
                return (
                  <Pressable
                    key={r}
                    style={[styles.roleChip, isActive && styles.roleChipActive]}
                    onPress={() => setUserForm((current) => ({ ...current, role: r }))}
                  >
                    <Text style={[styles.roleChipText, isActive && styles.roleChipTextActive]}>
                      {r === 'student' ? 'Student' : r === 'teacher' ? 'Teacher' : r === 'parent' ? 'Parent' : 'Admin'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setDialogMode(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.half]} onPress={submitUserDialog} disabled={savingUser}>
              {savingUser ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" /> : <Text style={styles.primaryButtonText}>Save User</Text>}
            </Pressable>
          </View>
        </View>
        </Modal>
      )}

      {subjectDialogMode !== null && (
        <Modal
        visible
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setSubjectDialogMode(null);
          setAuthorSearchResults([]);
        }}
      >
        <View style={[styles.sheetContainer, { paddingTop: insets.top }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.accentLight }]}>
                <BookOpen size={18} color={Colors.accent} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{subjectDialogMode === 'create' ? 'Create Subject' : 'Edit Subject'}</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>Curriculum metadata, cover, and author</Text>
              </View>
            </View>
            <Pressable
              style={styles.sheetCloseButton}
              onPress={() => {
                setSubjectDialogMode(null);
                setAuthorSearchResults([]);
              }}
            >
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cover Image</Text>
              <View style={styles.mediaActionRow}>
                <Pressable style={[styles.secondaryButton, styles.mediaActionButton]} onPress={uploadCoverImage} disabled={uploadingCoverImage}>
                  {uploadingCoverImage ? <ActivityIndicator accessibilityLabel="Loading" color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Upload Image</Text>}
                </Pressable>
              </View>
              {subjectForm.coverImage.trim() ? (
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewHeaderContent}>
                      <Text style={styles.mediaInfoLabel}>Selected Image</Text>
                      <Text style={styles.mediaInfoValue}>{toMediaLabel(subjectForm.coverImage, 'image')}</Text>
                    </View>
                    <Pressable
                      style={styles.previewRemoveButton}
                      onPress={() => setSubjectForm((current) => ({ ...current, coverImage: '' }))}
                    >
                      <Text style={styles.previewRemoveButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                  <Image source={{ uri: resolveMediaUrl(subjectForm.coverImage.trim()) }} style={styles.optionImagePreview} resizeMode="contain" />
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Subject Icon</Text>
              <View style={styles.mediaActionRow}>
                <Pressable style={[styles.secondaryButton, styles.mediaActionButton]} onPress={() => setSubjectLogoLibraryOpen(true)}>
                  <Text style={styles.secondaryButtonText}>Choose Logo</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.mediaActionButton]}
                  onPress={() => setSubjectForm((current) => ({ ...current, iconImage: '', iconBgColor: '#D6EAFF' }))}
                >
                  <Text style={styles.secondaryButtonText}>Clear Icon</Text>
                </Pressable>
              </View>
              {subjectForm.iconImage.trim() ? (
                <View style={styles.subjectIconPreviewRow}>
                  <View style={[styles.subjectIconPreviewBubble, { backgroundColor: subjectForm.iconBgColor || '#D6EAFF' }]}>
                    {resolveIconSymbol(subjectForm.iconImage.trim()) ? (
                      (() => {
                        const symbol = resolveIconSymbol(subjectForm.iconImage.trim())!;
                        const entry = SUBJECT_ICON_LIBRARY_MAP[symbol];
                        return <entry.Icon size={18} color={entry.color} />;
                      })()
                    ) : (
                      <Image source={{ uri: resolveMediaUrl(subjectForm.iconImage.trim()) }} style={styles.subjectIconPreviewImage} resizeMode="contain" />
                    )}
                  </View>
                  <Text style={styles.mediaInfoValue}>{toMediaLabel(subjectForm.iconImage, 'image')}</Text>
                </View>
              ) : (
                <Text style={styles.metaText}>No icon selected</Text>
              )}
              <Text style={styles.fieldLabel}>Icon Background</Text>
              <View style={styles.iconColorRow}>
                {SUBJECT_ICON_BG_OPTIONS.map((color) => {
                  const active = (subjectForm.iconBgColor || '#D6EAFF') === color;
                  return (
                    <Pressable
                      key={color}
                      style={[styles.iconColorChip, { backgroundColor: color }, active && styles.iconColorChipActive]}
                      onPress={() => setSubjectForm((current) => ({ ...current, iconBgColor: color }))}
                    />
                  );
                })}
              </View>
            </View>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              value={subjectForm.title}
              onChangeText={(title) => setSubjectForm((current) => ({ ...current, title }))}
              placeholder="Title"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={subjectForm.description}
              onChangeText={(description) => setSubjectForm((current) => ({ ...current, description }))}
              placeholder="Description"
              multiline
              style={[styles.input, styles.textAreaInput]}
            />
            <Text style={styles.fieldLabel}>Author</Text>
            <Pressable
              style={styles.externalToggleRow}
              onPress={() => {
                setAuthorSearchResults([]);
                setSubjectForm((current) => {
                  const nextIsExternal = !current.isExternalAuthor;
                  return {
                    ...current,
                    isExternalAuthor: nextIsExternal,
                    authorName: nextIsExternal ? current.authorName : '',
                    authorUserId: nextIsExternal ? '' : current.authorUserId,
                    authorUserDisplayName: nextIsExternal ? '' : current.authorUserDisplayName,
                    authorUserMobileNumber: nextIsExternal ? '' : current.authorUserMobileNumber,
                    authorUserProfileImage: nextIsExternal ? '' : current.authorUserProfileImage,
                  };
                });
              }}
            >
              <View style={[styles.checkbox, subjectForm.isExternalAuthor && styles.checkboxSelected]}>
                {subjectForm.isExternalAuthor ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.metaText}>Is External Author</Text>
            </Pressable>

            {subjectForm.isExternalAuthor ? (
              <TextInput
                value={subjectForm.authorName}
                onChangeText={(authorName) => setSubjectForm((current) => ({ ...current, authorName }))}
                placeholder="Enter external author name"
                style={styles.input}
              />
            ) : (
              <View style={styles.authorSearchSection}>
                <View style={styles.searchInline}>
                  <View style={styles.searchInputWrap}>
                    <Search size={14} color={Colors.textMuted} />
                    <TextInput
                      value={authorSearchEmail}
                      onChangeText={setAuthorSearchEmail}
                      placeholder="Search by email"
                      style={styles.searchInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onSubmitEditing={searchAuthorUsers}
                      returnKeyType="search"
                    />
                  </View>
                  <Pressable style={styles.searchInlineButton} onPress={searchAuthorUsers}>
                    {loadingAuthorSearch ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" size="small" /> : <Text style={styles.searchInlineButtonText}>Search</Text>}
                  </Pressable>
                </View>

                {subjectForm.authorUserId ? (
                  <View style={styles.selectedAuthorCard}>
                    {subjectForm.authorUserProfileImage ? (
                      <Image source={{ uri: resolveMediaUrl(subjectForm.authorUserProfileImage) }} style={styles.authorAvatar} />
                    ) : (
                      <View style={styles.authorAvatarPlaceholder}>
                        <Text style={styles.authorAvatarPlaceholderText}>{getAvatarInitials(subjectForm.authorUserDisplayName || 'AU')}</Text>
                      </View>
                    )}
                    <View style={styles.authorMeta}>
                      <Text style={styles.authorNameText}>{subjectForm.authorUserDisplayName || 'Selected author'}</Text>
                      <Text style={styles.authorSubText}>{subjectForm.authorUserMobileNumber || '-'}</Text>
                    </View>
                    <Pressable
                      style={[styles.actionButton, styles.deleteActionButton]}
                      onPress={() =>
                        setSubjectForm((current) => ({
                          ...current,
                          authorUserId: '',
                          authorUserDisplayName: '',
                          authorUserMobileNumber: '',
                          authorUserProfileImage: '',
                        }))
                      }
                    >
                      <Text style={styles.deleteActionButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                ) : null}

                {authorSearchResults.length > 0 ? (
                  <ScrollView style={styles.searchResultList}>
                    {authorSearchResults.map((author) => (
                      <Pressable key={author.id} style={styles.searchResultRow} onPress={() => selectInternalAuthor(author)}>
                        {author.profileImage ? (
                          <Image source={{ uri: resolveMediaUrl(author.profileImage) }} style={styles.authorAvatar} />
                        ) : (
                          <View style={styles.authorAvatarPlaceholder}>
                            <Text style={styles.authorAvatarPlaceholderText}>
                              {getAvatarInitials(`${author.firstName} ${author.lastName}`)}
                            </Text>
                          </View>
                        )}
                        <View style={styles.authorMeta}>
                          <Text style={styles.authorNameText}>{author.firstName} {author.lastName}</Text>
                          <Text style={styles.authorSubText}>{author.mobileNumber || '-'}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            )}
            <Text style={styles.fieldLabel}>Standard *</Text>
            <Pressable style={styles.selectorInput} onPress={() => setStandardSelectorTarget('subjectFormClassLevel')}>
              <Text style={subjectForm.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                {subjectForm.classLevel ? getStandardLabel(subjectForm.classLevel) : 'Select standard'}
              </Text>
            </Pressable>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable
              style={[styles.secondaryButton, styles.half]}
              onPress={() => {
                setSubjectDialogMode(null);
                setAuthorSearchResults([]);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.half]} onPress={submitSubjectDialog} disabled={savingSubject}>
              {savingSubject ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" /> : <Text style={styles.primaryButtonText}>Save Subject</Text>}
            </Pressable>
          </View>
        </View>
        </Modal>
      )}

      {subjectLogoLibraryOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSubjectLogoLibraryOpen(false)}>
        <View style={styles.logoPickerOverlay}>
          <View style={[styles.logoPickerSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.logoPickerHeader}>
              <Text style={styles.sheetTitle}>Pick Subject Logo</Text>
              <Pressable style={styles.sheetCloseButton} onPress={() => setSubjectLogoLibraryOpen(false)}>
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.logoGrid}>
              {SUBJECT_ICON_LIBRARY.map((asset) => {
                const selected = subjectForm.iconImage.trim() === `symbol:${asset.key}`;
                return (
                  <Pressable
                    key={asset.key}
                    style={[styles.logoItem, selected && styles.logoItemActive]}
                    onPress={() => {
                      setSubjectForm((current) => ({ ...current, iconImage: `symbol:${asset.key}` }));
                      setSubjectLogoLibraryOpen(false);
                    }}
                  >
                    <asset.Icon size={24} color={asset.color} />
                    <Text style={styles.logoLabel} numberOfLines={1}>{asset.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
        </Modal>
      )}

      {pendingDeleteSubject !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPendingDeleteSubject(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <Text style={styles.cardTitle}>Delete Subject?</Text>
            <Text style={styles.metaText}>
              Are you sure you want to delete "{pendingDeleteSubject?.title}" from {getStandardLabel(pendingDeleteSubject?.classLevel)}?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={[styles.secondaryButton, styles.confirmActionButton]} onPress={() => setPendingDeleteSubject(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmDeleteButton, styles.confirmActionButton]} onPress={confirmDeleteSubject}>
                {deletingSubjectId ? (
                  <ActivityIndicator accessibilityLabel="Loading" size="small" color="#b91c1c" />
                ) : (
                  <Text style={styles.deleteActionButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
        </Modal>
      )}

      {viewMoreTeacher !== null && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewMoreTeacher(null)}>
        <View style={[styles.sheetContainer, { paddingTop: insets.top }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                <BookOpen size={18} color={Colors.primary} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>Assigned Classes & Subjects</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{viewMoreTeacher?.firstName} {viewMoreTeacher?.lastName}</Text>
              </View>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setViewMoreTeacher(null)}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Pressable style={styles.filterChipBtn} onPress={() => setStandardSelectorTarget('viewMoreTeacherClassLevel')}>
                <Text style={viewMoreTeacherClassFilter ? styles.filterChipActive : styles.filterChipPlaceholder}>
                  {viewMoreTeacherClassFilter ? getStandardLabel(viewMoreTeacherClassFilter) : 'Standard ▾'}
                </Text>
              </Pressable>
              {viewMoreTeacherClassFilter ? (
                <Pressable style={styles.filterChipBtn} onPress={() => { setViewMoreTeacherClassFilter(''); setViewMoreTeacherPage(1); }}>
                  <Text style={[styles.filterChipActive, { color: '#DC2626' }]}>Clear</Text>
                </Pressable>
              ) : null}
              <View style={[styles.searchBar, { flex: 1, width: 'auto', marginBottom: 0 }]}>
                <Search size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search subjects..."
                  placeholderTextColor={Colors.textMuted}
                  value={viewMoreTeacherSearch}
                  onChangeText={(text) => { setViewMoreTeacherSearch(text); setViewMoreTeacherPage(1); }}
                  returnKeyType="search"
                />
                {viewMoreTeacherSearch ? (
                  <Pressable onPress={() => { setViewMoreTeacherSearch(''); setViewMoreTeacherPage(1); }} style={{ padding: 4 }}>
                    <X size={16} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            <View style={{ paddingBottom: 24 }}>
              {viewMoreGroupedClasses.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <BookOpen size={32} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyStateTitle}>No Assignments</Text>
                  <Text style={styles.emptyStateSub}>This teacher has no assigned classes or subjects matching your filters.</Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {viewMoreGroupedClasses.map(c => {
                    const hasMore = !c.allSubjects && c.assignedSubjects.length > 2;
                    const displaySubjects = hasMore ? c.assignedSubjects.slice(0, 2) : c.assignedSubjects;
                    const remaining = hasMore ? c.assignedSubjects.length - 2 : 0;
                    return (
                      <View key={c.classLevel} style={styles.premiumCard}>
                        <View style={styles.premiumCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                              <GraduationCap size={20} color={Colors.primary} />
                            </View>
                            <View>
                              <Text style={styles.premiumCardTitle}>{getStandardLabel(c.classLevel)}</Text>
                              <Text style={styles.premiumCardSub}>
                                {c.allSubjects ? 'Full Access: All Subjects' : (c.assignedSubjects.length === 0 ? 'No Subjects Assigned' : `${c.assignedSubjects.length} Specific Subject(s)`)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {!c.allSubjects && (
                          <View style={styles.premiumCardBody}>
                            {c.assignedSubjects.length > 0 ? (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {displaySubjects.map(sub => (
                                  <View key={sub} style={[styles.subjectChip, { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight }]}>
                                    <Text style={[styles.subjectChipText, { color: Colors.primaryDark }]}>{sub}</Text>
                                  </View>
                                ))}
                                {hasMore && (
                                  <View style={[styles.subjectChip, { backgroundColor: Colors.surfaceAlt, borderColor: Colors.borderLight }]}>
                                    <Text style={[styles.subjectChipText, { color: Colors.textSecondary }]}>+{remaining} more</Text>
                                  </View>
                                )}
                              </View>
                            ) : (
                              <Text style={[styles.metaText, { marginTop: 0 }]}>No subjects currently assigned for this class.</Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
        </Modal>
      )}


      {teacherModalUser !== null && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTeacherModalUser(null)}>
        <View style={[styles.sheetContainer, { paddingTop: insets.top }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.purpleLight }]}>
                <UserCheck size={18} color={Colors.purple} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>Assign Classes & Subjects</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{teacherModalUser?.firstName} {teacherModalUser?.lastName}</Text>
              </View>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setTeacherModalUser(null)}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4, marginHorizontal: 16, marginTop: 16 }}>
            <Pressable 
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: teacherManageTab === 'class' ? '#ffffff' : 'transparent', shadowColor: teacherManageTab === 'class' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: teacherManageTab === 'class' ? 2 : 0 }} 
              onPress={() => setTeacherManageTab('class')}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: teacherManageTab === 'class' ? Colors.primary : Colors.textSecondary }}>Assign Classes</Text>
            </Pressable>
            <Pressable 
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: teacherManageTab === 'subject' ? '#ffffff' : 'transparent', shadowColor: teacherManageTab === 'subject' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: teacherManageTab === 'subject' ? 2 : 0 }} 
              onPress={() => setTeacherManageTab('subject')}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: teacherManageTab === 'subject' ? Colors.primary : Colors.textSecondary }}>Assign Subjects</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            {teacherManageTab === 'class' ? (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.fieldLabel}>Assigned Standards</Text>
                    <Text style={styles.metaText}>Add classes that this teacher is responsible for.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable style={[styles.addButtonSmall, { backgroundColor: Colors.error }]} onPress={() => setPendingBulkClassAction('remove')}>
                      <Trash2 size={14} color="#fff" />
                      <Text style={styles.addButtonSmallText}>Remove All</Text>
                    </Pressable>
                    <Pressable style={styles.addButtonSmall} onPress={() => setPendingBulkClassAction('add')}>
                      <Plus size={16} color="#fff" />
                      <Text style={styles.addButtonSmallText}>All Standards</Text>
                    </Pressable>
                    <Pressable style={styles.addButtonSmall} onPress={() => setStandardSelectorTarget('teacherAssignClass')}>
                      <Plus size={16} color="#fff" />
                      <Text style={styles.addButtonSmallText}>Add</Text>
                    </Pressable>
                  </View>
                </View>

                {teacherSelectedClasses.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <GraduationCap size={32} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyStateTitle}>No Classes Assigned</Text>
                    <Text style={styles.emptyStateSub}>Assign a standard to get started.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 12, marginTop: 12 }}>
                    {teacherSelectedClasses.map(c => (
                      <View key={c.classLevel} style={styles.premiumCard}>
                        <View style={styles.premiumCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                              <GraduationCap size={20} color={Colors.primary} />
                            </View>
                            <View>
                              <Text style={styles.premiumCardTitle}>{getStandardLabel(c.classLevel)}</Text>
                              <Text style={styles.premiumCardSub}>
                                {c.allSubjects ? 'Full Access: All Subjects' : `${c.assignedSubjects.length} Specific Subject(s)`}
                              </Text>
                            </View>
                          </View>
                          <Pressable style={styles.iconButton} onPress={() => setPendingRemoveTeacherClass(c.classLevel)}>
                            <Trash2 size={18} color={Colors.error} />
                          </Pressable>
                        </View>
                        
                        <View style={styles.premiumCardBody}>
                          <Pressable 
                            style={[styles.toggleRow, !c.allSubjects && styles.toggleRowActive]} 
                            onPress={() => toggleTeacherClassAllSubjects(c.classLevel, !c.allSubjects)}
                          >
                            <View style={[styles.checkboxContainer, !c.allSubjects && styles.checkboxContainerActive]}>
                              {!c.allSubjects && <Check size={14} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.toggleTitle, !c.allSubjects && { color: Colors.primaryDark }]}>Restrict Subject Access</Text>
                              <Text style={styles.toggleSub}>Only allow assignment of explicitly selected subjects</Text>
                            </View>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View>
                {/* Class filter dropdown */}
                {teacherSelectedClasses.filter(c => !c.allSubjects).length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <ShieldCheck size={32} color={Colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyStateTitle}>No Restricted Classes</Text>
                    <Text style={styles.emptyStateSub}>Go to "Assign Classes" and enable "Restrict Subject Access" on a class first.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 20 }}>
                    <View>
                      <Text style={styles.fieldLabel}>Filter by Class</Text>
                      <View style={styles.classDropdownWrap}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 4 }}>
                          {teacherSelectedClasses.filter(c => !c.allSubjects).map(c => (
                            <Pressable
                              key={c.classLevel}
                              style={[styles.pillSelector, teacherSubjectTargetClass === c.classLevel && styles.pillSelectorActive]}
                              onPress={() => setTeacherSubjectTargetClass(c.classLevel)}
                            >
                              <Text style={[styles.pillSelectorText, teacherSubjectTargetClass === c.classLevel && styles.pillSelectorTextActive]}>
                                {getStandardLabel(c.classLevel)}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </View>

                    {teacherSubjectTargetClass ? (
                      <View style={{ gap: 20 }}>
                        <View>
                          <Text style={styles.fieldLabel}>Add Subjects to {getStandardLabel(teacherSubjectTargetClass)}</Text>
                          <View style={[styles.searchBar, { marginBottom: 10, marginTop: 8 }]}>
                            <Search size={18} color={Colors.textMuted} />
                            <TextInput
                              style={styles.searchBarInput}
                              placeholder="Search available subjects..."
                              placeholderTextColor={Colors.textMuted}
                              value={teacherAssignSearch}
                              onChangeText={setTeacherAssignSearch}
                              returnKeyType="search"
                            />
                            {teacherAssignSearch ? (
                              <Pressable onPress={() => setTeacherAssignSearch('')} style={{ padding: 4 }}>
                                <X size={16} color={Colors.textMuted} />
                              </Pressable>
                            ) : null}
                          </View>

                          {(() => {
                            const currentClass = teacherSelectedClasses.find(c => c.classLevel === teacherSubjectTargetClass);
                            const assigned = new Set(currentClass?.assignedSubjects || []);
                            let avail = assignmentCatalog.filter(a => a.classLevel === teacherSubjectTargetClass && !assigned.has(a.subject));
                            if (teacherAssignSearch.trim()) {
                              const q = teacherAssignSearch.toLowerCase().trim();
                              avail = avail.filter(a => (a.subject || '').toLowerCase().includes(q));
                            }
                            if (avail.length === 0) {
                              return (
                                <View style={[styles.emptyStateCard, { paddingVertical: 20 }]}>
                                  <Text style={styles.emptyStateSub}>{teacherAssignSearch ? 'No subjects match your search.' : 'All subjects already assigned.'}</Text>
                                </View>
                              );
                            }
                            return (
                              <View>
                                <Pressable
                                  style={styles.bulkActionRow}
                                  onPress={() => setPendingBulkSubjectAction('add')}
                                >
                                  <View style={styles.bulkActionLeft}>
                                    <View style={styles.bulkCheckbox}>
                                      <Plus size={12} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.bulkActionText}>Add All ({avail.length}) Subjects</Text>
                                  </View>
                                </Pressable>
                                <View style={styles.transferListContainer}>
                                  <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} contentContainerStyle={{ padding: 8, gap: 6 }}>
                                    {avail.map(pair => (
                                      <View key={`avail-${pairKey(pair)}`} style={styles.transferCard}>
                                        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                          <View style={[styles.transferIconWrap, { backgroundColor: '#f1f5f9' }]}>
                                            <BookOpen size={16} color={Colors.textSecondary} />
                                          </View>
                                          <Text style={styles.transferCardText} numberOfLines={1} ellipsizeMode="tail">{pair.subject}</Text>
                                        </View>
                                        <Pressable style={styles.transferAddBtn} onPress={() => { toggleTeacherSubject(teacherSubjectTargetClass, pair.subject); setTeacherAssignSearch(''); }}>
                                          <Plus size={14} color="#fff" />
                                          <Text style={styles.transferAddBtnText}>Add</Text>
                                        </Pressable>
                                      </View>
                                    ))}
                                  </ScrollView>
                                </View>
                              </View>
                            );
                          })()}
                        </View>

                        <View>
                          <Text style={styles.fieldLabel}>Assigned Subjects — {getStandardLabel(teacherSubjectTargetClass)}</Text>
                          {(() => {
                            const currentClass = teacherSelectedClasses.find(c => c.classLevel === teacherSubjectTargetClass);
                            if (!currentClass || currentClass.assignedSubjects.length === 0) {
                              return (
                                <View style={[styles.emptyStateCard, { marginTop: 8, paddingVertical: 20 }]}>
                                  <Text style={styles.emptyStateSub}>No subjects assigned yet. Add some above.</Text>
                                </View>
                              );
                            }
                            return (
                              <View style={{ marginTop: 8 }}>
                                <Pressable
                                  style={[styles.bulkActionRow, styles.bulkActionRowDanger]}
                                  onPress={() => setPendingBulkSubjectAction('remove')}
                                >
                                  <View style={styles.bulkActionLeft}>
                                    <View style={[styles.bulkCheckbox, styles.bulkCheckboxDanger]}>
                                      <Trash2 size={12} color={Colors.error} />
                                    </View>
                                    <Text style={styles.bulkActionTextDanger}>Remove All ({currentClass.assignedSubjects.length}) Subjects</Text>
                                  </View>
                                </Pressable>
                                <View style={styles.transferListContainer}>
                                  <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }} contentContainerStyle={{ padding: 8, gap: 6 }}>
                                    {currentClass.assignedSubjects.map(subject => (
                                      <View key={subject} style={styles.transferCardSelected}>
                                        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                          <View style={[styles.transferIconWrap, { backgroundColor: Colors.primaryLight }]}>
                                            <CheckCircle2 size={16} color={Colors.primary} />
                                          </View>
                                          <Text style={styles.transferCardTextSelected} numberOfLines={1} ellipsizeMode="tail">{subject}</Text>
                                        </View>
                                        <Pressable style={styles.transferRemoveBtn} onPress={() => setPendingRemoveTeacherPair({ classLevel: teacherSubjectTargetClass, subject })}>
                                          <Trash2 size={16} color={Colors.error} />
                                        </Pressable>
                                      </View>
                                    ))}
                                  </ScrollView>
                                </View>
                              </View>
                            );
                          })()}
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.emptyStateCard, { marginTop: 4 }]}>
                        <Text style={styles.emptyStateSub}>Select a class above to manage its subjects.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setTeacherModalUser(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.half]} onPress={saveTeacherAssignments} disabled={savingTeacherAssignments}>
              {savingTeacherAssignments ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" /> : <Text style={styles.primaryButtonText}>Save Assignments</Text>}
            </Pressable>
          </View>

          {/* Confirm Overlays Rendered INSIDE the modal so they stack properly on web */}
          {pendingRemoveTeacherPair !== null && (
            <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 100 }]}>
              <View style={styles.confirmModalCard}>
                <Text style={styles.cardTitle}>Remove Assignment?</Text>
                <Text style={styles.metaText}>
                  Are you sure you want to remove the assignment "{pendingRemoveTeacherPair?.subject}" for {getStandardLabel(pendingRemoveTeacherPair?.classLevel || '')}?
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={[styles.secondaryButton, styles.confirmActionButton]} onPress={() => setPendingRemoveTeacherPair(null)}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmDeleteButton, styles.confirmActionButton]} onPress={() => {
                    if (pendingRemoveTeacherPair) {
                      toggleTeacherSubject(pendingRemoveTeacherPair.classLevel, pendingRemoveTeacherPair.subject);
                      setPendingRemoveTeacherPair(null);
                    }
                  }}>
                    <Text style={styles.deleteActionButtonText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {pendingBulkSubjectAction !== null && (
            <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 100 }]}>
              <View style={styles.confirmModalCard}>
                <Text style={styles.cardTitle}>
                  {pendingBulkSubjectAction === 'add' ? 'Add All Subjects?' : 'Remove All Subjects?'}
                </Text>
                <Text style={styles.metaText}>
                  {pendingBulkSubjectAction === 'add'
                    ? `This will assign all available subjects for ${getStandardLabel(teacherSubjectTargetClass)} to this teacher.`
                    : `This will remove all assigned subjects for ${getStandardLabel(teacherSubjectTargetClass)} from this teacher.`
                  }
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={[styles.secondaryButton, styles.confirmActionButton]} onPress={() => setPendingBulkSubjectAction(null)}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmDeleteButton, styles.confirmActionButton]} onPress={() => {
                    if (pendingBulkSubjectAction === 'add') assignAllSubjectsForClass(teacherSubjectTargetClass);
                    else removeAllSubjectsForClass(teacherSubjectTargetClass);
                    setPendingBulkSubjectAction(null);
                  }}>
                    <Text style={styles.deleteActionButtonText}>{pendingBulkSubjectAction === 'add' ? 'Add All' : 'Remove All'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {pendingBulkClassAction !== null && (
            <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 100 }]}>
              <View style={styles.confirmModalCard}>
                <Text style={styles.cardTitle}>
                  {pendingBulkClassAction === 'add' ? 'Assign All Standards?' : 'Remove All Standards?'}
                </Text>
                <Text style={styles.metaText}>
                  {pendingBulkClassAction === 'add'
                    ? 'This will assign all available standards to this teacher.'
                    : 'This will remove all currently assigned standards and their subjects from this teacher.'
                  }
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={[styles.secondaryButton, styles.confirmActionButton]} onPress={() => setPendingBulkClassAction(null)}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmDeleteButton, styles.confirmActionButton]} onPress={() => {
                    if (pendingBulkClassAction === 'add') assignAllClasses();
                    else removeAllClasses();
                    setPendingBulkClassAction(null);
                  }}>
                    <Text style={styles.deleteActionButtonText}>{pendingBulkClassAction === 'add' ? 'Assign All' : 'Remove All'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Remove Individual Standard Confirm */}
          {pendingRemoveTeacherClass !== null && (
            <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 100 }]}>
              <View style={styles.confirmModalCard}>
                <Text style={styles.cardTitle}>Remove Standard?</Text>
                <Text style={styles.metaText}>
                  Are you sure you want to remove the standard {getStandardLabel(pendingRemoveTeacherClass)} and all its assigned subjects?
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={[styles.secondaryButton, styles.confirmActionButton]} onPress={() => setPendingRemoveTeacherClass(null)}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmDeleteButton, styles.confirmActionButton]} onPress={() => {
                    if (pendingRemoveTeacherClass) {
                      removeTeacherClass(pendingRemoveTeacherClass);
                      setPendingRemoveTeacherClass(null);
                    }
                  }}>
                    <Text style={styles.deleteActionButtonText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

        </View>
        </Modal>
      )}

      {parentModalUser !== null && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setParentModalUser(null)}>
        <View style={[styles.sheetContainer, { paddingTop: insets.top }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.successLight }]}>
                <Users size={18} color={Colors.success} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>Assign Students</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{parentModalUser?.firstName} {parentModalUser?.lastName}</Text>
              </View>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setParentModalUser(null)}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Search Student</Text>
            <TextInput
              value={parentStudentSearch}
              onChangeText={setParentStudentSearch}
              placeholder="Search by name or email"
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.fieldLabel}>Standard</Text>
                <Pressable
                  style={styles.selectorInput}
                  onPress={() => setStandardSelectorTarget('parentStudentClassLevel')}
                >
                  <Text style={parentStudentClassLevel ? styles.selectorText : styles.selectorPlaceholder}>
                    {parentStudentClassLevel ? getStandardLabel(parentStudentClassLevel) : 'Standard (any)'}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.secondaryButton, styles.half, styles.alignBottomButton]}
                onPress={() => searchStudentsForParent(parentStudentSearch, parentStudentClassLevel)}
                disabled={loadingParentStudents}
              >
                {loadingParentStudents ? <ActivityIndicator accessibilityLabel="Loading" color={Colors.primary} /> : <Text style={styles.secondaryButtonText}>Search</Text>}
              </Pressable>
            </View>
            <ScrollView style={styles.transferList}>
              {filteredParentStudentResults.map((student) => {
                const selected = parentSelectedStudentIds.includes(student.id);
                return (
                  <Pressable key={student.id} style={styles.studentSelectRow} onPress={() => toggleParentStudent(student.id)}>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.transferItemText}>
                        {student.firstName} {student.lastName}
                      </Text>
                      <Text style={styles.metaText}>
                        {student.id} {student.classLevel ? `• ${getStandardLabel(student.classLevel)}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setParentModalUser(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.half]} onPress={saveParentStudents} disabled={savingParentStudents}>
              {savingParentStudents ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" /> : <Text style={styles.primaryButtonText}>Save Mapping</Text>}
            </Pressable>
          </View>
        </View>
        </Modal>
      )}

      <SelectorModal
        visible={standardSelectorTarget !== null}
        title="Select Standard"
        options={STANDARD_OPTIONS.map((s) => ({ label: s.label, value: s.value }))}
        selected={''}
        showAny={standardSelectorTarget === 'parentStudentClassLevel' || standardSelectorTarget === 'subjectFilterClassLevel' || standardSelectorTarget === 'studentFilterClassLevel' || standardSelectorTarget === 'viewMoreClassLevel'}
        onSelect={applyStandardSelection}
        onClose={() => setStandardSelectorTarget(null)}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  heroBanner: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xxl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...Shadow.md,
    shadowColor: Colors.primary,
  },
  heroLeft: {
    flex: 1,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    // Darkening (not lightening) overlay so white text keeps WCAG AA
    // contrast against the (already-dark) hero background.
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 28,
  },
  heroSub: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 18,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 80,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 2,
    alignItems: 'flex-start',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabTile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
    ...Shadow.sm,
  },
  tabTileIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTileText: {
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  sectionHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...Shadow.sm,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 40,
  },
  textAreaInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  fieldGroup: {
    gap: 8,
  },
  mediaActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaActionButton: {
    minWidth: 140,
  },
  subjectIconPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectIconPreviewBubble: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  subjectIconPreviewImage: {
    width: 30,
    height: 30,
  },
  iconColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconColorChip: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  iconColorChipActive: {
    borderColor: '#2563eb',
    borderWidth: 2,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fbff',
    gap: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewHeaderContent: {
    flex: 1,
    gap: 2,
  },
  mediaInfoLabel: {
    fontSize: 11,
    color: '#4B5768',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mediaInfoValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  previewRemoveButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewRemoveButtonText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  optionImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  selectorInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  selectorPlaceholder: {
    color: '#4E5D71',
    fontSize: 14,
  },
  selectorText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    marginBottom: -2,
  },
  half: {
    flex: 1,
  },
  alignBottomButton: {
    justifyContent: 'center',
    marginTop: 22,
  },
  searchBar: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  searchBarInput: { flex: 1, fontSize: 13, color: Colors.text, paddingVertical: 0 },
  
  roleChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  filterChipBtn: { borderRadius: 10, backgroundColor: '#F0F0F8', paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center' },
  filterChipActive:     { fontSize: 12, fontWeight: '700', color: Colors.primary },
  filterChipPlaceholder:{ fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  
  listContainer: { gap: 10, marginTop: 4 },
  listCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 14, backgroundColor: Colors.surface,
  },
  listCardCol: {
    flexDirection: 'column', alignItems: 'stretch', gap: 12,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 14, backgroundColor: Colors.surface,
  },
  listMainRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  listMainCol: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listAvatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  listAvatarText: { color: Colors.primary, fontWeight: '900', fontSize: 14 },
  listMeta: { flex: 1, gap: 2 },
  listTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  listSub: { fontSize: 12, color: Colors.textSecondary },
  listRole: { fontSize: 10, color: Colors.primary, fontWeight: '800', letterSpacing: 0.6 },
  pillMore: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  pillMoreText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  listPillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.primary, borderRadius: Radius.md },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ghostBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  ghostBtnText: { color: Colors.text, fontSize: 11, fontWeight: '700' },
  dangerBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.errorLight, borderRadius: Radius.md },
  dangerBtnText: { color: Colors.error, fontSize: 11, fontWeight: '700' },
  roleChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  roleChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleChipTextActive: {
    color: '#1d4ed8',
  },
  primaryButton: {
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    alignItems: 'center',
    ...Shadow.sm,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  primaryButtonSmall: {
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
    minHeight: 56,
    backgroundColor: Colors.surface,
  },
  tableHeader: {
    backgroundColor: Colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  colName: {
    width: 170,
  },
  colSubjectCover: {
    width: 100,
  },
  colSubjectTitle: {
    width: 180,
  },
  colSubjectDescription: {
    width: 280,
  },
  colSubjectAuthor: {
    width: 230,
  },
  colClass: {
    width: 120,
  },
  colEmail: {
    width: 230,
  },
  colMobile: {
    width: 140,
  },
  colAssignments: {
    width: 340,
  },
  colAction: {
    width: 200,
  },
  actionCell: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryActionButton: {
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceAlt,
  },
  deleteActionButton: {
    borderColor: Colors.errorLight,
    backgroundColor: Colors.errorLight,
  },
  actionButtonText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  deleteActionButtonText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  coverCell: {
    justifyContent: 'center',
  },
  subjectCoverThumb: {
    width: 28,
    height: 28,
  },
  subjectIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectCoverPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  subjectCoverPlaceholderText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  authorCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  authorAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarPlaceholderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  authorMeta: {
    flex: 1,
    minWidth: 0,
  },
  authorNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  authorSubText: {
    fontSize: 11,
    color: '#4B5768',
  },
  externalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  authorSearchSection: {
    gap: 8,
  },
  selectedAuthorCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchResultList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 6,
    backgroundColor: '#f8fafc',
  },
  searchResultRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.primaryLight,
  },
  pillText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  userCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
  },
  message: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  paginationRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  paginationInfo: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  paginationButtonDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  paginationButtonText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  paginationButtonTextDisabled: {
    color: Colors.textMuted,
  },
  paginationPageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 16,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { zIndex: 99999, position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0 } : {}),
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    gap: 10,
  },
  sheetHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  sheetHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetCloseText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    padding: 20,
    gap: 12,
    paddingBottom: 32,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  searchInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 6 : 4,
    backgroundColor: Colors.surface,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  searchInlineButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInlineButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  refreshOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Shadow.sm,
  },
  confirmModalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 12,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmActionButton: {
    flex: 1,
    marginTop: 0,
    minHeight: 40,
    justifyContent: 'center',
  },
  confirmDeleteButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
    paddingVertical: 9,
    alignItems: 'center',
  },
  transferModal: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
    maxHeight: '90%',
  },
  transferRow: {
    flexDirection: 'row',
    gap: 10,
  },
  transferColumn: {
    flex: 1,
    gap: 8,
  },
  transferTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
  },
  transferList: {
    maxHeight: 320,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
  },
  transferItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  transferItemText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    flex: 1,
  },
  inlineAddButton: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineAddButtonText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 11,
  },
  inlineRemoveButton: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineRemoveButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 11,
  },
  studentSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4E5D71',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    borderColor: '#1d4ed8',
    backgroundColor: '#1d4ed8',
  },
  checkboxTick: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  selectorOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  selectorOptionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  logoPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  logoPickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '84%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  logoPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
  },
  logoItem: {
    width: '22%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  logoItemActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  logoThumb: {
    width: 34,
    height: 34,
  },
  logoLabel: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  successText: {
    color: '#166534',
  },
  errorText: {
    color: '#b91c1c',
  },

  // Premium Modal Styles
  addButtonSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  addButtonSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyStateCard: { padding: 24, backgroundColor: Colors.surfaceAlt, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  emptyStateSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  premiumCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  premiumCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: Colors.border },
  premiumCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  premiumCardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  premiumCardBody: { padding: 14 },
  iconButton: { padding: 8, borderRadius: 8, backgroundColor: Colors.surfaceAlt },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: 'transparent' },
  toggleRowActive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  checkboxContainer: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxContainerActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  toggleSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  pillSelector: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  pillSelectorActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillSelectorText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  pillSelectorTextActive: { color: '#fff' },
  transferListContainer: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  transferCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  transferCardSelected: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  transferCardText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  transferCardTextSelected: { flex: 1, fontSize: 14, fontWeight: '700', color: '#166534' },
  transferIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  transferAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.text, borderRadius: 6 },
  transferAddBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  transferRemoveBtn: { padding: 8, borderRadius: 6, backgroundColor: '#fee2e2' },
  classDropdownWrap: { backgroundColor: Colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 8, overflow: 'hidden' },
  bulkActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.primaryLight, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  bulkActionRowDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  bulkActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkCheckbox: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  bulkCheckboxDanger: { borderColor: Colors.error },
  bulkActionText: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  bulkActionTextDanger: { fontSize: 13, fontWeight: '700', color: Colors.error },
  toastOverlay: { position: 'absolute', top: Platform.OS === 'ios' ? 120 : 100, left: 16, right: 16, alignItems: 'center', zIndex: 999999, elevation: 99, ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}) },
  toastCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successLight, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.success, ...Shadow.md, width: '100%', maxWidth: 400 },
  toastText: { color: Colors.success, fontSize: 14, fontWeight: '700', flex: 1 },
  subjectChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  subjectChipText: { fontSize: 12, fontWeight: '600' },
});
