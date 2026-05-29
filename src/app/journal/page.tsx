"use client";
export const dynamic = "force-dynamic";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import {
  Trade, AssetClass, ASSET_CLASSES, assetCfg, SETUPS, EMOTIONS, MISTAKES, COUNTRIES,
  computePnl, computePnlPct, computeRR, fmtMoney, fmtMoneyFull, behaviourScore, autoGrade,
} from "@/lib/journal";

// ── Supabase (safe lazy init) ───────────────────────────────────────────────
function makeSb(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try { return createClient(url, key); } catch { return null; }
}

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg: "#050610", bg2: "#08091a", panel: "rgba(255,255,255,0.025)",
  panelB: "rgba(255,255,255,0.05)", brd: "rgba(255,255,255,0.06)", brd2: "rgba(255,255,255,0.12)",
  tp: "#E8E9ED", ts: "#6b7280", tm: "#9ca3af",
  pur: "#7c5cfc", purD: "#4f46e5", purL: "#c4b5fd",
  grn: "#10b981", grnL: "#6ee7b7", red: "#ef4444", redL: "#fca5a5",
  amb: "#f59e0b", ambL: "#fcd34d", blu: "#3b82f6", bluL: "#93c5fd",
  gold: "#fbbf24", pink: "#ec4899",
};

type Screen = "dashboard" | "trades" | "analytics" | "calendar" | "leaderboard" | "settings";

interface Profile {
  display_name: string;
  username: string;
  country: string;
  avatar_url: string;
  primary_asset: string;
  public_profile: boolean;
  onboarded: boolean;
  plan: string;
}

// helper for db row → Trade
function rowToTrade(r: Record<string, unknown>): Trade {
  return {
    id: r.id as string,
    asset_class: (r.asset_class as AssetClass) || "in_fno",
    symbol: (r.symbol as string) || "",
    side: (r.side as "long" | "short") || "long",
    strike: r.strike ? Number(r.strike) : undefined,
    expiry: (r.expiry as string) || undefined,
    option_type: (r.option_type as string) || undefined,
    leverage: r.leverage ? Number(r.leverage) : undefined,
    qty: Number(r.qty) || 0,
    entry_price: Number(r.entry_price) || 0,
    exit_price: Number(r.exit_price) || 0,
    sl: r.sl ? Number(r.sl) : undefined,
    target: r.target ? Number(r.target) : undefined,
    entry_time: (r.entry_time as string) || "",
    exit_time: (r.exit_time as string) || undefined,
    trade_date: (r.trade_date as string) || "",
    pnl: Number(r.pnl) || 0,
    pnl_pct: Number(r.pnl_pct) || 0,
    rr: r.rr != null ? Number(r.rr) : undefined,
    planned_rr: r.planned_rr != null ? Number(r.planned_rr) : undefined,
    currency: (r.currency as string) || "INR",
    is_closed: (r.is_closed as boolean) ?? true,
    setup: (r.setup as string) || undefined,
    emotion_entry: (r.emotion_entry as string) || undefined,
    emotion_exit: (r.emotion_exit as string) || undefined,
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    followed_plan: (r.followed_plan as boolean) ?? undefined,
    grade: (r.grade as string) || undefined,
    mistakes: (r.mistakes as string[]) || [],
    lesson: (r.lesson as string) || undefined,
    thesis: (r.thesis as string) || undefined,
    invalidation: (r.invalidation as string) || undefined,
    screenshot_url: (r.screenshot_url as string) || undefined,
    tags: (r.tags as string[]) || [],
  };
}

function tradeToRow(t: Trade, userId: string): Record<string, unknown> {
  return {
    id: t.id, user_id: userId, asset_class: t.asset_class, symbol: t.symbol, side: t.side,
    strike: t.strike ?? null, expiry: t.expiry || null, option_type: t.option_type || null,
    leverage: t.leverage ?? null, qty: t.qty, entry_price: t.entry_price, exit_price: t.exit_price ?? null,
    sl: t.sl ?? null, target: t.target ?? null, entry_time: t.entry_time, exit_time: t.exit_time || null,
    trade_date: t.trade_date, pnl: t.pnl, pnl_pct: t.pnl_pct, rr: t.rr ?? null, planned_rr: t.planned_rr ?? null,
    currency: t.currency, is_closed: t.is_closed, setup: t.setup || null, emotion_entry: t.emotion_entry || null,
    emotion_exit: t.emotion_exit || null, confidence: t.confidence ?? null, followed_plan: t.followed_plan ?? null,
    grade: t.grade || null, mistakes: t.mistakes?.length ? t.mistakes : null, lesson: t.lesson || null,
    thesis: t.thesis || null, invalidation: t.invalidation || null, screenshot_url: t.screenshot_url || null,
    tags: t.tags?.length ? t.tags : null, updated_at: new Date().toISOString(),
  };
}

