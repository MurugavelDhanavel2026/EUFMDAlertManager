import type { AppRole } from '../config/constants';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
