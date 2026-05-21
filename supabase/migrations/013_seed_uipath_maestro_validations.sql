-- Configuration for the "Retrigger all validations" action, which starts a
-- UiPath Maestro workflow via an API Trigger. The Admin page saves settings
-- with UPDATE (by key), so the row must already exist — seed it here.
INSERT INTO public.app_settings (key, value) VALUES
  ('uipath_maestro_validations', '{"invoke_url": "", "personal_access_token": "", "enabled": false}')
ON CONFLICT (key) DO NOTHING;
