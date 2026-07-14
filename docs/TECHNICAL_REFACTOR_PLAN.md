# 技術リファクタリング計画

目的: 現在の巨大な `index.html` を、ゲーム挙動・保存形式・UI表示を変えずに段階的に分割する。

## 現状

- `index.html` に HTML、CSS、マスターデータ、エンジン、拡張エンジン、UI、イベントリスナーが全て含まれる。
- モジュール風に `__modules` と即時関数で分かれているが、物理ファイルは1つ。
- `TycoonEngine.prototype` を `installExpansion`, `installCompletion`, `installParity` が後付け拡張している。
- 週送り、保存、描画が密結合している。

## 推奨ディレクトリ構成

```text
index.html
css/
  app.css
js/
  main.js
  data/
    master.js
    missions.js
    expansion-data.js
  core/
    utils.js
    state.js
    normalize.js
    save.js
    engine.js
    week-engine.js
  systems/
    stores.js
    organization.js
    finance.js
    capital-markets.js
    venture.js
    products.js
    real-estate.js
    ma.js
    overseas.js
    supply-chain.js
    rd.js
    media-events.js
    personal-assets.js
    succession.js
    competitors.js
    achievements.js
  ui/
    dom.js
    render.js
    screens-home.js
    screens-map.js
    screens-business.js
    screens-office.js
    screens-market.js
    screens-venture.js
    screens-ma.js
    screens-assets.js
    screens-strategy.js
    screens-media.js
    screens-legacy.js
    screens-settings.js
    actions.js
    charts.js
tests/
  smoke-test.js
  syntax-check.js
  save-migration-test.js
  old-save-load-test.js
  long-run-test.js
  finance-integrity-test.js
```

## 各ファイルの責務と移動対象

