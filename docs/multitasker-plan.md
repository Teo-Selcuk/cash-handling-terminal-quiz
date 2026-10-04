# Multitasker / OVERLOAD implementation

1. Build a deterministic shared run engine with independent task clocks, all nine task contracts, configurable unlocks/scaling, modes, pressure evidence and run serialization. Verify task rules, deadlines, simultaneous events and mode endings with unit tests.
2. Add setup, responsive panels and keyboard/pointer controls. Verify 1–9 panels and real concurrent timers in Chromium. Persist completed and interrupted runs through the existing history store.
3. Integrate sample runs, metrics, filters, shared charts, detailed activity tables, error opportunities and evidence-based recommendations. Verify both Real and Sample Data and every existing History tab.
4. Review intended changes, run unit/browser suites, commit, push, watch the existing Pages workflow, and verify the deployed game and analytics.

The existing chart/check-hold work remains included. No existing game or history format is removed. The player selects a focused panel for keyboard input; pointer controls always belong to their own panel. Task deadlines advance independently from the shared run clock. Memory-study phases do not accept answers prematurely, and a single expiration is scored once.