export default function NeeyumJournal() {
  const sb = useMemo(() => makeSb(), []);
  const [authState, setAuthState] = useState<"loading" | "auth" | "app">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [name, setName] = useState("");
  const [authErr, setAuthErr] = useState(""); const [authLoad, setAuthLoad] = useState(false); const [cfgErr, setCfgErr] = useState("");

  const [scr, setScr] = useState<Screen>("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetClass | "all">("all");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);

  // Auth
  useEffect(() => {
    if (!sb) { setCfgErr("Supabase not configured. Set env vars and redeploy."); setAuthState("auth"); return; }
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) { setUser(data.session.user); setAuthState("app"); }
      else setAuthState("auth");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_, s) => {
      if (s?.user) { setUser(s.user); setAuthState("app"); }
      else { setUser(null); setAuthState("auth"); }
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  // Load trades + profile
  useEffect(() => {
    if (!sb || !user) return;
    (async () => {
      try {
        const { data } = await sb.from("nj_trades").select("*").eq("user_id", user.id).order("trade_date", { ascending: false });
        if (data && data.length > 0) {
          setTrades(data.map(rowToTrade));
        } else {
          // DB empty — try localStorage backup so user doesn't lose unsaved trades
          try {
            const backup = localStorage.getItem("nj_trades_backup");
            if (backup) {
              const parsed = JSON.parse(backup) as Trade[];
              if (Array.isArray(parsed) && parsed.length > 0) setTrades(parsed);
            }
          } catch {}
        }
        const { data: prof } = await sb.from("nj_profiles").select("display_name,username,country,avatar_url,primary_asset,public_profile,onboarded,plan").eq("id", user.id).single();
        if (prof) {
          const pr = prof as Profile;
          setProfile(pr);
          if (!pr.onboarded) setShowOnboard(true);
        } else {
          // No profile row yet — show onboarding
          setShowOnboard(true);
        }
      } catch (e) { console.error(e); }
    })();
  }, [sb, user]);

  const [saveError, setSaveError] = useState<string>("");

  const saveTrade = useCallback(async (t: Trade) => {
    setTrades(prev => {
      const exists = prev.find(x => x.id === t.id);
      const next = exists ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev];
      try { localStorage.setItem("nj_trades_backup", JSON.stringify(next)); } catch {}
      return next;
    });
    if (sb && user) {
      const { error } = await sb.from("nj_trades").upsert(tradeToRow(t, user.id), { onConflict: "id" });
      if (error) {
        console.error("[NJ] save error:", error);
        setSaveError(`Database save failed: ${error.message}. Trade kept locally — please re-run the SQL schema in Supabase.`);
        setTimeout(() => setSaveError(""), 8000);
      } else {
        setSaveError("");
      }
    }
  }, [sb, user]);

  const removeTrade = useCallback(async (id: string) => {
    setTrades(prev => {
      const next = prev.filter(t => t.id !== id);
      try { localStorage.setItem("nj_trades_backup", JSON.stringify(next)); } catch {}
      return next;
    });
    if (sb && user) await sb.from("nj_trades").delete().eq("id", id).eq("user_id", user.id);
  }, [sb, user]);

  const doGoogle = async () => {
    if (!sb) return;
    setAuthLoad(true);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/journal` } });
    if (error) { setAuthErr(error.message); setAuthLoad(false); }
  };
  const doEmail = async () => {
    if (!sb) { setAuthErr("Not configured"); return; }
    setAuthLoad(true); setAuthErr("");
    if (authMode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) setAuthErr(error.message);
    } else {
      const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
      if (error) setAuthErr(error.message);
      else setAuthErr("Check your email to confirm, then log in.");
    }
    setAuthLoad(false);
  };

  // Filtered trades
  const fTrades = useMemo(() =>
    assetFilter === "all" ? trades : trades.filter(t => t.asset_class === assetFilter),
    [trades, assetFilter]);
  const closed = useMemo(() => fTrades.filter(t => t.is_closed), [fTrades]);

  // ═══════════════ AUTH SCREEN ═══════════════
  if (authState === "loading") return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.ts }}>Loading…</div>
  );

  if (authState === "auth") return <AuthScreen {...{ C, authMode, setAuthMode, email, setEmail, pass, setPass, name, setName, authErr, authLoad, cfgErr, doGoogle, doEmail }} />;

  // ═══════════════ MAIN APP ═══════════════
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.tp, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        .nj-shell { max-width: 480px; margin: 0 auto; }
        @media (min-width: 768px) { .nj-shell { max-width: 760px; } }
        @media (min-width: 1100px) { .nj-shell { max-width: 1080px; } }
        .nj-bottomnav { max-width: 480px; }
        @media (min-width: 768px) { .nj-bottomnav { max-width: 760px; } }
        @media (min-width: 1100px) { .nj-bottomnav { max-width: 1080px; } }
        .nj-grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 900px) { .nj-grid2 { grid-template-columns: 2fr 1fr; } }
        .nj-stat4 { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
        @media (min-width: 768px) { .nj-stat4 { grid-template-columns: repeat(4,1fr); } }
        input,select,textarea { font-family: inherit; }
        ::-webkit-scrollbar { height: 0; width: 0; }
        @keyframes njspin { to { transform: rotate(360deg); } }
      `}</style>

      <TopBar {...{ C, user, scr, setScr, avatarUrl: profile?.avatar_url }} />

      {saveError && (
        <div className="nj-shell" style={{ padding: "10px 14px 0" }}>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 12, lineHeight: 1.5 }}>
            ⚠ {saveError}
          </div>
        </div>
      )}

      <div className="nj-shell" style={{ padding: "16px 14px 100px" }}>
        {scr === "dashboard" && <Dashboard {...{ C, trades: fTrades, closed, assetFilter, setAssetFilter, setShowAdd, setEditTrade, profile }} />}
        {scr === "trades" && <TradesList {...{ C, trades: fTrades, assetFilter, setAssetFilter, setShowAdd, setEditTrade, removeTrade }} />}
        {scr === "analytics" && <Analytics {...{ C, closed }} />}
        {scr === "calendar" && <CalendarView {...{ C, closed }} />}
        {scr === "leaderboard" && <Leaderboard {...{ C, sb, user, profile }} />}
        {scr === "settings" && <Settings {...{ C, sb, user, profile, setProfile, trades }} />}
      </div>

      {(showAdd || editTrade) && (
        <TradeModal {...{ C, onClose: () => { setShowAdd(false); setEditTrade(null); }, onSave: (t: Trade) => { saveTrade(t); setShowAdd(false); setEditTrade(null); }, editTrade }} />
      )}

      {showOnboard && (
        <OnboardModal {...{ C, sb, user, profile, onDone: (pr: Profile) => { setProfile(pr); setShowOnboard(false); } }} />
      )}

      <BottomNav {...{ C, scr, setScr, setShowAdd }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════
// ── Auth Screen ─────────────────────────────────────────────────────────────
function AuthScreen(p: {
  C: Record<string, string>; authMode: "login" | "signup"; setAuthMode: (m: "login" | "signup") => void;
  email: string; setEmail: (s: string) => void; pass: string; setPass: (s: string) => void;
  name: string; setName: (s: string) => void; authErr: string; authLoad: boolean; cfgErr: string;
  doGoogle: () => void; doEmail: () => void;
}) {
  const { C } = p;
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${C.pur},${C.blu})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 auto 14px" }}>N</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.tp }}>Neeyum Journal</div>
          <div style={{ fontSize: 13, color: C.ts, marginTop: 4 }}>{p.authMode === "login" ? "Welcome back, trader" : "Start your trading edge"}</div>
        </div>
        {p.cfgErr && <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "10px 14px", color: C.ambL, fontSize: 12, marginBottom: 12 }}>⚠ {p.cfgErr}</div>}
        {p.authErr && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 13, marginBottom: 12 }}>{p.authErr}</div>}

        <button onClick={p.doGoogle} disabled={p.authLoad} style={{ width: "100%", padding: 13, background: "#fff", border: "none", borderRadius: 14, color: "#1a1a1a", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 009 18z" fill="#34A853"/><path d="M3.96 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 00.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
          <div style={{ flex: 1, height: 1, background: C.brd2 }} /><span style={{ fontSize: 10, color: C.ts }}>OR</span><div style={{ flex: 1, height: 1, background: C.brd2 }} />
        </div>

        {p.authMode === "signup" && (
          <div style={{ marginBottom: 12 }}>
            <input value={p.name} onChange={e => p.setName(e.target.value)} placeholder="Your name" style={authInput(C)} />
          </div>
        )}
        <input value={p.email} onChange={e => p.setEmail(e.target.value)} placeholder="you@email.com" style={{ ...authInput(C), marginBottom: 12 }} />
        <input type="password" value={p.pass} onChange={e => p.setPass(e.target.value)} placeholder="Min 6 characters" style={{ ...authInput(C), marginBottom: 16 }} />
        <button onClick={p.doEmail} disabled={p.authLoad} style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {p.authLoad ? "Please wait…" : p.authMode === "login" ? "Login →" : "Create Account →"}
        </button>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.ts }}>
          {p.authMode === "login" ? "No account? " : "Have account? "}
          <button onClick={() => { p.setAuthMode(p.authMode === "login" ? "signup" : "login"); }} style={{ background: "none", border: "none", color: C.purL, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {p.authMode === "login" ? "Sign Up" : "Login"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ color: C.ts, fontSize: 12, textDecoration: "none" }}>← Back to Neeyum.in</a>
        </div>
      </div>
    </div>
  );
}
function authInput(C: Record<string, string>): React.CSSProperties {
  return { width: "100%", background: C.panel, border: `1px solid ${C.brd2}`, borderRadius: 12, color: C.tp, padding: "13px 15px", fontSize: 14, outline: "none", boxSizing: "border-box" };
}

// ── Top Bar ───────────────────────────────────────────────────────────────
function TopBar(p: { C: Record<string, string>; user: User | null; scr: string; setScr: (s: Screen) => void; avatarUrl?: string }) {
  const { C } = p;
  const titles: Record<string, string> = { dashboard: "Dashboard", trades: "Trades", analytics: "Analytics", calendar: "Calendar", leaderboard: "Leaderboard", settings: "Settings" };
  return (
    <div style={{ borderBottom: `1px solid ${C.brd}`, background: C.bg2 }}>
      <div className="nj-shell" style={{ padding: "14px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${C.pur},${C.blu})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 16, textDecoration: "none", flexShrink: 0 }}>N</a>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: C.ts, letterSpacing: "0.15em" }}>NEEYUM JOURNAL</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{titles[p.scr] || "Journal"}</div>
        </div>
        <button onClick={() => p.setScr("settings")} aria-label="Settings" style={{ width: 36, height: 36, borderRadius: "50%", border: p.scr === "settings" ? `2px solid ${C.purL}` : "2px solid transparent", padding: 0, cursor: "pointer", background: "transparent", flexShrink: 0, overflow: "hidden" }}>
          {p.avatarUrl
            ? <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `linear-gradient(135deg,${C.amb},${C.pink})` }} title={p.user?.email || ""} />}
        </button>
      </div>
    </div>
  );
}

