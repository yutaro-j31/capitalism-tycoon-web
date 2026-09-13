# PE UI Phase 1 polish — production WebKit screenshots

These PNGs were captured from the repository's real `index.html` in Playwright WebKit, using the production JavaScript, CSS, PE adapter, and PE renderer. State injection existed only in the temporary capture process; no production source was modified.

- Base main SHA: `408cbe409cf32d2f6bc2fe7669248a384a81dae5`
- Viewport: `390x844`
- Browser: WebKit
- Horizontal overflow: none in all five captures
- Page errors: 0
- Console errors: 0

| Screenshot | Weeks remaining | Deployment | Severity | Recommended range | Bid price | Participants | recommendDrop |
|---|---:|---:|---|---|---|---|---|
| [Fund — normal](./fund-normal-390x844.png) | 100 | 50% | normal | — | — | — | — |
| [Fund — warning](./fund-warning-390x844.png) | 52 | 65% | warning | — | — | — | — |
| [Fund — critical](./fund-critical-390x844.png) | 8 | 70% | critical | — | — | — | — |
| [Final Bid — Bid primary](./bid-primary-390x844.png) | 100 | 50% | normal | 17.11億円–19.85億円 | 17.11億円 | none | false |
| [Final Bid — Drop primary](./bid-drop-primary-390x844.png) | 100 | 50% | normal | 17.11億円–19.85億円 | 19.46億円 | foreign-major (外資系大手, aggressiveness 1.06) | true |

The critical capture displays both `資金消化条件未達 → 次号ファンド組成条件を満たせません` and the production-formatted undeployed amount (30.00億円). The Drop-primary capture is triggered by the canonical `foreign-major` rival ID, without changing its roster display name.
