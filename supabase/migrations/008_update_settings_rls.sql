-- Allow all authenticated users to read email_template and graph_api_config
-- (needed for NMVS email sending from Alerts page)
DROP POLICY IF EXISTS "settings_select" ON public.app_settings;
CREATE POLICY "settings_select" ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR key IN ('email_template', 'graph_api_config')
  );
