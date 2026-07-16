# Phase 6D-2: GitHub Pages Deployment Attestation

## Purpose

Prove that the public GitHub Pages site is serving the exact static runtime from the intended `main` checkout before the release-candidate tag is created.

## Static delivery contract

The repository root contains `.nojekyll` so GitHub Pages serves the checked-in files without Jekyll transformation.

`scripts/pages-deployment-smoke.js` reads `release-candidate.json`, then compares the published bytes with the local checkout for:

- `index.html`;
- `release-candidate.json`;
- every relative stylesheet referenced by the entrypoint;
- every relative JavaScript module referenced by the entrypoint.

The verifier rejects absolute, parent-directory, and repository-escaping asset paths. Every local and remote file is compared using SHA-256 and byte length.

## Deployment timing

A push to `main` can start the smoke workflow before GitHub Pages has finished publishing. The verifier therefore retries stale or unavailable assets with cache-busting requests.

The default workflow allows twenty attempts at thirty-second intervals and has a fifteen-minute job timeout. A newer `main` push cancels the older verification run so a stale commit cannot produce a later green result.

## Release integration

The canonical release-delivery gate runs a local deterministic test of:

- asset discovery and path safety;
- full runtime coverage;
- stale-deployment retry behavior;
- permanent mismatch failure;
- workflow trigger and concurrency wiring;
- `.nojekyll` presence.

The actual remote comparison runs only after a push to `main` or manual dispatch. Pull requests do not compare unpublished branch bytes against the public Pages site.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains `9`.
- No runtime game module, formula, balance value, UI output, migration, or randomness changes.
- The release candidate remains `2.0.0-rc.1`.

## Tag gate

`v2.0.0-rc.1` remains blocked until the Pages Deployment Smoke workflow succeeds for the intended final `main` commit and the six manual iPhone Safari checks are completed.
