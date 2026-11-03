# Phase 3 P3-4 — competitor dilution on every external issuance (G5)

**Status: gameplay-visible correction.** It is step 4 of the activation readiness memo
(`PHASE_3_P3_4_ACTIVATION_READINESS.md`, gap G5), which the Owner approved on 2026-11-03. It does not activate the
authority or grant S_PASS.

## What changes

The player company's competitor stake is held as a ratio, `competitorOwnedRatio`, over the outstanding shares
(issued − treasury). The shared external-issuance helper `engine.issueSharesToExternalHolders` keeps the competitor's
share count fixed when new shares are issued: it rescales the ratio over the larger denominator. The share swap and the
M&A equity raise already used it.

Four writers raised `sharesOut` directly and kept the old ratio. Each issuance therefore **grew** the competitor's
implied share count, taking the extra shares from the external float:

| Writer | Entry |
| --- | --- |
| W-INVESTOR | `acceptInvestorOffer` (`js/expansion.js`) |
| W-SPONSOR | `requestSponsorInjection` (`js/player-crisis-actions.js`) |
| W-TURNAROUND-ACCEPT | turnaround-fund `accept` (`js/player-crisis-turnaround-fund.js`) |
| W-TURNAROUND-RATCHET | turnaround-fund `settle` (`js/player-crisis-turnaround-fund.js`) |

All four now issue through `issueSharesToExternalHolders`. After an issuance:

- the founder's and the competitor's share counts are unchanged;
- the new shares are external;
- the three ratios still sum to 1.

The ratchet's own listed-row mirror (#1211) moves into the helper, which writes the same values.

## Who sees it

Only a company with a nonzero competitor stake. Competitor purchases need a listed company, while W-INVESTOR, W-SPONSOR
and W-TURNAROUND-ACCEPT refuse a listed company. In practice the visible case is the ratchet after an IPO during the
fund term, or a stake left over after delisting. With no competitor stake, every outcome is unchanged. Compared with
before this change, issued shares,
cash, the ledger and the founder's ratio are unchanged in every case. No RNG is drawn.

## Evidence

`tests/issuance-competitor-dilution-case.js` (run by `tests/ma-share-swap-ownership-ratios-test.js`) starts each writer from a consistent cap table (founder 70%, competitor
20%, external 10%). It checks for each one that:

- the founder's and the competitor's counts are unchanged;
- the external count grows by exactly the issued shares;
- the ratios sum to 1;
- accounting validates.

Each writer's case fails when that writer's change is reverted. The existing atomicity, ratchet and verification-leg
tests of the four writers pass unchanged.
