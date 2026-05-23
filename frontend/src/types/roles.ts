import { ComponentType } from 'react';

export type UserRole = 'student' | 'teacher' | 'parent' | 'admin' | 'superadmin';

export type RoleTabItem = {
  route: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
};

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  classLevel?: string;
  roles: UserRole[];
  activeRole: UserRole;
  profileImage?: string;
  organizationId?: string;
};
