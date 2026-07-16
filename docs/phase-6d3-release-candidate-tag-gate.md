# Phase 6D-3: Release Candidate Tag Gate

## Purpose

Create `v2.0.0-rc.1` only after the final `main` commit has passed automated release checks, the published GitHub Pages bytes match that checkout, and all required iPhone Safari smoke checks have been explicitly confirmed.

## Manual workflow only

The `Release Candidate Tag` workflow uses `workflow_dispatch` and has no push or scheduled trigger. It can run only from `main`.

The operator must confirm all six release-candidate smoke checks and record:

- tested iPhone model;
- Safari or iOS version;
- optional completion timestamp;
- optional notes.

Unchecked items, an invalid commit SHA, a non-main ref, missing device information, or malformed evidence blocks the workflow before any tag operation.

## Automated gates

Before tagging, the workflow:

1. rejects any open pull request;
2. writes a machine-readable `release-candidate-evidence.json` artifact;
3. runs `npm run test:release`;
4. verifies the published GitHub Pages static bytes against the checked-out commit;
5. retains the evidence artifact for ninety days;
6. creates an annotated tag only when the target tag does not already exist elsewhere.

If `v2.0.0-rc.1` already points to the same commit, the tag step is idempotent. If it points to a different commit, the workflow fails and never moves the existing tag.

## Evidence contract

`scripts/release-candidate-tag-gate.js` derives confirmation environment names from the smoke-check IDs in `release-candidate.json`. This keeps the manifest as the source of truth and prevents a workflow change from silently omitting a required check.

The evidence records the candidate version and tag, repository, branch, full commit SHA, actor, workflow run ID, test time, device, browser version, notes, and every confirmed smoke check.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains `9`.
- Release candidate remains `2.0.0-rc.1`.
- No game runtime, formula, balance, UI, migration, or randomness change.
- No tag is created by this implementation PR itself.
