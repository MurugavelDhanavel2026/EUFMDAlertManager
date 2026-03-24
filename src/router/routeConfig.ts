import type { AppRole } from '../config/constants';

export interface RouteConfig {
  path: string;
  label: string;
  icon: string;
  roles: AppRole[];
  showInNav: boolean;
}

export const routeConfig: RouteConfig[] = [
  {
    path: '/',
    label: 'nav.dashboard',
    icon: 'Dashboard',
    roles: ['AlertHandler', 'AlertHandler_supervisor', 'admin'],
    showInNav: true,
  },
  {
    path: '/alerts',
    label: 'nav.alerts',
    icon: 'Notifications',
    roles: ['AlertHandler', 'AlertHandler_supervisor', 'admin'],
    showInNav: true,
  },
  {
    path: '/markets',
    label: 'nav.markets',
    icon: 'Public',
    roles: ['admin'],
    showInNav: true,
  },
  {
    path: '/users',
    label: 'nav.users',
    icon: 'People',
    roles: ['AlertHandler_supervisor', 'admin'],
    showInNav: true,
  },
  {
    path: '/admin',
    label: 'nav.admin',
    icon: 'Settings',
    roles: ['admin'],
    showInNav: true,
  },
];
