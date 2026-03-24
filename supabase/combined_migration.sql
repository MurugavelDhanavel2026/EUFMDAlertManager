-- ============================================
-- Novatio EU FMD Alert Manager - Combined Migration
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Create markets table
CREATE TABLE IF NOT EXISTS public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name TEXT NOT NULL,
  market_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.markets (market_name, market_code) VALUES
  ('European Union', 'EU'),
  ('India', 'IN'),
  ('United States', 'US'),
  ('United Kingdom', 'UK'),
  ('Brazil', 'BR'),
  ('South Africa', 'ZA'),
  ('China', 'CN'),
  ('Spain', 'ES')
ON CONFLICT (market_code) DO NOTHING;

-- 2. Create user profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('AlertHandler', 'AlertHandler_supervisor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create user_markets junction table
CREATE TABLE IF NOT EXISTS public.user_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  UNIQUE(user_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_user_markets_user ON public.user_markets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_markets_market ON public.user_markets(market_id);

-- 4. Create alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL UNIQUE,
  alert_timestamp TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'InProgress', 'Closed', 'OnHold')),
  error_code TEXT,
  target_market TEXT NOT NULL,
  alert_message TEXT,
  gtin TEXT,
  expiry_date DATE,
  serial_number TEXT,
  batch_name TEXT,
  message_guid TEXT,
  root_cause TEXT,
  assigned_user UUID REFERENCES public.user_profiles(id),
  created_on TIMESTAMPTZ DEFAULT now(),
  changed_on TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_target_market ON public.alerts(target_market);
CREATE INDEX IF NOT EXISTS idx_alerts_gtin ON public.alerts(gtin);
CREATE INDEX IF NOT EXISTS idx_alerts_assigned_user ON public.alerts(assigned_user);
CREATE INDEX IF NOT EXISTS idx_alerts_batch_name ON public.alerts(batch_name);
CREATE INDEX IF NOT EXISTS idx_alerts_created_on ON public.alerts(created_on);

CREATE OR REPLACE FUNCTION update_changed_on()
RETURNS TRIGGER AS $$
BEGIN
  NEW.changed_on = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alerts_changed_on ON public.alerts;
CREATE TRIGGER alerts_changed_on
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION update_changed_on();

-- Enable realtime for alerts table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create bulk_operations table
CREATE TABLE IF NOT EXISTS public.bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.user_profiles(id),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('close', 'respond_nmvs')),
  alert_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'PendingApproval' CHECK (status IN ('PendingApproval', 'Approved', 'Rejected')),
  reviewed_by UUID REFERENCES public.user_profiles(id),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bulk_ops_status ON public.bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bulk_ops_requested_by ON public.bulk_operations(requested_by);

-- 6. Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('smtp_config', '{"host": "", "port": 587, "user": "", "password": "", "from_email": ""}'),
  ('uipath_fetch_alerts', '{"endpoint": "", "api_key": "", "enabled": false}'),
  ('uipath_root_cause', '{"endpoint": "", "api_key": "", "enabled": false}'),
  ('db_config', '{"supabase_url": "", "supabase_anon_key": ""}')
ON CONFLICT (key) DO NOTHING;

-- 7. Enable RLS on all tables
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_market_codes()
RETURNS SETOF TEXT AS $$
  SELECT m.market_code
  FROM public.user_markets um
  JOIN public.markets m ON m.id = um.market_id
  WHERE um.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- MARKETS policies
DROP POLICY IF EXISTS "markets_select" ON public.markets;
CREATE POLICY "markets_select" ON public.markets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "markets_insert" ON public.markets;
CREATE POLICY "markets_insert" ON public.markets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "markets_update" ON public.markets;
CREATE POLICY "markets_update" ON public.markets
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "markets_delete" ON public.markets;
CREATE POLICY "markets_delete" ON public.markets
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- USER_PROFILES policies
DROP POLICY IF EXISTS "profiles_select" ON public.user_profiles;
CREATE POLICY "profiles_select" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.user_profiles;
CREATE POLICY "profiles_insert" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

DROP POLICY IF EXISTS "profiles_update" ON public.user_profiles;
CREATE POLICY "profiles_update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

DROP POLICY IF EXISTS "profiles_delete" ON public.user_profiles;
CREATE POLICY "profiles_delete" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- USER_MARKETS policies
DROP POLICY IF EXISTS "user_markets_select" ON public.user_markets;
CREATE POLICY "user_markets_select" ON public.user_markets
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
  );

DROP POLICY IF EXISTS "user_markets_insert" ON public.user_markets;
CREATE POLICY "user_markets_insert" ON public.user_markets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

DROP POLICY IF EXISTS "user_markets_update" ON public.user_markets;
CREATE POLICY "user_markets_update" ON public.user_markets
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

DROP POLICY IF EXISTS "user_markets_delete" ON public.user_markets;
CREATE POLICY "user_markets_delete" ON public.user_markets
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

-- ALERTS policies
DROP POLICY IF EXISTS "alerts_select" ON public.alerts;
CREATE POLICY "alerts_select" ON public.alerts
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
    OR target_market IN (SELECT public.get_user_market_codes())
  );

DROP POLICY IF EXISTS "alerts_insert" ON public.alerts;
CREATE POLICY "alerts_insert" ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

DROP POLICY IF EXISTS "alerts_update" ON public.alerts;
CREATE POLICY "alerts_update" ON public.alerts
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
    OR (
      public.get_user_role() = 'AlertHandler'
      AND target_market IN (SELECT public.get_user_market_codes())
    )
  );

-- BULK_OPERATIONS policies
DROP POLICY IF EXISTS "bulk_ops_select" ON public.bulk_operations;
CREATE POLICY "bulk_ops_select" ON public.bulk_operations
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
  );

DROP POLICY IF EXISTS "bulk_ops_insert" ON public.bulk_operations;
CREATE POLICY "bulk_ops_insert" ON public.bulk_operations
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "bulk_ops_update" ON public.bulk_operations;
CREATE POLICY "bulk_ops_update" ON public.bulk_operations
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

-- APP_SETTINGS policies
DROP POLICY IF EXISTS "settings_select" ON public.app_settings;
CREATE POLICY "settings_select" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "settings_update" ON public.app_settings;
CREATE POLICY "settings_update" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================
-- DONE! All tables, indexes, functions, triggers,
-- RLS policies, and seed data created.
-- ============================================