| ファイル | 責務 | 移動対象 |
|---|---|---|
| `css/app.css` | 全スタイル | `<style>` 内CSS全体 |
| `js/data/master.js` | 業種、地域、株式、スタートアップ、役員、競合等マスター | `MASTER`, `normalizeMasterData` の純データ部分 |
| `js/data/missions.js` | ミッション/実績定義 | `MISSION_DEFS`, 拡張実績定義 |
| `js/data/expansion-data.js` | 創業者特性、サプライヤー、R&D、スポーツ等 | `FOUNDER_TRAITS`, `SUPPLIER_OFFERS`, `RD_PROJECTS` 等 |
| `js/core/utils.js` | 共通関数 | `deepClone`, `clamp`, `finite`, `uuid`, `yen`, `compactYen`, `pct`, `rand`, `pick` |
| `js/core/state.js` | 初期状態 | `createInitialState`, `makeProperties`, `makeTenants`, `makeRentalOffices` |
| `js/core/normalize.js` | 旧セーブ補完/不正値補正 | `mergeDefaults`, `normalize`, `ensureExpansionDefaults`, `ensureCompletionDefaults`, `ensureParityDefaults` |
| `js/core/save.js` | localStorage/JSON入出力 | `SAVE_KEY`, `SAVE_VERSION`, `load`, `save`, `loadSlot`, `exportSave`, `importSave`, `reset` |
| `js/core/engine.js` | `TycoonEngine` クラス本体 | コンストラクタ、イベント、通知、参照ヘルパー、会社価値/個人純資産 |
| `js/core/week-engine.js` | 週送りの順序制御 | `advanceWeek`, `updateMacro`, `recordHistory`, 拡張週次更新の呼び出し順 |
| `js/systems/stores.js` | 店舗/事業 | `openStore`, `closeStore`, `investBusiness`, `changePrice`, `fit`, 店舗売上計算 |
| `js/systems/organization.js` | 本社/部門/CXO/社員 | `contractOffice`, `createDepartment`, `hireDepartmentStaff`, `scoutExecutive`, `hireExecutive`, `departmentEffect`, キーパーソン |
| `js/systems/finance.js` | 借入、返済、レポート、税、キャッシュフロー | `borrow`, `repay`, `companyBorrowRate`, `personalBorrowRate`, `reports` 更新 |
| `js/systems/capital-markets.js` | 上場、配当、自社株、上場株投資 | `buyStock`, `sellStock`, `executeIPO`, `setDividend`, `buybackOwnShares`, `updateMarket`, 株式分割 |
| `js/systems/venture.js` | VC/スタートアップ/社内VC | `investStartup`, `convertStartupToSubsidiary`, `updateStartupIPO`, `proposeInternalVenture` |
| `js/systems/products.js` | 自社プロダクト/ファネル | `startProduct`, `investProduct`, `sellProduct`, `updateProducts`, `ensureProductFunnel`, `updateProductFunnelsWeekly` |
| `js/systems/real-estate.js` | 不動産/建設/個人不動産 | `buyProperty`, `sellProperty`, `buildOnLand`, 個人不動産更新 |
| `js/systems/ma.js` | M&A/のれん/子会社 | `generateMATargets`, `acquireTarget`, `sellMASubsidiary`, `updateSubsidiaries` |
| `js/systems/overseas.js` | 海外進出 | `expandOverseas`, `investOverseas`, `updateOverseas` |
| `js/systems/supply-chain.js` | 仕入先/在庫/垂直統合 | `contractSupplier`, `cancelSupplier`, `addVerticalIntegration`, `updateSupplyChainWeekly` |
| `js/systems/rd.js` | R&D/特許 | `startRDProject`, `licensePatent`, `updateRDWeekly` |
| `js/systems/media-events.js` | メディア/イベント/オークション | `generateMediaWeekly`, メディアアクション |
| `js/systems/personal-assets.js` | 個人投資/高級資産/スポーツ | `buyLuxury`, `buyPersonalInvestment`, `buySportsTeam`, `updatePersonalAssets`, `updateSportsExpandedWeekly` |
| `js/systems/succession.js` | 承継/再起業/エンディング | `sellCompany`, `startNewCompany`, `updateSuccessionWeekly`, `updateHallOfRecords` |
| `js/systems/competitors.js` | 競合 | `updateCompetitors`, `competitorPressure`, `seedCompetitorCounterStates`, `respondToCompetitor` |
| `js/systems/achievements.js` | ミッション/実績 | `checkMilestones`, エンディング判定 |
| `js/ui/*` | 描画とアクション | `render*`, `action`, `drawCharts`, DOM helper |

## グローバル変数への依存

現状依存:

- `engine`, `ui`, `$`, `app`, `toastRoot`, `modalRoot` が UI 全体でグローバル的に参照される。
- `TycoonEngine.prototype` を拡張関数が直接変更する。
- `MASTER` と各種マスター配列がエンジン/ UI の両方から参照される。

対策:

- `main.js` で依存注入: `createApp({ engine, uiState, rootNodes })`。
- システム関数は `engine` インスタンスメソッドのまま移動し、最初は挙動を変えない。
- 次段階で純関数化するが、物理分割PRでは行わない。

## 循環依存の危険

- `week-engine` がほぼ全システムを呼ぶため、各システムが `week-engine` を import すると循環する。
- UI が `engine` とデータ定義の両方を参照するため、データ→UI の逆参照は禁止。
- `normalize` がシステム固有デフォルトを知りすぎると循環しやすい。

ルール:

1. `data` と `utils` は他に依存しない。
2. `state/normalize/save` は `data/utils` のみに依存。
3. `systems` は `utils` と `engine` の状態に依存するが UI に依存しない。
4. `ui` は `engine` に依存してよいが、システムから UI を呼ばない。
5. `week-engine` はシステムを呼ぶ最上位オーケストレータにする。

## 読み込み順

GitHub PagesでES Modulesを使う場合:

```html
<link rel="stylesheet" href="css/app.css">
<script type="module" src="js/main.js"></script>
```

`main.js` の import 順:

1. `utils`
2. `data/*`
3. `state`, `normalize`, `save`
4. `engine`
5. `systems/*` のインストール
6. `ui/*`
7. `render()` 初回実行

