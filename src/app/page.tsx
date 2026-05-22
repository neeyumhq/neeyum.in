"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.sleepyclassics.neeyum";

export default function Home() {
  const [labTab, setLabTab] = useState("overview");
  const [lbFilter, setLbFilter] = useState("global");
  const [expandedMetric, setExpandedMetric] = useState<number | null>(0);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [labTab]);

  const scrollToLab = () => {
    document.getElementById("page-home")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const METRICS = [
    { name: "Risk Control", weight: "30%", score: 80, formula: "100 - ((MaxLoss - DailyLimit) / DailyLimit × 100)", color: "var(--orange)" },
    { name: "Discipline", weight: "25%", score: 70, formula: "EarnedPoints / 25 × 100 based on Lock Days", color: "var(--purple2)" },
    { name: "Target Progression", weight: "20%", score: 60, formula: "NetClosedPnL / MonthlyTarget × 100", color: "var(--gold)" },
    { name: "Consistency", weight: "15%", score: 90, formula: "EarnedPoints / 15 × 100 based on Active Days", color: "var(--blue)" },
    { name: "Win Ratio", weight: "10%", score: 50, formula: "WinningTrades / TotalClosedTrades × 100", color: "var(--pink)" },
  ];

  return (
    <>
      {/* ═══════════════════════════════════════════════════
           PRODUCT SUITE — 3 products at top
      ═══════════════════════════════════════════════════ */}
      <div id="page-suite" style={{
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(180deg, rgba(124,92,252,0.04) 0%, transparent 100%)",
        paddingTop: "80px",
      }}>
        <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "0 5% 20px", textAlign: "center" }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(0,229,160,0.07)", border: "1px solid rgba(0,229,160,0.18)",
            color: "var(--green)", fontSize: "11px", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase",
            padding: "5px 16px", borderRadius: "100px", marginBottom: "24px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--green)", display: "inline-block" }}></span>
            Three Products &#183; One Ecosystem
          </div>

          <h1 style={{
            fontFamily: "var(--font-syne), sans-serif",
            fontSize: "clamp(36px, 6vw, 70px)", fontWeight: 800,
            letterSpacing: "-2px", lineHeight: 1.05, marginBottom: "16px",
          }}>
            Trade with <span style={{ color: "var(--green)" }}>Discipline.</span>
            <br />Not Emotion.
          </h1>

          <p style={{ fontSize: "17px", color: "var(--sub2)", maxWidth: "480px", margin: "0 auto 48px", lineHeight: 1.8 }}>
            From simulating crypto strategies to tracking real NSE/BSE trades &#8212;
            Neeyum is the complete trader discipline ecosystem.
          </p>

          {/* 3 Product Cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px", marginBottom: "48px", textAlign: "left",
          }}>

            {/* TradeOS */}
            <a href="/tradeos" target="_blank" rel="noopener noreferrer"
              className="product-card product-card--trade"
              style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ background: "rgba(0,229,160,0.12)", borderRadius: "12px", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-syne),sans-serif", fontSize: "11px", fontWeight: 800, color: "var(--green)" }}>NSE</div>
                <span style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.2)", color: "var(--green)", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Live Now</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--sub)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>01 / 03</div>
              <div style={{ fontFamily: "var(--font-syne),sans-serif", fontSize: "24px", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.5px" }}>Neeyum TradeOS</div>
              <p style={{ fontSize: "13px", color: "var(--sub2)", lineHeight: 1.75, marginBottom: "18px", flex: 1 }}>
                Connect Dhan broker and automatically sync all NSE/BSE trades. Journal every trade, track emotions, see your real behaviour score.
              </p>
              {["Live trade sync via Dhan API", "Mandatory post-trade journal", "Behaviour + psychology score", "P&L breakdown with charges"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--sub2)", marginBottom: "6px" }}>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>&#8594;</span> {f}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "18px", marginTop: "16px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Launch TradeOS</span>
                <span style={{ fontSize: "20px", color: "var(--green)" }}>&#8594;</span>
              </div>
            </a>

            {/* Neeyum Lab */}
            <a href="#page-home" onClick={(e) => { e.preventDefault(); scrollToLab(); }}
              className="product-card"
              style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ background: "rgba(124,92,252,0.12)", borderRadius: "12px", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-syne),sans-serif", fontSize: "11px", fontWeight: 800, color: "var(--purple2)" }}>LAB</div>
                <span style={{ background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.2)", color: "var(--purple2)", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Live Now</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--sub)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>02 / 03</div>
              <div style={{ fontFamily: "var(--font-syne),sans-serif", fontSize: "24px", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.5px" }}>Neeyum Lab</div>
              <p style={{ fontSize: "13px", color: "var(--sub2)", lineHeight: 1.75, marginBottom: "18px", flex: 1 }}>
                BTC &amp; ETH F&amp;O discipline simulator. Ranked by behaviour, not profit. Practice strategies with simulated capital and real conditions.
              </p>
              {["BTC & ETH F&O simulation", "Global behaviour-ranked leaderboard", "Gamma to Delta to Theta to Elite", "5-metric behaviour score system"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--sub2)", marginBottom: "6px" }}>
                  <span style={{ color: "var(--purple2)", fontWeight: 700 }}>&#8594;</span> {f}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "18px", marginTop: "16px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Start Simulating</span>
                <span style={{ fontSize: "20px", color: "var(--purple2)" }}>&#8594;</span>
              </div>
            </a>

            {/* Neeyum Analyse */}
            <div className="product-card" style={{ opacity: 0.6, position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(124,92,252,0.12)", border: "1px solid rgba(124,92,252,0.25)", color: "var(--purple2)", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Coming Soon</div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ background: "rgba(245,200,66,0.12)", borderRadius: "12px", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-syne),sans-serif", fontSize: "11px", fontWeight: 800, color: "var(--gold)" }}>ANA</div>
              </div>
              <div style={{ fontSize: "11px", color: "var(--sub)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>03 / 03</div>
              <div style={{ fontFamily: "var(--font-syne),sans-serif", fontSize: "24px", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.5px" }}>Neeyum Analyse</div>
              <p style={{ fontSize: "13px", color: "var(--sub2)", lineHeight: 1.75, marginBottom: "18px", flex: 1 }}>
                Deep-dive analysis for any stock, crypto or index. NSE, BSE, NASDAQ and 500+ assets. Technicals, fundamentals and behavioural sentiment.
              </p>
              {["NSE, BSE, NASDAQ, NYSE stocks", "BTC, ETH and 500+ crypto assets", "Technical + fundamental analysis", "AI-powered pattern recognition"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--sub2)", marginBottom: "6px" }}>
                  <span style={{ color: "var(--gold)", fontWeight: 700 }}>&#8594;</span> {f}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "18px", marginTop: "16px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--sub2)" }}>Join Waitlist</span>
                <span style={{ fontSize: "20px", color: "var(--sub2)" }}>&#8594;</span>
              </div>
            </div>
          </div>

          {/* Divider into Lab */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "40px" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
            <div style={{ background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.2)", color: "var(--purple2)", fontSize: "11px", fontWeight: 700, padding: "6px 16px", borderRadius: "100px", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              &#8595; Neeyum Lab &#8212; Full Platform Details
            </div>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
           NEEYUM LAB — Full content (existing, preserved)
      ═══════════════════════════════════════════════════ */}
      <div id="page-home">

        {/* Lab sub-navigation */}
        <div style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", padding: "0 5%", display: "flex", gap: 0, overflowX: "auto" }}>
          {[["overview","Overview"],["how","How It Works"],["engine","Behaviour Score"],["levels","Levels & Capital"],["pricing","Pricing"]].map(([id, label]) => (
            <button key={id} onClick={() => setLabTab(id)}
              style={{ background: "transparent", border: "none", borderBottom: `2px solid ${labTab === id ? "var(--purple2)" : "transparent"}`, color: labTab === id ? "var(--purple2)" : "var(--sub2)", padding: "14px 18px", fontSize: "13px", fontWeight: labTab === id ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW / HERO */}
        {labTab === "overview" && (
          <section className="hero">
            <div className="hero-mesh"></div>
            <div className="hero-grid-lines"></div>
            <div className="hero-inner">
              <div className="hero-pill">
                <div className="hero-pill-dot"></div>
                Live Now &#183; BTC &amp; ETH F&amp;O Simulator
              </div>
              <h1>
                Master BTC &amp; ETH F&amp;O &#8212;<br />
                <span className="accent">Without Real Capital Risk.</span>
              </h1>
              <p className="hero-sub">
                Neeyum Lab is a behaviour-first crypto derivatives simulation platform designed to build discipline, risk control, and structured execution habits.
              </p>
              <div className="hero-ctas">
                <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  &#128242; Download Android APK
                </a>
                <button onClick={() => setLabTab("how")} className="btn-secondary">
                  Learn How It Works &#8594;
                </button>
              </div>
              <p className="hero-disclaimer">&#9888; Simulation only. No real-money trading. No financial advice.</p>
              <div className="hero-markets">
                <div className="market-chip">
                  <div className="market-icon">&#8383;</div>
                  <div className="market-info">
                    <div className="market-name">Bitcoin Options</div>
                    <div className="market-sub">BTC F&amp;O &#183; Fixed Leverage</div>
                  </div>
                </div>
                <div className="market-chip">
                  <div className="market-icon">&#926;</div>
                  <div className="market-info">
                    <div className="market-name">Ethereum Options</div>
                    <div className="market-sub">ETH F&amp;O &#183; Fixed Leverage</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HOW IT WORKS */}
        {labTab === "how" && (
          <section id="how">
            <div className="container">
              <div className="section-eyebrow">How It Works</div>
              <h2 className="section-title">Log. Analyse. Improve.</h2>
              <p className="section-sub">A four-step loop that compounds into real, measurable trading discipline over time.</p>
              <div className="steps-grid">
                <div className="step-card reveal"><div className="step-num">01</div><h3>Enter Simulated Trade</h3><p>Log BTC or ETH option trades manually with full parameters &#8212; entry, exit, SL, target, quantity, and emotion state.</p></div>
                <div className="step-card reveal rd1"><div className="step-num">02</div><h3>Follow Structured Risk Rules</h3><p>Daily loss limits enforced automatically. SL mandatory in Discipline Mode. Fixed leverage prevents emotional sizing.</p></div>
                <div className="step-card reveal rd2"><div className="step-num">03</div><h3>System Evaluates Behaviour</h3><p>The 5-Metric Behaviour Engine scores every trade across Risk Control, Discipline, Target Progression, Consistency, and Win Ratio.</p></div>
                <div className="step-card reveal rd3"><div className="step-num">04</div><h3>Monthly Score Generated</h3><p>Your composite Behaviour Score (0&#8211;100) is calculated monthly. It resets &#8212; but your behaviour history compounds forever.</p></div>
              </div>
              <div style={{ textAlign: "center", marginTop: "40px" }}>
                <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  &#128242; Download &amp; Start Training
                </a>
              </div>
            </div>
          </section>
        )}

        {/* BEHAVIOUR ENGINE */}
        {labTab === "engine" && (
          <section id="engine">
            <div className="container">
              <div className="section-eyebrow">5-Metric Behaviour Framework</div>
              <h2 className="section-title">Your Behaviour Score<br />Is Your Real Edge.</h2>
              <p className="section-sub">Five weighted metrics. One composite score (0&#8211;100). Calculated monthly based on your actual trading behaviour &#8212; not luck.</p>
              <div className="engine-grid">
                <div className="engine-metrics">
                  {METRICS.map((m, i) => (
                    <div key={i} className={`metric-row reveal ${expandedMetric === i ? "expanded" : ""}`}
                      onClick={() => setExpandedMetric(expandedMetric === i ? null : i)}>
                      <div className="metric-header">
                        <div className="metric-icon" style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: m.color }}>
                          {m.name.slice(0, 3).toUpperCase()}
                        </div>
                        <div className="metric-name" style={{ flex: 1 }}>{m.name} <span className="metric-weight">{m.weight}</span></div>
                        <div className="metric-score" style={{ color: m.color }}>{m.score}</div>
                      </div>
                      <div className="metric-details">
                        <div className="metric-details-inner">
                          <div className="metric-formula">{m.formula}</div>
                          <div className="metric-bar-bg"><div className="metric-bar" style={{ width: `${m.score}%`, background: m.color }}></div></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="formula-box reveal rd1">
                  <div className="formula-title">Final Score Formula</div>
                  <div className="formula-main">
                    Final Score =<br />(Risk &#215; 0.30) +<br />(Discipline &#215; 0.25) +<br />(Target &#215; 0.20) +<br />(Consistency &#215; 0.15) +<br />(WinRatio &#215; 0.10)
                  </div>
                  <div className="formula-result">
                    <div className="formula-result-val">72</div>
                    <div className="formula-result-label">Stable Trader &#183; Resets monthly &#183; History compounds</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* LEVELS */}
        {labTab === "levels" && (
          <section className="alt-bg" id="levels">
            <div className="container">
              <div className="section-eyebrow">Level Structure</div>
              <h2 className="section-title">Progress Through Discipline.<br />Not Just Profit.</h2>
              <p className="section-sub">Five levels from Gamma to Elite. Each unlocks higher simulated capital. Levels earned through behaviour &#8212; not just P&amp;L.</p>
              <div className="levels-grid">
                {[
                  { name: "&#915; Gamma", cap: "$30,000", target: "10%", glow: "rgba(100,200,100,0.5)", bc: "#64c864" },
                  { name: "&#916; Delta", cap: "$50,000", target: "15%", glow: "rgba(59,158,255,0.5)", bc: "var(--blue)" },
                  { name: "&#920; Theta", cap: "$70,000", target: "18%", glow: "rgba(124,92,252,0.5)", bc: "var(--purple2)" },
                  { name: "&#913; Alpha", cap: "$1,00,000", target: "20%", glow: "rgba(240,80,138,0.5)", bc: "var(--pink)" },
                ].map((l, i) => (
                  <div key={i} className={`level-card reveal${i > 0 ? ` rd${i}` : ""}`}>
                    <div className="level-glow" style={{ background: `radial-gradient(circle,${l.glow},transparent)` }}></div>
                    <div className="level-name" dangerouslySetInnerHTML={{ __html: l.name }} />
                    <div className="level-capital">Trading Capital</div>
                    <div className="level-capital-val">{l.cap}</div>
                    <div className="level-target-badge" style={{ fontSize: "22px", color: l.bc, border: `1px solid ${l.bc}40`, background: `${l.bc}18` }}>{l.target}</div>
                    <div className="level-note">Monthly target<br />to progress</div>
                  </div>
                ))}
                <div className="level-card elite reveal rd4">
                  <div className="level-glow" style={{ background: "radial-gradient(circle,rgba(245,200,66,0.6),transparent)" }}></div>
                  <div className="level-name">&#9889; Elite</div>
                  <div className="level-capital">Trading Capital</div>
                  <div className="level-capital-val">$2,00,000</div>
                  <div className="level-target-badge" style={{ background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.35)", color: "var(--gold)" }}>25%</div>
                  <div className="level-note">Highest level<br />Master tier</div>
                </div>
                <div className="level-reset reveal">
                  <strong>&#9888; Reset Rule:</strong> If a user incurs a loss of 50% of simulated capital at any level, the user may reset and restart that level. Behaviour history is retained.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PRICING */}
        {labTab === "pricing" && (
          <section id="pricing">
            <div className="container" style={{ textAlign: "center" }}>
              <div className="section-eyebrow">Pricing</div>
              <h2 className="section-title">No Ads. No Noise. Pure Discipline.</h2>
              <p className="section-sub" style={{ margin: "0 auto" }}>Start free. Upgrade to train like a structured trader.</p>
              <div className="pricing-grid">
                <div className="price-card reveal">
                  <div className="mode-badge free">&#128275; EXPLORER MODE</div>
                  <h3>Explorer</h3>
                  <div className="mode-price">
                    <span className="amount">Free</span>
                    <span className="period">/ Forever</span>
                  </div>
                  <div className="price-divider"></div>
                  <div className="price-features">
                    {["Start simulation instantly","BTC & ETH access","5 trades/day, 10% loss limit","Basic journal metrics"].map(f => (
                      <div key={f} className="pf-item"><div className="pf-check">&#10003;</div><div className="pf-on">{f}</div></div>
                    ))}
                  </div>
                  <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="price-btn outline" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
                    Get Started for Free
                  </a>
                </div>
                <div className="price-card featured reveal rd1">
                  <div className="price-pop">3-DAY FREE TRIAL AVAILABLE</div>
                  <div className="mode-badge paid">&#9889; DISCIPLINE MODE</div>
                  <h3>Discipline</h3>
                  <div className="mode-price">
                    <span className="amount">&#8377;99</span>
                    <span className="period">/ month</span>
                  </div>
                  <div style={{ color: "var(--green)", fontWeight: 700, fontSize: "12px", marginBottom: "20px" }}>
                    or &#8377;499/year &#8212; Save 58%
                  </div>
                  <div className="price-divider"></div>
                  <div className="price-features" style={{ textAlign: "left" }}>
                    {["3-Day Free Trial — no payment required","Everything in Explorer","Full behaviour analytics","Emotional heatmap & AI metrics","No advertisements"].map(f => (
                      <div key={f} className="pf-item"><div className="pf-check">&#10003;</div><div className="pf-on">{f}</div></div>
                    ))}
                  </div>
                  <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="price-btn grad" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
                    Start 3-Day Free Trial &#8594;
                  </a>
                </div>
              </div>
              <p className="refund-note">&#9888; Trial available once per user. Cancel anytime. <Link href="/refund-policy">Refund Policy</Link></p>
            </div>
          </section>
        )}

        {/* LEADERBOARD — always shown at bottom */}
        <section className="alt-bg" id="leaderboard">
          <div className="container">
            <div className="section-eyebrow">Global Leaderboard</div>
            <h2 className="section-title">Ranked by Behaviour.<br />Not by Profit.</h2>
            <p className="section-sub">The only leaderboard that measures discipline, consistency, and risk control. Not luck.</p>
            <div className="lb-filters">
              {[["global","🌍 Global"],["india","🇮🇳 India"],["gamma","Γ Gamma"],["theta","Θ Theta"],["elite","⚡ Elite"]].map(([k, l]) => (
                <div key={k} className={`lb-filter ${lbFilter === k ? "active" : ""}`} onClick={() => setLbFilter(k)}>{l}</div>
              ))}
            </div>
            <div className="lb-table">
              <div className="lb-header"><div>Rank</div><div>Trader</div><div>Level</div><div>Score</div><div>Badge</div><div>Risk Ctrl</div></div>
              {[
                { rank:"🥇", n:"AlphaWolf", loc:"🇮🇳 India · Elite", lv:"⚡ Elite", lc:"var(--gold)", sc:"89.4", scc:"var(--green)", b:"Elite Structured", bc:"var(--green)", r:"94%", av:"A", avG:"linear-gradient(135deg,#ffd700,#ff8c00)", avC:"#1a0f00" },
                { rank:"🥈", n:"CryptoZen", loc:"🇺🇸 USA · Alpha", lv:"Α Alpha", lc:"var(--pink)", sc:"87.1", scc:"var(--blue)", b:"Elite Structured", bc:"var(--green)", r:"91%", av:"C", avG:"linear-gradient(135deg,#3b9eff,#7c5cfc)", avC:"#fff" },
                { rank:"🥉", n:"SatoshiX", loc:"🇬🇧 UK · Theta", lv:"Θ Theta", lc:"var(--purple2)", sc:"84.9", scc:"var(--gold)", b:"Strong Discipline", bc:"var(--blue)", r:"88%", av:"S", avG:"linear-gradient(135deg,#f0508a,#7c5cfc)", avC:"#fff" },
              ].map((r, i) => (
                <div key={i} className={`lb-row ${i === 0 ? "top1" : i === 1 ? "top2" : "top3"}`}>
                  <div className="lb-rank" style={{ fontSize: "20px" }}>{r.rank}</div>
                  <div className="lb-user">
                    <div className="lb-avatar" style={{ background: r.avG, color: r.avC }}>{r.av}</div>
                    <div><div className="lb-username">{r.n}</div><div className="lb-country">{r.loc}</div></div>
                  </div>
                  <div className="lb-cell" style={{ color: r.lc }}>{r.lv}</div>
                  <div className="lb-score-val" style={{ color: r.scc }}>{r.sc}</div>
                  <div><span className="lb-badge" style={{ color: r.bc, borderColor: r.bc }}>{r.b}</span></div>
                  <div className="lb-cell" style={{ color: "var(--green)" }}>{r.r}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta">
          <div className="container">
            <h2>Stop losing to<br /><span className="acc">your own emotions.</span><br />Start training.</h2>
            <p>BTC &amp; ETH F&amp;O simulation. Behaviour scoring. Real discipline. Zero real risk.</p>
            <div className="hero-ctas">
              <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="btn-primary">
                &#128242; Download Android APK
              </a>
              <Link href="/about" className="btn-secondary">Read Our Story</Link>
            </div>
            <p className="hero-disclaimer" style={{ marginTop: "20px" }}>&#9888; Simulation only. No real-money trading. Not financial advice.</p>
          </div>
        </section>

      </div>

      {/* Product card styles */}
      <style>{`
        .product-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 26px 24px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .product-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
        .product-card--trade {
          background: linear-gradient(135deg,rgba(0,229,160,0.07),rgba(0,229,160,0.02));
          border: 1px solid rgba(0,229,160,0.22);
        }
        .product-card--trade:hover {
          box-shadow: 0 12px 40px rgba(0,229,160,0.1);
        }
      `}</style>
    </>
  );
}
