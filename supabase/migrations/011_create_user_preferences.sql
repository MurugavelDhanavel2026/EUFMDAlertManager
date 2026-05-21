-- Per-user UI preferences (e.g. which columns are visible on the Alerts page).
-- One row per user, holding a free-form JSONB blob keyed by preference area.
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: a user can only read and write their own preferences row.
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select" ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_preferences_insert" ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_update" ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_delete" ON public.user_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
