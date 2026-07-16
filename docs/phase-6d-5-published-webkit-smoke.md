# Phase 6D-5: published iPhone WebKit smoke

## Purpose

Close the gap between a repository-local browser test and the actual GitHub Pages delivery used by players.

Phase 6D-4 proved the release path in Playwright WebKit against a local static server. Phase 6D-5 reuses the same destructive-in-browser path against the canonical published URL only after every published static byte matches the current checkout.

## Published path

The `Pages Deployment Smoke` workflow now performs this sequence on every `main` push and by manual dispatch:

1. Check out the exact `main` commit.
2. Wait for GitHub Pages and compare `index.html` plus every relative CSS and JavaScript asset by byte length and SHA-256.
3. Install pinned `playwright@1.61.0` and WebKit only.
4. Run the full iPhone WebKit smoke against `https://yutaro-j31.github.io/capitalism-tycoon-web/`.
5. Retain the result JSON, exported save, and screenshot for 30 days.

The browser context is fresh, so setup, save, reset, and import operations affect only that isolated browser profile. No server-side or repository state is changed.

## Target safety

`IPHONE_WEBKIT_TARGET_URL` is accepted only when it:

- uses HTTPS;
- has no credentials;
- has the same origin and directory path as `release-candidate.json`;
- has no caller-provided query string or fragment.

The test adds its own cache-busting query after validation. Arbitrary external targets cannot be supplied to the release smoke.

## Release candidate tag gate

The manual tag workflow now requires both browser paths:

1. local static iPhone WebKit smoke;
2. exact published-byte attestation;
3. published GitHub Pages iPhone WebKit smoke;
4. annotated tag creation.

Tag creation remains the final step. Failure in either browser path or the byte attestation prevents `v2.0.0-rc.1` from being created.

## Physical-device boundary

Published WebKit automation still does not replace the physical iPhone Safari evidence in Issue #63. Safe-area rendering, Safari chrome interaction, download behavior, memory pressure, and device-specific responsiveness must still be confirmed on a real iPhone before the tag workflow is dispatched.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains `9`.
- The game runtime, formulas, balance, accounting, migrations, and deterministic behavior are unchanged.
- No permanent npm dependency or package lock is added.
- Repository permissions remain read-only for the Pages verification workflow.