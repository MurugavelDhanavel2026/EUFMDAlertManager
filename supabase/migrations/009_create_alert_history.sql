-- Alert history: immutable audit log for events that happen to an alert.
-- Cascade delete from alerts so removing an alert wipes its history.
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  performed_by UUID REFERENCES public.user_profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON public.alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_performed_at ON public.alert_history(performed_at DESC);

-- Trigger function that logs row-level changes on the alerts table.
-- SECURITY DEFINER so the INSERT into alert_history is not blocked by RLS.
CREATE OR REPLACE FUNCTION public.log_alert_history()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.alert_history (alert_id, event_type, event_data, performed_by)
    VALUES (
      NEW.id,
      'created',
      jsonb_build_object(
        'alert_id', NEW.alert_id,
        'target_market', NEW.target_market,
        'status', NEW.status
      ),
      v_user_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.alert_history (alert_id, event_type, event_data, performed_by)
      VALUES (
        NEW.id,
        'status_changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status),
        v_user_id
      );
    END IF;

    IF NEW.root_cause IS DISTINCT FROM OLD.root_cause THEN
      INSERT INTO public.alert_history (alert_id, event_type, event_data, performed_by)
      VALUES (
        NEW.id,
        'root_cause_updated',
        jsonb_build_object('from', OLD.root_cause, 'to', NEW.root_cause),
        v_user_id
      );
    END IF;

    IF NEW.assigned_user IS DISTINCT FROM OLD.assigned_user THEN
      INSERT INTO public.alert_history (alert_id, event_type, event_data, performed_by)
      VALUES (
        NEW.id,
        'user_assigned',
        jsonb_build_object('from', OLD.assigned_user, 'to', NEW.assigned_user),
        v_user_id
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS alerts_history_log ON public.alerts;
CREATE TRIGGER alerts_history_log
  AFTER INSERT OR UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.log_alert_history();

-- RLS: mirror the alerts visibility rules.
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

-- Read: supervisor / admin see everything; AlertHandler sees only history
-- belonging to alerts in their assigned markets.
CREATE POLICY "alert_history_select" ON public.alert_history
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
    OR alert_id IN (
      SELECT id FROM public.alerts
      WHERE target_market IN (SELECT public.get_user_market_codes())
    )
  );

-- Write: same conditions as update on the parent alert. Trigger inserts
-- bypass this via SECURITY DEFINER; app-side inserts (NMVS sent, master
-- data triggered) flow through and respect RLS.
CREATE POLICY "alert_history_insert" ON public.alert_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('AlertHandler_supervisor', 'admin')
    OR alert_id IN (
      SELECT id FROM public.alerts
      WHERE target_market IN (SELECT public.get_user_market_codes())
    )
  );

-- No UPDATE or DELETE policy — history is immutable from the app side.
-- Deletes only happen via ON DELETE CASCADE from the parent alert.
