# Release Readiness Gate

This checklist defines the minimum merge and release gate after the Phase 6B balance audits.

Run the complete local release gate with:

```bash
npm run test:release
```

The dedicated `Release Readiness` workflow runs the same command on pull requests and manual dispatches. The command executes progression and balance readiness, compatibility and UI hardening, and delivery-environment checks.

## Progression and balance

- Normal-start progression reaches IPO using production actions and at least 52 organic weekly reports.
- The 39-case strategy matrix passes across representative industries, regions, borrowing policies, and deterministic seeds.
- The 90-row difficulty/scenario matrix passes for Easy, Normal, and Hard in Free Play and Standard Scenario.
- Standard Scenario keeps explicit target, checkpoint, deadline, completion, overdue, score, and grade metadata.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains 9 unless a migration is intentionally introduced and tested.
- Existing saves load without duplicate calibration or loss of player-earned demand.
- Runtime state remains finite and JSON-serializable.

## System invariants

- Finance validation and accounting invariants pass.
- Market, supply, workforce, competitor, crisis, restructuring, valuation, IPO, M&A, and subsidiary tests pass.
- Long-run tests complete without bankruptcy caused by non-finite state or broken lifecycle integration.
- Deterministic tests do not add or consume new runtime randomness.

## User experience

- Core progression remains playable on iPhone Safari.
- Crisis, turnaround, scenario, and IPO blockers remain visible and actionable.
- Weekly summaries explain material changes without mutating state during rendering.
- Save, load, import, export, and reset remain reachable.

## Delivery environment

- The viewport contract retains device width, initial scale, and `viewport-fit=cover`.
- Safe-area spacing remains active for the top bar, bottom navigation, and compact mobile layout.
- Buttons and form controls retain touch-sized minimum heights, and constrained modals remain scrollable.
- A deterministic 520-week game can be serialized, loaded, and saved again without invalid state.
- The canonical ten-year save remains at or below 4 MiB, with no reload/save growth above 64 KiB.
- Mobile contract checks must finish within 30 seconds and the ten-year storage audit within 180 seconds.

## Merge policy

A release-oriented pull request may be merged only when:

1. the branch is based on current `main`;
2. all required GitHub Actions jobs pass on the exact final head;
3. no unresolved review thread or known critical defect remains;
4. save compatibility and deterministic regression gates pass; and
5. the complete diff has been reviewed for unrelated changes.
