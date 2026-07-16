# Phase 6D-1: Release Candidate Contract

## Purpose

Freeze the first release-candidate identity and make its deployment, save compatibility, and manual smoke requirements machine-readable before creating a Git tag.

## Candidate identity

- Version: `2.0.0-rc.1`
- Planned tag: `v2.0.0-rc.1`
- Source branch: `main`
- Entrypoint: `./index.html`
- Deployment target: GitHub Pages project site
- Canonical release command: `npm run test:release`

The machine-readable source of truth is `release-candidate.json`.

## Save compatibility

The release candidate keeps:

- `SAVE_KEY`: `capitalism_tycoon_web_v1`
- save version: `9`
- compatibility floor: version `9`

The candidate contract test loads the production engine and fails when runtime values drift from the manifest.

## Automated contract

The `Release Candidate Contract` workflow verifies:

- release-candidate semantic version and matching tag name;
- repository, source branch, entrypoint, and GitHub Pages destination;
- Pages-safe relative CSS and JavaScript paths;
- absence of a conflicting HTML `base` element or external JavaScript dependency;
- runtime save key and save version parity;
- the required manual smoke-test list.

This focused workflow complements the existing complete `Release Readiness` workflow. It does not replace balance, compatibility, long-run, or UI gates.

## Required manual smoke test

Before creating the candidate tag, verify on the published GitHub Pages site using iPhone Safari:

1. A fresh visit reaches the founder setup screen.
2. A JSON save can be restored before creating a replacement company.
3. One-week advance produces a weekly report and remains responsive.
4. Four-week advance completes and presents the final weekly summary.
5. Save, export, reset, and import remain reachable and functional.
6. Top and bottom safe areas, horizontally scrollable navigation, buttons, forms, and modals remain usable.

## Tag gate

Create `v2.0.0-rc.1` only when:

- the exact final `main` commit passes every required workflow;
- no open release-oriented PR or unresolved review thread remains;
- the published Pages commit matches the intended `main` commit;
- all six manual smoke checks pass;
- no critical save-loss, startup, progression, or mobile-navigation defect is known.

A failed smoke check blocks tagging and starts a focused corrective PR without changing the save key or save version unless a tested migration is intentionally introduced.
