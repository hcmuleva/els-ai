export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  active_role: UserRole;
};

export type UserWithRoles = {
  id: number;
  name: string;
  email: string;
  activeRole: UserRole;
  roles: UserRole[];
};
