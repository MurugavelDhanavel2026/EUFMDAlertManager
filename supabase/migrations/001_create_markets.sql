-- Create markets table
CREATE TABLE IF NOT EXISTS public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name TEXT NOT NULL,
  market_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default markets
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
