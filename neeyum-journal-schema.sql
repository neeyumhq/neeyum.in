-- ════════════════════════════════════════════════════════════════════════════
-- NEEYUM JOURNAL — Database Schema
-- Run this in Supabase SQL Editor (safe to re-run; uses IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Profiles (extends the existing profiles table if present) ──────────────
CREATE TABLE IF NOT EXISTS public.nj_profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name  TEXT,
  username      TEXT UNIQUE,
  country       TEXT DEFAULT 'IN',          -- ISO country code
  avatar_seed   TEXT,                        -- for generated avatar colors
  avatar_url    TEXT,                        -- uploaded profile picture
  primary_asset TEXT,                        -- main asset class focus
  onboarded     BOOLEAN DEFAULT false,       -- has completed first-run setup
  plan          TEXT NOT NULL DEFAULT 'free', -- free | pro | elite
  plan_expires  TIMESTAMPTZ,
  public_profile BOOLEAN DEFAULT true,        -- opt-in to leaderboard
  base_currency TEXT DEFAULT 'INR',           -- INR | USD
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- If table already existed, add the new columns
ALTER TABLE public.nj_profiles ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE public.nj_profiles ADD COLUMN IF NOT EXISTS primary_asset TEXT;
ALTER TABLE public.nj_profiles ADD COLUMN IF NOT EXISTS onboarded     BOOLEAN DEFAULT false;

-- ── Trades (the heart of the journal) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nj_trades (
  id              TEXT PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Classification
  asset_class     TEXT NOT NULL,    -- in_fno | in_eq | us_stock | us_option | crypto | futures | forex
  symbol          TEXT NOT NULL,
  side            TEXT NOT NULL,    -- long | short

  -- Asset-specific (nullable, only some apply per class)
  strike          NUMERIC(14,2),
  expiry          DATE,
  option_type     TEXT,             -- CE | PE | CALL | PUT
  leverage        NUMERIC(8,2),

  -- Core trade data
  qty             NUMERIC(18,8) NOT NULL,
  entry_price     NUMERIC(18,8) NOT NULL,
  exit_price      NUMERIC(18,8),
  sl              NUMERIC(18,8),
  target          NUMERIC(18,8),

  -- Times
  entry_time      TIMESTAMPTZ NOT NULL,
  exit_time       TIMESTAMPTZ,
  trade_date      DATE NOT NULL,

  -- Computed/stored P&L
  pnl             NUMERIC(18,2) DEFAULT 0,
  pnl_pct         NUMERIC(10,2) DEFAULT 0,
  rr              NUMERIC(8,2),               -- realized R-multiple
  planned_rr      NUMERIC(8,2),               -- from SL/target at entry
  currency        TEXT DEFAULT 'INR',
  is_closed       BOOLEAN DEFAULT true,

  -- Behaviour / journal
  setup           TEXT,
  emotion_entry   TEXT,
  emotion_exit    TEXT,
  confidence      INTEGER,                    -- 1-10
  followed_plan   BOOLEAN,
  grade           TEXT,                       -- A+ | A | B | C | D
  mistakes        TEXT[],
  lesson          TEXT,
  thesis          TEXT,                       -- pre-trade plan
  invalidation    TEXT,
  screenshot_url  TEXT,
  tags            TEXT[],

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nj_trades_user_date  ON public.nj_trades(user_id, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_nj_trades_user_asset ON public.nj_trades(user_id, asset_class);
CREATE INDEX IF NOT EXISTS idx_nj_trades_setup      ON public.nj_trades(user_id, setup);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.nj_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nj_trades   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_nj_profile" ON public.nj_profiles;
CREATE POLICY "own_nj_profile" ON public.nj_profiles
  FOR ALL USING (auth.uid() = id);

-- profiles readable by anyone for leaderboard display (only safe columns via view)
DROP POLICY IF EXISTS "read_public_nj_profile" ON public.nj_profiles;
CREATE POLICY "read_public_nj_profile" ON public.nj_profiles
  FOR SELECT USING (public_profile = true);

DROP POLICY IF EXISTS "own_nj_trades" ON public.nj_trades;
CREATE POLICY "own_nj_trades" ON public.nj_trades
  FOR ALL USING (auth.uid() = user_id);

-- ── Auto-create profile on signup ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_nj_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.nj_profiles (id, display_name, username, avatar_seed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    LOWER(split_part(NEW.email, '@', 1)) || '_' || substr(NEW.id::text, 1, 4),
    substr(NEW.id::text, 1, 8)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_nj ON auth.users;
CREATE TRIGGER on_auth_user_created_nj
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_nj_new_user();

-- ════════════════════════════════════════════════════════════════════════════
-- LEADERBOARD — behaviour score (NOT pnl-based) + pnl% leaderboard
-- Filterable by country and asset_class
-- ════════════════════════════════════════════════════════════════════════════

-- Per-user, per-asset-class aggregate stats (recomputed via view)
CREATE OR REPLACE VIEW public.nj_user_asset_stats AS
SELECT
  t.user_id,
  t.asset_class,
  p.display_name,
  p.username,
  p.country,
  p.avatar_seed,
  p.public_profile,
  COUNT(*)                                          AS total_trades,
  COUNT(*) FILTER (WHERE t.pnl >= 0)                AS wins,
  COUNT(*) FILTER (WHERE t.pnl < 0)                 AS losses,
  ROUND(COALESCE(SUM(t.pnl), 0)::numeric, 2)        AS total_pnl,
  ROUND(COALESCE(AVG(t.pnl_pct), 0)::numeric, 2)    AS avg_pnl_pct,
  ROUND(COALESCE(AVG(t.rr), 0)::numeric, 2)         AS avg_rr,
  ROUND(
    CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE t.pnl >= 0)::numeric / COUNT(*)::numeric) * 100
      ELSE 0 END, 1)                                AS win_rate,
  -- Behaviour components
  ROUND(
    (
      (COUNT(*) FILTER (WHERE t.setup IS NOT NULL AND t.setup != ''))::numeric +
      (COUNT(*) FILTER (WHERE t.emotion_entry IS NOT NULL AND t.emotion_entry != ''))::numeric +
      (COUNT(*) FILTER (WHERE t.lesson IS NOT NULL AND t.lesson != ''))::numeric +
      (COUNT(*) FILTER (WHERE t.grade IS NOT NULL AND t.grade != ''))::numeric
    ) / NULLIF(COUNT(*) * 4, 0) * 35, 1)            AS journal_score,
  ROUND(
    (COUNT(*) FILTER (WHERE t.grade IN ('A+','A','B')))::numeric
    / NULLIF(COUNT(*) FILTER (WHERE t.grade IS NOT NULL AND t.grade != ''), 0) * 25, 1)
                                                    AS grade_score,
  ROUND(LEAST(15,
    (COUNT(*) FILTER (WHERE t.followed_plan = true))::numeric
    / NULLIF(COUNT(*), 0) * 15), 1)                 AS plan_score,
  ROUND(LEAST(25, GREATEST(0,
    25 - (COALESCE(STDDEV(t.pnl), 0) / NULLIF(ABS(AVG(t.pnl)), 0)) * 4)), 1)
                                                    AS risk_score
FROM public.nj_trades t
JOIN public.nj_profiles p ON p.id = t.user_id
WHERE t.is_closed = true
GROUP BY t.user_id, t.asset_class, p.display_name, p.username, p.country, p.avatar_seed, p.public_profile
HAVING COUNT(*) >= 3;

-- Composite leaderboard (behaviour + pnl) — filter client-side by country/asset
CREATE OR REPLACE VIEW public.nj_leaderboard AS
SELECT
  s.user_id,
  s.asset_class,
  s.display_name,
  s.username,
  s.country,
  s.avatar_seed,
  s.total_trades,
  s.wins, s.losses, s.win_rate,
  s.total_pnl,
  s.avg_pnl_pct,
  s.avg_rr,
  s.journal_score,
  s.grade_score,
  s.plan_score,
  s.risk_score,
  ROUND(
    COALESCE(s.journal_score,0) + COALESCE(s.grade_score,0)
    + COALESCE(s.plan_score,0) + COALESCE(s.risk_score,0), 1
  ) AS behaviour_score
FROM public.nj_user_asset_stats s
WHERE s.public_profile = true;

-- "All assets" combined leaderboard per user (sums across asset classes)
CREATE OR REPLACE VIEW public.nj_leaderboard_global AS
SELECT
  t.user_id,
  p.display_name,
  p.username,
  p.country,
  p.avatar_seed,
  COUNT(*) AS total_trades,
  COUNT(*) FILTER (WHERE t.pnl >= 0) AS wins,
  COUNT(*) FILTER (WHERE t.pnl < 0)  AS losses,
  ROUND(CASE WHEN COUNT(*)>0 THEN (COUNT(*) FILTER (WHERE t.pnl>=0)::numeric/COUNT(*)::numeric)*100 ELSE 0 END,1) AS win_rate,
  ROUND(COALESCE(SUM(t.pnl),0)::numeric,2) AS total_pnl,
  ROUND(COALESCE(AVG(t.pnl_pct),0)::numeric,2) AS avg_pnl_pct,
  ROUND(COALESCE(AVG(t.rr),0)::numeric,2) AS avg_rr,
  ROUND(
    (((COUNT(*) FILTER (WHERE t.setup IS NOT NULL AND t.setup!=''))::numeric +
      (COUNT(*) FILTER (WHERE t.emotion_entry IS NOT NULL AND t.emotion_entry!=''))::numeric +
      (COUNT(*) FILTER (WHERE t.lesson IS NOT NULL AND t.lesson!=''))::numeric +
      (COUNT(*) FILTER (WHERE t.grade IS NOT NULL AND t.grade!=''))::numeric)
      / NULLIF(COUNT(*)*4,0) * 35)
    + LEAST(25, (COUNT(*) FILTER (WHERE t.grade IN ('A+','A','B')))::numeric
        / NULLIF(COUNT(*) FILTER (WHERE t.grade IS NOT NULL AND t.grade!=''),0) * 25)
    + LEAST(15, (COUNT(*) FILTER (WHERE t.followed_plan=true))::numeric/NULLIF(COUNT(*),0)*15)
    + LEAST(25, GREATEST(0, 25 - (COALESCE(STDDEV(t.pnl),0)/NULLIF(ABS(AVG(t.pnl)),0))*4))
  ,1) AS behaviour_score
FROM public.nj_trades t
JOIN public.nj_profiles p ON p.id = t.user_id
WHERE t.is_closed = true AND p.public_profile = true
GROUP BY t.user_id, p.display_name, p.username, p.country, p.avatar_seed
HAVING COUNT(*) >= 3;

GRANT SELECT ON public.nj_leaderboard        TO anon, authenticated;
GRANT SELECT ON public.nj_leaderboard_global TO anon, authenticated;
GRANT SELECT ON public.nj_user_asset_stats   TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- AVATAR STORAGE — public bucket for profile pictures
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view avatars (public bucket)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Users can upload/update/delete only their own avatar (path starts with their uid)
DROP POLICY IF EXISTS "avatars_own_write" ON storage.objects;
CREATE POLICY "avatars_own_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_own_update" ON storage.objects;
CREATE POLICY "avatars_own_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_own_delete" ON storage.objects;
CREATE POLICY "avatars_own_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
