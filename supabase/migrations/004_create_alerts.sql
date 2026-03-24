-- Create alerts table
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

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_target_market ON public.alerts(target_market);
CREATE INDEX IF NOT EXISTS idx_alerts_gtin ON public.alerts(gtin);
CREATE INDEX IF NOT EXISTS idx_alerts_assigned_user ON public.alerts(assigned_user);
CREATE INDEX IF NOT EXISTS idx_alerts_batch_name ON public.alerts(batch_name);
CREATE INDEX IF NOT EXISTS idx_alerts_created_on ON public.alerts(created_on);

-- Auto-update changed_on timestamp on UPDATE
CREATE OR REPLACE FUNCTION update_changed_on()
RETURNS TRIGGER AS $$
BEGIN
  NEW.changed_on = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_changed_on
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION update_changed_on();

-- Enable realtime for alerts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
