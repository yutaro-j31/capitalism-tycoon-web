# J2 補足：画面に出ない11モジュールの重複調査

- 基準: `main` @ `d6b09f79`（2026-11-13）。文書のみ。コードの変更・挙動変更の提案はなし。
- 対象: ブランチ `docs/inventory`（コミット `7c30b2da`）の `README.md` J2 にある11モジュール。各節の「判定」は事実の分類までで、画面に載せる・消すの判断は書かない。
- 状態の実測: 新規ゲーム（シナリオ free・難易度 normal）で操作せず156週進めた時点の `engine.g` を読んだ（1シード。店舗0・会社借入0・取締役会未設置・非上場）。「値を持つか」はこの条件での値。
- 判定の語: **重複**＝本番に同じ役割の別の仕組みがある／**単独**＝本番に代わりがない／**中身が空**＝処理自体が no-op（Mode 0 など）。

## 前例（調査済み・確定）：役員3モジュール

`executive-retirement-succession` / `executive-reviews-succession-board` / `executives-department-assignments` は `g.executiveManagement` を使うが、本番の役員は `js/engine.js` の `hireExecutive` が使う `g.executives`。`executiveManagement` の候補生成・採用は到達不能な 'finance' 画面のボタンからしか呼ばれず、本番では役員リストが常に空（実測: `executiveManagement = {candidates:[], executives:[], assignments:{}, history:[]}`、`executives = {}`）。よって退任処理は毎週動くが対象は0人。→ 判定は「重複」。

## 1. bank-loans-covenants（`js/bank-loans-covenants.js`）

- **機能**: 返済期間・コベナンツ付きの銀行融資（`borrowFromBank`）と、ジム開業時の開業ローン（`gymStartupQuote` / `fundGymStartup`）、その週次返済（`service`）。
- **本番に同じ役割の仕組み**: **ある**（一般の会社借入）。`js/engine.js:1775` `borrow(amount, account)`（`companyDebt` と `finance.loans` を更新）、画面は `js/app.js:578` `renderBank` の「借入」ボタン → `js/app.js:974` 付近 `case 'borrow-company'` → `engine.borrow`。`borrowFromBank`（js/bank-loans-covenants.js:84）は js/ 内に呼出元がなく、画面側 `inject()` は存在しない `[data-screen="finance"]`（:86）を探す。
- **例外（本番で生きている部分）**: ジム開業ローンは `js/engine.js:1061, 1178, 1222` から呼ばれ、`updateMacro` ラップ経由で毎週 `service`/`serviceGymStartupWorkout` が走る。この部分に本番の代わりはない。
- **書く状態**: `g.bankFinancing`。実測値は `{loans:[], history:[], lastServiceWeek:157, migrationVersion:1}`＝**空**（ジム店舗を出していないため）。ジム店舗を出した場合のみ `loans` に入る見込みだが、今回は未計測。
- **判定**: **重複**（一般の銀行借入について）。ただしジム開業ローン部分は単独。

## 2. board-governance-resolution（`js/board-governance-resolution.js`）

- **機能**: 取締役会が「成長投資案件」を決議する仕組み（`submitGrowthInvestmentResolution`、取締役の性格パラメータによる賛否）。
- **本番に同じ役割の仕組み**: **ある**（ただし表示のみ）。`js/engine.js:1469` `establishBoard`、`js/engine.js:2610` が四半期ごとに `g.boardAgendas`（「成長投資枠の承認」「財務規律の強化」など）を生成、`js/app.js:429` が一覧表示（承認ボタンなし）。決議を実行する本番側の操作はない。モジュール側 `submitGrowthInvestmentResolution` は js/ 内に呼出元なし。
- **書く状態**: `g.boardGovernance`。実測値は既定メンバー（CEO/CFO ほか）と `resolutions: []`＝**初期値のまま**。
- **判定**: **重複**（役割は同じ「取締役会が成長投資を承認する」。本番側は議題の表示のみで、決議操作は本番にもモジュール側にも到達経路がない）。

## 3. corporate-bonds-ratings（`js/corporate-bonds-ratings.js`）

- **機能**: 社債の格付・発行・利払い。
- **本番に同じ役割の仕組み**: **ない**（債券での資金調達の代替はない。借入は `engine.borrow` のみ）。
- **書く状態**: `g.bondFinancing`。実測値は `{bonds:[], history:[], lastServiceWeek:null}`＝**常に空**。`issue()` と `service()` は `return false`（js/corporate-bonds-ratings.js:12-13、コメント「GF-002 Mode 0」）。
- **判定**: **中身が空（Mode 0）**。

## 4. convertible-bonds-dilution（`js/convertible-bonds-dilution.js`）

- **機能**: 転換社債の発行・転換と希薄化。
- **本番に同じ役割の仕組み**: **ない**。
- **書く状態**: `g.convertibleFinancing`。実測値は `{notes:[], history:[], lastServiceWeek:null}`＝**常に空**。`issue()`（:8）・`service()`（:10）は `return false`。
- **判定**: **中身が空（Mode 0）**。

## 5. preferred-shares-dividends（`js/preferred-shares-dividends.js`）

