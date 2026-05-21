// Per-user UI preferences stored in the `user_preferences` table as a JSONB
// blob keyed by area. Each field below is one area of the app.
export interface UserPreferences {
  // Ordered list of column keys the user wants visible on the Alerts page.
  // Absent => fall back to the default visible set.
  alertsColumns?: string[];
  // Every column key that existed the last time the user saved their choice.
  // Used to tell "deliberately hidden" apart from "introduced after they saved"
  // so newly-added columns appear automatically instead of staying hidden.
  alertsKnownColumns?: string[];
}

export interface UserPreferencesRow {
  user_id: string;
  preferences: UserPreferences;
  updated_at: string;
}
