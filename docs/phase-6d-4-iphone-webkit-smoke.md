# Phase 6D-4: iPhone WebKit automated smoke

## Purpose

Add a real WebKit browser gate for the release-candidate path without treating emulation as a substitute for the required physical iPhone Safari check.

The automated smoke runs the static game in Playwright WebKit using the `iPhone 13` device descriptor. It verifies the highest-risk release path from a clean browser context through save recovery.

## Automated path

The smoke test performs the following sequence:

1. Starts a repository-local static server with path traversal protection and no-cache responses.
2. Opens the game in WebKit with an iPhone viewport, touch input, mobile user agent, Japanese locale, reduced motion, blocked service workers, and Tokyo time zone.
3. Confirms that a fresh visit shows the founder setup form and the pre-setup JSON recovery control.
4. Creates a company and confirms that the configured state is saved under `capitalism_tycoon_web_v1`.
5. Advances one week and checks the weekly report modal.
6. Advances four weeks and checks the final weekly report modal.
7. Opens settings and verifies save, export, import, and reset controls.
8. Downloads the exported JSON and validates its configured company state.
9. Resets the game, returns to setup, and imports the exported JSON through the setup recovery input.
10. Confirms the company name, game week, and save state after recovery.
11. Checks document overflow, horizontally scrollable navigation, visible interactive controls, and modal width on the iPhone viewport.
12. Fails on page errors, console errors, failed resource requests, invalid JSON, missing controls, or layout overflow.

A result JSON file, exported save, and screenshot are retained as workflow artifacts. Failure runs also retain a best-effort screenshot and diagnostic arrays.

## CI contract

The `iPhone WebKit Smoke` workflow:

- runs for every pull request and by manual dispatch;
- has read-only repository permissions;
- installs pinned `playwright@1.61.0` without changing `package.json` or creating a lockfile;
- installs only the WebKit browser and its system dependencies;
- uploads evidence for 30 days.

The lightweight `iphone-webkit-smoke-contract-test.js` runs inside the canonical release-delivery gate. It protects the workflow trigger, permission, pinned version, WebKit-only implementation, critical selectors, evidence upload, and release-tag ordering without requiring a browser download during every ordinary release-readiness job.

## Release candidate tag gate

The manual `Release Candidate Tag` workflow now also:

- installs the same pinned Playwright and WebKit versions;
- reruns the complete non-browser release gate;
- runs the automated iPhone WebKit smoke;
- retains browser evidence for 90 days;
- verifies the published GitHub Pages bytes;
- creates the annotated tag only after every earlier step succeeds.

The existing six physical-device confirmations, iPhone model, Safari/iOS version, and test time remain mandatory. Automated WebKit success does not authorize checking those manual boxes.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains `9`.
- No game runtime, formula, balance, migration, UI output, or randomness behavior is changed.
- No permanent npm dependency or package lock is added.
- The release candidate remains `2.0.0-rc.1` until the final tag workflow is explicitly dispatched from `main`.