// ── Bottom Nav ──────────────────────────────────────────────────────────────
function BottomNav(p: { C: Record<string, string>; scr: string; setScr: (s: Screen) => void; setShowAdd: (b: boolean) => void }) {
  const { C } = p;
  const items: [Screen, string, string][] = [
    ["dashboard", "⬡", "Home"], ["trades", "≡", "Trades"], ["analytics", "◈", "Stats"], ["calendar", "▦", "Calendar"],
  ];
  return (
    <div className="nj-bottomnav" style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", background: "rgba(8,9,26,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.brd2}`, display: "flex", zIndex: 90, padding: "10px 0 16px", alignItems: "center" }}>
      {items.slice(0, 2).map(([id, ic, lb]) => <NavBtn key={id} {...{ C, id, ic, lb, active: p.scr === id, onClick: () => p.setScr(id) }} />)}
      <button onClick={() => p.setShowAdd(true)} style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", color: "#fff", fontSize: 26, cursor: "pointer", flexShrink: 0, margin: "0 8px", boxShadow: `0 6px 20px ${C.pur}66`, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>+</button>
      {items.slice(2, 4).map(([id, ic, lb]) => <NavBtn key={id} {...{ C, id, ic, lb, active: p.scr === id, onClick: () => p.setScr(id) }} />)}
      <NavBtn {...{ C, id: "leaderboard" as Screen, ic: "🏆", lb: "Ranks", active: p.scr === "leaderboard", onClick: () => p.setScr("leaderboard") }} />
    </div>
  );
}
function NavBtn(p: { C: Record<string, string>; id: string; ic: string; lb: string; active: boolean; onClick: () => void }) {
  const { C } = p;
  return (
    <button onClick={p.onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: p.active ? C.purL : C.ts, padding: "4px 2px", fontSize: 9, fontWeight: 600 }}>
      <span style={{ fontSize: 17 }}>{p.ic}</span>{p.lb}
    </button>
  );
}

// ── Asset Filter Pills ──────────────────────────────────────────────────────
function AssetPills(p: { C: Record<string, string>; value: AssetClass | "all"; onChange: (v: AssetClass | "all") => void }) {
  const { C } = p;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
      <Pill C={C} active={p.value === "all"} onClick={() => p.onChange("all")}>All Assets</Pill>
      {ASSET_CLASSES.map(a => <Pill key={a.key} C={C} active={p.value === a.key} onClick={() => p.onChange(a.key)}>{a.flag} {a.label}</Pill>)}
    </div>
  );
}
function Pill(p: { C: Record<string, string>; active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { C } = p;
  return <button onClick={p.onClick} style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "7px 13px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", background: p.active ? "rgba(124,92,252,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${p.active ? C.pur : C.brd2}`, color: p.active ? C.purL : C.tm, fontFamily: "inherit" }}>{p.children}</button>;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard(p: { C: Record<string, string>; trades: Trade[]; closed: Trade[]; assetFilter: AssetClass | "all"; setAssetFilter: (v: AssetClass | "all") => void; setShowAdd: (b: boolean) => void; setEditTrade: (t: Trade) => void; profile: Profile | null }) {
  const { C, closed } = p;
  const open = useMemo(() => p.trades.filter(t => !t.is_closed), [p.trades]);
  const cur = p.assetFilter === "all" ? "INR" : assetCfg(p.assetFilter as AssetClass).currency;
  const totalPnl = closed.reduce((a, t) => a + t.pnl, 0);
  const wins = closed.filter(t => t.pnl >= 0).length;
  const losses = closed.filter(t => t.pnl < 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
  const rrs = closed.filter(t => t.rr != null).map(t => t.rr!);
  const avgRR = rrs.length ? (rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2) : "—";
  const bScore = behaviourScore(closed);

  // month-over-month
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const thisMonthPnl = closed.filter(t => t.trade_date.startsWith(thisMonth)).reduce((a, t) => a + t.pnl, 0);
  const lastMonthPnl = closed.filter(t => t.trade_date.startsWith(lastMonth)).reduce((a, t) => a + t.pnl, 0);
  const momDelta = lastMonthPnl !== 0 ? ((thisMonthPnl - lastMonthPnl) / Math.abs(lastMonthPnl)) * 100 : 0;

  return (
    <div>
      <AssetPills C={C} value={p.assetFilter} onChange={p.setAssetFilter} />

      {/* Hero stats */}
      <div className="nj-stat4" style={{ marginBottom: 18 }}>
        <StatCard C={C} hero label="📈 Total P&L" value={fmtMoney(totalPnl, cur)} valColor={totalPnl >= 0 ? C.grn : C.red} meta={momDelta !== 0 ? `${momDelta >= 0 ? "↑" : "↓"} ${Math.abs(momDelta).toFixed(0)}% vs last mo` : `${closed.length} trades`} metaColor={momDelta >= 0 ? C.grn : C.red} />
        <StatCard C={C} label="🎯 Win Rate" value={`${winRate}%`} meta={`${wins}W · ${losses}L`} />
        <StatCard C={C} label="⚖ Avg R" value={`${avgRR}R`} meta={rrs.length ? `${rrs.length} rated` : "no SL data"} />
        <StatCard C={C} label="🧠 Behaviour" value={`${bScore.total}`} valSuffix="/100" meta="discipline score" valColor={C.purL} />
      </div>

      {/* Behaviour breakdown */}
      <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>Behaviour Score</div><div style={{ fontSize: 11, color: C.ts }}>What actually predicts long-term success</div></div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.purL }}>{bScore.total}</div>
        </div>
        <BBar C={C} label="📓 Journaling" val={bScore.journal} max={35} grad={`linear-gradient(90deg,${C.pur},${C.purL})`} />
        <BBar C={C} label="📊 Grade Quality" val={bScore.grade} max={25} grad={`linear-gradient(90deg,${C.amb},${C.ambL})`} />
        <BBar C={C} label="🎯 Plan Adherence" val={bScore.plan} max={15} grad={`linear-gradient(90deg,${C.grn},${C.grnL})`} />
        <BBar C={C} label="🛡 Risk Control" val={bScore.risk} max={25} grad={`linear-gradient(90deg,${C.blu},${C.bluL})`} last />
      </div>

      {/* Open positions */}
      {open.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🟡 Open Positions</div>
            <span style={{ fontSize: 10, color: C.amb, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{open.length} running</span>
          </div>
          {open.map(t => (
            <div key={t.id} onClick={() => p.setEditTrade(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, marginBottom: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: "rgba(245,158,11,0.15)", color: C.ambL, flexShrink: 0 }}>{assetCfg(t.asset_class).label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.symbol}</div>
                <div style={{ fontSize: 10, color: C.ts, display: "flex", gap: 8, marginTop: 3 }}>
                  <span>{t.side === "long" ? "📈 LONG" : "📉 SHORT"}</span><span>{t.qty} @ {t.entry_price}</span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: C.amb, fontWeight: 700, flexShrink: 0 }}>Tap to close →</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent trades */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Recent Trades</div>
        <button onClick={() => p.setShowAdd(true)} style={{ background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", color: "#fff", padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Trade</button>
      </div>
      {closed.length === 0 && open.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: C.ts, fontSize: 13 }}>No trades yet. Tap <strong style={{ color: C.purL }}>+ Add Trade</strong> to log your first.</div>}
      {closed.slice(0, 6).map(t => <TradeRow key={t.id} C={C} t={t} onClick={() => p.setEditTrade(t)} />)}
    </div>
  );
}

function StatCard(p: { C: Record<string, string>; label: string; value: string; valSuffix?: string; meta?: string; metaColor?: string; valColor?: string; hero?: boolean }) {
  const { C } = p;
  return (
    <div style={{ background: p.hero ? `linear-gradient(135deg,rgba(124,92,252,0.12),rgba(59,130,246,0.04))` : C.panel, border: `1px solid ${p.hero ? "rgba(124,92,252,0.25)" : C.brd}`, borderRadius: 14, padding: "15px 16px" }}>
      <div style={{ fontSize: 10, color: C.ts, letterSpacing: "0.08em", marginBottom: 8 }}>{p.label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: p.valColor || C.tp, lineHeight: 1 }}>{p.value}{p.valSuffix && <span style={{ fontSize: 13, color: C.ts, fontWeight: 600 }}>{p.valSuffix}</span>}</div>
      {p.meta && <div style={{ fontSize: 11, color: p.metaColor || C.ts, marginTop: 6 }}>{p.meta}</div>}
    </div>
  );
}
function BBar(p: { C: Record<string, string>; label: string; val: number; max: number; grad: string; last?: boolean }) {
  const { C } = p;
  return (
    <div style={{ marginBottom: p.last ? 0 : 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: C.tm }}><span>{p.label}</span><span style={{ fontWeight: 700 }}>{p.val}/{p.max}</span></div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${(p.val / p.max) * 100}%`, height: "100%", background: p.grad, borderRadius: 3 }} /></div>
    </div>
  );
}

// ── Trade Row ───────────────────────────────────────────────────────────────
const ASSET_PILL_COLORS: Record<AssetClass, [string, string]> = {
  in_fno: ["rgba(124,92,252,0.15)", "#c4b5fd"], in_eq: ["rgba(236,72,153,0.15)", "#f9a8d4"],
  in_comm: ["rgba(234,179,8,0.15)", "#fde047"],
  us_stock: ["rgba(59,130,246,0.15)", "#93c5fd"], us_option: ["rgba(59,130,246,0.15)", "#93c5fd"],
  commodity: ["rgba(234,179,8,0.15)", "#fde047"],
  crypto: ["rgba(245,158,11,0.15)", "#fcd34d"], futures: ["rgba(245,158,11,0.15)", "#fcd34d"],
  forex: ["rgba(16,185,129,0.15)", "#6ee7b7"],
};
function TradeRow(p: { C: Record<string, string>; t: Trade; onClick?: () => void }) {
  const { C, t } = p;
  const cfg = assetCfg(t.asset_class);
  const [bg, col] = ASSET_PILL_COLORS[t.asset_class];
  const gradeColors: Record<string, string> = { "A+": C.grn, "A": C.grn, "B": C.blu, "C": C.amb, "D": C.red };
  return (
    <div onClick={p.onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 12, marginBottom: 8, cursor: p.onClick ? "pointer" : "default" }}>
      <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: bg, color: col, flexShrink: 0 }}>{cfg.label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.symbol}</div>
        <div style={{ fontSize: 10, color: C.ts, display: "flex", gap: 8, marginTop: 3 }}>
          <span>{t.side === "long" ? "📈" : "📉"} {t.qty}</span>
          <span>@ {t.entry_price}{t.is_closed ? ` → ${t.exit_price}` : ""}</span>
        </div>
      </div>
      {t.is_closed ? (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.pnl >= 0 ? C.grn : C.red, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(t.pnl, t.currency)}</div>
          {t.rr != null && <div style={{ fontSize: 10, color: C.ts }}>{t.rr > 0 ? "+" : ""}{t.rr}R</div>}
        </div>
      ) : (
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(245,158,11,0.15)", color: C.ambL, flexShrink: 0 }}>OPEN</span>
      )}
      {t.is_closed && t.grade && <div style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: `${gradeColors[t.grade]}22`, color: gradeColors[t.grade], flexShrink: 0 }}>{t.grade}</div>}
    </div>
  );
}

// ── Trade Modal (adaptive form) ──────────────────────────────────────────────
function TradeModal(p: { C: Record<string, string>; onClose: () => void; onSave: (t: Trade) => void; editTrade: Trade | null }) {
  const { C } = p;
  const e = p.editTrade;
  const [ac, setAc] = useState<AssetClass>(e?.asset_class || "in_fno");
  const cfg = assetCfg(ac);
  const now = new Date();
  const [side, setSide] = useState<"long" | "short">(e?.side || "long");
  const [symbol, setSymbol] = useState(e?.symbol || "");
  const [strike, setStrike] = useState(e?.strike?.toString() || "");
  const [expiry, setExpiry] = useState(e?.expiry || "");
  const [optType, setOptType] = useState(e?.option_type || "CE");
  const [lev, setLev] = useState(e?.leverage?.toString() || "");
  const [qty, setQty] = useState(e?.qty?.toString() || "");
  const [entry, setEntry] = useState(e?.entry_price?.toString() || "");
  const [exit, setExit] = useState(e?.exit_price?.toString() || "");
  const [sl, setSl] = useState(e?.sl?.toString() || "");
  const [target, setTarget] = useState(e?.target?.toString() || "");
  const [entryTime, setEntryTime] = useState(e?.entry_time?.slice(0, 16) || now.toISOString().slice(0, 16));
  const [exitTime, setExitTime] = useState(e?.exit_time?.slice(0, 16) || now.toISOString().slice(0, 16));
  const [thesis, setThesis] = useState(e?.thesis || "");
  const [confidence, setConfidence] = useState(e?.confidence?.toString() || "");
  const [setup, setSetup] = useState(e?.setup || "");
  const [emotion, setEmotion] = useState(e?.emotion_entry || "");
  const [mistakes, setMistakes] = useState<string[]>(e?.mistakes || []);
  const [followedPlan, setFollowedPlan] = useState<boolean | undefined>(e?.followed_plan);
  const [lesson, setLesson] = useState(e?.lesson || "");
  const [isClosed, setIsClosed] = useState<boolean>(e ? (e.is_closed ?? true) : true);
  const [err, setErr] = useState("");

  const en = parseFloat(entry) || 0, ex = parseFloat(exit) || 0, q = parseFloat(qty) || 0, sln = parseFloat(sl) || 0;
  const pnl = isClosed ? computePnl(side, en, ex, q) : 0;
  const pnlPct = isClosed ? computePnlPct(side, en, ex) : 0;
  const rr = isClosed ? computeRR(side, en, ex, sln || undefined) : undefined;

  // System-computed grade, live
  const autoGradeVal = isClosed ? autoGrade({
    pnl, rr, is_closed: isClosed, followed_plan: followedPlan,
    setup, emotion_entry: emotion, lesson, mistakes,
    confidence: parseFloat(confidence) || undefined, thesis,
  }) : "";
  const autoGradeColor =
    autoGradeVal === "A+" ? C.grn :
    autoGradeVal === "A"  ? C.grn :
    autoGradeVal === "B"  ? C.blu :
    autoGradeVal === "C"  ? C.amb :
    autoGradeVal === "D"  ? C.red : "";

  const save = () => {
    if (!symbol.trim()) return setErr("Enter symbol");
    if (!q) return setErr("Enter quantity");
    if (!en) return setErr("Enter entry price");
    if (isClosed && !ex) return setErr("Enter exit price (or mark as Open position)");
    const t: Trade = {
      id: e?.id || `nj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      asset_class: ac, symbol: symbol.trim().toUpperCase(), side,
      strike: cfg.hasStrike ? (parseFloat(strike) || undefined) : undefined,
      expiry: cfg.hasExpiry ? (expiry || undefined) : undefined,
      option_type: cfg.hasStrike ? optType : undefined,
      leverage: cfg.hasLeverage ? (parseFloat(lev) || undefined) : undefined,
      qty: q, entry_price: en, exit_price: isClosed ? ex : 0, sl: sln || undefined, target: parseFloat(target) || undefined,
      entry_time: new Date(entryTime).toISOString(), exit_time: isClosed ? new Date(exitTime).toISOString() : undefined,
      trade_date: entryTime.slice(0, 10),
      pnl, pnl_pct: pnlPct, rr: rr ?? undefined, currency: cfg.currency, is_closed: isClosed,
      setup: setup || undefined, emotion_entry: emotion || undefined,
      confidence: parseFloat(confidence) || undefined, followed_plan: followedPlan,
      grade: autoGradeVal || undefined, mistakes, lesson: lesson || undefined, thesis: thesis || undefined,
    };
    p.onSave(t);
  };


  return (
    <div onClick={p.onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: C.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, width: "100%", maxWidth: 640, maxHeight: "94vh", overflowY: "auto", border: `1px solid ${C.brd2}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div><div style={{ fontSize: 10, color: C.ts, letterSpacing: "0.1em" }}>{e && !e.is_closed ? "MANAGE POSITION" : "LOG TRADE"}</div><div style={{ fontSize: 20, fontWeight: 800 }}>{e ? (e.is_closed ? "Edit Trade" : "Close / Edit Position") : "Add Trade"}</div></div>
          <button onClick={p.onClose} style={{ width: 32, height: 32, background: "rgba(255,255,255,0.05)", border: "none", color: C.tp, fontSize: 18, borderRadius: 8, cursor: "pointer" }}>×</button>
        </div>

        {err && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 12, marginBottom: 14 }}>{err}</div>}

        {/* Asset class */}
        <Label C={C}>Asset Class</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 16 }}>
          {ASSET_CLASSES.map(a => (
            <button key={a.key} onClick={() => setAc(a.key)} style={{ padding: "9px 4px", background: ac === a.key ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${ac === a.key ? C.pur : C.brd2}`, borderRadius: 9, color: ac === a.key ? C.purL : C.tm, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
              <div style={{ fontSize: 15, marginBottom: 2 }}>{a.flag}</div>{a.label}
            </button>
          ))}
        </div>

        {/* Pre-trade plan */}
        <div style={{ padding: 13, background: "rgba(124,92,252,0.05)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 11, marginBottom: 14 }}>
          <Label C={C} color={C.purL}>📋 Pre-Trade Thesis (optional but powerful)</Label>
          <input value={thesis} onChange={ev => setThesis(ev.target.value)} placeholder="Why this trade? What's your edge?" style={{ ...inp(C), marginBottom: 10 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Label C={C} color={C.purL}>Confidence</Label>
            <input type="range" min="1" max="10" value={confidence || "5"} onChange={ev => setConfidence(ev.target.value)} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purL, minWidth: 24, textAlign: "right" }}>{confidence || 5}</span>
          </div>
        </div>

        {/* Symbol */}
        <Label C={C}>Symbol</Label>
        <input value={symbol} onChange={ev => setSymbol(ev.target.value)} placeholder={cfg.symbolHint} style={{ ...inp(C), marginBottom: 14 }} />

        {/* Position status: Open vs Closed */}
        <Label C={C}>Position Status</Label>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button onClick={() => setIsClosed(false)} style={{ flex: 1, padding: 11, background: !isClosed ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${!isClosed ? C.amb : C.brd2}`, color: !isClosed ? C.ambL : C.tm, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🟡 Open (still running)</button>
          <button onClick={() => setIsClosed(true)} style={{ flex: 1, padding: 11, background: isClosed ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${isClosed ? C.grn : C.brd2}`, color: isClosed ? C.grnL : C.tm, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Closed (squared off)</button>
        </div>

        {/* F&O / options specific */}
        {cfg.hasStrike && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div><Label C={C}>Strike</Label><input value={strike} onChange={ev => setStrike(ev.target.value)} style={inp(C)} /></div>
            {cfg.hasExpiry && <div><Label C={C}>Expiry</Label><input type="date" value={expiry} onChange={ev => setExpiry(ev.target.value)} style={inp(C)} /></div>}
            <div><Label C={C}>Type</Label>
              <div style={{ display: "flex", gap: 5 }}>
                {(ac === "us_option" ? ["CALL", "PUT"] : ["CE", "PE"]).map(o => (
                  <button key={o} onClick={() => setOptType(o)} style={{ flex: 1, padding: 9, background: optType === o ? "rgba(124,92,252,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${optType === o ? C.pur : C.brd2}`, color: optType === o ? C.purL : C.tm, borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{o}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {cfg.hasExpiry && !cfg.hasStrike && (
          <div style={{ marginBottom: 14 }}><Label C={C}>Expiry / Contract Month</Label><input type="date" value={expiry} onChange={ev => setExpiry(ev.target.value)} style={inp(C)} /></div>
        )}

        {/* Side + qty */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><Label C={C}>Position</Label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSide("long")} style={sideBtn(C, side === "long", "long")}>📈 LONG</button>
              <button onClick={() => setSide("short")} style={sideBtn(C, side === "short", "short")}>📉 SHORT</button>
            </div>
          </div>
          <div><Label C={C}>{cfg.qtyLabel}</Label><input type="number" value={qty} onChange={ev => setQty(ev.target.value)} placeholder="50" style={inp(C)} /></div>
        </div>

        {cfg.hasLeverage && (<div style={{ marginBottom: 14 }}><Label C={C}>Leverage (x)</Label><input type="number" value={lev} onChange={ev => setLev(ev.target.value)} placeholder="10" style={inp(C)} /></div>)}

        {/* Prices */}
        <div style={{ display: "grid", gridTemplateColumns: isClosed ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 14 }}>
          <div><Label C={C}>Entry Price</Label><input type="number" step="any" value={entry} onChange={ev => setEntry(ev.target.value)} style={inp(C)} /></div>
          {isClosed && <div><Label C={C}>Exit Price</Label><input type="number" step="any" value={exit} onChange={ev => setExit(ev.target.value)} style={inp(C)} /></div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><Label C={C}>Stop Loss</Label><input type="number" step="any" value={sl} onChange={ev => setSl(ev.target.value)} placeholder="—" style={inp(C)} /></div>
          <div><Label C={C}>Target</Label><input type="number" step="any" value={target} onChange={ev => setTarget(ev.target.value)} placeholder="—" style={inp(C)} /></div>
        </div>

        {/* Times */}
        <div style={{ display: "grid", gridTemplateColumns: isClosed ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 14 }}>
          <div><Label C={C}>Entry Time</Label><input type="datetime-local" value={entryTime} onChange={ev => setEntryTime(ev.target.value)} style={inp(C)} /></div>
          {isClosed && <div><Label C={C}>Exit Time</Label><input type="datetime-local" value={exitTime} onChange={ev => setExitTime(ev.target.value)} style={inp(C)} /></div>}
        </div>

        {/* Live preview */}
        {pnl !== 0 && (
          <div style={{ background: pnl >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${pnl >= 0 ? C.grn : C.red}40`, borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 10, color: C.ts, letterSpacing: "0.1em" }}>NET P&L</div><div style={{ fontSize: 22, fontWeight: 800, color: pnl >= 0 ? C.grn : C.red }}>{fmtMoneyFull(pnl, cfg.currency)}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.ts, letterSpacing: "0.1em" }}>R · %</div><div style={{ fontSize: 16, fontWeight: 700, color: pnl >= 0 ? C.grn : C.red }}>{rr != null ? `${rr}R` : "—"} · {pnlPct}%</div></div>
          </div>
        )}

        {/* Setup */}
        <Label C={C}>Setup / Strategy</Label>
        <ChipRow C={C} options={SETUPS} value={setup} onToggle={s => setSetup(setup === s ? "" : s)} style={{ marginBottom: 14 }} />

        {/* Emotion */}
        <Label C={C}>Emotion at Entry</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {EMOTIONS.map(em => (
            <button key={em.key} onClick={() => setEmotion(emotion === em.key ? "" : em.key)} style={{ padding: "6px 11px", background: emotion === em.key ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${emotion === em.key ? C.pur : C.brd2}`, color: emotion === em.key ? C.purL : C.tm, borderRadius: 18, fontSize: 11, cursor: "pointer" }}>{em.emoji} {em.key}</button>
          ))}
        </div>

        {/* Mistakes */}
        <Label C={C}>Mistakes (if any)</Label>
        <ChipRow C={C} options={MISTAKES} multi value={mistakes} onToggle={m => setMistakes(mistakes.includes(m) ? mistakes.filter(x => x !== m) : [...mistakes, m])} style={{ marginBottom: 14 }} />

        {/* Plan + Auto-Grade */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><Label C={C}>Followed Plan?</Label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setFollowedPlan(true)} style={sideBtn(C, followedPlan === true, "long")}>✓ Yes</button>
              <button onClick={() => setFollowedPlan(false)} style={sideBtn(C, followedPlan === false, "short")}>✗ No</button>
            </div>
          </div>
          <div><Label C={C}>Auto Grade</Label>
            {(() => {
              const gradeColor = autoGradeColor || C.tm;
              return (
                <div style={{ padding: "10px 14px", background: `${gradeColor}1a`, border: `1px solid ${gradeColor}66`, borderRadius: 8, fontSize: 22, fontWeight: 800, color: gradeColor, textAlign: "center" as const, fontFamily: "inherit" }}>
                  {autoGradeVal || "—"}
                  <span style={{ fontSize: 9, color: C.ts, fontWeight: 500, display: "block", letterSpacing: "0.05em", marginTop: 2 }}>{isClosed ? "system-rated" : "close trade for grade"}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Lesson */}
        <Label C={C}>Lesson Learned</Label>
        <textarea value={lesson} onChange={ev => setLesson(ev.target.value)} rows={3} placeholder="What did you learn? What will you do differently?" style={{ ...inp(C), marginBottom: 18, resize: "vertical" }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={p.onClose} style={{ flex: 1, padding: 13, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.brd2}`, color: C.tm, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} style={{ flex: 2, padding: 13, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>💾 Save Trade</button>
        </div>
      </div>
    </div>
  );
}
function Label(p: { C: Record<string, string>; children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 10, color: p.color || p.C.ts, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>{p.children}</div>;
}
function inp(C: Record<string, string>): React.CSSProperties {
  return { width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.brd2}`, borderRadius: 9, color: C.tp, padding: "11px 13px", fontSize: 13, outline: "none", boxSizing: "border-box" };
}
function sideBtn(C: Record<string, string>, active: boolean, kind: "long" | "short"): React.CSSProperties {
  const col = kind === "long" ? C.grn : C.red;
  return { flex: 1, padding: 10, background: active ? `${col}2e` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? col : C.brd2}`, color: active ? (kind === "long" ? C.grnL : C.redL) : C.tm, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
}
function ChipRow(p: { C: Record<string, string>; options: string[]; value: string | string[]; multi?: boolean; onToggle: (s: string) => void; style?: React.CSSProperties }) {
  const { C } = p;
  const isActive = (o: string) => p.multi ? (p.value as string[]).includes(o) : p.value === o;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, ...p.style }}>
      {p.options.map(o => <button key={o} onClick={() => p.onToggle(o)} style={{ padding: "6px 11px", background: isActive(o) ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${isActive(o) ? C.pur : C.brd2}`, color: isActive(o) ? C.purL : C.tm, borderRadius: 18, fontSize: 11, cursor: "pointer" }}>{o}</button>)}
    </div>
  );
}

// ── Trades List ─────────────────────────────────────────────────────────────
function TradesList(p: { C: Record<string, string>; trades: Trade[]; assetFilter: AssetClass | "all"; setAssetFilter: (v: AssetClass | "all") => void; setShowAdd: (b: boolean) => void; setEditTrade: (t: Trade) => void; removeTrade: (id: string) => void }) {
  const { C } = p;
  return (
    <div>
      <AssetPills C={C} value={p.assetFilter} onChange={p.setAssetFilter} />
      {p.trades.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: C.ts, fontSize: 13 }}>No trades in this filter.</div>}
      {p.trades.map(t => (
        <div key={t.id} style={{ marginBottom: 8 }}>
          <TradeRow C={C} t={t} onClick={() => p.setEditTrade(t)} />
          <div style={{ display: "flex", gap: 6, marginTop: -4, marginBottom: 4, paddingLeft: 4 }}>
            {t.lesson && <span style={{ fontSize: 10, color: C.ts, fontStyle: "italic", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💡 {t.lesson}</span>}
            <button onClick={() => { if (confirm(`Delete ${t.symbol}?`)) p.removeTrade(t.id); }} style={{ marginLeft: "auto", background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.3)`, color: C.redL, fontSize: 10, padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>🗑 Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Analytics ───────────────────────────────────────────────────────────────
function Analytics(p: { C: Record<string, string>; closed: Trade[] }) {
  const { C, closed } = p;
  const [tab, setTab] = useState<"setups" | "emotions" | "monthly" | "time">("setups");

  // Setup performance
  const setupStats = useMemo(() => {
    const m: Record<string, { n: number; wins: number; pnl: number; rr: number[] }> = {};
    closed.forEach(t => { const s = t.setup || "Untagged"; if (!m[s]) m[s] = { n: 0, wins: 0, pnl: 0, rr: [] }; m[s].n++; if (t.pnl >= 0) m[s].wins++; m[s].pnl += t.pnl; if (t.rr != null) m[s].rr.push(t.rr); });
    return Object.entries(m).map(([k, v]) => ({ setup: k, n: v.n, wr: Math.round((v.wins / v.n) * 100), pnl: v.pnl, avgRR: v.rr.length ? (v.rr.reduce((a, b) => a + b, 0) / v.rr.length).toFixed(1) : "—" })).sort((a, b) => b.wr - a.wr);
  }, [closed]);

  // Emotion performance
  const emoStats = useMemo(() => {
    const m: Record<string, { n: number; wins: number; rr: number[] }> = {};
    closed.forEach(t => { const e = t.emotion_entry; if (!e) return; if (!m[e]) m[e] = { n: 0, wins: 0, rr: [] }; m[e].n++; if (t.pnl >= 0) m[e].wins++; if (t.rr != null) m[e].rr.push(t.rr); });
    return EMOTIONS.filter(e => m[e.key]).map(e => ({ ...e, n: m[e.key].n, wr: Math.round((m[e.key].wins / m[e.key].n) * 100), avgRR: m[e.key].rr.length ? (m[e.key].rr.reduce((a, b) => a + b, 0) / m[e.key].rr.length).toFixed(1) : "—" })).sort((a, b) => b.wr - a.wr);
  }, [closed]);

  // Monthly
  const monthly = useMemo(() => {
    const m: Record<string, { n: number; wins: number; pnl: number; journaled: number; gradeA: number }> = {};
    closed.forEach(t => { const mo = t.trade_date.slice(0, 7); if (!mo) return; if (!m[mo]) m[mo] = { n: 0, wins: 0, pnl: 0, journaled: 0, gradeA: 0 }; m[mo].n++; if (t.pnl >= 0) m[mo].wins++; m[mo].pnl += t.pnl; if (t.lesson || t.setup) m[mo].journaled++; if (["A+", "A"].includes(t.grade || "")) m[mo].gradeA++; });
    return Object.entries(m).map(([k, v]) => ({ month: k, ...v, wr: Math.round((v.wins / v.n) * 100), jPct: Math.round((v.journaled / v.n) * 100) })).sort((a, b) => b.month.localeCompare(a.month));
  }, [closed]);

  if (closed.length === 0) return <div style={{ textAlign: "center", padding: "60px 20px", color: C.ts, fontSize: 13 }}>Log some trades to unlock analytics.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 5, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {([["setups", "🎯 Setups"], ["emotions", "😶 Emotions"], ["monthly", "📅 Monthly"], ["time", "⏰ Timing"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flexShrink: 0, padding: "8px 13px", background: tab === k ? "rgba(124,92,252,0.15)" : "transparent", border: `1px solid ${tab === k ? C.pur : C.brd2}`, color: tab === k ? C.purL : C.tm, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {tab === "setups" && (
        <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Setup Performance</div>
          <div style={{ fontSize: 11, color: C.ts, marginBottom: 14 }}>Find your edge — which strategies actually work</div>
          {setupStats.map(s => {
            const col = s.wr >= 60 ? C.grn : s.wr >= 45 ? C.amb : C.red;
            return (
              <div key={s.setup} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 700 }}>{s.setup}</span>
                  <span style={{ color: C.ts }}>{s.wr}% · {s.avgRR}R · {s.n} trades · <span style={{ color: s.pnl >= 0 ? C.grn : C.red }}>{fmtMoney(s.pnl, "INR")}</span></span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${s.wr}%`, height: "100%", background: col }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "emotions" && (
        <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Emotion → Outcome</div>
          <div style={{ fontSize: 11, color: C.ts, marginBottom: 14 }}>Which emotional states make you money</div>
          {emoStats.length === 0 && <div style={{ color: C.ts, fontSize: 12 }}>Tag emotions when adding trades to see this.</div>}
          {emoStats.map(e => {
            const col = e.wr >= 60 ? C.grn : e.wr >= 40 ? C.amb : C.red;
            const danger = e.wr < 40;
            return (
              <div key={e.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: danger ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)", border: danger ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent", borderRadius: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{e.emoji}</span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.key}</div><div style={{ fontSize: 10, color: C.ts }}>{e.n} trades · avg {e.avgRR}R</div></div>
                <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{e.wr}%</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "monthly" && (
        <div>
          {monthly.length >= 2 && (
            <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.ts, letterSpacing: "0.1em", marginBottom: 10 }}>THIS MONTH VS LAST</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[["P&L", monthly[0].pnl - monthly[1].pnl, "money"], ["Win Rate", monthly[0].wr - monthly[1].wr, "pct"], ["Journaling", monthly[0].jPct - monthly[1].jPct, "pct"]].map(([l, d]) => {
                  const delta = d as number; const pos = delta >= 0;
                  return <div key={l as string} style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase", marginBottom: 4 }}>{l as string}</div><div style={{ fontSize: 14, fontWeight: 800, color: pos ? C.grn : C.red }}>{pos ? "↑" : "↓"} {(l === "P&L") ? fmtMoney(Math.abs(delta), "INR") : `${Math.abs(delta).toFixed(0)}%`}</div></div>;
                })}
              </div>
            </div>
          )}
          {monthly.map(m => (
            <div key={m.month} style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div><div style={{ fontSize: 14, fontWeight: 800 }}>{new Date(m.month + "-01").toLocaleString("default", { month: "long", year: "numeric" })}</div><div style={{ fontSize: 10, color: C.ts, marginTop: 2 }}>{m.n} trades · {m.wins}W · {m.n - m.wins}L</div></div>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.pnl >= 0 ? C.grn : C.red }}>{fmtMoney(m.pnl, "INR")}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {[["Win Rate", `${m.wr}%`, m.wr >= 50 ? C.grn : C.amb], ["Journaled", `${m.jPct}%`, m.jPct >= 80 ? C.grn : C.amb], ["A Grades", `${m.gradeA}`, C.purL]].map(([l, v, c]) => (
                  <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}><div style={{ fontSize: 8, color: C.ts, marginBottom: 2 }}>{l}</div><div style={{ fontSize: 12, fontWeight: 700, color: c as string }}>{v}</div></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "time" && <TimeAnalysis C={C} closed={closed} />}
    </div>
  );
}

function TimeAnalysis(p: { C: Record<string, string>; closed: Trade[] }) {
  const { C, closed } = p;
  const hourly = useMemo(() => {
    const m: Record<number, { n: number; wins: number; pnl: number }> = {};
    closed.forEach(t => { if (!t.entry_time) return; const h = new Date(t.entry_time).getHours(); if (!m[h]) m[h] = { n: 0, wins: 0, pnl: 0 }; m[h].n++; if (t.pnl >= 0) m[h].wins++; m[h].pnl += t.pnl; });
    return Object.entries(m).map(([h, v]) => ({ hour: parseInt(h), ...v, wr: Math.round((v.wins / v.n) * 100) })).sort((a, b) => a.hour - b.hour);
  }, [closed]);
  if (hourly.length === 0) return <div style={{ color: C.ts, fontSize: 12, padding: 20, textAlign: "center" }}>Add entry times to see timing analysis.</div>;
  const maxPnl = Math.max(...hourly.map(h => Math.abs(h.pnl)), 1);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⏰ Performance by Hour</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130 }}>
        {hourly.map(h => (
          <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ height: `${Math.max(8, (Math.abs(h.pnl) / maxPnl) * 90)}%`, width: "100%", background: h.pnl >= 0 ? `linear-gradient(180deg,${C.grn},${C.grnL})` : `linear-gradient(180deg,${C.red},${C.redL})`, borderRadius: "4px 4px 0 0", minHeight: 8 }} />
            <div style={{ fontSize: 8, color: C.ts }}>{h.hour}:00</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calendar Heatmap ────────────────────────────────────────────────────────
function CalendarView(p: { C: Record<string, string>; closed: Trade[] }) {
  const { C, closed } = p;
  const [month, setMonth] = useState(new Date());
  const byDate = useMemo(() => {
    const m: Record<string, number> = {};
    closed.forEach(t => { if (!t.trade_date) return; m[t.trade_date] = (m[t.trade_date] || 0) + t.pnl; });
    return m;
  }, [closed]);

  const y = month.getFullYear(), mo = month.getMonth();
  const firstDay = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const maxAbs = Math.max(...Object.values(byDate).map(Math.abs), 1);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthPnl = Object.entries(byDate).filter(([d]) => d.startsWith(`${y}-${String(mo + 1).padStart(2, "0")}`)).reduce((a, [, v]) => a + v, 0);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setMonth(new Date(y, mo - 1, 1))} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: C.tp, width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{month.toLocaleString("default", { month: "long", year: "numeric" })}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: monthPnl >= 0 ? C.grn : C.red }}>{fmtMoney(monthPnl, "INR")}</div>
        </div>
        <button onClick={() => setMonth(new Date(y, mo + 1, 1))} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: C.tp, width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} style={{ fontSize: 9, color: C.ts, textAlign: "center" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const pnl = byDate[dateStr];
          let bg = "rgba(255,255,255,0.02)", col = C.ts;
          if (pnl != null) {
            const intensity = Math.abs(pnl) / maxAbs;
            const alpha = 0.1 + intensity * 0.35;
            if (pnl >= 0) { bg = `rgba(16,185,129,${alpha})`; col = C.grnL; }
            else { bg = `rgba(239,68,68,${alpha})`; col = C.redL; }
          }
          return (
            <div key={i} style={{ aspectRatio: "1", borderRadius: 6, background: bg, padding: "4px 5px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: pnl != null ? col : C.ts }}>{d}</span>
              {pnl != null && <span style={{ fontSize: 8, fontWeight: 700, color: col }}>{fmtMoney(pnl, "INR").replace("₹", "")}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Leaderboard ─────────────────────────────────────────────────────────────
interface LBRow { user_id: string; display_name: string; username: string; country: string; total_trades: number; win_rate: number; total_pnl: number; avg_pnl_pct: number; behaviour_score: number; }
function Leaderboard(p: { C: Record<string, string>; sb: SupabaseClient | null; user: User | null; profile: Profile | null }) {
  const { C } = p;
  const [mode, setMode] = useState<"behaviour" | "pnl">("behaviour");
  const [countryF, setCountryF] = useState("ALL");
  const [assetF, setAssetF] = useState<AssetClass | "all">("all");
  const [rows, setRows] = useState<LBRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!p.sb) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const view = assetF === "all" ? "nj_leaderboard_global" : "nj_leaderboard";
        let q = p.sb!.from(view).select("*");
        if (assetF !== "all") q = q.eq("asset_class", assetF);
        if (countryF !== "ALL") q = q.eq("country", countryF);
        const { data } = await q.limit(100);
        setRows((data as LBRow[]) || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [p.sb, assetF, countryF]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => mode === "behaviour" ? b.behaviour_score - a.behaviour_score : b.avg_pnl_pct - a.avg_pnl_pct);
    return arr;
  }, [rows, mode]);

  const myRank = sorted.findIndex(r => r.user_id === p.user?.id) + 1;

  return (
    <div>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setMode("behaviour")} style={lbTab(C, mode === "behaviour")}>🧠 Behaviour</button>
        <button onClick={() => setMode("pnl")} style={lbTab(C, mode === "pnl")}>📈 P&L %</button>
      </div>

      {/* Country filter */}
      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
        <Pill C={C} active={countryF === "ALL"} onClick={() => setCountryF("ALL")}>🌐 Global</Pill>
        {COUNTRIES.map(c => <Pill key={c.code} C={C} active={countryF === c.code} onClick={() => setCountryF(c.code)}>{c.flag} {c.name}</Pill>)}
      </div>
      {/* Asset filter */}
      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
        <Pill C={C} active={assetF === "all"} onClick={() => setAssetF("all")}>All Assets</Pill>
        {ASSET_CLASSES.map(a => <Pill key={a.key} C={C} active={assetF === a.key} onClick={() => setAssetF(a.key)}>{a.flag} {a.label}</Pill>)}
      </div>

      <div style={{ background: "rgba(124,92,252,0.06)", border: `1px solid ${C.brd2}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: C.ts, lineHeight: 1.5 }}>
        {mode === "behaviour" ? "Ranked by discipline: journaling, plan adherence, grade quality, risk control. The traders who survive." : "Ranked by average % return per trade — fair across all capital sizes."}
      </div>

      {!p.profile?.public_profile && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.ambL }}>
          ⚠ Your profile is private. Enable public profile in Settings to appear on the leaderboard.
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: 40, color: C.ts }}>Loading rankings…</div>}
      {!loading && sorted.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.ts, fontSize: 13 }}>🏁 No traders ranked yet for this filter. Be the first with 3+ trades!</div>}

      {myRank > 0 && (
        <div style={{ background: `linear-gradient(135deg,rgba(124,92,252,0.12),transparent)`, border: `1px solid rgba(124,92,252,0.3)`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 9, color: C.ts, letterSpacing: "0.1em" }}>YOU</div>
          <div style={{ fontWeight: 800, color: C.purL, fontSize: 16 }}>#{myRank}</div>
          <div style={{ flex: 1, fontSize: 12, color: C.tm }}>{sorted[myRank - 1]?.display_name}</div>
          <div style={{ fontWeight: 800, color: C.purL }}>{mode === "behaviour" ? sorted[myRank - 1]?.behaviour_score : `${sorted[myRank - 1]?.avg_pnl_pct}%`}</div>
        </div>
      )}

      {sorted.slice(0, 50).map((r, i) => {
        const rank = i + 1;
        const c = COUNTRIES.find(x => x.code === r.country);
        const score = mode === "behaviour" ? r.behaviour_score : r.avg_pnl_pct;
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
        return (
          <div key={r.user_id + i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: rank <= 3 ? "rgba(251,191,36,0.04)" : C.panel, border: `1px solid ${rank <= 3 ? "rgba(251,191,36,0.2)" : C.brd}`, borderRadius: 11, marginBottom: 8 }}>
            <div style={{ width: 28, textAlign: "center", fontWeight: 800, fontSize: medal ? 16 : 13, color: rank <= 3 ? C.gold : C.ts }}>{medal || rank}</div>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${C.pur},${C.pink})`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.display_name}</div>
              <div style={{ fontSize: 9, color: C.ts }}>{c?.flag} {c?.name} · {r.total_trades} trades · {r.win_rate}% WR</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: mode === "behaviour" ? C.purL : (score >= 0 ? C.grn : C.red) }}>{mode === "behaviour" ? score : `${score >= 0 ? "+" : ""}${score}%`}</div>
          </div>
        );
      })}
    </div>
  );
}
function lbTab(C: Record<string, string>, active: boolean): React.CSSProperties {
  return { flex: 1, padding: "10px", background: active ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${active ? C.pur : C.brd2}`, color: active ? C.purL : C.tm, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
}

// ── Settings ────────────────────────────────────────────────────────────────
// ── Shared avatar upload helper ──────────────────────────────────────────────
async function uploadAvatar(sb: SupabaseClient, userId: string, file: File): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar_${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) { console.error("[NJ] avatar upload:", error); return null; }
    const { data } = sb.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error(e); return null; }
}

// ── Profile form fields (shared by Onboarding + Settings) ────────────────────
function ProfileFields(p: {
  C: Record<string, string>; sb: SupabaseClient | null; userId: string;
  name: string; setName: (s: string) => void;
  username: string; setUsername: (s: string) => void;
  country: string; setCountry: (s: string) => void;
  primaryAsset: string; setPrimaryAsset: (s: string) => void;
  avatarUrl: string; setAvatarUrl: (s: string) => void;
}) {
  const { C } = p;
  const [uploading, setUploading] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !p.sb) return;
    if (file.size > 3 * 1024 * 1024) { alert("Image must be under 3MB"); return; }
    setUploading(true);
    const url = await uploadAvatar(p.sb, p.userId, file);
    if (url) p.setAvatarUrl(url);
    else alert("Upload failed. Make sure the avatars storage bucket exists.");
    setUploading(false);
  };

  return (
    <div>
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: `linear-gradient(135deg,${C.amb},${C.pink})`, flexShrink: 0, border: `2px solid ${C.brd2}` }}>
          {p.avatarUrl && <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "inline-block", padding: "9px 14px", background: "rgba(124,92,252,0.12)", border: `1px solid ${C.pur}`, color: C.purL, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {uploading ? "Uploading…" : p.avatarUrl ? "Change Photo" : "📷 Upload Photo"}
            <input type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
          </label>
          <div style={{ fontSize: 10, color: C.ts, marginTop: 6 }}>JPG/PNG, under 3MB</div>
        </div>
      </div>

      <Label C={C}>Display Name</Label>
      <input value={p.name} onChange={e => p.setName(e.target.value)} placeholder="Your name" style={{ ...inp(C), marginBottom: 14 }} />

      <Label C={C}>Username (public handle)</Label>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 13, top: 11, color: C.ts, fontSize: 13 }}>@</span>
        <input value={p.username} onChange={e => p.setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="handle" style={{ ...inp(C), paddingLeft: 26 }} />
      </div>

      <Label C={C}>Country</Label>
      <select value={p.country} onChange={e => p.setCountry(e.target.value)} style={{ ...inp(C), marginBottom: 14 }}>
        {COUNTRIES.map(c => <option key={c.code} value={c.code} style={{ background: C.bg2 }}>{c.flag} {c.name}</option>)}
      </select>

      <Label C={C}>Primary Asset Focus</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {ASSET_CLASSES.map(a => (
          <button key={a.key} onClick={() => p.setPrimaryAsset(a.key)} style={{ padding: "7px 11px", background: p.primaryAsset === a.key ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${p.primaryAsset === a.key ? C.pur : C.brd2}`, color: p.primaryAsset === a.key ? C.purL : C.tm, borderRadius: 18, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{a.flag} {a.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Onboarding Modal (first run after Google login) ──────────────────────────
function OnboardModal(p: { C: Record<string, string>; sb: SupabaseClient | null; user: User | null; profile: Profile | null; onDone: (pr: Profile) => void }) {
  const { C } = p;
  const defaultName = p.profile?.display_name || (p.user?.email ? p.user.email.split("@")[0] : "");
  const [name, setName] = useState(defaultName);
  const [username, setUsername] = useState(p.profile?.username || (p.user?.email ? p.user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") : ""));
  const [country, setCountry] = useState(p.profile?.country || "IN");
  const [primaryAsset, setPrimaryAsset] = useState(p.profile?.primary_asset || "in_fno");
  const [avatarUrl, setAvatarUrl] = useState(p.profile?.avatar_url || "");
  const [pub, setPub] = useState(p.profile?.public_profile ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const finish = async () => {
    if (!name.trim()) return setErr("Enter your name");
    if (!username.trim()) return setErr("Pick a username");
    if (!p.sb || !p.user) return setErr("Not connected");
    setSaving(true); setErr("");
    const row = {
      id: p.user.id, display_name: name.trim(), username: username.trim(),
      country, primary_asset: primaryAsset, avatar_url: avatarUrl || null,
      public_profile: pub, onboarded: true,
    };
    const { error } = await p.sb.from("nj_profiles").upsert(row, { onConflict: "id" });
    if (error) {
      if (error.message?.includes("duplicate") || error.code === "23505") setErr("That username is taken, try another");
      else setErr(error.message || "Could not save");
      setSaving(false);
      return;
    }
    p.onDone({ display_name: name.trim(), username: username.trim(), country, primary_asset: primaryAsset, avatar_url: avatarUrl, public_profile: pub, onboarded: true, plan: p.profile?.plan || "free" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.bg2, borderRadius: 20, padding: 24, width: "100%", maxWidth: 460, maxHeight: "94vh", overflowY: "auto", border: `1px solid ${C.brd2}` }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg,${C.pur},${C.blu})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 auto 12px" }}>N</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Welcome to Neeyum Journal</div>
          <div style={{ fontSize: 12, color: C.ts, marginTop: 4 }}>Set up your trader profile to get started</div>
        </div>

        {err && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 12, marginBottom: 14 }}>{err}</div>}

        <ProfileFields {...{ C, sb: p.sb, userId: p.user?.id || "", name, setName, username, setUsername, country, setCountry, primaryAsset, setPrimaryAsset, avatarUrl, setAvatarUrl }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 4px" }}>
          <div><div style={{ fontSize: 13, fontWeight: 600 }}>Show on Leaderboard</div><div style={{ fontSize: 11, color: C.ts }}>Compete globally by behaviour & P&L</div></div>
          <button onClick={() => setPub(!pub)} style={{ width: 46, height: 26, borderRadius: 13, background: pub ? C.pur : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: pub ? 23 : 3, transition: "all 0.2s" }} />
          </button>
        </div>

        <button onClick={finish} disabled={saving} style={{ width: "100%", padding: 14, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 12 }}>
          {saving ? "Setting up…" : "Start Journaling →"}
        </button>
      </div>
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
function Settings(p: { C: Record<string, string>; sb: SupabaseClient | null; user: User | null; profile: Profile | null; setProfile: (pr: Profile) => void; trades: Trade[] }) {
  const { C } = p;
  const [name, setName] = useState(p.profile?.display_name || "");
  const [username, setUsername] = useState(p.profile?.username || "");
  const [country, setCountry] = useState(p.profile?.country || "IN");
  const [primaryAsset, setPrimaryAsset] = useState(p.profile?.primary_asset || "in_fno");
  const [avatarUrl, setAvatarUrl] = useState(p.profile?.avatar_url || "");
  const [pub, setPub] = useState(p.profile?.public_profile ?? true);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (p.profile) {
      setName(p.profile.display_name || ""); setUsername(p.profile.username || "");
      setCountry(p.profile.country || "IN"); setPrimaryAsset(p.profile.primary_asset || "in_fno");
      setAvatarUrl(p.profile.avatar_url || ""); setPub(p.profile.public_profile ?? true);
    }
  }, [p.profile]);

  const save = async () => {
    if (!p.sb || !p.user) return;
    if (!name.trim()) return setErr("Enter your name");
    if (!username.trim()) return setErr("Pick a username");
    setErr("");
    const { error } = await p.sb.from("nj_profiles").upsert({
      id: p.user.id, display_name: name.trim(), username: username.trim(),
      country, primary_asset: primaryAsset, avatar_url: avatarUrl || null,
      public_profile: pub, onboarded: true,
    }, { onConflict: "id" });
    if (error) {
      if (error.message?.includes("duplicate") || error.code === "23505") setErr("That username is taken");
      else setErr(error.message || "Save failed");
      return;
    }
    p.setProfile({ display_name: name.trim(), username: username.trim(), country, primary_asset: primaryAsset, avatar_url: avatarUrl, public_profile: pub, onboarded: true, plan: p.profile?.plan || "free" });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const logout = async () => { if (p.sb) await p.sb.auth.signOut(); };

  return (
    <div>
      <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>👤 Edit Profile</div>
        {err && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <ProfileFields {...{ C, sb: p.sb, userId: p.user?.id || "", name, setName, username, setUsername, country, setCountry, primaryAsset, setPrimaryAsset, avatarUrl, setAvatarUrl }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 6px", marginTop: 4, borderTop: `1px solid ${C.brd}` }}>
          <div><div style={{ fontSize: 13, fontWeight: 600 }}>Public Profile</div><div style={{ fontSize: 11, color: C.ts }}>Appear on global leaderboard</div></div>
          <button onClick={() => setPub(!pub)} style={{ width: 46, height: 26, borderRadius: 13, background: pub ? C.pur : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: pub ? 23 : 3, transition: "all 0.2s" }} />
          </button>
        </div>
        <button onClick={save} style={{ width: "100%", padding: 12, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 8 }}>{saved ? "✓ Saved" : "Save Profile"}</button>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>📊 Your Stats</div>
        <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.8 }}>
          Total trades: <strong style={{ color: C.tp }}>{p.trades.length}</strong><br />
          Plan: <strong style={{ color: C.purL }}>{(p.profile?.plan || "free").toUpperCase()}</strong><br />
          Account: <strong style={{ color: C.tp }}>{p.user?.email}</strong>
        </div>
      </div>

      <div style={{ background: "rgba(124,92,252,0.05)", border: "1px solid rgba(124,92,252,0.2)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: C.purL }}>💎 Upgrade to PRO</div>
        <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.6, marginBottom: 12 }}>Unlimited trades, AI insights, advanced analytics, priority leaderboard. Coming soon.</div>
        <button disabled style={{ width: "100%", padding: 11, background: "rgba(124,92,252,0.15)", border: `1px solid ${C.pur}`, color: C.purL, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "not-allowed", opacity: 0.7 }}>Coming Soon</button>
      </div>

      <button onClick={logout} style={{ width: "100%", padding: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: C.redL, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Sign Out</button>
    </div>
  );
}
