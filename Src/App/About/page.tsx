import React from "react";

export default function About() {
    return (
        <div id="page-about" style={{ paddingTop: "64px" }}>
            <section>
                <div className="container">
                    <div className="section-eyebrow">About Neeyum Lab</div>
                    <div className="about-inner">
                        <h2 className="section-title" style={{ textAlign: "center" }}>
                            Built to Solve<br />One Core Problem.
                        </h2>
                        <p><strong>Most traders fail not because of strategy — but because of behaviour.</strong></p>
                        <p>Neeyum Lab was built from the ground up to answer a single question: What if a platform enforced discipline instead of enabling impulsive trading?</p>
                        <p>We believe <strong>discipline compounds</strong>. Emotion destroys capital. The market doesn't care about feelings — and neither does your Behaviour Score.</p>
                        <p>We start with <strong>BTC & ETH F&O simulation</strong>. We expand only when structure is proven strong. No premature scaling. No noise. Just one focused tool that does what brokers never will — holds you accountable to yourself.</p>
                        <div className="about-values">
                            <div className="av-card">
                                <div className="av-icon">🏗</div>
                                <h4>Structure First</h4>
                                <p>Every feature exists to enforce structure, not to enable gambling. Rules are non-negotiable.</p>
                            </div>
                            <div className="av-card">
                                <div className="av-icon">📊</div>
                                <h4>Data Over Emotion</h4>
                                <p>Your behaviour score is built from real data — not self-assessment. The numbers don't lie.</p>
                            </div>
                            <div className="av-card">
                                <div className="av-icon">🌱</div>
                                <h4>Compounding Discipline</h4>
                                <p>Score resets monthly. But habits don't. Behaviour history compounds into mastery over time.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
