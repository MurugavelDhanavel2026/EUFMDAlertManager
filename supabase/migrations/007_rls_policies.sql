-- Enable Row Level Security on all tables
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's assigned market codes
CREATE OR REPLACE FUNCTION public.get_user_market_codes()
RETURNS SETOF TEXT AS $$
  SELECT m.market_code
  FROM public.user_markets um
  JOIN public.markets m ON m.id = um.market_id
  WHERE um.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- MARKETS policies
-- ==========================================
CREATE POLICY "markets_select" ON public.markets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "markets_insert" ON public.markets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "markets_update" ON public.markets
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "markets_delete" ON public.markets
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ==========================================
-- USER_PROFILES policies
-- ==========================================
CREATE POLICY "profiles_select" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
  );

CREATE POLICY "profiles_insert" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

CREATE POLICY "profiles_update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

CREATE POLICY "profiles_delete" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ==========================================
-- USER_MARKETS policies
-- ==========================================
CREATE POLICY "user_markets_select" ON public.user_markets
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
  );

CREATE POLICY "user_markets_insert" ON public.user_markets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

CREATE POLICY "user_markets_update" ON public.user_markets
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

CREATE POLICY "user_markets_delete" ON public.user_markets
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

-- ==========================================
-- ALERTS policies
-- ==========================================
CREATE POLICY "alerts_select" ON public.alerts
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
    OR target_market IN (SELECT public.get_user_market_codes())
  );

CREATE POLICY "alerts_insert" ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

CREATE POLICY "alerts_update" ON public.alerts
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
    OR (
      public.get_user_role() = 'AlertHandler'
      AND target_market IN (SELECT public.get_user_market_codes())
    )
  );

-- ==========================================
-- BULK_OPERATIONS policies
-- ==========================================
CREATE POLICY "bulk_ops_select" ON public.bulk_operations
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
  );

CREATE POLICY "bulk_ops_insert" ON public.bulk_operations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "bulk_ops_update" ON public.bulk_operations
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('AlertHandler_supervisor', 'admin'));

-- ==========================================
-- APP_SETTINGS policies
-- ==========================================
CREATE POLICY "settings_select" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "settings_update" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin');
