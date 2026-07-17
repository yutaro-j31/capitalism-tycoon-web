# Phase 6E-4: privacy-safe playtest report

## Purpose

During physical iPhone Safari playtests, a defect report should include enough context to reproduce the problem without exposing the player's company name, player name, cash balances, store names, or complete save data.

## User flow

1. Open the in-game **Settings** tab.
2. Find **起動・診断情報**.
3. Select **不具合報告ファイルを保存**.
4. Attach the downloaded JSON file when reporting the defect.

The report contains:

- release candidate version and save format version;
- entrypoint, page path, user agent, connectivity, and current week;
- viewport size, pixel ratio, orientation, visibility state, and active tab;
- whether a save exists, whether it is readable, its UTF-8 byte size, and a non-reversible checksum;
- at most 30 recent sanitized UI actions.

## Privacy boundary

The report does **not** contain:

- player or company names;
- company or personal cash values;
- stores, employees, investments, holdings, loans, or other game-state objects;
- form values or visible button text;
- the raw JSON save.

Only static action identifiers such as `advance-week`, `tab`, and `save-now` are retained. Optional action metadata is limited to tokenized tab, kind, and binding identifiers.

## Compatibility boundary

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains 9.
- The module reads local storage only to calculate presence, readability, size, and checksum.
- It never calls `setItem`, `removeItem`, or `clear`.
- It does not change formulas, accounting, balance, progression, migrations, or random sequences.

## Automated verification

- `tests/playtest-report-ui-test.js` verifies privacy, storage purity, action bounds, exact download structure, and button insertion.
- `tests/playtest-report-webkit-test.js` creates a company in iPhone 13 WebKit, navigates through tabs, downloads the report, verifies private setup values are absent, and confirms the save is byte-for-byte unchanged.
- The standard iPhone WebKit workflow and release-candidate tag gate both require the browser download test to pass.