互換性重視で最初は IIFE + 複数 `<script defer>` でもよいが、長期的には ES Modules 推奨。

## GitHub Pagesで動作を維持する方法

- ビルド不要の静的ファイルだけにする。
- 相対パスを使う。
- `type="module"` 使用時はローカル `file://` ではなく簡易HTTPサーバで確認する。
- 404回避のためファイル名の大文字小文字を統一する。
- 外部CDNに依存しない。

## 安全な分割手順

1. 現状のスナップショットテストを追加する。まだコードは分割しない。
2. JS構文チェックと長期週送りテストを作る。
3. CSSのみ `css/app.css` に移動するPR。
4. データ定義のみ `js/data/*` に移動するPR。
5. utils/state/saveを移動するPR。
6. UI描画関数を画面単位で移動するPR。
7. システム関数を責務ごとに移動するPR。
8. `advanceWeek` の順序表をテスト化してから分割する。

## 1回のPull Requestで行うべき変更量

- 目安: 1責務、差分300〜800行程度。
- 物理移動だけのPRではロジック変更禁止。
- 数値変更とファイル分割を同じPRに混ぜない。
- 保存スキーマ変更は必ず単独PR。

## 分割前後で確認すべきテスト

- HTML構造検査。
- JavaScript構文検査。
- 新規ゲーム開始。
- 旧セーブ読込。
- 10週、100週、1000週の週送り。
- セーブ→リロード→同一主要値確認。
- JSON export/import 往復。
- スロット保存/読込。
- iPhone幅で下部メニュー、モーダル、横スクロール表確認。

## ロールバック方法

- 物理分割PRは1責務ごとにするため、問題PRを revert する。
- 保存スキーマ変更前は必ずサンプル旧セーブを `tests/fixtures` に置く。
- `SAVE_KEY` は変更しないため、ユーザーの実セーブを破壊しない。必要時は読み込み時にバックアップを別キーへ保存する案を検討するが、通常運用キーは維持する。

## iPhone Safari確認項目

- 下部タブが安全領域に隠れない。
- モーダル下端のボタンがホームバーに隠れない。
- 横長テーブルが横スクロールできる。
- 入力欄でズームしないフォントサイズを維持する。
- `position: sticky/fixed` と `backdrop-filter` の負荷を確認する。
- `type="module"` のキャッシュ更新が反映されるか確認する。
- localStorage容量超過時の挙動を確認する。

## Phase 0 CSS extraction update (2026-07-14)

- Static CSS was physically extracted from the former single `<style>` block in `index.html` to `css/app.css`.
- `index.html` now loads the stylesheet with the GitHub Pages-safe relative path `./css/app.css`.
- CSS selector names, declaration values, rule order, media query order, JavaScript, save schema, weekly processing, random processing, and game balance were not intentionally changed.
- Future JavaScript or UI refactors should treat this as a structure-only baseline and keep CSS changes covered by `npm run test:css` plus the existing deterministic game regression tests.

## Phase 0 JavaScript extraction note

- The embedded classic game script has been physically moved from `index.html` to `js/app.js` without logical module splitting.
- `index.html` keeps the script load at the end of `body` and uses the project-site-safe relative path `./js/app.js`.
- The file remains a classic script; no `type="module"`, `defer`, or `async` is used.
- Future state/save/engine/UI splits should be performed in separate PRs with fixed-seed regression verification and without reordering prototype wrappers or initialization.

## Phase 0 module file split update (2026-07-14)

The first JavaScript physical split is complete. The former internal IIFE modules now live in `js/runtime.js`, `js/data.js`, `js/engine.js`, `js/expansion.js`, `js/completion.js`, `js/parity.js`, and `js/app.js` while preserving classic script execution. This is still not the future fine-grained subsystem structure listed above; it is an intermediate safety step that keeps the existing module boundaries and prototype installer order unchanged.

The internal registry is `globalThis.__capitalismTycoonModules`. Future refactors should not add additional globals or migrate to ES modules until fixed-seed, save compatibility, and browser timing checks are updated for that larger semantic change.
