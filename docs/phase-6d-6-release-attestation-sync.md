# Phase 6D-6: release attestation synchronization

## Purpose

Make the successful public deployment evidence visible on the release tracking issue without relying on a maintainer to copy commit SHAs, workflow URLs, or artifact names by hand.

The synchronization does not approve the physical-device checklist and does not create a tag. It only records automated evidence after the complete published Pages path has succeeded.

## Trigger and trust boundary

`Release Attestation Sync` runs only when the named `Pages Deployment Smoke` workflow completes successfully. The job additionally requires:

- the source event to be a `push`;
- the source branch to be `main`;
- the source repository to be this repository;
- the attested commit to still be the current `main` commit;
- exactly one non-expired `published-iphone-webkit-smoke-<SHA>` artifact on the source run.

A successful but stale Pages run is ignored because a newer `main` push will produce its own attestation.

## Issue synchronization

For current successful runs, the workflow:

1. reads Issue #63;
2. updates only the `Target main commit` line;
3. replaces the prior automated published-evidence line with the current commit;
4. preserves every physical iPhone Safari checkbox;
5. creates or updates one marker comment containing the candidate, commit, deployment URL, workflow run, completion time, and evidence artifact;
6. retains the rendered issue body and comment as a 90-day workflow artifact.

The marker comment is idempotent, so repeated runs update one comment instead of creating an unbounded comment history.

## Permissions

The workflow uses:

- `contents: read` to check out the exact attested commit;
- `actions: read` to verify the browser evidence artifact;
- `issues: write` to update Issue #63 and its attestation comment.

It has no repository-contents write permission and contains no tag or push command.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains `9`.
- The game runtime, user interface, formulas, balance, migrations, accounting, and random-number behavior are unchanged.
- Physical iPhone Safari confirmation remains mandatory before `v2.0.0-rc.1` can be created.