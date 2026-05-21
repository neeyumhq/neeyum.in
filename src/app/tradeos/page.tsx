"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

// ── Supabase client factory (safe across SSR + missing env vars) ──────────
function makeSb(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("[TradeOS] Missing Supabase env vars");
    return null;
  }
  try {
    return createClient(url, key);
  } catch (e) {
    console.error("[TradeOS] Supabase init failed:", e);
    return null;
  }
}

// ── Colors ────────────────────────────────────────────────────────────────
const C = {
  bg:"#06080F",s1:"#0B0E1A",s2:"#0F1220",s3:"#141828",
  brd:"rgba(99,102,241,0.12)",brd2:"rgba(99,102,241,0.22)",
  pur:"#6366F1",purL:"#818CF8",purD:"#4338CA",
  grn:"#10B981",grnL:"#34D399",red:"#EF4444",redL:"#F87171",
  amb:"#F59E0B",ambL:"#FCD34D",tp:"#F1F5F9",ts:"#64748B",
};

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtPnL = (v: number) => `${v >= 0 ? "+" : "-"}₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInr = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pH = (v: number) => v > 0 ? "#10B981" : v < 0 ? "#EF4444" : "#64748B";
const gC = (g: string) => ["A+","A"].includes(g) ? "#10B981" : ["B+","B"].includes(g) ? "#3B82F6" : g === "C" ? "#F59E0B" : "#EF4444";
const sHex = (s: number) => s >= 70 ? "#10B981" : s >= 45 ? "#F59E0B" : "#EF4444";

interface Trade {
  id: string; symbol: string; date: string; type: string; qty: number;
  buyAvg: number; sellAvg: number; pnl: number; realizedPnl: number;
  unrealizedPnl: number; isClosed: boolean; product: string;
  holdTime: number; holdDisplay: string;
  grade: string; setup: string; emotion: string; lesson: string;
  confidence: number; exitType: string; mistakes: string[];
  sl: number; target: number; rr: string | number;
  journaled?: boolean;
}

interface Fund {
  availabelBalance: number; utilizedAmount: number; sodLimit: number;
}

interface Cfg {
  lossType: "percent" | "amount"; lossVal: number;
  tgtType: "percent" | "amount"; tgtVal: number;
  tradeLimit: number;
}

export default function TradeOS() {
  const sb = useMemo(() => makeSb(), []);
  const [authState, setAuthState] = useState<"loading"|"auth"|"connect-broker"|"app">("loading");
  const [configError, setConfigError] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login"|"signup">("login");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [brokerError, setBrokerError] = useState("");
  const [scr, setScr] = useState("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [fund, setFund] = useState<Fund | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [jOpen, setJOpen] = useState<Trade | null>(null);
  const [analTab, setAnalTab] = useState("overview");
  const [perfFilter, setPerfFilter] = useState("all");
  const [cfg, setCfg] = useState<Cfg>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("nt_cfg") || "null") || { lossType:"percent", lossVal:2.5, tgtType:"percent", tgtVal:8, tradeLimit:3 }; }
      catch { return { lossType:"percent", lossVal:2.5, tgtType:"percent", tgtVal:8, tradeLimit:3 }; }
    }
    return { lossType:"percent", lossVal:2.5, tgtType:"percent", tgtVal:8, tradeLimit:3 };
  });

  const saveTrades = useCallback((t: Trade[]) => {
    setTrades(t);
    try { localStorage.setItem("nt_trades", JSON.stringify(t)); } catch {}
  }, []);

  // Load cached trades on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("nt_trades");
      if (cached) setTrades(JSON.parse(cached));
      const cachedFund = localStorage.getItem("nt_fund");
      if (cachedFund) setFund(JSON.parse(cachedFund));
    } catch {}
  }, []);

  // Auth state
  useEffect(() => {
    if (!sb) {
      setConfigError("Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env vars, then redeploy.");
      setAuthState("auth");
      return;
    }
    // Check current session immediately
    sb.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (session?.user) {
        setUser(session.user);
        try {
          const res = await fetch("/api/broker", { headers: { Authorization: `Bearer ${session.access_token}` } });
          const d = await res.json();
          setAuthState(d.connections?.length > 0 ? "app" : "connect-broker");
        } catch {
          setAuthState("connect-broker");
        }
      } else {
        setAuthState("auth");
      }
    });
    // Listen for future changes
    const { data: sub } = sb.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser(session.user);
        try {
          const res = await fetch("/api/broker", { headers: { Authorization: `Bearer ${session.access_token}` } });
          const d = await res.json();
          setAuthState(d.connections?.length > 0 ? "app" : "connect-broker");
        } catch {
          setAuthState("connect-broker");
        }
      } else {
        setAuthState("auth");
        setUser(null);
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [sb]);

  const avail = fund?.availabelBalance || 0;
  const lossLimit = cfg.lossType === "percent" ? avail * (cfg.lossVal / 100) : cfg.lossVal;
  const dailyTarget = cfg.tgtType === "percent" ? avail * (cfg.tgtVal / 100) : cfg.tgtVal;
  const closed = trades.filter(t => t.isClosed);
  const open = trades.filter(t => !t.isClosed);
  const totalPnL = trades.reduce((a, t) => a + t.pnl, 0);
  const realPnL = closed.reduce((a, t) => a + t.realizedPnl, 0);
  const unrealPnL = open.reduce((a, t) => a + t.unrealizedPnl, 0);
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl < 0);
  const wr = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
  const avgW = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgL = losses.length ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 1;
  const rr = (avgW / avgL).toFixed(2);
  const unjournaled = closed.filter(t => !t.journaled);
  const lossUsed = Math.min(100, Math.abs(Math.min(realPnL, 0)) / Math.max(lossLimit, 1) * 100);
  const tgtPct = Math.min(100, Math.max(0, realPnL) / Math.max(dailyTarget, 1) * 100);
  const lossHit = realPnL <= -lossLimit;
  const disc = Math.round(
    (trades.filter(t => t.sl > 0).length / Math.max(trades.length, 1) * 100) * 0.25 +
    (closed.filter(t => ["A","A+","B","B+"].includes(t.grade)).length / Math.max(closed.length, 1) * 100) * 0.25 +
    (closed.filter(t => t.lesson).length / Math.max(closed.length, 1) * 100) * 0.20 +
    wr * 0.15 + Math.min(100, parseFloat(rr) * 50) * 0.15
  );
  const isLocked = () => Date.now() < parseInt(typeof window !== "undefined" ? localStorage.getItem("nt_locked") || "0" : "0");
  const lockDays = () => Math.ceil((parseInt(localStorage.getItem("nt_locked") || "0") - Date.now()) / 86400000);
  const lockDate = () => new Date(parseInt(localStorage.getItem("nt_locked") || "0")).toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" });

  // ── API helpers ─────────────────────────────────────────────────────────
  const getJwt = async () => {
    if (!sb) return "";
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || "";
  };

  const syncDhan = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const jwt = await getJwt();
      const [fundRes, tradesRes] = await Promise.all([
        fetch("/api/dhan?endpoint=/fundlimit", { headers: { Authorization: `Bearer ${jwt}` } }),
        fetch("/api/dhan?endpoint=/allpositions", { headers: { Authorization: `Bearer ${jwt}` } }),
      ]);
      const fundData: Fund = await fundRes.json();
      const tradesData: Trade[] = await tradesRes.json();
      if (fundData && !("error" in fundData)) {
        setFund(fundData);
        try { localStorage.setItem("nt_fund", JSON.stringify(fundData)); } catch {}
      }
      if (Array.isArray(tradesData)) {
        const prev = trades.filter(t => t.lesson || t.emotion || t.setup || t.grade || t.exitType);
        const merged = tradesData.map(t => {
          const p = prev.find(e => e.symbol === t.symbol && e.date === t.date);
          return p ? { ...t, setup: p.setup, emotion: p.emotion, lesson: p.lesson, grade: p.grade, exitType: p.exitType, confidence: p.confidence, mistakes: p.mistakes, sl: p.sl || t.sl } : t;
        });
        saveTrades(merged);
        setSyncMsg(`✓ Synced · ${merged.length} positions loaded`);
      }
    } catch {
      setSyncMsg("✗ Sync failed. Check your Dhan token.");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 5000);
  };

  const saveBroker = async (token: string, clientId: string) => {
    setBrokerLoading(true); setBrokerError("");
    try {
      const jwt = await getJwt();
      const res = await fetch("/api/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ broker: "dhan", clientId, accessToken: token }),
      });
      const data = await res.json();
      if (data.error) { setBrokerError(data.error); return; }
      setAuthState("app");
    } catch { setBrokerError("Failed to save. Try again."); }
    setBrokerLoading(false);
  };

  const updateTrade = (id: string, updates: Partial<Trade>) => {
    const updated = trades.map(t => t.id === id ? { ...t, ...updates } : t);
    saveTrades(updated);
  };

  const saveCfg = (newCfg: Cfg) => {
    setCfg(newCfg);
    try { localStorage.setItem("nt_cfg", JSON.stringify(newCfg)); } catch {}
    if (!isLocked()) {
      try { localStorage.setItem("nt_locked", String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch {}
    }
  };

  // ── Shared UI components ─────────────────────────────────────────────────
  const Bar = ({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) => (
    <div style={{ height: h, background: "rgba(255,255,255,0.07)", borderRadius: h, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: h, transition: "width 0.8s" }} />
    </div>
  );

  const Ring = ({ score }: { score: number }) => {
    const r = 40, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
    const c = sHex(score);
    const lbl = score >= 70 ? "DISCIPLINED" : score >= 45 ? "DEVELOPING" : "HIGH RISK";
    return (
      <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
        <svg width={100} height={100} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={r} fill="none" stroke={C.s3} strokeWidth={8} />
          <circle cx={50} cy={50} r={r} fill="none" stroke={c} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 50 50)" style={{ filter: `drop-shadow(0 0 6px ${c}88)` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: c, fontFamily: "monospace" }}>{score}</span>
          <span style={{ fontSize: 7, color: c, letterSpacing: "0.08em", fontWeight: 700 }}>{lbl}</span>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SCREENS
  // ══════════════════════════════════════════════════════════════════════════

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (authState === "loading") return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>⬡</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.purL }}>Niyam TradeOS</div>
      <div style={{ fontSize: 24, color: C.ts, animation: "spin 1s linear infinite" }}>↻</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (authState === "auth") return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.tp, fontFamily: "system-ui,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⬡</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Niyam TradeOS</div>
          <div style={{ fontSize: 13, color: C.ts }}>{authMode === "login" ? "Login to your account" : "Create your account"}</div>
        </div>
        {configError && <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "10px 14px", color: C.ambL, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>⚠ {configError}</div>}
        {authError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 13, marginBottom: 12 }}>{authError}</div>}
        {/* Google Sign-In */}
        <button
          disabled={authLoading || !sb}
          onClick={async () => {
            if (!sb) { setAuthError("Supabase not configured."); return; }
            setAuthLoading(true); setAuthError("");
            const { error } = await sb.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${window.location.origin}/tradeos` }
            });
            if (error) { setAuthError(error.message); setAuthLoading(false); }
          }}
          style={{ width: "100%", padding: 12, background: "#fff", border: "none", borderRadius: 14, color: "#1a1a1a", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
          <div style={{ flex: 1, height: 1, background: C.brd2 }} />
          <span style={{ fontSize: 10, color: C.ts, letterSpacing: "0.1em" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: C.brd2 }} />
        </div>
        {authMode === "signup" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.ts, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Full Name</div>
            <input id="auth_name" style={{ width: "100%", background: C.s2, border: `1px solid ${C.brd2}`, borderRadius: 12, color: C.tp, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", outline: "none" }} placeholder="Your name" />
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.ts, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Email</div>
          <input id="auth_email" type="email" style={{ width: "100%", background: C.s2, border: `1px solid ${C.brd2}`, borderRadius: 12, color: C.tp, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", outline: "none" }} placeholder="you@email.com" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.ts, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Password</div>
          <input id="auth_pass" type="password" style={{ width: "100%", background: C.s2, border: `1px solid ${C.brd2}`, borderRadius: 12, color: C.tp, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", outline: "none" }} placeholder="Min 6 characters" />
        </div>
        <button
          disabled={authLoading}
          onClick={async () => {
            const email = (document.getElementById("auth_email") as HTMLInputElement)?.value?.trim();
            const pass = (document.getElementById("auth_pass") as HTMLInputElement)?.value;
            const name = (document.getElementById("auth_name") as HTMLInputElement)?.value?.trim();
            if (!email || !pass) { setAuthError("Please enter email and password"); return; }
            setAuthLoading(true); setAuthError("");
            if (!sb) { setAuthError("Supabase not configured. Check env vars."); setAuthLoading(false); return; }
            if (authMode === "login") {
              const { error } = await sb.auth.signInWithPassword({ email, password: pass });
              if (error) setAuthError(error.message);
            } else {
              const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
              if (error) setAuthError(error.message);
            }
            setAuthLoading(false);
          }}
          style={{ width: "100%", padding: 14, background: authLoading ? C.s3 : `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, cursor: authLoading ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 16 }}>
          {authLoading ? "Please wait…" : authMode === "login" ? "Login →" : "Create Account →"}
        </button>
        <div style={{ textAlign: "center", fontSize: 13, color: C.ts }}>
          {authMode === "login" ? "No account? " : "Have account? "}
          <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}
            style={{ background: "none", border: "none", color: C.purL, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            {authMode === "login" ? "Sign Up" : "Login"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ color: C.ts, fontSize: 12 }}>← Back to Neeyum.in</a>
        </div>
      </div>
    </div>
  );

  if (authState === "connect-broker") return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.tp, fontFamily: "system-ui,sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Connect Your Dhan Account</div>
          <div style={{ fontSize: 13, color: C.ts }}>Securely connect Dhan to sync your NSE/BSE trades</div>
        </div>
        {brokerError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: C.redL, fontSize: 13, marginBottom: 12 }}>{brokerError}</div>}
        <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Dhan API Credentials</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.ts, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Access Token</div>
            <input id="b_token" type="password" style={{ width: "100%", background: C.bg, border: `1px solid ${C.brd2}`, borderRadius: 10, color: C.tp, padding: "11px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} placeholder="Paste your Dhan access token (eyJ...)" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.ts, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Client ID</div>
            <input id="b_client" style={{ width: "100%", background: C.bg, border: `1px solid ${C.brd2}`, borderRadius: 10, color: C.tp, padding: "11px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} placeholder="Your Dhan Client ID (numbers)" />
          </div>
          <button disabled={brokerLoading} onClick={async () => {
            const t = (document.getElementById("b_token") as HTMLInputElement)?.value?.trim();
            const c = (document.getElementById("b_client") as HTMLInputElement)?.value?.trim();
            if (!t || !c) { setBrokerError("Please enter both fields"); return; }
            await saveBroker(t, c);
          }}
            style={{ width: "100%", padding: 13, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {brokerLoading ? "Connecting…" : "Connect Dhan →"}
          </button>
        </div>
        <div style={{ background: "rgba(99,102,241,0.05)", border: `1px solid ${C.brd}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📖 How to get your Dhan token</div>
          {["Login at dhanhq.co", "Profile picture → My Profile → API Integration", "Click Generate Access Token → set max expiry", "Copy the Access Token (starts with eyJ...)", "Copy your Client ID (numbers only)"].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "5px 0", fontSize: 12, color: C.ts }}>
              <span style={{ background: C.pur, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              {s}
            </div>
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8, fontSize: 11, color: C.amb, lineHeight: 1.6 }}>
            ⚠ Dhan tokens expire every 24 hours. You&apos;ll get a reminder to refresh each morning. All your trade data is saved permanently — only live sync needs the token.
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={async () => { if (sb) await sb.auth.signOut(); setAuthState("auth"); }}
            style={{ background: "none", border: "none", color: C.ts, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Sign out</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN APP
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ background: C.bg, color: C.tp, fontFamily: "system-ui,-apple-system,sans-serif", maxWidth: 480, margin: "0 auto", minHeight: "100vh" }}>
      <style>{`
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:rgba(255,255,255,0.08);outline:none;width:100%;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:9px;cursor:pointer;}
        ::-webkit-scrollbar{display:none;}
        @keyframes spin{to{transform:rotate(360deg);}}
        textarea{font-family:inherit;}
      `}</style>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(6,8,15,0.97)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.brd}`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/" style={{ background: `rgba(99,102,241,0.15)`, border: `1px solid ${C.brd2}`, color: C.purL, width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 13 }}>←</a>
          <div>
            <div style={{ fontSize: 10, color: C.purL, fontWeight: 700, letterSpacing: "0.15em" }}>NIYAM TRADEOS</div>
            <div style={{ fontSize: 10, color: C.ts }}>{user?.email?.split("@")[0]} · <span style={{ color: C.grn }}>Dhan Connected</span></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {unjournaled.length > 0 && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.amb }} />}
          <div style={{ background: `${pH(totalPnL)}22`, border: `1px solid ${pH(totalPnL)}44`, borderRadius: 8, padding: "4px 10px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: pH(totalPnL) }}>{fmtPnL(totalPnL)}</div>
        </div>
      </div>

      {/* Token reminder */}
      <div style={{ background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.18)", padding: "6px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.amb }}>⏱ Dhan token expires every 24h · Refresh daily at 8 AM</span>
        <button onClick={() => setScr("settings")} style={{ background: C.amb, border: "none", color: "#000", padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Settings</button>
      </div>

      {/* Sync message */}
      {syncMsg && <div style={{ padding: "10px 14px", fontSize: 12, background: syncMsg.startsWith("✓") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: syncMsg.startsWith("✓") ? C.grnL : C.redL, borderBottom: `1px solid ${syncMsg.startsWith("✓") ? C.grn : C.red}33` }}>{syncMsg}</div>}

      {/* Loss alert */}
      {lossHit && scr === "dashboard" && (
        <div style={{ background: "linear-gradient(135deg,#7F1D1D,#991B1B)", padding: "14px 16px", border: "2px solid #EF4444" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>🚨 STOP TRADING — Loss Limit Hit</div>
          <div style={{ fontSize: 12, color: "#FCA5A5", lineHeight: 1.7 }}>⛔ Close all open positions<br />⛔ No new orders today<br />✅ Journal and review your trades</div>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: C.redL, marginTop: 8, textAlign: "center" }}>{fmtPnL(realPnL)} today</div>
        </div>
      )}

      {/* ── DASHBOARD ─────────────────────────────────────────────── */}
      {scr === "dashboard" && (
        <div style={{ padding: "16px 14px 90px" }}>
          {unjournaled.length > 0 && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📓</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: C.ambL }}>{unjournaled.length} trade needs journaling (mandatory)</div></div>
              <button onClick={() => { setJOpen(unjournaled[0]); setScr("trades"); }} style={{ background: C.amb, border: "none", color: "#000", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Fix Now</button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: C.ts, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 2 }}>NIYAM TRADEOS</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>Dashboard</div>
            </div>
            <button onClick={syncDhan} style={{ display: "flex", alignItems: "center", gap: 5, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", borderRadius: 9, color: "#fff", padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ display: "inline-block", animation: syncing ? "spin 1s linear infinite" : "none" }}>↻</span>
              {syncing ? "Syncing…" : "Sync Dhan"}
            </button>
          </div>

          {/* P&L Hero */}
          <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(16,185,129,0.05))", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 20, padding: 18, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>TOTAL P&L TODAY</div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: pH(totalPnL), fontFamily: "monospace" }}>{fmtPnL(totalPnL)}</div>
                <div style={{ fontSize: 10, color: C.ts, marginTop: 5 }}>{trades.length} trades · {wins.length}W · {losses.length}L · {open.length} open</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: C.grn, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>LIVE</span>
                <div style={{ fontSize: 9, color: C.ts, marginTop: 8 }}>Available Funds</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.purL, fontFamily: "monospace" }}>{fmtInr(avail)}</div>
                <div style={{ fontSize: 9, color: C.ts }}>From Dhan · Auto-synced</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: C.ts }}>LOSS ({cfg.lossVal}{cfg.lossType === "percent" ? "%" : "₹"} = {fmtInr(lossLimit)})</span>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: lossUsed > 80 ? C.red : lossUsed > 50 ? C.amb : C.grn }}>{Math.round(lossUsed)}%</span>
                </div>
                <Bar pct={lossUsed} color={lossUsed > 80 ? C.red : lossUsed > 50 ? C.amb : C.grn} h={5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: C.ts }}>TARGET ({cfg.tgtVal}{cfg.tgtType === "percent" ? "%" : "₹"} = {fmtInr(dailyTarget)})</span>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: C.grn }}>{Math.round(tgtPct)}%</span>
                </div>
                <Bar pct={tgtPct} color={C.grn} h={5} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Realized", realPnL], ["Unrealized", unrealPnL]].map(([l, v]) => (
                <div key={l as string} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{l as string}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pH(v as number), fontFamily: "monospace" }}>{fmtPnL(v as number)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Discipline + Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 110 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.ts }}>Discipline</div>
              <Ring score={disc} />
              <div style={{ fontSize: 9, color: C.ts, textAlign: "center" }}>behaviour score</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[["Win Rate", `${wr}%`, wr >= 60 ? C.grn : C.amb], ["Avg R:R", rr, parseFloat(rr) >= 1.5 ? C.grn : C.amb], ["Trades", `${trades.length}/${cfg.tradeLimit}`, trades.length >= cfg.tradeLimit ? C.red : C.purL], ["Journaled", `${closed.filter(t => t.lesson).length}/${closed.length}`, closed.every(t => t.lesson) ? C.grn : C.amb]].map(([l, v, c]) => (
                <div key={l as string} style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 9, padding: "8px 11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.ts }}>{l as string}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c as string, fontFamily: "monospace" }}>{v as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 13, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📋 Today&apos;s Rules</div>
            {[
              [`Max ${cfg.tradeLimit} trades`, trades.length < cfg.tradeLimit, `${trades.length}/${cfg.tradeLimit}`],
              [`Loss ≤ ${cfg.lossVal}${cfg.lossType === "percent" ? "%" : "₹"}`, !lossHit, fmtPnL(Math.min(realPnL, 0))],
              [`Target ${cfg.tgtVal}${cfg.tgtType === "percent" ? "%" : "₹"}`, realPnL >= dailyTarget, realPnL >= dailyTarget ? "✓ HIT" : fmtPnL(Math.max(realPnL, 0))],
              ["Journal all trades", closed.every(t => t.lesson), `${closed.filter(t => t.lesson).length}/${closed.length} done`],
              ["SL on all trades", trades.every(t => t.sl > 0), "Protected"],
            ].map(([r, ok, n]) => (
              <div key={r as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.brd}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? C.grn : C.red, boxShadow: ok ? `0 0 5px ${C.grn}` : "" }} />
                  <span style={{ fontSize: 11 }}>{r as string}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: ok ? C.grnL : C.redL }}>{n as string}</span>
              </div>
            ))}
          </div>

          {/* Psychology */}
          <div style={{ background: `linear-gradient(135deg,rgba(99,102,241,0.08),rgba(16,185,129,0.04))`, border: `1px solid ${C.brd2}`, borderRadius: 14, padding: 13 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🧠 Psychology Meter</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Greed Control", 82, C.grn, "Selling at targets"], ["Fear Mgmt", 74, "#3B82F6", "Not cutting wins"], ["Patience", 91, C.grn, "Waiting for setup"], ["Discipline", disc, disc >= 70 ? C.grn : C.amb, "On plan"]].map(([l, v, c, tip]) => (
                <div key={l as string} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 9, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: C.ts }}>{l as string}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c as string, fontFamily: "monospace" }}>{v as number}%</span>
                  </div>
                  <Bar pct={v as number} color={c as string} />
                  <div style={{ fontSize: 9, color: C.ts, marginTop: 4 }}>{tip as string}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TRADES ───────────────────────────────────────────────── */}
      {scr === "trades" && (
        <div style={{ padding: "16px 14px 90px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Trades</div>
          <div style={{ fontSize: 11, color: pH(totalPnL), marginBottom: 12, fontFamily: "monospace" }}>{trades.length} positions · {fmtPnL(totalPnL)}</div>
          {trades.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.ts }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tp, marginBottom: 6 }}>No trades yet</div>
              <div style={{ fontSize: 12 }}>Tap Sync Dhan on the dashboard</div>
            </div>
          ) : trades.map(t => {
            const isJ = jOpen?.id === t.id;
            const needsJ = t.isClosed && !t.lesson;
            return (
              <div key={t.id} style={{ background: C.s1, border: `1px solid ${needsJ ? "rgba(245,158,11,0.4)" : isJ ? C.pur : C.brd}`, borderRadius: 14, padding: 13, marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                  <div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{t.symbol.slice(0, 22)}</span>
                      <span style={{ background: t.isClosed ? "rgba(100,116,139,0.2)" : "rgba(129,140,248,0.2)", color: t.isClosed ? C.ts : C.purL, fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>{t.isClosed ? "CLOSED" : "OPEN"}</span>
                      {t.exitType && <span style={{ background: t.exitType === "Target Hit" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: t.exitType === "Target Hit" ? C.grn : C.red, fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>{t.exitType === "Target Hit" ? "✓ TARGET" : "✗ SL"}</span>}
                      {needsJ && <span style={{ background: "rgba(245,158,11,0.15)", color: C.amb, fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>⚠ JOURNAL NEEDED</span>}
                    </div>
                    <div style={{ fontSize: 9, color: C.ts }}>{t.date} · {t.qty}qty · {t.setup || "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: pH(t.pnl), fontFamily: "monospace" }}>{fmtPnL(t.pnl)}</div>
                    {t.grade && <span style={{ background: `${gC(t.grade)}22`, color: gC(t.grade), fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>Grd {t.grade}</span>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, background: C.s2, borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  {[["Entry", t.buyAvg ? `₹${t.buyAvg}` : "—"], ["Exit", t.sellAvg && t.isClosed ? `₹${t.sellAvg}` : "Active"], ["Hold", t.holdDisplay || "—"], ["SL", t.sl ? `₹${t.sl}` : "—"], ["Target", t.target ? `₹${t.target}` : "—"], ["R:R", t.rr || "—"]].map(([l, v]) => (
                    <div key={l}><div style={{ fontSize: 8, color: C.ts, textTransform: "uppercase" as const, marginBottom: 1 }}>{l}</div><div style={{ fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>{v}</div></div>
                  ))}
                </div>
                {t.lesson && <div style={{ fontSize: 10, color: C.ts, background: "rgba(99,102,241,0.07)", borderRadius: 7, padding: "6px 8px", borderLeft: `2px solid ${C.pur}`, marginBottom: 7, lineHeight: 1.5 }}>💡 {t.lesson}</div>}
                <button onClick={() => setJOpen(isJ ? null : t)} style={{ width: "100%", padding: "7px", background: isJ ? "rgba(99,102,241,0.2)" : needsJ ? "rgba(245,158,11,0.1)" : t.lesson ? "rgba(16,185,129,0.07)" : C.s2, border: `1px solid ${isJ ? C.pur : needsJ ? "rgba(245,158,11,0.4)" : t.lesson ? "rgba(16,185,129,0.3)" : C.brd}`, borderRadius: 8, color: isJ ? C.purL : needsJ ? C.ambL : t.lesson ? C.grnL : C.ts, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {isJ ? "▲ Close" : needsJ ? "⚠ Journal Required (Mandatory)" : t.lesson ? "✏️ Edit Journal" : "📝 Add Journal"}
                </button>
                {isJ && (
                  <div style={{ background: C.s2, borderRadius: 10, padding: 12, marginTop: 8, border: `1px solid ${C.brd2}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.purL, marginBottom: 10 }}>📓 Journal — {t.symbol.slice(0, 18)}</div>
                    {[
                      { q: "Exit Type", o: ["Target Hit", "Stop Loss Hit", "Manual Exit"], key: "exitType" },
                      { q: "Setup", o: ["Breakout", "Pullback", "Trend Following", "Reversal", "ORB", "VWAP", "Random", "Emotional"], key: "setup" },
                      { q: "Outcome", o: ["Full Success", "Partial", "Followed Plan", "Mistake"], key: "outcome" },
                      { q: "Emotion", o: ["Calm", "Impatient", "Overconfident", "Anxious", "Frustrated"], key: "emotion" },
                      { q: "Grade", o: ["A+", "A", "B+", "B", "C", "D"], key: "grade" },
                    ].map(({ q, o, key }) => (
                      <div key={q} style={{ marginBottom: 9 }}>
                        <div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>{q}</div>
                        <div style={{ display: "flex", flexWrap: "wrap" as const }}>
                          {o.map(x => (
                            <button key={x} onClick={() => updateTrade(t.id, { [key]: t[key as keyof Trade] === x ? "" : x } as Partial<Trade>)}
                              style={{ padding: "3px 9px", borderRadius: 20, border: `1px solid ${t[key as keyof Trade] === x ? C.pur : C.brd2}`, background: t[key as keyof Trade] === x ? `rgba(99,102,241,0.2)` : "transparent", color: t[key as keyof Trade] === x ? C.purL : C.ts, fontSize: 10, cursor: "pointer", fontFamily: "inherit", margin: "2px" }}>{x}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginBottom: 9 }}>
                      <div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>Lesson Learned <span style={{ color: C.red }}>*required</span></div>
                      <textarea defaultValue={t.lesson} placeholder="What did you learn? What will you do differently?" id={`ls_${t.id}`}
                        style={{ width: "100%", minHeight: 55, background: C.bg, border: `1px solid ${C.brd2}`, borderRadius: 8, color: C.tp, padding: 8, fontSize: 11, resize: "none" as const, lineHeight: 1.5, boxSizing: "border-box" as const, marginBottom: 8 }} />
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => {
                        const lesson = (document.getElementById(`ls_${t.id}`) as HTMLTextAreaElement)?.value || "";
                        updateTrade(t.id, { lesson });
                        setJOpen(null);
                      }} style={{ flex: 1, padding: 10, background: `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Save Journal</button>
                      <button onClick={() => setJOpen(null)} style={{ padding: "10px 12px", background: C.s3, border: "none", borderRadius: 8, color: C.ts, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ANALYTICS ────────────────────────────────────────────── */}
      {scr === "analytics" && (
        <div style={{ padding: "16px 14px 90px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Analytics</div>
          <div style={{ display: "flex", gap: 5, marginBottom: 12, overflowX: "auto" as const }}>
            {["overview", "psychology", "strategies", "timing"].map(tab => (
              <button key={tab} onClick={() => setAnalTab(tab)} style={{ background: analTab === tab ? "rgba(99,102,241,0.2)" : "transparent", border: `1px solid ${analTab === tab ? C.pur : C.brd}`, color: analTab === tab ? C.purL : C.ts, padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const, textTransform: "capitalize" as const }}>{tab}</button>
            ))}
          </div>
          {analTab === "overview" && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[[fmtPnL(totalPnL), "Net P&L", pH(totalPnL)], [`${wr}%`, "Win Rate", wr >= 60 ? C.grn : C.amb], [rr, "Avg R:R", parseFloat(rr) >= 1.5 ? C.grn : C.amb], [`${closed.length}`, "Closed Trades", C.tp]].map(([v, l, c]) => (
                <div key={l as string} style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 11, padding: "11px 12px" }}>
                  <div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>{l as string}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c as string, fontFamily: "monospace" }}>{v as string}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 13 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>💰 P&L Breakdown</div>
              {[["Realized P&L", realPnL, true], ["Unrealized (Open)", unrealPnL, true], ["Gross P&L", totalPnL, true], ["Est. Brokerage", -312, false, "~₹312"], ["STT + Exchange", -198, false, "~₹198"], ["Net After Charges", totalPnL - 510, true]].map(([l, v, s, note]) => (
                <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.brd}` }}>
                  <span style={{ fontSize: 11, color: C.ts }}>{l as string}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s ? pH(v as number) : C.red, fontFamily: "monospace" }}>{note as string || fmtPnL(v as number)}</span>
                </div>
              ))}
            </div>
          </>}
          {analTab === "psychology" && (
            <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 13 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🧠 Emotional Patterns</div>
              {["Calm", "Impatient", "Overconfident", "Anxious"].map(e => {
                const n = closed.filter(t => t.emotion === e).length;
                const c = e === "Calm" ? C.grn : C.red;
                return (
                  <div key={e} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 80, fontSize: 11, color: C.ts }}>{e}</div>
                    <div style={{ flex: 1 }}><Bar pct={closed.length ? n / closed.length * 100 : 0} color={c} /></div>
                    <div style={{ width: 28, fontSize: 11, color: c, fontWeight: 700, fontFamily: "monospace", textAlign: "right" as const }}>{closed.length ? Math.round(n / closed.length * 100) : 0}%</div>
                  </div>
                );
              })}
              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🚨 Mistake Tracker</div>
              {[["FOMO Entry", 0], ["Revenge Trade", 0], ["Moved SL", 0], ["Exited Early", 1]].map(([m, n]) => (
                <div key={m as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.brd}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{m as string}</div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: n === 0 ? C.grn : C.amb, fontFamily: "monospace" }}>{n as number}</span>
                </div>
              ))}
            </div>
          )}
          {analTab === "strategies" && (
            <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 13 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📈 Strategy Win Rates</div>
              {Array.from(new Set(closed.map(t => t.setup).filter(Boolean))).map(setup => {
                const st = closed.filter(t => t.setup === setup);
                const sw = st.filter(t => t.pnl > 0);
                const swr = Math.round(sw.length / st.length * 100);
                const spnl = st.reduce((a, t) => a + t.pnl, 0);
                const c = swr >= 70 ? C.grn : swr >= 50 ? C.amb : C.red;
                return (
                  <div key={setup} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: C.ts }}>{setup} <span style={{ color: "#334155" }}>{st.length}T</span></span>
                      <div style={{ display: "flex", gap: 10 }}><span style={{ fontSize: 10, color: pH(spnl), fontFamily: "monospace" }}>{fmtPnL(spnl)}</span><span style={{ fontSize: 10, color: c, fontWeight: 700, fontFamily: "monospace" }}>{swr}%</span></div>
                    </div>
                    <Bar pct={swr} color={c} />
                  </div>
                );
              })}
              {Array.from(new Set(closed.map(t => t.setup).filter(Boolean))).length === 0 && <div style={{ fontSize: 12, color: C.ts, textAlign: "center" as const, padding: "20px 0" }}>Add setups in your journals to see strategy performance</div>}
            </div>
          )}
          {analTab === "timing" && (
            <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 13 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>⏱ Best Trading Times</div>
              {[["9:15–10:00 AM", C.grn, "Your golden hour"], ["10:00–11:00 AM", C.grn, "Good zone"], ["11:00–1:00 PM", C.red, "Avoid — choppy"], ["1:00–3:30 PM", C.amb, "Low conviction"]].map(([t, c, note]) => (
                <div key={t as string} style={{ padding: "8px 0", borderBottom: `1px solid ${C.brd}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{t as string}</span>
                  </div>
                  <div style={{ fontSize: 9, color: c as string }}>{note as string}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── REPORT ───────────────────────────────────────────────── */}
      {scr === "report" && (
        <div style={{ padding: "16px 14px 90px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Performance Report</div>
          <div style={{ fontSize: 11, color: C.ts, marginBottom: 12 }}>Full history with execution quality</div>
          <div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto" as const }}>
            {["all", "wins", "losses", "A grade"].map(f => (
              <button key={f} onClick={() => setPerfFilter(f)} style={{ background: perfFilter === f ? "rgba(99,102,241,0.2)" : "transparent", border: `1px solid ${perfFilter === f ? C.pur : C.brd}`, color: perfFilter === f ? C.purL : C.ts, padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>{f}</button>
            ))}
          </div>
          {closed.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 10 }}>
              {[[fmtPnL(Math.max(...closed.map(t => t.pnl), 0)), "Best Trade", C.grn], [fmtPnL(Math.min(...closed.map(t => t.pnl), 0)), "Worst Trade", C.red], [rr + ":1", "Avg R:R", parseFloat(rr) >= 1.5 ? C.grn : C.amb]].map(([v, l, c]) => (
                <div key={l as string} style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 9, padding: "10px 8px", textAlign: "center" as const }}>
                  <div style={{ fontSize: 8, color: C.ts, textTransform: "uppercase" as const, marginBottom: 2 }}>{l as string}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: c as string, fontFamily: "monospace" }}>{v as string}</div>
                </div>
              ))}
            </div>
          )}
          {closed.filter(t => perfFilter === "all" ? true : perfFilter === "wins" ? t.pnl > 0 : perfFilter === "losses" ? t.pnl < 0 : ["A", "A+"].includes(t.grade)).map(t => (
            <div key={t.id} style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 13, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.symbol.slice(0, 22)}</div><div style={{ fontSize: 9, color: C.ts }}>{t.date} · {t.setup || "—"}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {t.grade && <span style={{ background: `${gC(t.grade)}22`, color: gC(t.grade), fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>Grd {t.grade}</span>}
                  <span style={{ fontSize: 15, fontWeight: 800, color: pH(t.pnl), fontFamily: "monospace" }}>{fmtPnL(t.pnl)}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, background: C.s2, borderRadius: 8, padding: 8, marginBottom: 6 }}>
                {[["Entry", t.buyAvg ? `₹${t.buyAvg}` : "—"], ["Exit", t.sellAvg ? `₹${t.sellAvg}` : "—"], ["Hold", t.holdDisplay || "—"], ["R:R", t.rr || "—"], ["SL", t.sl ? `₹${t.sl}` : "—"], ["Target", t.target ? `₹${t.target}` : "—"]].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 8, color: C.ts, textTransform: "uppercase" as const, marginBottom: 1 }}>{l}</div><div style={{ fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>{v}</div></div>
                ))}
              </div>
              {t.exitType && <span style={{ background: t.exitType === "Target Hit" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: t.exitType === "Target Hit" ? C.grn : C.red, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, display: "inline-block", marginBottom: 4 }}>{t.exitType === "Target Hit" ? "✓ TARGET HIT" : "✗ SL HIT"}</span>}
              {t.lesson && <div style={{ fontSize: 9, color: C.ts, background: "rgba(99,102,241,0.07)", borderRadius: 6, padding: "5px 8px", borderLeft: `2px solid ${C.pur}`, lineHeight: 1.5 }}>💡 {t.lesson}</div>}
            </div>
          ))}
          {closed.length === 0 && <div style={{ textAlign: "center" as const, padding: "40px 20px", color: C.ts, fontSize: 12 }}>No closed trades yet. Sync Dhan to load your history.</div>}
        </div>
      )}

      {/* ── SETTINGS ─────────────────────────────────────────────── */}
      {scr === "settings" && (
        <div style={{ padding: "16px 14px 90px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Settings</div>

          {isLocked() && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ambL }}>Locked — {lockDays()} days remaining</div>
                <div style={{ fontSize: 11, color: C.ts, marginTop: 2 }}>Unlocks on {lockDate()}</div>
              </div>
            </div>
          )}

          <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>💰 Account & Limits</div>

            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: 11, marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: C.ts, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 3 }}>Available Funds (live from Dhan)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.purL, fontFamily: "monospace" }}>{fmtInr(avail)}</div>
              <div style={{ fontSize: 10, color: C.ts, marginTop: 2 }}>Margin used: {fmtInr(fund?.utilizedAmount || 0)} · Sync to refresh</div>
            </div>

            {[
              { label: "Daily Loss Limit", val: cfg.lossVal, type: cfg.lossType, color: C.red, onChange: (v: number, t: "percent" | "amount") => setCfg({ ...cfg, lossVal: v, lossType: t }), min: [0.5, 500], max: [10, 5000], step: [0.5, 100] },
              { label: "Daily Target", val: cfg.tgtVal, type: cfg.tgtType, color: C.grn, onChange: (v: number, t: "percent" | "amount") => setCfg({ ...cfg, tgtVal: v, tgtType: t }), min: [0.5, 500], max: [20, 10000], step: [0.5, 500] },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 12 }}>{f.label}</span>
                  <div style={{ display: "flex", background: C.s2, borderRadius: 7, padding: 2 }}>
                    {(["percent", "amount"] as const).map(t => (
                      <button key={t} disabled={isLocked()} onClick={() => f.onChange(f.val, t)} style={{ padding: "3px 9px", borderRadius: 5, border: "none", background: f.type === t ? C.pur : "transparent", color: f.type === t ? "#fff" : C.ts, fontSize: 10, fontWeight: 600, cursor: isLocked() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{t === "percent" ? "% Funds" : "₹ Fixed"}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: f.color, fontFamily: "monospace" }}>{f.type === "percent" ? `${f.val}%` : `₹${f.val.toLocaleString("en-IN")}`}</span>
                  <span style={{ fontSize: 10, color: C.ts }}>{f.type === "percent" ? `= ${fmtInr(avail * f.val / 100)} of funds` : `= ${((f.val / Math.max(avail, 1)) * 100).toFixed(1)}% of funds`}</span>
                </div>
                <input type="range" disabled={isLocked()} min={f.type === "percent" ? f.min[0] : f.min[1]} max={f.type === "percent" ? f.max[0] : f.max[1]} step={f.type === "percent" ? f.step[0] : f.step[1]} value={f.val}
                  onChange={e => f.onChange(parseFloat(e.target.value), f.type)} style={{ width: "100%", accentColor: f.color, opacity: isLocked() ? 0.5 : 1 }} />
              </div>
            ))}

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 12 }}>Max Trades / Day</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.purL, fontFamily: "monospace" }}>{cfg.tradeLimit}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} disabled={isLocked()} onClick={() => setCfg({ ...cfg, tradeLimit: n })}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${cfg.tradeLimit === n ? C.pur : C.brd}`, background: cfg.tradeLimit === n ? "rgba(99,102,241,0.2)" : "transparent", color: cfg.tradeLimit === n ? C.purL : C.ts, fontSize: 14, fontWeight: 800, cursor: isLocked() ? "not-allowed" : "pointer", fontFamily: "monospace", opacity: isLocked() ? 0.6 : 1 }}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔒</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ambL, marginBottom: 3 }}>30-Day Discipline Lock</div>
                <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.6 }}>Once saved, settings lock for 30 days. Changing your limits when losing is how traders blow accounts. Commit to your plan.</div>
              </div>
            </div>
          </div>

          <div style={{ background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 13, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🔗 Dhan Connection</div>
            <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 9, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.grnL }}>✓ Dhan Connected</div>
              <div style={{ fontSize: 10, color: C.ts, marginTop: 2 }}>Tokens expire every 24 hours · Update each morning to sync live trades</div>
            </div>
            <button onClick={async () => {
              setAuthState("connect-broker");
            }} style={{ width: "100%", padding: "9px", background: "transparent", border: `1px solid ${C.amb}`, borderRadius: 9, color: C.amb, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🔄 Update Dhan Token</button>
          </div>

          <button disabled={isLocked()} onClick={() => saveCfg(cfg)} style={{ width: "100%", padding: 13, background: isLocked() ? C.s3 : `linear-gradient(135deg,${C.pur},${C.purD})`, border: "none", borderRadius: 12, color: isLocked() ? C.ts : "#fff", fontSize: 14, fontWeight: 700, cursor: isLocked() ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 10 }}>
            {isLocked() ? `🔒 Locked · ${lockDays()} days remaining` : "💾 Save & Lock for 30 Days"}
          </button>

          <button onClick={async () => { if (sb) await sb.auth.signOut(); setAuthState("auth"); }} style={{ width: "100%", padding: 12, background: "transparent", border: `1px solid ${C.brd}`, borderRadius: 12, color: C.ts, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Sign Out</button>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(11,14,26,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.brd2}`, display: "flex", zIndex: 100, padding: "10px 0 16px" }}>
        {[["dashboard", "⬡", "Home"], ["trades", "≡", "Trades"], ["analytics", "◈", "Analytics"], ["report", "◉", "Report"], ["settings", "⚙", "Settings"]].map(([id, ic, lb]) => (
          <button key={id} onClick={() => setScr(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: scr === id ? C.purL : C.ts, padding: "4px 2px", fontSize: 8, fontFamily: "inherit", fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>{ic}</span>{lb}
            {scr === id && <div style={{ width: 4, height: 4, borderRadius: 2, background: C.pur }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
