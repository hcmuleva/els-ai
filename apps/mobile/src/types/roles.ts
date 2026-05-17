import { ComponentType } from 'react';

export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export type RoleTabItem = {
  route: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
};

export type AppUser = {
  id: number;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
};
