// Neeyum Journal — shared types, asset class config, calculations

export type AssetClass = "in_fno" | "in_eq" | "in_comm" | "us_stock" | "us_option" | "commodity" | "crypto" | "futures" | "forex";

export interface AssetConfig {
  key: AssetClass;
  label: string;
  flag: string;
  currency: "INR" | "USD";
  hasStrike: boolean;
  hasExpiry: boolean;
  hasLeverage: boolean;
  fractionalQty: boolean;
  qtyLabel: string;
  symbolHint: string;
}

export const ASSET_CLASSES: AssetConfig[] = [
  { key: "in_fno",   label: "IN F&O",      flag: "🇮🇳", currency: "INR", hasStrike: true,  hasExpiry: true,  hasLeverage: false, fractionalQty: false, qtyLabel: "Lots × Size", symbolHint: "NIFTY24NOV23000CE" },
  { key: "in_eq",    label: "IN Equity",   flag: "🇮🇳", currency: "INR", hasStrike: false, hasExpiry: false, hasLeverage: false, fractionalQty: false, qtyLabel: "Quantity",    symbolHint: "RELIANCE, TCS" },
  { key: "in_comm",  label: "IN Commodity",flag: "🇮🇳", currency: "INR", hasStrike: false, hasExpiry: true,  hasLeverage: false, fractionalQty: false, qtyLabel: "Lots",        symbolHint: "GOLD, SILVER, CRUDEOIL" },
  { key: "us_stock", label: "US Stocks",   flag: "🇺🇸", currency: "USD", hasStrike: false, hasExpiry: false, hasLeverage: false, fractionalQty: true,  qtyLabel: "Shares",      symbolHint: "AAPL, TSLA" },
  { key: "us_option",label: "US Options",  flag: "🇺🇸", currency: "USD", hasStrike: true,  hasExpiry: true,  hasLeverage: false, fractionalQty: false, qtyLabel: "Contracts",   symbolHint: "AAPL 200C" },
  { key: "commodity",label: "Commodity",   flag: "🛢", currency: "USD", hasStrike: false, hasExpiry: true,  hasLeverage: true,  fractionalQty: true,  qtyLabel: "Lots/Units",  symbolHint: "XAUUSD, WTI, NATGAS" },
  { key: "crypto",   label: "Crypto",      flag: "₿",  currency: "USD", hasStrike: false, hasExpiry: false, hasLeverage: false, fractionalQty: true,  qtyLabel: "Quantity",    symbolHint: "BTC/USDT" },
  { key: "futures",  label: "Crypto Fut.", flag: "📈", currency: "USD", hasStrike: false, hasExpiry: false, hasLeverage: true,  fractionalQty: true,  qtyLabel: "Quantity",    symbolHint: "BTCUSDT-PERP" },
  { key: "forex",    label: "Forex",       flag: "💱", currency: "USD", hasStrike: false, hasExpiry: false, hasLeverage: true,  fractionalQty: true,  qtyLabel: "Lots",        symbolHint: "EUR/USD" },
];

export function assetCfg(k: AssetClass): AssetConfig {
  return ASSET_CLASSES.find(a => a.key === k) || ASSET_CLASSES[0];
}

export interface Trade {
  id: string;
  asset_class: AssetClass;
  symbol: string;
  side: "long" | "short";
  strike?: number;
  expiry?: string;
  option_type?: string;
  leverage?: number;
  qty: number;
  entry_price: number;
  exit_price: number;
  sl?: number;
  target?: number;
  entry_time: string;
  exit_time?: string;
  trade_date: string;
  pnl: number;
  pnl_pct: number;
  rr?: number;
  planned_rr?: number;
  currency: string;
  is_closed: boolean;
  setup?: string;
  emotion_entry?: string;
  emotion_exit?: string;
  confidence?: number;
  followed_plan?: boolean;
  grade?: string;
  mistakes?: string[];
  lesson?: string;
  thesis?: string;
  invalidation?: string;
  screenshot_url?: string;
  tags?: string[];
}

export const SETUPS = ["Breakout", "ORB", "VWAP Reversal", "Pullback", "Trend Follow", "Range", "News Catalyst", "Reversal", "Scalp", "Swing"];
export const EMOTIONS = [
  { key: "Calm",       emoji: "😌" },
  { key: "Confident",  emoji: "💪" },
  { key: "Anxious",    emoji: "😰" },
  { key: "FOMO",       emoji: "🔥" },
  { key: "Revenge",    emoji: "😡" },
  { key: "Uncertain",  emoji: "🤔" },
  { key: "Greedy",     emoji: "🤑" },
  { key: "Bored",      emoji: "😴" },
];
export const MISTAKES = ["Chased entry", "Moved SL", "Oversized", "No plan", "Held too long", "Cut too early", "Revenge trade", "Ignored signal", "FOMO entry", "No stop loss"];
export const GRADES = ["A+", "A", "B", "C", "D"];

export const COUNTRIES = [
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "US", flag: "🇺🇸", name: "USA" },
  { code: "GB", flag: "🇬🇧", name: "UK" },
  { code: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "OTHER", flag: "🌍", name: "Other" },
];

// ── Calculations ────────────────────────────────────────────────────────────
export function computePnl(side: "long" | "short", entry: number, exit: number, qty: number): number {
  if (!entry || !exit || !qty) return 0;
  const raw = side === "long" ? (exit - entry) * qty : (entry - exit) * qty;
  return parseFloat(raw.toFixed(2));
}

