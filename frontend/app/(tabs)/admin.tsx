import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types/roles';

type ManagedRole = Extract<UserRole, 'student' | 'teacher' | 'parent' | 'admin'>;
type AdminTab = 'student' | 'teacher' | 'parent';
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

const roleOptions: ManagedRole[] = ['student', 'teacher', 'parent', 'admin'];

const EMPTY_USER_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  classLevel: '',
  password: '',
  role: 'student',
};

const pairKey = (pair: AssignmentPair) => `${pair.classLevel}::${pair.subject}`;
const STANDARD_OPTIONS = [
  'LKG',
  'UKG',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];

export default function AdminScreen() {
  const { user, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('student');
  const [students, setStudents] = useState<ManagedUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherAssignmentUser[]>([]);
  const [parents, setParents] = useState<ParentAssignmentUser[]>([]);
  const [assignmentCatalog, setAssignmentCatalog] = useState<AssignmentPair[]>([]);
  const [studentFilters, setStudentFilters] = useState({ search: '', name: '' });
  const [loadingTable, setLoadingTable] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingTeacherAssignments, setSavingTeacherAssignments] = useState(false);
  const [savingParentStudents, setSavingParentStudents] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);

  const [teacherModalUser, setTeacherModalUser] = useState<TeacherAssignmentUser | null>(null);
  const [teacherSelectedPairs, setTeacherSelectedPairs] = useState<AssignmentPair[]>([]);

  const [parentModalUser, setParentModalUser] = useState<ParentAssignmentUser | null>(null);
  const [parentStudentSearch, setParentStudentSearch] = useState('');
  const [parentStudentClassLevel, setParentStudentClassLevel] = useState('');
  const [parentStudentResults, setParentStudentResults] = useState<StudentSearchResult[]>([]);
  const [parentSelectedStudentIds, setParentSelectedStudentIds] = useState<string[]>([]);
  const [loadingParentStudents, setLoadingParentStudents] = useState(false);
  const [standardSelectorTarget, setStandardSelectorTarget] = useState<'userFormClassLevel' | 'parentStudentClassLevel' | null>(null);

  const isAdminView = user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

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

  const loadAssignmentCatalog = useCallback(async () => {
    if (!isAdminView) return;
    const res = await apiFetch('/quizzes/question-bank?limit=300');
    if (!res.ok) {
      setAssignmentCatalog([]);
      return;
    }
    const payload = await res.json().catch(() => ({ questions: [] }));
    const rawPairs = ((payload.questions || []) as Array<{ class_level?: string; subject?: string }>)
      .map((item) => ({ classLevel: (item.class_level || '').trim(), subject: (item.subject || '').trim() }))
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
      if (activeTab === 'student') {
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
  }, [activeTab, isAdminView, loadAssignmentCatalog, loadParents, loadStudents, loadTeachers]);

  useEffect(() => {
    loadActiveTab();
  }, [loadActiveTab]);

  useEffect(() => {
    if (!isAdminView || activeTab !== 'student') return;
    const timeoutId = setTimeout(async () => {
      setLoadingTable(true);
      try {
        await loadStudents();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to load students';
        setMessage({ type: 'error', text });
      } finally {
        setLoadingTable(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [activeTab, isAdminView, loadStudents, studentFilters.name, studentFilters.search]);

  const openCreateDialog = (roleFromTab?: ManagedRole) => {
    const role = roleFromTab || (activeTab === 'student' ? 'student' : activeTab === 'teacher' ? 'teacher' : 'parent');
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
      await Promise.all([loadStudents(), loadTeachers(), loadParents()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : dialogMode === 'create' ? 'Failed to create user' : 'Failed to update user';
      setMessage({ type: 'error', text });
    } finally {
      setSavingUser(false);
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

  const applyStandardSelection = (value: string) => {
    if (standardSelectorTarget === 'userFormClassLevel') {
      setUserForm((current) => ({ ...current, classLevel: value }));
    }
    if (standardSelectorTarget === 'parentStudentClassLevel') {
      setParentStudentClassLevel(value);
    }
    setStandardSelectorTarget(null);
  };

  if (!isAdminView) {
    return (
      <ScreenTemplate title="Admin">
        <Text style={styles.errorText}>You do not have permission to access admin controls.</Text>
      </ScreenTemplate>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin User Management</Text>
      <Text style={styles.subtitle}>Manage students, teachers, parents, and assignment mappings.</Text>

      {message && (
        <View style={[styles.message, message.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
            {message.text}
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {(['student', 'teacher', 'parent'] as AdminTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'student' ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Student Filters</Text>
            <TextInput
              value={studentFilters.search}
              onChangeText={(search) => setStudentFilters((current) => ({ ...current, search }))}
              placeholder="Search by name/email/mobile"
              style={styles.input}
            />
            <TextInput
              value={studentFilters.name}
              onChangeText={(name) => setStudentFilters((current) => ({ ...current, name }))}
              placeholder="Filter by name"
              style={styles.input}
            />
            <Text style={styles.metaText}>Filters update automatically while you type.</Text>
            <Pressable style={styles.primaryButton} onPress={() => openCreateDialog('student')}>
              <Text style={styles.primaryButtonText}>Create Student</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Students ({students.length})</Text>
            {loadingTable ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <ScrollView horizontal>
                <View>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.colName]}>Name</Text>
                    <Text style={[styles.tableCell, styles.colClass]}>Standard</Text>
                    <Text style={[styles.tableCell, styles.colEmail]}>Email</Text>
                    <Text style={[styles.tableCell, styles.colMobile]}>Mobile</Text>
                    <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                  </View>
                  {students.map((student) => (
                    <View key={student.id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.colName]}>{student.firstName} {student.lastName}</Text>
                      <Text style={[styles.tableCell, styles.colClass]}>{student.classLevel || '-'}</Text>
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
            )}
          </View>
        </>
      ) : null}

      {activeTab === 'teacher' ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Teachers ({teachers.length})</Text>
            <Pressable style={styles.primaryButtonSmall} onPress={() => openCreateDialog('teacher')}>
              <Text style={styles.primaryButtonText}>Create Teacher</Text>
            </Pressable>
          </View>
          {loadingTable ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <ScrollView horizontal>
              <View>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.colName]}>Name</Text>
                  <Text style={[styles.tableCell, styles.colEmail]}>Email</Text>
                  <Text style={[styles.tableCell, styles.colAssignments]}>Assigned Standard / Subject</Text>
                  <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                </View>
                {teachers.map((teacher) => (
                  <View key={teacher.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colName]}>{teacher.firstName} {teacher.lastName}</Text>
                    <Text style={[styles.tableCell, styles.colEmail]}>{teacher.email}</Text>
                    <View style={[styles.tableCell, styles.colAssignments, styles.pillsWrap]}>
                      {teacher.assignments.length === 0 ? (
                        <Text style={styles.metaText}>No assignments</Text>
                      ) : (
                        teacher.assignments.map((assignment) => (
                          <View key={pairKey(assignment)} style={styles.pill}>
                            <Text style={styles.pillText}>{assignment.classLevel} • {assignment.subject}</Text>
                          </View>
                        ))
                      )}
                    </View>
                    <View style={[styles.colAction, styles.actionCell]}>
                      <Pressable style={styles.actionButton} onPress={() => openTeacherAssignmentDialog(teacher)}>
                        <Text style={styles.actionButtonText}>Edit Assignments</Text>
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
          )}
        </View>
      ) : null}

      {activeTab === 'parent' ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Parents ({parents.length})</Text>
            <Pressable style={styles.primaryButtonSmall} onPress={() => openCreateDialog('parent')}>
              <Text style={styles.primaryButtonText}>Create Parent</Text>
            </Pressable>
          </View>
          {loadingTable ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <ScrollView horizontal>
              <View>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.colName]}>Name</Text>
                  <Text style={[styles.tableCell, styles.colEmail]}>Email</Text>
                  <Text style={[styles.tableCell, styles.colAssignments]}>Assigned Students</Text>
                  <Text style={[styles.tableCell, styles.colAction]}>Actions</Text>
                </View>
                {parents.map((parent) => (
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
                              {student.classLevel ? ` (${student.classLevel})` : ''}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                    <View style={[styles.colAction, styles.actionCell]}>
                      <Pressable style={styles.actionButton} onPress={() => openParentAssignmentDialog(parent)}>
                        <Text style={styles.actionButtonText}>Edit Students</Text>
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
                        <Text style={styles.actionButtonText}>Edit Parent</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      ) : null}

      <Modal visible={dialogMode !== null} transparent animationType="fade" onRequestClose={() => setDialogMode(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{dialogMode === 'create' ? 'Create User' : 'Edit User'}</Text>
            <TextInput
              value={userForm.firstName}
              onChangeText={(firstName) => setUserForm((current) => ({ ...current, firstName }))}
              placeholder="First name"
              style={styles.input}
            />
            <TextInput
              value={userForm.lastName}
              onChangeText={(lastName) => setUserForm((current) => ({ ...current, lastName }))}
              placeholder="Last name"
              style={styles.input}
            />
            <TextInput
              value={userForm.email}
              onChangeText={(email) => setUserForm((current) => ({ ...current, email }))}
              placeholder="Email"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={userForm.mobileNumber}
              onChangeText={(mobileNumber) => setUserForm((current) => ({ ...current, mobileNumber }))}
              placeholder="Mobile number"
              style={styles.input}
            />
            {userForm.role === 'student' ? (
              <Pressable style={styles.selectorInput} onPress={() => setStandardSelectorTarget('userFormClassLevel')}>
                <Text style={userForm.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                  {userForm.classLevel || 'Select standard'}
                </Text>
              </Pressable>
            ) : null}
            <TextInput
              value={userForm.password}
              onChangeText={(password) => setUserForm((current) => ({ ...current, password }))}
              placeholder={dialogMode === 'create' ? 'Password (optional)' : 'New password (optional)'}
              secureTextEntry
              style={styles.input}
            />
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
            <View style={styles.row}>
              <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setDialogMode(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.half]} onPress={submitUserDialog} disabled={savingUser}>
                {savingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={standardSelectorTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStandardSelectorTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Select Standard</Text>
            <ScrollView style={styles.transferList}>
              {standardSelectorTarget === 'parentStudentClassLevel' ? (
                <Pressable style={styles.selectorOption} onPress={() => applyStandardSelection('')}>
                  <Text style={styles.selectorOptionText}>Any</Text>
                </Pressable>
              ) : null}
              {STANDARD_OPTIONS.map((standard) => (
                <Pressable key={standard} style={styles.selectorOption} onPress={() => applyStandardSelection(standard)}>
                  <Text style={styles.selectorOptionText}>{standard}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setStandardSelectorTarget(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={teacherModalUser !== null} transparent animationType="fade" onRequestClose={() => setTeacherModalUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.transferModal}>
            <Text style={styles.cardTitle}>
              Assign Subjects • {teacherModalUser?.firstName} {teacherModalUser?.lastName}
            </Text>
            <Text style={styles.metaText}>Add and remove pairs below to correct mistaken assignments.</Text>
            <View style={styles.transferRow}>
              <View style={styles.transferColumn}>
                <Text style={styles.transferTitle}>Available</Text>
                <ScrollView style={styles.transferList}>
                  {availableTeacherPairs.map((pair) => (
                    <View key={`available-${pairKey(pair)}`} style={styles.transferItem}>
                      <Text style={styles.transferItemText}>{pair.classLevel} • {pair.subject}</Text>
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
                      <Text style={styles.transferItemText}>{pair.classLevel} • {pair.subject}</Text>
                      <Pressable style={styles.inlineRemoveButton} onPress={() => removeTeacherPair(pair)}>
                        <Text style={styles.inlineRemoveButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setTeacherModalUser(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.half]} onPress={saveTeacherAssignments} disabled={savingTeacherAssignments}>
                {savingTeacherAssignments ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={parentModalUser !== null} transparent animationType="fade" onRequestClose={() => setParentModalUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.transferModal}>
            <Text style={styles.cardTitle}>
              Assign Students • {parentModalUser?.firstName} {parentModalUser?.lastName}
            </Text>
            <TextInput
              value={parentStudentSearch}
              onChangeText={setParentStudentSearch}
              placeholder="Search student by name / standard / student id"
              style={styles.input}
            />
            <View style={styles.row}>
              <Pressable
                style={[styles.selectorInput, styles.half]}
                onPress={() => setStandardSelectorTarget('parentStudentClassLevel')}
              >
                <Text style={parentStudentClassLevel ? styles.selectorText : styles.selectorPlaceholder}>
                  {parentStudentClassLevel || 'Standard (any)'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, styles.half]}
                onPress={() => searchStudentsForParent(parentStudentSearch, parentStudentClassLevel)}
                disabled={loadingParentStudents}
              >
                {loadingParentStudents ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Search</Text>}
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
                        {student.id} {student.classLevel ? `• ${student.classLevel}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.row}>
              <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => setParentModalUser(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.half]} onPress={saveParentStudents} disabled={savingParentStudents}>
                {savingParentStudents ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Mapping</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  tabButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
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
  half: {
    flex: 1,
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
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  primaryButtonSmall: {
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 52,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#334155',
  },
  colName: {
    width: 170,
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
    width: 240,
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
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryActionButton: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  actionButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
  },
  pillText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
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
