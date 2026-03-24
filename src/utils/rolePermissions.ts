import type { AppRole } from '../config/constants';

const roleHierarchy: Record<AppRole, number> = {
  AlertHandler: 1,
  AlertHandler_supervisor: 2,
  admin: 3,
};

export function canAccess(userRole: AppRole, requiredRoles: AppRole[]): boolean {
  return requiredRoles.includes(userRole);
}

export function isSupervisorOrAbove(role: AppRole): boolean {
  return roleHierarchy[role] >= 2;
}

export function isAdmin(role: AppRole): boolean {
  return role === 'admin';
}

export function canCreateRole(creatorRole: AppRole, targetRole: AppRole): boolean {
  if (creatorRole === 'admin') return true;
  if (creatorRole === 'AlertHandler_supervisor' && targetRole === 'AlertHandler') return true;
  return false;
}

export function getCreatableRoles(role: AppRole): AppRole[] {
  if (role === 'admin') return ['AlertHandler', 'AlertHandler_supervisor'];
  if (role === 'AlertHandler_supervisor') return ['AlertHandler'];
  return [];
}
