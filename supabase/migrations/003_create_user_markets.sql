-- Create user_markets junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.user_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  UNIQUE(user_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_user_markets_user ON public.user_markets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_markets_market ON public.user_markets(market_id);
