# Phase 6E-1: release diagnostics and safe restart

## Purpose

Make mobile launch and cache recovery self-service after the two-store WebKit freeze and in-app browser blank-page reports.

## Player-facing behavior

The settings screen gains an `起動・診断情報` card that shows:

- release candidate version
- current entrypoint and launch mode
- save schema version and saved week
- online/offline state
- the current project-site path

The card provides two actions:

1. `最新版で再起動` opens `play.html` with a fresh reload token.
2. `診断情報をコピー` copies a small support payload without company cash, personal assets, names, history, or the full save.

The safe restart does not clear or rewrite local storage. Players should still export JSON before destructive troubleshooting.

## Compatibility contract

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- save version remains 9.
- no game formulas, balance, finance, progression, migration, or random sequence changes.
- diagnostics may read only the saved week from the canonical save.
- diagnostics must never call `localStorage.setItem`, `removeItem`, or `clear`.
- the settings card must be inserted idempotently and must not create a MutationObserver feedback loop.
- the restart target must always be the same-origin project `play.html` entrypoint with stale query and fragment data removed.

## Verification

`tests/release-diagnostics-ui-test.js` verifies:

- external classic-script module presence and public contract
- manifest-aligned release and save identifiers
- safe diagnostics redaction
- HTML escaping
- stable render keys
- same-origin cache-safe launcher URL generation
- clipboard success and permission-denied fallback behavior
- blocked/corrupt storage handling
- absence of save-storage mutation APIs

The contract runs from the existing static release-hardening gate.

`tests/release-diagnostics-webkit-test.js` runs in the iPhone 13 WebKit workflow and verifies:

- the settings card is visible and actionable
- copied diagnostics omit private game state
- `最新版で再起動` reaches `play.html`
- the same company, week, cash, and save version survive the restart
- screenshot and machine-readable evidence are retained with the existing WebKit artifact