- **機能**: 優先株の発行と優先配当。
- **本番に同じ役割の仕組み**: **ない**（普通株の配当・自社株買いは `js/shareholder-returns.js` だが優先株ではない）。
- **書く状態**: `g.preferredFinancing`。実測値は `{series:[], history:[], lastServiceWeek:null, totalDividendsPaid:0}`＝**常に空**。`issue()`（:8）・`service()`（:9）は `return false`。
- **判定**: **中身が空（Mode 0）**。

## 6. global-company-ranking-goals（`js/global-company-ranking-goals.js`）

- **機能**: 企業スコアから世界順位を毎週算出し、世界トップ100・25・10・1位の目標を一度だけ達成して名声（`prestige`）を記録する（`docs/global-company-ranking-goals.md`）。
- **本番に同じ役割の仕組み**: **ない**。近いものは業界別ランキング `js/parity.js:101` `computeIndustryRanking`（ramen/cafe/conveni の業界内順位、画面 `js/app.js:208`）で、世界順位ではない。エンディング `global_tycoon`（`js/completion.js` の `ENDING_DEFS`）は企業価値1兆円の判定で別物。
- **書く状態**: `g.globalRanking`。実測値は `currentRank:96, score:1242, prestige:10, completedGoalIds:["top100"]`、履歴あり＝**本番で実際に値を持つ**（毎週更新）。ただし読み手は `hall-of-fame-generations` と `long-run-guidance` のみで、どれも画面に出ない。報酬は記録のみでスコアに反映しない（コメント #816）。
- **判定**: **単独（本番に代わりなし）**。

## 7. hall-of-fame-generations（`js/hall-of-fame-generations.js`）

- **機能**: 実績（利益黒字化・世界トップ100/10・子会社5社）の解除と遺産ポイント、世代交代（`retireCurrentGeneration`）の記録。
- **本番に同じ役割の仕組み**: **ある**。記録は `g.hallOfRecords`（`js/expansion.js:259` で定義、`js/expansion.js:892` `updateHallOfRecords` が毎週更新）、世代交代は `js/expansion.js:759` `retireFounder` / `js/expansion.js:792` `executeSuccession`（`legacyScore`・`inheritedLegacyScore`）、画面は `js/app.js:739` `renderLegacy`。モジュール側の `retireCurrentGeneration` は自モジュールの画面のボタン以外に呼出元がない。
- **書く状態**: `g.hallOfFame`。実測値は `{generation:1, legacyPoints:10, achievements:["global-top100"], records:[]}`＝毎週処理されるが**ほぼ初期値**（実績1件のみ。世代交代の記録は空）。本番の `hallOfRecords`・`legacyScore`（実測51）は別に値を持つ。
- **判定**: **重複**。

## 8. long-run-guidance（`js/long-run-guidance.js`）

- **機能**: 長期プレイの案内（5ステップ: 1週進める／現金維持／黒字化／世界トップ100／世代交代）の達成を記録し、チェックリストを出す。
- **本番に同じ役割の仕組み**: **ある**。創業ガイド `js/founding-tutorial.js:89` `STEPS`（画面は `js/app.js:974` `founding-tutorial-jump`）、秘書の「今週やること」`js/executive-secretary.js:14` `generateTasks`（`js/app.js:154`）、ミッション `js/data.js:1828` `MISSION_DEFS`（初期値 `activeMissionIDs: ['mission_setup']` は `js/engine.js:306`）。本モジュールの `renderSection` は js/ 内に呼出元がなく、閉じる操作 `dismissLongRunGuidance` も自モジュールの画面のボタンのみ。
- **書く状態**: `g.longRunGuidance`。実測値は `completed:["advance-week","positive-cash","global-top100"]`、`dismissed:false`（毎週更新され値を持つが、読み手は自モジュールの画面のみ）。
- **判定**: **重複**。

## 判定一覧

| # | モジュール | 本番に同じ役割の仕組み | 書く状態の実値（156週・操作なし） | 判定 |
|---|---|---|---|---|
| 1 | bank-loans-covenants | あり: `js/engine.js:1775` `borrow`／`js/app.js:578` renderBank（ジム開業ローン部分は本番で生きており単独） | `bankFinancing` 空（`loans:[]`） | 重複 |
| 2 | board-governance-resolution | あり（表示のみ）: `js/engine.js:1469,2610`／`js/app.js:429` | `boardGovernance` 初期値のまま（`resolutions:[]`） | 重複 |
| 3 | corporate-bonds-ratings | なし | `bondFinancing` 常に空（`issue`/`service` は `return false`） | 中身が空 |
| 4 | convertible-bonds-dilution | なし | `convertibleFinancing` 常に空（同上） | 中身が空 |
| 5 | preferred-shares-dividends | なし | `preferredFinancing` 常に空（同上） | 中身が空 |
| 6 | global-company-ranking-goals | なし（業界ランキング `js/parity.js:101` は別物） | `globalRanking` 値あり（rank 96・毎週更新） | 単独 |
| 7 | hall-of-fame-generations | あり: `g.hallOfRecords`（`js/expansion.js:892`）・`retireFounder`/`executeSuccession`（`js/expansion.js:759,792`） | `hallOfFame` ほぼ初期値（実績1件） | 重複 |
| 8 | long-run-guidance | あり: `js/founding-tutorial.js:89`・`js/executive-secretary.js:14`・`js/data.js:1828` | `longRunGuidance` 値あり（3ステップ達成） | 重複 |

（前例の役員3モジュールは上記「前例」のとおり 重複。）
