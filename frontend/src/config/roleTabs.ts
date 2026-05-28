import {
  BookOpen,
  BookOpenCheck,
  ChartColumn,
  FileText,
  House,
  Settings,
  Shield,
  SquareLibrary,
} from 'lucide-react-native';

import { RoleTabItem, UserRole } from '../types/roles';

export const roleTabs: Record<UserRole, RoleTabItem[]> = {
  student: [
    { route: 'index', label: 'Home', icon: House },
    { route: 'classroom', label: 'Classroom', icon: BookOpen },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
  ],
  teacher: [
    { route: 'planner', label: 'Planner', icon: SquareLibrary },
    { route: 'manage', label: 'Manage', icon: FileText },
    { route: 'stories', label: 'Stories', icon: BookOpenCheck },
    { route: 'exam', label: 'Exam', icon: FileText },
  ],
  parent: [
    { route: 'index', label: 'Home', icon: House },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
  ],
  admin: [
    { route: 'admin', label: 'Admin', icon: Shield },
  ],
  superadmin: [
    { route: 'superadmin', label: 'Superadmin', icon: Shield },
  ],
};

export const hiddenTabRoutes = [
  'classroom',
  'planner',
  'exam',
  'logicopiccolo',
  'assessment',
  'evaluation',
  'manage',
  'admin',
  'superadmin',
  'settings',
] as const;

export const profileMenuItems = [
  { route: 'profile', label: 'Profile', icon: House },
  { route: 'settings', label: 'Settings', icon: Settings },
];
