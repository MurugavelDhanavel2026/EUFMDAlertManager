-- Create app_settings table for SMTP, UiPath, and DB configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('smtp_config', '{"host": "", "port": 587, "user": "", "password": "", "from_email": ""}'),
  ('uipath_fetch_alerts', '{"endpoint": "", "api_key": "", "enabled": false}'),
  ('uipath_root_cause', '{"endpoint": "", "api_key": "", "enabled": false}'),
  ('db_config', '{"supabase_url": "", "supabase_anon_key": ""}')
ON CONFLICT (key) DO NOTHING;
