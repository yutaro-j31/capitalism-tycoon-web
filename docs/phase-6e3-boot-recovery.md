# Phase 6E-3: boot recovery

## Purpose

Keep restart and save-backup actions available when a required JavaScript file fails before the full game recovery module installs.

## Behavior

`js/boot-recovery.js` loads before `runtime.js` and does not depend on game modules or application CSS. During startup it watches JavaScript errors, promise rejections, and failed script or stylesheet resources.

The standalone dialog provides:

- `最新版で再起動`: opens the same-origin project `play.html` with a fresh reload token.
- `JSONバックアップ`: downloads the exact canonical save string.
- `画面に戻る`: closes only the temporary dialog.

At browser `load`, a successfully installed `runtime-recovery-ui.js` receives the latest early failure and replaces the minimal guard. When the runtime never installs, the boot dialog remains available.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- save version remains 9.
- local storage is never written, removed, or cleared.
- backup bytes remain unchanged, including invalid JSON.
- original browser errors are not suppressed.
- formulas, accounting, balance, migrations, progression, and random sequences are unchanged.
- the API uses `Symbol.for('capitalismTycoon.bootRecovery')` instead of adding a named global.
- critical layout is inline and uses iPhone safe areas and 44-pixel controls.

## Verification

`tests/boot-recovery-test.js` covers script order, storage purity, safe restart URLs, HTML escaping, exact backup bytes, symbol registration, and handoff.

`tests/boot-recovery-webkit-test.js` returns HTTP 404 for `js/runtime.js` in an iPhone 13 WebKit session, then verifies the dialog, exact JSON backup, `play.html` restart, and save preservation.

The focused recovery workflow, standard WebKit workflow, release-candidate contract, and RC tag workflow enforce this path.
