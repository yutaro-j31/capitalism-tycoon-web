# Manual Codex development (ChatGPT plan)

This directory contains the reusable prompt for developing Capitalism Tycoon Web with **Codex Web / Codex Cloud signed in through the user's ChatGPT plan**.

The project does **not** require an `OPENAI_API_KEY`, a GitHub write PAT for automation, or a scheduled Codex GitHub Action in this operating mode.

## Instruction hierarchy

Keep the files separate by purpose:

1. **`/AGENTS.md`** — repository-wide, durable operating rules for Codex and other coding agents. Keep this file at the repository root.
2. **`/CLAUDE.md`** — detailed project-specific invariants, pitfalls, and validation rules.
3. **`/docs/feature-requests.md`** and **`/docs/gameplay-systems-roadmap.md`** — current backlog and roadmap.
4. **`.github/codex/prompts/manual-development.md`** — short task launcher for a manually started Codex task.

Do not paste the full contents of `AGENTS.md` into every task. The launcher explicitly tells Codex to read the current repository copy so the durable rules can evolve independently.

## iPhone / iPad operating loop

1. Open Codex Web while signed in with ChatGPT.
2. Select the GitHub-connected `yutaro-j31/capitalism-tycoon-web` environment/repository.
3. Start a **Code** task.
4. Paste the contents of `.github/codex/prompts/manual-development.md`.
5. Optionally append one specific task after the launcher. If no task is appended, Codex should select the next safe unit of work according to `AGENTS.md`.
6. Let Codex inspect the repository, implement one reviewable change, and run focused tests.
7. When supported by the connected Codex environment, have it push a non-main branch and open a **Draft PR**. It must never merge autonomously.
8. Return to ChatGPT with the PR URL. ChatGPT reviews the live GitHub state, CI, diff, and review feedback before any merge.

## Usage and cost boundary

This manual path is intentionally separate from API automation. Do not add an `OPENAI_API_KEY` merely to use this workflow. Usage is governed by the Codex allowance of the ChatGPT account used to sign in.

## Removed API scheduler

The previous hourly GitHub Actions + `openai/codex-action` scheduler was removed after choosing the ChatGPT-plan-only operating model. This prevents hourly skipped runs and avoids accidentally enabling API-billed autonomous development.

If API automation is ever reconsidered, restore it through a new reviewed PR rather than silently re-enabling old scheduler files.
