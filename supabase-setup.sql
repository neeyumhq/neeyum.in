-- ══════════════════════════════════════════════════════════════════════════════
-- NIYAM TRADEOS — SUPABASE DATABASE SETUP
-- Copy this entire file and paste into Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. USER PROFILES (extends Supabase auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name     TEXT,
  plan          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  plan_expires  TIMESTAMPTZ,
  razorpay_id   TEXT,                          -- Razorpay customer ID
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BROKER CONNECTIONS (encrypted tokens)
CREATE TABLE IF NOT EXISTS public.broker_connections (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  broker        TEXT NOT NULL DEFAULT 'dhan',
  client_id     TEXT NOT NULL,
  access_token  TEXT NOT NULL,                 -- AES-256 encrypted
  is_active     BOOLEAN DEFAULT true,
  connected_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker)
);

-- 3. JOURNALS (cloud-synced per user)
CREATE TABLE IF NOT EXISTS public.journals (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_symbol  TEXT,
  trade_date    DATE,
  setup         TEXT,
  outcome       TEXT,
  emotion       TEXT,
  confidence    INTEGER,
  satisfaction  INTEGER,
  exit_type     TEXT,
  hold_time     INTEGER,
  grade         TEXT,
  lesson        TEXT,
  mistakes      TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PAYMENTS LOG
CREATE TABLE IF NOT EXISTS public.payments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT,
  amount              INTEGER,                 -- in paise
  plan                TEXT,
  status              TEXT DEFAULT 'pending',  -- 'pending' | 'paid' | 'failed'
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (each user sees ONLY their own data)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;

-- Profiles: user can read/update only their own
CREATE POLICY "own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Broker: user can read/write only their own
CREATE POLICY "own broker" ON public.broker_connections
  FOR ALL USING (auth.uid() = user_id);

-- Journals: user can read/write only their own
CREATE POLICY "own journals" ON public.journals
  FOR ALL USING (auth.uid() = user_id);

-- Payments: user can read only their own
CREATE POLICY "own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGNUP
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════════════════════════════════════
-- UPGRADE USER PLAN (called by payment function)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.upgrade_user_plan(
  p_user_id UUID,
  p_plan TEXT,
  p_months INTEGER DEFAULT 1
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    plan = p_plan,
    plan_expires = CASE
      WHEN plan_expires > NOW() THEN plan_expires + (p_months || ' months')::INTERVAL
      ELSE NOW() + (p_months || ' months')::INTERVAL
    END
  WHERE id = p_user_id;
END;
$$;

-- Done! Your database is ready.
