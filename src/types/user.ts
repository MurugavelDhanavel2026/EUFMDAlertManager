import type { AppRole } from '../config/constants';
import type { Market } from './market';

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
  markets?: Market[];
}
