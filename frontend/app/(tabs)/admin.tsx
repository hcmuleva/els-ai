import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, ChevronLeft, ChevronRight, CreditCard, GraduationCap, Plus, Search, Shield, Sparkles, Users, UserCheck, X } from 'lucide-react-native';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import SelectorModal from '../../src/components/SelectorModal';
import { BillingPanel } from '../../src/components/billing/BillingPanel';
import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../../src/theme';
import { UserRole } from '../../src/types/roles';

type IconComp = React.ComponentType<{ size?: number; color?: string }>;

type ManagedRole = Extract<UserRole, 'student' | 'teacher' | 'parent' | 'admin'>;
type AdminTab = 'subject' | 'student' | 'teacher' | 'parent' | 'billing';
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

type TeacherAssignmentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  assignments: AssignmentPair[];
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
const TAB_OPTIONS: Array<{ key: AdminTab; label: string; description: string; tint: string; tintLight: string; Icon: IconComp }> = [
  { key: 'subject', label: 'Subjects', description: 'Create and manage curriculum subjects for each standard.', tint: Colors.accent, tintLight: Colors.accentLight, Icon: BookOpen },
  { key: 'student', label: 'Students', description: 'Manage student records, classes, and profile details.', tint: Colors.primary, tintLight: Colors.primaryLight, Icon: GraduationCap },
  { key: 'teacher', label: 'Teachers', description: 'Assign standards and subjects to teachers in one place.', tint: Colors.purple, tintLight: Colors.purpleLight, Icon: UserCheck },
  { key: 'parent', label: 'Parents', description: 'Map student accounts with parents for visibility and reports.', tint: Colors.success, tintLight: Colors.successLight, Icon: Users },
  { key: 'billing', label: 'Billing', description: 'Track subscriptions and organizational billing settings.', tint: Colors.warning, tintLight: Colors.warningLight, Icon: CreditCard },
];
const TABLE_PAGE_SIZE = 8;
const ADMIN_ACTIVE_TAB_KEY = 'admin:activeTab';
const ADMIN_TAB_KEYS: AdminTab[] = ['subject', 'student', 'teacher', 'parent', 'billing'];

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
  const [activeTab, setActiveTab] = useState<AdminTab>('subject');
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
  });
  const [adminCounts, setAdminCounts] = useState({ subjects: 0, students: 0, teachers: 0, parents: 0 });
  const [assignmentCatalog, setAssignmentCatalog] = useState<AssignmentPair[]>([]);
  const [studentFilters, setStudentFilters] = useState({ search: '', name: '' });
  const [loadingTable, setLoadingTable] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [pendingDeleteSubject, setPendingDeleteSubject] = useState<SubjectRecord | null>(null);
  const [savingTeacherAssignments, setSavingTeacherAssignments] = useState(false);
  const [savingParentStudents, setSavingParentStudents] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const [teacherModalUser, setTeacherModalUser] = useState<TeacherAssignmentUser | null>(null);
  const [teacherSelectedPairs, setTeacherSelectedPairs] = useState<AssignmentPair[]>([]);

  const [parentModalUser, setParentModalUser] = useState<ParentAssignmentUser | null>(null);
  const [parentStudentSearch, setParentStudentSearch] = useState('');
  const [parentStudentClassLevel, setParentStudentClassLevel] = useState('');
  const [parentStudentResults, setParentStudentResults] = useState<StudentSearchResult[]>([]);
  const [parentSelectedStudentIds, setParentSelectedStudentIds] = useState<string[]>([]);
  const [loadingParentStudents, setLoadingParentStudents] = useState(false);
  const [standardSelectorTarget, setStandardSelectorTarget] = useState<
    'userFormClassLevel' | 'parentStudentClassLevel' | 'subjectFormClassLevel' | null
  >(null);

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
          .flatMap((subject) => [subject.coverImage || '', subject.authorUser?.profileImage || ''])
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
    if (studentFilters.name.trim()) query.set('name', studentFilters.name.trim());
    const res = await apiFetch(`/users?${query.toString()}`);
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load students');
    }
    const payload = await res.json();
    setStudents((payload.users || []) as ManagedUser[]);
  }, [apiFetch, isAdminView, studentFilters.name, studentFilters.search]);

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
  }, [activeTab, isAdminView, loadStudents, studentFilters.name, studentFilters.search]);

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
      setMessage({ type: 'success', text: dialogMode === 'create' ? 'User created successfully.' : 'User updated successfully.' });
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
      setMessage({ type: 'success', text: subjectDialogMode === 'create' ? 'Subject created successfully.' : 'Subject updated successfully.' });
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
    setTeacherSelectedPairs(teacher.assignments || []);
  };

  const addTeacherPair = (pair: AssignmentPair) => {
    setTeacherSelectedPairs((current) => {
      if (current.some((item) => pairKey(item) === pairKey(pair))) return current;
      return [...current, pair];
    });
  };

  const removeTeacherPair = (pair: AssignmentPair) => {
    setTeacherSelectedPairs((current) => current.filter((item) => pairKey(item) !== pairKey(pair)));
  };

  const saveTeacherAssignments = async () => {
    if (!teacherModalUser) return;
    setSavingTeacherAssignments(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/users/teachers/${teacherModalUser.id}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ assignments: teacherSelectedPairs }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to assign standards and subjects');
      }
      setTeacherModalUser(null);
      setMessage({ type: 'success', text: 'Teacher assignments updated successfully.' });
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
      setMessage({ type: 'success', text: 'Parent student mapping updated successfully.' });
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
      teacherModalUser.assignments.forEach((pair) => {
        if (!base.some((item) => pairKey(item) === pairKey(pair))) {
          base.push(pair);
        }
      });
    }
    return base.filter((pair) => !selected.has(pairKey(pair)));
  }, [assignmentCatalog, teacherModalUser, teacherSelectedPairs]);

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
  }, [activeTab, studentFilters.name, studentFilters.search]);

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

  const subjectPagination = useMemo(() => toPaginationMeta('subject', subjects.length), [subjects.length, toPaginationMeta]);
  const studentPagination = useMemo(() => toPaginationMeta('student', students.length), [students.length, toPaginationMeta]);
  const teacherPagination = useMemo(() => toPaginationMeta('teacher', teachers.length), [teachers.length, toPaginationMeta]);
  const parentPagination = useMemo(() => toPaginationMeta('parent', parents.length), [parents.length, toPaginationMeta]);

  const paginatedSubjects = useMemo(
    () => subjects.slice(subjectPagination.start, subjectPagination.end),
    [subjects, subjectPagination.end, subjectPagination.start],
  );
  const paginatedStudents = useMemo(
    () => students.slice(studentPagination.start, studentPagination.end),
    [students, studentPagination.end, studentPagination.start],
  );
  const paginatedTeachers = useMemo(
    () => teachers.slice(teacherPagination.start, teacherPagination.end),
    [teachers, teacherPagination.end, teacherPagination.start],
  );
  const paginatedParents = useMemo(
    () => parents.slice(parentPagination.start, parentPagination.end),
    [parents, parentPagination.end, parentPagination.start],
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
    setStandardSelectorTarget(null);
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
        {TAB_OPTIONS.map((tab) => {
          const active = activeTab === tab.key;
          const TabIcon = tab.Icon;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tabTile,
                { backgroundColor: active ? tab.tint : Colors.surface, borderColor: active ? tab.tint : Colors.borderLight },
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
          {loadingTable && subjects.length === 0 ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <View style={{ position: 'relative' }}>
              {loadingTable ? (
                <View style={styles.refreshOverlay}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : null}
              <ScrollView horizontal>
                <View>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.colSubjectCover]}>Cover</Text>
                  <Text style={[styles.tableCell, styles.colSubjectTitle]}>Title</Text>
                  <Text style={[styles.tableCell, styles.colSubjectDescription]}>Description</Text>
                  <Text style={[styles.tableCell, styles.colSubjectAuthor]}>Author</Text>
                  <Text style={[styles.tableCell, styles.colClass]}>Standard</Text>
                  <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                </View>
                {paginatedSubjects.map((subject) => (
                  <View key={subject.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.colSubjectCover, styles.coverCell]}>
                      {subject.coverImage ? (
                        <Image source={{ uri: resolveMediaUrl(subject.coverImage) }} style={styles.subjectCoverThumb} />
                      ) : (
                        <View style={styles.subjectCoverPlaceholder}>
                          <Text style={styles.subjectCoverPlaceholderText}>{getAvatarInitials(subject.title)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.tableCell, styles.colSubjectTitle]}>{subject.title}</Text>
                    <Text style={[styles.tableCell, styles.colSubjectDescription]} numberOfLines={2}>
                      {subject.description || '-'}
                    </Text>
                    <View style={[styles.tableCell, styles.colSubjectAuthor, styles.authorCell]}>
                      {subject.authorUser?.profileImage ? (
                        <Image source={{ uri: resolveMediaUrl(subject.authorUser.profileImage) }} style={styles.authorAvatar} />
                      ) : (
                        <View style={styles.authorAvatarPlaceholder}>
                          <Text style={styles.authorAvatarPlaceholderText}>{getAvatarInitials(subject.author || 'AU')}</Text>
                        </View>
                      )}
                      <View style={styles.authorMeta}>
                        <Text style={styles.authorNameText} numberOfLines={1}>
                          {subject.author || '-'}
                        </Text>
                        <Text style={styles.authorSubText} numberOfLines={1}>
                          {subject.isExternalAuthor ? 'External author' : subject.authorUser?.mobileNumber || 'Internal author'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.tableCell, styles.colClass]}>{getStandardLabel(subject.classLevel)}</Text>
                    <View style={[styles.colAction, styles.actionCell]}>
                      <Pressable style={styles.actionButton} onPress={() => openEditSubjectDialog(subject)}>
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.deleteActionButton]}
                        onPress={() => requestDeleteSubject(subject)}
                        disabled={deletingSubjectId === subject.id}
                      >
                        {deletingSubjectId === subject.id ? (
                          <ActivityIndicator size="small" color="#b91c1c" />
                        ) : (
                          <Text style={styles.deleteActionButtonText}>Delete</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
          {renderPagination('subject', 'Subjects', subjectPagination)}
        </View>
      ) : null}

      {activeTab === 'student' ? (
        <>
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.primaryLight }]}>
                  <Search size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Find Students</Text>
                  <Text style={styles.cardCount}>Filters apply as you type</Text>
                </View>
              </View>
              <Pressable style={[styles.cta, { backgroundColor: Colors.primary }]} onPress={() => openCreateDialog('student')}>
                <Plus size={14} color="#fff" />
                <Text style={styles.ctaText}>New Student</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Global Search</Text>
            <TextInput
              value={studentFilters.search}
              onChangeText={(search) => setStudentFilters((current) => ({ ...current, search }))}
              placeholder="Search by name, email, or mobile"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Student Name</Text>
            <TextInput
              value={studentFilters.name}
              onChangeText={(name) => setStudentFilters((current) => ({ ...current, name }))}
              placeholder="Filter by student name"
              style={styles.input}
            />
          </View>

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
            </View>
            <Text style={styles.sectionHint}>Use this table to update student profile details and verify standard assignments quickly.</Text>
            {loadingTable && students.length === 0 ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={{ position: 'relative' }}>
                {refreshingStudents ? (
                  <View style={styles.refreshOverlay}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : null}
                <ScrollView horizontal>
                  <View>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                      <Text style={[styles.tableCell, styles.colName]}>Name</Text>
                      <Text style={[styles.tableCell, styles.colClass]}>Standard</Text>
                      <Text style={[styles.tableCell, styles.colEmail]}>Email</Text>
                      <Text style={[styles.tableCell, styles.colMobile]}>Mobile</Text>
                      <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                    </View>
                    {paginatedStudents.map((student) => (
                      <View key={student.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.colName]}>{student.firstName} {student.lastName}</Text>
                        <Text style={[styles.tableCell, styles.colClass]}>{getStandardLabel(student.classLevel)}</Text>
                        <Text style={[styles.tableCell, styles.colEmail]}>{student.email}</Text>
                        <Text style={[styles.tableCell, styles.colMobile]}>{student.mobileNumber || '-'}</Text>
                        <View style={[styles.colAction, styles.actionCell]}>
                          <Pressable style={styles.actionButton} onPress={() => openEditDialog(student)}>
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            {renderPagination('student', 'Students', studentPagination)}
          </View>
        </>
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
          {loadingTable && teachers.length === 0 ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <View style={{ position: 'relative' }}>
              {loadingTable ? (
                <View style={styles.refreshOverlay}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : null}
              <ScrollView horizontal>
                <View>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.colName]}>Name</Text>
                    <Text style={[styles.tableCell, styles.colEmail]}>Email</Text>
                    <Text style={[styles.tableCell, styles.colAssignments]}>Assigned Standard / Subject</Text>
                    <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                  </View>
                  {paginatedTeachers.map((teacher) => (
                  <View key={teacher.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colName]}>{teacher.firstName} {teacher.lastName}</Text>
                    <Text style={[styles.tableCell, styles.colEmail]}>{teacher.email}</Text>
                    <View style={[styles.tableCell, styles.colAssignments, styles.pillsWrap]}>
                      {teacher.assignments.length === 0 ? (
                        <Text style={styles.metaText}>No assignments</Text>
                      ) : (
                        teacher.assignments.map((assignment) => (
                          <View key={pairKey(assignment)} style={styles.pill}>
                            <Text style={styles.pillText}>{getStandardLabel(assignment.classLevel)} • {assignment.subject}</Text>
                          </View>
                        ))
                      )}
                    </View>
                    <View style={[styles.colAction, styles.actionCell]}>
                      <Pressable style={styles.actionButton} onPress={() => openTeacherAssignmentDialog(teacher)}>
                        <Text style={styles.actionButtonText}>Manage Assignments</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.secondaryActionButton]}
                        onPress={() =>
                          openEditDialog({
                            id: teacher.id,
                            firstName: teacher.firstName,
                            lastName: teacher.lastName,
                            email: teacher.email,
                            mobileNumber: teacher.mobileNumber,
                            classLevel: '',
                            activeRole: 'teacher',
                            roles: ['teacher'],
                          })
                        }
                      >
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </Pressable>
                    </View>
                  </View>
                  ))}
                </View>
              </ScrollView>
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
          {loadingTable && parents.length === 0 ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <View style={{ position: 'relative' }}>
              {loadingTable ? (
                <View style={styles.refreshOverlay}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : null}
              <ScrollView horizontal>
                <View>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.colName]}>Name</Text>
                    <Text style={[styles.tableCell, styles.colEmail]}>Email</Text>
                    <Text style={[styles.tableCell, styles.colAssignments]}>Assigned Students</Text>
                    <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                  </View>
                  {paginatedParents.map((parent) => (
                  <View key={parent.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colName]}>{parent.firstName} {parent.lastName}</Text>
                    <Text style={[styles.tableCell, styles.colEmail]}>{parent.email}</Text>
                    <View style={[styles.tableCell, styles.colAssignments, styles.pillsWrap]}>
                      {parent.students.length === 0 ? (
                        <Text style={styles.metaText}>No students assigned</Text>
                      ) : (
                        parent.students.map((student) => (
                          <View key={student.id} style={styles.pill}>
                            <Text style={styles.pillText}>
                              {student.firstName} {student.lastName}
                              {student.classLevel ? ` (${getStandardLabel(student.classLevel)})` : ''}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                    <View style={[styles.colAction, styles.actionCell]}>
                      <Pressable style={styles.actionButton} onPress={() => openParentAssignmentDialog(parent)}>
                        <Text style={styles.actionButtonText}>Manage Students</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.secondaryActionButton]}
                        onPress={() =>
                          openEditDialog({
                            id: parent.id,
                            firstName: parent.firstName,
                            lastName: parent.lastName,
                            email: parent.email,
                            mobileNumber: parent.mobileNumber,
                            classLevel: '',
                            activeRole: 'parent',
                            roles: ['parent'],
                          })
                        }
                      >
                        <Text style={styles.actionButtonText}>Edit Profile</Text>
                      </Pressable>
                    </View>
                  </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
          {renderPagination('parent', 'Parents', parentPagination)}
        </View>
      ) : null}

      <Modal visible={dialogMode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDialogMode(null)}>
        <View style={styles.sheetContainer}>
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
              {roleOptions.map((role) => (
                <Pressable
                  key={`dialog-${role}`}
                  onPress={() =>
                    setUserForm((current) => ({
                      ...current,
                      role,
                      classLevel: role === 'student' ? current.classLevel : '',
                    }))
                  }
                  style={[styles.roleChip, userForm.role === role && styles.roleChipActive]}
                >
                  <Text style={[styles.roleChipText, userForm.role === role && styles.roleChipTextActive]}>{role}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setDialogMode(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.half]} onPress={submitUserDialog} disabled={savingUser}>
              {savingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save User</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={subjectDialogMode !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setSubjectDialogMode(null);
          setAuthorSearchResults([]);
        }}
      >
        <View style={styles.sheetContainer}>
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
                  {uploadingCoverImage ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Upload Image</Text>}
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
                    {loadingAuthorSearch ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchInlineButtonText}>Search</Text>}
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
              {savingSubject ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Subject</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={pendingDeleteSubject !== null} transparent animationType="fade" onRequestClose={() => setPendingDeleteSubject(null)}>
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
                  <ActivityIndicator size="small" color="#b91c1c" />
                ) : (
                  <Text style={styles.deleteActionButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SelectorModal
        visible={standardSelectorTarget !== null}
        title="Select Standard"
        options={STANDARD_OPTIONS.map((s) => ({ label: s.label, value: s.value }))}
        selected={''}
        showAny={standardSelectorTarget === 'parentStudentClassLevel'}
        onSelect={applyStandardSelection}
        onClose={() => setStandardSelectorTarget(null)}
      />

      <Modal visible={teacherModalUser !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTeacherModalUser(null)}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: Colors.purpleLight }]}>
                <UserCheck size={18} color={Colors.purple} />
              </View>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>Assign Subjects</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{teacherModalUser?.firstName} {teacherModalUser?.lastName}</Text>
              </View>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={() => setTeacherModalUser(null)}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.metaText}>Add and remove standard/subject pairs to correct assignments.</Text>
            <View style={styles.transferRow}>
              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Available</Text>
                <ScrollView style={styles.transferList}>
                  {availableTeacherPairs.map((pair) => (
                    <View key={`available-${pairKey(pair)}`} style={styles.transferItem}>
                      <Text style={styles.transferItemText}>{getStandardLabel(pair.classLevel)} • {pair.subject}</Text>
                      <Pressable style={styles.inlineAddButton} onPress={() => addTeacherPair(pair)}>
                        <Text style={styles.inlineAddButtonText}>Add</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Assigned</Text>
                <ScrollView style={styles.transferList}>
                  {teacherSelectedPairs.map((pair) => (
                    <View key={`selected-${pairKey(pair)}`} style={styles.transferItem}>
                      <Text style={styles.transferItemText}>{getStandardLabel(pair.classLevel)} • {pair.subject}</Text>
                      <Pressable style={styles.inlineRemoveButton} onPress={() => removeTeacherPair(pair)}>
                        <Text style={styles.inlineRemoveButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setTeacherModalUser(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.half]} onPress={saveTeacherAssignments} disabled={savingTeacherAssignments}>
              {savingTeacherAssignments ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Assignments</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={parentModalUser !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setParentModalUser(null)}>
        <View style={styles.sheetContainer}>
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
                {loadingParentStudents ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.secondaryButtonText}>Search</Text>}
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
              {savingParentStudents ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Mapping</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    color: 'rgba(255,255,255,0.85)',
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
    color: '#64748b',
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
    color: '#94a3b8',
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
  roleChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
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
    marginTop: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
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
    paddingVertical: 11,
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
    width: 220,
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
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
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
    color: '#64748b',
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
    borderColor: '#94a3b8',
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
  successText: {
    color: '#166534',
  },
  errorText: {
    color: '#b91c1c',
  },
});
