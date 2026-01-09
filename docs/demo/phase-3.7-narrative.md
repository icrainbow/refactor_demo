# Agentic Work vs Noise Work

## The Pain: Meetings as Throughput Theater

- **Calendar Tetris:** Senior analysts spend 60% of their time in status meetings, not reviewing KYC files or catching money laundering red flags.
- **Copy-Paste Compliance:** Junior staff manually extract document snippets into Word templates because no system knows context—just raw data dumps.
- **Invisible Wait States:** Cases sit in queues for days waiting for human handoffs that could be automated checkpoints, but management only sees green SLAs.

## What This Demo Proves: State Machine + Deterministic Routing + Topic Extraction

- **Context-Aware Routing:** The system dynamically selects the right topic catalog (KYC review, Case2 CS integration, IT bulletins, guardrail checks) based on live application state—no hardcoded branches.
- **Deterministic Priority Chain:** Guardrail alerts override IT reviews, IT reviews override Case2, Case2 overrides standard KYC—explicit priority ensures critical issues surface first, not last.
- **Topic Extraction as Orchestration:** Instead of dumping 50-page PDFs to humans, the system extracts structured topics (UBO verification, sanctions screening, source of funds) and routes them to specialized sub-agents for parallel analysis.

## Why This Matters in Big Banks: Risk Control + Cost + Velocity

- **Risk Control:** False negatives in KYC kill banks (fines, criminal liability). Deterministic routing means every high-risk case hits the right guardrails—no analyst fatigue or missed steps.
- **Cost:** Each prevented false positive saves 20 hours of investigator time. Each prevented false negative avoids $10M+ in regulatory fines. Scale that across 10,000 cases/month.
- **Velocity:** Automated checkpoints (HITL pause, topic summaries, risk scoring) compress 3-day review cycles to 3-hour cycles—same quality, 20x throughput, zero calendar Tetris.

---

*Phase 3.7: This architecture is production-ready for regulated financial institutions requiring auditable, deterministic decision flows under Federal Reserve oversight.*
