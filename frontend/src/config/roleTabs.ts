import {
  BookOpen,
  ChartColumn,
  FileText,
  House,
  Puzzle,
  Settings,
  Shield,
  SquareLibrary,
} from 'lucide-react-native';

import { RoleTabItem, UserRole } from '../types/roles';

export const roleTabs: Record<UserRole, RoleTabItem[]> = {
  student: [
    { route: 'index', label: 'Home', icon: House },
    { route: 'practice', label: 'Practice', icon: BookOpen },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
  ],
  teacher: [
    { route: 'planner', label: 'Planner', icon: SquareLibrary },
    { route: 'exam', label: 'Exam', icon: FileText },
    { route: 'logicopiccolo', label: 'Logicopiccolo', icon: Puzzle },
    { route: 'content', label: 'Questions', icon: FileText },
    { route: 'assessment', label: 'Assess', icon: ChartColumn },
    { route: 'evaluation', label: 'Eval', icon: BookOpen },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
  ],
  parent: [
    { route: 'index', label: 'Home', icon: House },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
  ],
  admin: [
    { route: 'index', label: 'Home', icon: House },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
    { route: 'admin', label: 'Admin', icon: Shield },
  ],
  superadmin: [
    { route: 'index', label: 'Home', icon: House },
    { route: 'reports', label: 'Reports', icon: ChartColumn },
    { route: 'admin', label: 'Admin', icon: Shield },
  ],
};

export const hiddenTabRoutes = [
  'practice',
  'planner',
  'exam',
  'logicopiccolo',
  'assessment',
  'evaluation',
  'content',
  'admin',
  'settings',
] as const;

export const profileMenuItems = [
  { route: 'profile', label: 'Profile', icon: House },
  { route: 'settings', label: 'Settings', icon: Settings },
];