export function computePnlPct(side: "long" | "short", entry: number, exit: number, lev = 1): number {
  if (!entry || !exit) return 0;
  const pct = ((exit - entry) / entry) * 100 * (side === "long" ? 1 : -1) * (lev || 1);
  return parseFloat(pct.toFixed(2));
}

// Realized R-multiple: actual move / planned risk (entry→SL distance)
export function computeRR(side: "long" | "short", entry: number, exit: number, sl?: number): number | undefined {
  if (!entry || !exit) return undefined;
  if (!sl || sl <= 0) {
    // Fallback: % move as R-units assuming 1% risk
    const pct = ((exit - entry) / entry) * 100 * (side === "long" ? 1 : -1);
    return parseFloat(pct.toFixed(2));
  }
  const risk = Math.abs(entry - sl);
  if (risk === 0) return undefined;
  const reward = side === "long" ? (exit - entry) : (entry - exit);
  return parseFloat((reward / risk).toFixed(2));
}

export function fmtMoney(n: number, currency = "INR"): string {
  const sym = currency === "USD" ? "$" : "₹";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  if (abs >= 100000 && currency === "INR") return `${sign}${sym}${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}${sym}${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  return `${sign}${sym}${abs.toFixed(2)}`;
}

export function fmtMoneyFull(n: number, currency = "INR"): string {
  const sym = currency === "USD" ? "$" : "₹";
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}${sym}${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Auto-grade a trade based on inputs (not just P&L outcome)
// Returns A+ / A / B / C / D based on discipline + outcome quality
export function autoGrade(t: {
  pnl: number;
  rr?: number;
  is_closed: boolean;
  followed_plan?: boolean;
  setup?: string;
  emotion_entry?: string;
  lesson?: string;
  mistakes?: string[];
  confidence?: number;
  thesis?: string;
}): string {
  if (!t.is_closed) return ""; // open positions don't get a grade yet

  let score = 50; // start at C-ish

  // Plan adherence (the single biggest factor)
  if (t.followed_plan === true) score += 18;
  else if (t.followed_plan === false) score -= 18;

  // Journaling completeness
  let journalCount = 0;
  if (t.setup) journalCount++;
  if (t.emotion_entry) journalCount++;
  if (t.lesson && t.lesson.trim().length >= 10) journalCount++;
  if (t.thesis && t.thesis.trim().length >= 10) journalCount++;
  score += journalCount * 4; // up to +16

  // R-multiple quality (size of win/loss relative to risk)
  if (t.rr != null) {
    if (t.rr >= 3) score += 14;
    else if (t.rr >= 2) score += 10;
    else if (t.rr >= 1) score += 6;
    else if (t.rr >= 0) score += 2;
    else if (t.rr >= -1) score -= 4;   // controlled loss
    else if (t.rr >= -2) score -= 10;  // bigger loss than planned
    else score -= 18;                  // catastrophic loss
  } else {
    // No SL recorded — penalize lack of risk planning
    if (t.pnl >= 0) score += 2;
    else score -= 8;
  }

  // Emotional state penalty (FOMO/Revenge = bad regardless of outcome)
  if (t.emotion_entry === "FOMO" || t.emotion_entry === "Revenge") score -= 12;
  else if (t.emotion_entry === "Greedy" || t.emotion_entry === "Anxious") score -= 4;
  else if (t.emotion_entry === "Calm" || t.emotion_entry === "Confident") score += 4;

  // Mistakes penalty
  const mistakeCount = t.mistakes?.length || 0;
  const severeMistakes = ["Moved SL", "No stop loss", "Oversized", "Revenge trade", "No plan", "FOMO entry"];
  const hasSevere = t.mistakes?.some(m => severeMistakes.includes(m)) || false;
  if (hasSevere) score -= 15;
  score -= mistakeCount * 3;

  // Confidence calibration (high confidence + loss = overconfidence penalty)
  if (t.confidence != null && t.confidence >= 8 && t.pnl < 0) score -= 5;

  // Final grade buckets
  if (score >= 85) return "A+";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}


export function behaviourScore(trades: Trade[]): { total: number; journal: number; grade: number; plan: number; risk: number } {
  const closed = trades.filter(t => t.is_closed);
  if (closed.length === 0) return { total: 0, journal: 0, grade: 0, plan: 0, risk: 0 };
  const n = closed.length;

  const journalRaw = closed.reduce((a, t) => {
    let c = 0;
    if (t.setup) c++;
    if (t.emotion_entry) c++;
    if (t.lesson) c++;
    if (t.grade) c++;
    return a + c;
  }, 0);
  const journal = Math.round((journalRaw / (n * 4)) * 35 * 10) / 10;

  const graded = closed.filter(t => t.grade);
  const goodGrades = closed.filter(t => ["A+", "A", "B"].includes(t.grade || ""));
  const grade = graded.length ? Math.round((goodGrades.length / graded.length) * 25 * 10) / 10 : 0;

  const planned = closed.filter(t => t.followed_plan === true);
  const plan = Math.round(Math.min(15, (planned.length / n) * 15) * 10) / 10;

  const pnls = closed.map(t => t.pnl);
  const mean = pnls.reduce((a, b) => a + b, 0) / n;
  const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);
  const cv = Math.abs(mean) > 0 ? stddev / Math.abs(mean) : 5;
  const risk = Math.round(Math.max(0, Math.min(25, 25 - cv * 4)) * 10) / 10;

  const total = Math.round((journal + grade + plan + risk) * 10) / 10;
  return { total, journal, grade, plan, risk };
}
