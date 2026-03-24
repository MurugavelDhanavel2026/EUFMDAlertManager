export const APP_NAME = 'Novatio EU FMD Alert Manager';
export const APP_SHORT_NAME = 'AlertManager';

export const ALERT_STATUSES = ['Open', 'InProgress', 'Closed', 'OnHold'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ROLES = ['AlertHandler', 'AlertHandler_supervisor', 'admin'] as const;
export type AppRole = (typeof ROLES)[number];

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50];

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
