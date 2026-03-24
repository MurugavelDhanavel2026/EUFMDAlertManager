-- Create bulk_operations table for supervisor approval flow
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
