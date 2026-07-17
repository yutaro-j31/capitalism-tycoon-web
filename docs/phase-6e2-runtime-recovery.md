# Phase 6E-2: runtime recovery

## Purpose

Keep recovery actions reachable when an uncaught browser error interrupts the normal game screen.

## Player behavior

The recovery dialog provides:

- `最新版で再起動`: opens the same-origin `play.html` entrypoint with a new reload token.
- `JSONバックアップ`: downloads the current save without changing it.
- `診断情報をコピー`: copies release diagnostics and bounded error metadata.
- `画面に戻る`: closes only the recovery dialog.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- save version remains 9.
- the recovery module does not write, remove, or clear local storage.
- formulas, accounting, balance, progression, migrations, and random sequences are unchanged.
- the original browser error is not suppressed.
- repeated copies of the same error are debounced.
- diagnostics exclude company and player names, cash values, stores, histories, and the complete save.
- safe-area padding and inline layout keep the controls reachable on iPhone.

## Verification

`tests/runtime-recovery-ui-test.js` covers storage purity, error normalization, path handling, HTML escaping, diagnostic redaction, backup construction, invalid-save handling, duplicate-error suppression, and closing the dialog.

`tests/runtime-recovery-webkit-test.js` creates an iPhone 13 WebKit session, throws a real uncaught asynchronous error, confirms the dialog appears, verifies the saved bytes are unchanged, inspects the redacted payload, closes the dialog, and retains evidence.

The focused `Runtime Recovery Contract`, the standard iPhone WebKit workflow, and the release-candidate tag workflow all protect this behavior.

## Boundary

This phase covers failures after the recovery module has installed. Cache-safe startup remains handled by `play.html`; an error that prevents all scripts from loading requires a separate early-start design.
