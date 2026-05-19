import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types/roles';

type ManagedRole = Extract<UserRole, 'student' | 'teacher' | 'parent' | 'admin'>;

type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  activeRole: UserRole;
  roles: UserRole[];
};

const roleOptions: ManagedRole[] = ['student', 'teacher', 'parent', 'admin'];

export default function AdminScreen() {
  const { user, apiFetch } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [draftRolesByUserId, setDraftRolesByUserId] = useState<Record<string, ManagedRole[]>>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingRolesForUserId, setSavingRolesForUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
    role: 'teacher' as ManagedRole,
  });

  const [filters, setFilters] = useState({
    search: '',
    name: '',
    mobileNumber: '',
    role: '' as '' | ManagedRole,
  });

  const isAdminView = user?.activeRole === 'admin' || user?.activeRole === 'superadmin';

  const activeUserCount = useMemo(() => users.length, [users]);

  const loadUsers = async () => {
    if (!isAdminView) return;

    setLoadingUsers(true);
    setMessage(null);
    try {
      const query = new URLSearchParams();
      if (filters.search.trim()) query.set('search', filters.search.trim());
      if (filters.name.trim()) query.set('name', filters.name.trim());
      if (filters.mobileNumber.trim()) query.set('mobileNumber', filters.mobileNumber.trim());
      if (filters.role) query.set('role', filters.role);

      const res = await apiFetch(`/users${query.toString() ? `?${query.toString()}` : ''}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load users');
      }

      const payload = await res.json();
      const fetchedUsers = (payload.users || []) as ManagedUser[];
      setUsers(fetchedUsers);
      setDraftRolesByUserId(
        Object.fromEntries(
          fetchedUsers.map((managedUser) => [
            managedUser.id,
            managedUser.roles.filter((role): role is ManagedRole => roleOptions.includes(role as ManagedRole)),
          ]),
        ),
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load users';
      setMessage({ type: 'error', text });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [user?.activeRole]);

  const handleCreateUser = async () => {
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim()) {
      setMessage({ type: 'error', text: 'First name, last name, and email are required.' });
      return;
    }

    setCreatingUser(true);
    setMessage(null);
    try {
      const res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          email: createForm.email.trim().toLowerCase(),
          mobileNumber: createForm.mobileNumber.trim() || undefined,
          password: createForm.password.trim() || undefined,
          role: createForm.role,
        }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to create user');
      }

      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        mobileNumber: '',
        password: '',
        role: 'teacher',
      });
      setMessage({ type: 'success', text: 'User created successfully.' });
      await loadUsers();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to create user';
      setMessage({ type: 'error', text });
    } finally {
      setCreatingUser(false);
    }
  };

  const toggleRoleDraft = (userId: string, role: ManagedRole) => {
    setDraftRolesByUserId((current) => {
      const previous = current[userId] || [];
      const hasRole = previous.includes(role);
      const next = hasRole ? previous.filter((existingRole) => existingRole !== role) : [...previous, role];
      if (next.length === 0) return current;
      return { ...current, [userId]: next };
    });
  };

  const saveRoles = async (targetUserId: string) => {
    const roles = draftRolesByUserId[targetUserId];
    if (!roles || roles.length === 0) {
      setMessage({ type: 'error', text: 'At least one role must be selected.' });
      return;
    }

    setSavingRolesForUserId(targetUserId);
    setMessage(null);
    try {
      const res = await apiFetch(`/users/${targetUserId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to update roles');
      }
      setMessage({ type: 'success', text: 'Roles updated successfully.' });
      await loadUsers();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to update roles';
      setMessage({ type: 'error', text });
    } finally {
      setSavingRolesForUserId(null);
    }
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
      <Text style={styles.subtitle}>Create users, filter users, and assign roles.</Text>

      {message && (
        <View style={[styles.message, message.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
            {message.text}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create User Account</Text>
        <TextInput
          value={createForm.firstName}
          onChangeText={(firstName) => setCreateForm((current) => ({ ...current, firstName }))}
          placeholder="First name"
          style={styles.input}
        />
        <TextInput
          value={createForm.lastName}
          onChangeText={(lastName) => setCreateForm((current) => ({ ...current, lastName }))}
          placeholder="Last name"
          style={styles.input}
        />
        <TextInput
          value={createForm.email}
          onChangeText={(email) => setCreateForm((current) => ({ ...current, email }))}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={createForm.mobileNumber}
          onChangeText={(mobileNumber) => setCreateForm((current) => ({ ...current, mobileNumber }))}
          placeholder="Mobile number (optional)"
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          value={createForm.password}
          onChangeText={(password) => setCreateForm((current) => ({ ...current, password }))}
          placeholder="Password (optional, default: welcome)"
          secureTextEntry
          style={styles.input}
        />
        <View style={styles.roleRow}>
          {roleOptions.map((role) => (
            <Pressable
              key={role}
              onPress={() => setCreateForm((current) => ({ ...current, role }))}
              style={[styles.roleChip, createForm.role === role && styles.roleChipActive]}
            >
              <Text style={[styles.roleChipText, createForm.role === role && styles.roleChipTextActive]}>
                {role}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryButton} onPress={handleCreateUser} disabled={creatingUser}>
          {creatingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create User</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Filters</Text>
        <TextInput
          value={filters.search}
          onChangeText={(search) => setFilters((current) => ({ ...current, search }))}
          placeholder="Search by name, email, or number"
          style={styles.input}
        />
        <TextInput
          value={filters.name}
          onChangeText={(name) => setFilters((current) => ({ ...current, name }))}
          placeholder="Filter by name"
          style={styles.input}
        />
        <TextInput
          value={filters.mobileNumber}
          onChangeText={(mobileNumber) => setFilters((current) => ({ ...current, mobileNumber }))}
          placeholder="Filter by mobile number"
          keyboardType="phone-pad"
          style={styles.input}
        />
        <View style={styles.roleRow}>
          <Pressable
            onPress={() => setFilters((current) => ({ ...current, role: '' }))}
            style={[styles.roleChip, filters.role === '' && styles.roleChipActive]}
          >
            <Text style={[styles.roleChipText, filters.role === '' && styles.roleChipTextActive]}>all</Text>
          </Pressable>
          {roleOptions.map((role) => (
            <Pressable
              key={`filter-${role}`}
              onPress={() => setFilters((current) => ({ ...current, role }))}
              style={[styles.roleChip, filters.role === role && styles.roleChipActive]}
            >
              <Text style={[styles.roleChipText, filters.role === role && styles.roleChipTextActive]}>{role}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.secondaryButton} onPress={loadUsers} disabled={loadingUsers}>
          {loadingUsers ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Apply Filters</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Users ({activeUserCount})</Text>
        {loadingUsers ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : (
          users.map((managedUser) => (
            <View key={managedUser.id} style={styles.userCard}>
              <Text style={styles.userName}>
                {managedUser.firstName} {managedUser.lastName}
              </Text>
              <Text style={styles.metaText}>{managedUser.email}</Text>
              <Text style={styles.metaText}>{managedUser.mobileNumber || 'No mobile number'}</Text>
              <Text style={styles.metaText}>Active role: {managedUser.activeRole}</Text>

              <View style={styles.roleRow}>
                {roleOptions.map((role) => {
                  const selectedRoles = draftRolesByUserId[managedUser.id] || [];
                  const selected = selectedRoles.includes(role);
                  return (
                    <Pressable
                      key={`${managedUser.id}-${role}`}
                      onPress={() => toggleRoleDraft(managedUser.id, role)}
                      style={[styles.roleChip, selected && styles.roleChipActive]}
                    >
                      <Text style={[styles.roleChipText, selected && styles.roleChipTextActive]}>{role}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => saveRoles(managedUser.id)}
                disabled={savingRolesForUserId === managedUser.id}
              >
                {savingRolesForUserId === managedUser.id ? (
                  <ActivityIndicator color="#1d4ed8" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Save Roles</Text>
                )}
              </Pressable>
            </View>
          ))
        )}
      </View>
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
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  successText: {
    color: '#166534',
  },
  errorText: {
    color: '#b91c1c',
  },
});
