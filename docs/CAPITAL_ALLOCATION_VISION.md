# 資本配分構想（Capital Allocation Vision）

> **この文書の位置づけ**
>
> - 2026-09-29 時点の**長期構想**です。記載されている Deal Book・Control Ladder・Entity Registry などは**どれも実装されていません**。
> - **Economic Engine Gate D supersession:** Economic Engineの実装順序・tick順序・取引/会計契約・monetary precisionについては、`docs/economic-engine/ECONOMIC_ENGINE_ROADMAP.md`、`PHASE_0_CONTRACTS.md`、`ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md` を優先します。本文中の旧「Allocation→Valuation」順序、旧weekly phase案、`整数円化してBS差0円`目標、旧P1/P2フェーズ番号は歴史的設計入力であり、Economic Engineの実装契約ではありません。
> - 現在のゲームプレイ深掘りの進捗管理は `docs/gameplay-systems-roadmap.md`、全体の要約は `docs/GAME_OVERVIEW.md` を正とします。この文書は、それらを置き換えるものではありません。
> - 本文の「第2部 監査報告」は `main` @ `849586c`（#781）時点のコードを読んで書いたものです。その後のコード変更で記述が古くなっている可能性があります。着手するときは、該当箇所を必ず最新の `main` で再確認してください。
> - 3作品（Wall Street Raider / Big Ambitions / Global Business Tycoon）の調査まとめは `docs/REFERENCE_GAMES_RESEARCH.md` にあります。
>
> 構成:
> - 第1部 オーナー判断と着手条件（確定事項・着手前の再確認事項・個人純資産の現状調査）
> - 第2部 監査報告（`849586c` 時点。登録時の訂正を注記として追加）

---

# 第1部 オーナー判断と着手条件

## A. オーナー判断（2026-09-29 確定）

以下はすべて確定事項です。変更するときはオーナーの判断を得て、この節を更新してください。

### A-1. 個人純資産に自社株の持分を含める

- 監査の P0-4（§19）への回答です。
- `personalNetWorth()` に、プレイヤー（創業者）が保有する自社株の価値を算入します。

### A-2. 自社株の評価基準

| 状態 | 評価額 |
|---|---|
| 上場後 | 株価 × 持株数 |
| 未上場 | 会社の評価額 × 創業者の持株比率 × 0.7 |

- 未上場時の 0.7 は、流動性がないことによる割引（30%）です。

### A-3. 二重計上の防止

- 自社株は、どの口座・どの形で持っていても **1株につき1回だけ**数えます。
- 対象になる形の例: 創業者持株、個人口座で保有する自社ティッカー、家族信託の持株。

### A-4. エンディング条件は据え置き

- エンディング `capital_king`（個人純資産 1兆円）の閾値は変更しません。
- A-1 によって到達しやすさは変わりますが、条件そのものはそのままです。

### A-5. 所有の閾値は Control Ladder を採用する

- 監査 §11.2 が提案した、日本の会社法の閾値に基づく Control Ladder を採用します。
  - 1% / 3% / 1/3 / 1/2 / 2/3 / 90%
- 調査まとめ（`docs/REFERENCE_GAMES_RESEARCH.md` §3）の 5 / 20 / 33 / 51 / 80% は**採用しません**。
- 5% と 20% は、支配の段階ではなく「開示・会計上の区切り」として残します（2026-09-29 オーナー判断）。
  - 5%: 大量保有報告。買い集めが相手に知られるきっかけになる区切りです。
  - 20%: 持分法。将来の連結会計で使う区切りです。
- 監査 §11.2 の表は、支配の段階（上の6つ）と、開示・会計上の区切り（5% と 20%）を合わせたものとして読んでください。

### A-6. 着手順序

1. 是正作業（Issue #745）を完了する。
2. iPhone 実機で、週送り時間と保存容量を計測する。
3. Phase 0（監査 §20）に着手する。

**是正作業が完了するまで、Phase 0 以降には着手しません。**

## B. 着手前に再確認が必要な事項

### B-1. 株価のファンダ連動化（Phase 4）と Microcap の分布

- 株価を発行体の業績に連動させると（監査 Phase 4）、Microcap の分布の前提が変わります。
- 対象は `docs/MICROCAP_MODE_DESIGN.md` §4.1 の実測（Rule B の実測）です。前提ごと変わるため、再測定が必要です。
- 注: 「Rule B」は依頼時の呼称です。`docs/MICROCAP_MODE_DESIGN.md` の本文にはこの表記がなく、§4.1 の実測表を指します。

### B-2. Founding Route Rebalance の再開条件

- `docs/FOUNDING_ROUTE_REBALANCE_DESIGN.md` の作業（成長率の底上げなど）は、是正作業と Phase 0 の完了後に再測定してから再開します。

### B-3. 監査付録 C の未確認事項（5件）

1. 自社の公募増資（Secondary offering）の有無。上場子会社の追加募集は確認済み。
2. `maSubsidiaries[].retainedEarnings` が表示用のトラッカーか、会計上の意味を持つか。
3. `market[]` 銘柄の配当が実際に支払われる経路（`investmentDividend` カテゴリは存在する）。
4. 自社保有物件へ出店したときに、賃料が内部化されているか。
5. iPhone 実機（Safari）での週送り時間と保存の挙動（IDB へのフォールバックの頻度）。A-6 の手順2で計測します。

### B-4. 登録時に判明した補足（2026-09-29）

- **#776 との関係**: 監査 §2.2・§18-1・P0-1 の「週次処理の順序」について、登録時に注記を追加しました（第2部の該当箇所を参照）。最終確定処理の順序は #776 で固定済みです。残る課題は、境界の内側にある中間フェーズを宣言的に定義することです。
- **A-2 の「会社の評価額」の算出元**: 実装するときに決めます。候補は現行の `companyValue()`（`js/engine.js`）か、将来の Valuation Service です。
- **調査まとめ §46 の20項目の一部は、監査では扱いが浅いか未検討です**: ROIC vs 資本コスト、Deployable Capital、法人単位のリスク分離、カウンターパーティ容量など。項目ごとの対応状況は `docs/REFERENCE_GAMES_RESEARCH.md` の冒頭の表を参照してください。該当する Phase に着手する前に検討します。

## C. 個人純資産の現状調査（`main` @ `849586c`、読み取りのみ）

A-1〜A-3 を実装するときの前提として、現状を記録します。

### C-1. `personalNetWorth()` が今数えているもの

**本体（`js/engine.js` の `personalNetWorth()`）**

- 足すもの:
  - 個人現金
  - 個人口座の上場株（時価）
  - `owner==='personal'` の物件
  - 個人投資
  - 高級資産
  - 会社名義ではないスポーツチーム
  - VC の個人持分
  - 創業者ローンの債権
- 引くもの: 個人負債

**拡張（`js/expansion.js` の `personalNetWorth` 上書き）**

- 足すもの:
  - 個人所有の PE 案件
  - エンジェル投資
  - 個人不動産
  - 個人不動産法人の現金
  - 家族信託の現金（`familyTrustCash`）
- 引くもの:
  - 住宅ローン
  - 信用取引の借入

**創業者持株（`founderShares` / `founderOwnershipRatio`）は数えていません。**

### C-2. 家族信託の持株

- 含まれていません。数えているのは `familyTrustCash` だけです。
- `familyTrustShares` を増やす処理がありません。値が変わるのは、新会社を作るときの引き継ぎ（`js/completion.js` の新会社生成処理）だけなので、実際には常に 0 です。

### C-3. A-3（1株1回）に関係する既存の経路

- **個人口座での自社株購入**: 上場後は `market[]` に自社ティッカーが追加されます（`js/engine.js` の IPO 処理）。`buyStock` は自社ティッカーの購入を禁止していないため、個人口座で自社株を買うと、すでに時価で個人純資産に入ります。ここに創業者持株を足すと、同じ株を2回数える経路になります。
- **会社口座での自社株購入**: `buyStock(ticker, qty, 'company')` で会社口座から自社ティッカーを買う経路もあります（実質的な自己株）。`treasuryBuybackShares` との関係を整理する必要があります。

### C-4. 変更すると影響する箇所

| 区分 | 箇所 |
|---|---|
| エンディング | `js/completion.js` の `capital_king` 判定、エンディング記録、週次要約 |
| 実績 | `js/engine.js` の実績 `networth1b`（個人資産10億円） |
| 挙動 | `personalCreditLimit()` が純資産を使っているため、個人の借入枠が変わる。履歴 `personalNetWorthHistory` |
| 表示 | `js/app.js`、`js/d-ui-shell.js`、`js/play-runtime-compat.js`、`js/save-storage.js` |
| テスト | `founder-shareholder-loan-lender`、`pe-dual-ownership`、`personal-real-estate-corp` / `-depreciation` / `-mortgage` / `-operations`、`personal-stock-margin`、`save-storage-quota`、`sports-team-accounting`、`startup-funding-round` |
| フィクスチャ | `tests/fixtures/transaction-baseline-v1.json`、`current-version-save.json`、`future-version-save.json`、`embedded-javascript-baseline.js` |

- `personalCreditLimit()` が変わると、借入可能額を経由してシミュレーションの経路が変わる可能性があります。その場合は決定論の fingerprint が動くことがあるので、CLAUDE.md §7 に従って原因を確認してから更新します。
- フィクスチャ4つの中身が実際に変わるかどうかは、実装するときに確認が必要です。

---

# 第2部 監査報告（`main` @ `849586c` 時点）

> 以下は 2026-09-29 の監査報告の本文です。登録時の訂正は「登録時注記」として追加しました。本文中の「ユーザー判断」とある項目は、第1部 A で確定しています。

**監査名**: Capitalism Tycoon — WSR × Big Ambitions × GBT 統合 実装可否・アーキテクチャ監査

- 監査日: 2026-09-29
- 対象: `yutaro-j31/capitalism-tycoon-web` `main` @ `849586c`（#781）
- 方針: コード変更・branch・PR・save schema変更なし。読み取りと計測のみ。
- 証拠の扱い: 「確認済み」はファイル/行を示す。コードから確定できない点は「未確認」「推定」と明記する。

---

## 1. Executive Summary

**結論: 成立する。ただし「今のコードに機能を足していく」形では成立しない。先に4つの基盤（週次パイプライン・永続化コスト・資金移動プリミティブ・Entity/Ownershipの読み取りモデル）を直せば、既存資産の8割はそのまま活かせる。全面書き直しは不要。**

- **ゲームデザイン面**: 成立する。このリポジトリには既に WSR 的な部品が驚くほど揃っている。例: M&A Deal Room（競合入札・ラウンド・取締役会承認・買収ファイナンス・PMI）、PEファンド（GP/LP・Exit Decision Center・IPO Exit・Secondary）、VC（希薄化・フォローオン・セカンダリー）、社債・格付け・CB、銀行コベナンツ、上場子会社のTOB/スクイーズアウト、自社株買い・配当、アクティビスト、Capital Allocation Score/Policy などが実装済み。**足りないのは部品ではなく、部品どうしをつなぐ共通の経済レイヤ**。具体的には次の4点。
  1. 上場株 `market[]` がファンダメンタルズと無関係なランダムウォーク（`js/engine.js:1714`）。
  2. 株の保有が議決権・支配につながらない。
  3. 競合企業・上場企業・M&A候補が別々のデータ構造で、互いにつながっていない。
  4. 個人純資産に「自社株の持分」が入っていない（`js/engine.js:893`, `js/expansion.js:783`）。
- **技術面**: 成立するが前提条件がある。最大のボトルネックはシミュレーション計算ではなく**永続化**。40店舗・104週の計測で、1週あたり中央値1.19秒（Node/デスクトップ）、localStorage保存ペイロードは6.65MB。CPUプロファイルでは save 系（structuredClone・compaction・JSON.stringify・トランザクション開始時のJSONスナップショット）が **約50%** を占めた。100社・1000店舗規模は今のままでは無理。ただし、店舗をコホート単位で集約し、AIの精度を段階分けし、保存を差分/ダーティ方式にすれば到達できる。
- **役割分担の仮説**（WSR = Engine、Big Ambitions = Progression/Operations、GBT = CEO UI）は**妥当**。ただし2点を修正すべき。
  - Big Ambitionsから取り込むのは「操作量」ではなく「**委任によって判断レイヤが上がる構造**」。
  - WSRの金融商品の網羅性（オプション・先物・暗号資産・サブプライム等）は**取り込まない**。
- **独自性の核**として次の3点を提案する。これにより「店舗経営ゲーム＋投資ミニゲーム」でも「WSRのモバイル移植」でもないゲームになる。
  1. 資本配分を2つの通貨で考える: **Cash** と **Bandwidth（経営の注意力）**。
  2. 全ての投資機会を同じ比較軸に正規化した「**Deal Book**」。
  3. 日本の会社法の閾値（1%/3%/1/3/1/2/2/3/90%）を使った「**Control Ladder**」。

---

## 2. Current Game Architecture（確認済みの実状態）

### 2.1 技術スタック

| 項目 | 実状態 | 根拠 |
|---|---|---|
| 言語/形式 | Vanilla classic script（ES modules不使用）。`globalThis.__capitalismTycoonModules` レジストリ | `docs/FINANCE_ENGINE_DESIGN.md`, 各js冒頭 |
| モジュール数 | `js/` 205ファイル（約3.5MB）。`index.html` の `<script src>` は205本 | `ls js`, `grep '<script' index.html` |
| ビルド | なし（package.jsonはテストスクリプトのみ） | `package.json` |
| テスト | `tests/` 609ファイル。canonical CI は A–K の11 shard | `tests/run-all-shards.json`, CLAUDE.md §7 |
| 中核 | `TycoonEngine extends EventTarget`（`js/engine.js`, 2263行・約200KB） | `js/engine.js:651` 付近 |
| UI | `js/app.js`（render/イベント）＋ D UI shell（`js/d-ui-shell.js`, `js/d-ui-context-tabs.js`）＋ enhancer registry（予算79） | CLAUDE.md §3 |
| 地図 | Canvas 2D ＋ DOMマーカー（Phase 2） | `js/map-phase2-canvas.js` |
| 保存 | `SAVE_KEY=capitalism_tycoon_web_v1`、`saveVersion=9`、localStorage＋quota対応compaction（`js/save-storage.js`）＋IDB（`js/save-storage-idb.js`） | `js/save-storage.js:1-20` |
| 乱数 | `simulationRng`（seed付き）。`Math.random` はゲーム生成時のseed取得1箇所だけ | `js/engine.js:863` |

### 2.2 ランタイム構造: 「デコレータ連鎖型エンジン」

全体の挙動を決めている構造上の特徴。

- 各拡張モジュールが `EngineClass.prototype.X` を**上書きラップ**する（ベース関数を保持して呼び直す）。
- 計測結果（`grep 'prototype\.X='`）:

| ラップされるメソッド | ラップ数 |
|---|---|
| `normalize` | **46** |
| `updateParityWeekly` | **27** |
| `advanceWeek` | **16** |
| `save` | 7 |
| `configure` | 5 |

- `advanceWeek` の最終順序は **`index.html` のscriptロード順**で決まる。明示的なフェーズ定義はない。
- 例: `shareholder-returns.js` は `baseAdvanceWeek` を捕まえ、配当支払週だけ前後処理を差し込む。
- `runTransaction()`（`js/engine.js:743`）は、外側トランザクションの開始時に `JSON.stringify(this.g)` で全状態のスナップショットを取る。ロールバック用。

> **登録時注記（2026-09-29）**: この監査の基準コミット `849586c` には、既に #776（#740）が含まれている。#776 は `js/play-runtime-compat.js` に最も外側の週次境界を置き、全ラッパの実行後に「会計スナップショットの再構築 → 危機判定 → 検証 → 週次要約の更新」を行うよう固定した。つまり**最終確定処理の順序は既に宣言されている**。上の記述のうち、依然として正しいのは「境界の内側にある各ラッパの相対順序が script のロード順で決まる」という点である。§18-1 と P0-1 は、この残りの部分（中間フェーズの宣言化）を指す。

### 2.3 状態モデル: 単一グローバル状態 `g`

**プレイヤー会社は暗黙のシングルトン**になっている。

- 会社の値はトップレベル直下にある: `companyCash`, `companyDebt`, `sharesOut`, `founderShares`, `stockPrice`, `publicCompany`, …
- `businesses[]` は業種ごとの共有レコード（price/quality/brand）で、「プレイヤー会社の事業」と「業種マスタ」を兼ねている。
- この歪みは実害を出している。`js/management-context.js` 冒頭コメントによると、PE買収先に同じ操作をさせるには「`state.businesses[]/state.stores[]` に書くと所有者間で漏れる」ため、業種ごとに **detached runtime bridge** を作る必要があった（5本柱すべてで個別実装）。

**所有関係は10種類以上の別々の形で表現されている。**

| 資産 | 所有表現 |
|---|---|
| 上場株 | `companyStocks` / `personalStocks`: `{[stockID]:{qty,avg}}` |
| VC | `startups[].ownedCompany` / `ownedPersonal`（比率） |
| スタートアップ子会社 | `subsidiaries[].ownership` |
| M&A子会社 | `maSubsidiaries[]`（暗黙に100%） |
| 上場子会社 | `listed-subsidiary-*`（TOB/スクイーズアウトあり） |
| PE案件 | `peDeals[].ownerAccount`、`deal.portfolioCompany.cash` |
| 不動産 | `properties[].owner`（'company'/'personal'）＋ `personalRealEstateHoldings[]` |
| スポーツチーム | `sportsTeams[].owner` |
| その他 | `familyTrustShares`、`personalRealEstateCorp` |
| 自社 | `founderOwnershipRatio` / `externalShareholderRatio` / `competitorOwnedRatio`（スカラー） |

### 2.4 会計モデル（`js/finance.js`）

**方式**: 会計イベント方式。複式簿記の仕訳ではない。

- `finance.event(g, category, amount, {cashEffect, profitEffect, assetEffect, liabilityEffect, equityEffect, sourceType, sourceID, ...})`
- 32カテゴリが Operating / Investing / Financing に分類される。
- `idempotencyKey` / `operationID` による重複排除がある。

**資金移動は二重書き**。まず状態を直接書き換え、次にイベントを記録する（例: `buyStock` `js/engine.js:1335`）。

```
this.g[cashKey]-=cost; if(account==='company') finance.event(...)
```

→ 正本は `g.companyCash`。ledger はそれを説明する並行記録にすぎない。書き漏れは `finance-cash-mutation-coverage-test` などのテストで網を張っている。

**BSはハイブリッドで作られる**（`bsFrom()`）。

- 資産側は状態配列から毎回導出される:
  - `stockBook` は取得原価（時価評価しない）
  - `subsidiaryBook` は取得原価/純資産簿価
  - `propertyBook`, `goodwillBook`, `otherFixedBook`
- 純資産側は ledger のロールフォワードで独立に計算される（`openingRetainedEarnings + 累積純利益 − 配当 + 修正`）。
- `validate()` がチェックする項目:
  - BS差額が±2円以内か
  - BS現金と `companyCash` が一致するか
  - CF恒等式
  - 週次スナップショットの連続性
  - ロールフォワード現金
- **BSの構造的な欠落**:
  - `shortTermDebt=companyDebt`、`longTermDebt=0` 固定（長短区分がない）
  - 非支配株主持分・連結・持分法がない
  - 投資有価証券は原価評価

**資金プールの状態**: 3＋1プールが分離されており、PE保存則はテストで保証されている。

| プール | 実体 | ledger |
|---|---|---|
| Company | `companyCash` | あり |
| Personal | `personalCash` | **なし**。スカラーと `personalNetWorth()` の計算のみ |
| Fund | `fund.cash` | PE側の保存則テスト（T21） |
| PE Portfolio | `deal.portfolioCompany.cash` | 書き込みは `settlePortfolioOperatingWeek()` のみ |

**評価は関数ごとにバラバラ**。

- `companyValue()`（`js/engine.js:879`）: 現金−負債＋店舗収益価値＋不動産＋株時価＋VC持分＋子会社＋M&A子会社＋プロダクト＋海外＋スポーツ、の合計（sum-of-parts ヒューリスティック）。
- `personalNetWorth()`（`js/engine.js:893` ＋ `js/expansion.js:783` の拡張）: **創業者が持つ自社株の価値を含まない**。
- ほかにも評価ロジックが独立して存在する: Deal Room の valuation bridge、PE評価、スタートアップ valuation、上場子会社株価。

### 2.5 市場・競合

**上場株 `market[]`**（計測時36銘柄。microcapを含む）

- 価格式（`js/engine.js:1714`）:
  ```
  move = trend + (economy−1)·0.018 + noise(±volatility)
  ```
  自社ティッカーだけ `profit/companyValue` の項が加わる。
- **発行体の財務諸表を持たない**。
- 注文ルール（`js/engine.js:605-650`）:
  - 1注文の上限は発行済株式の5%
  - インパクトは `min(3%, qty/issued·0.6)`
  - 手数料0.1%
  - 約定価格は前後の中値
  - `stockOrderPlan` で複数注文に分割できる
- bid/ask・板・出来高はない。空売りもない（grep 0件）。個人の信用取引はある（`js/personal-stock-margin.js`）。

**競合は二系統ある**

| 系統 | 中身 |
|---|---|
| `state.competitors`（engine） | グループ配分（`COMPETITOR_GROUPS`, `allocateCompetitorGroupBudgets`）。利益は `stores × rand(10万〜45万)`（`js/engine.js:1977`） |
| `state.competitorStates`（`js/competitor.js`、ramen限定） | 戦略・価格/広告/品質/能力AI、財務、信用枠、distress→turnaround→bankrupt のライフサイクル、プロジェクト、市場参入。公開情報だけを参照 |

- どちらも**上場銘柄ではなく、買収もできない**（`acquireCompetitor` 系は0件）。

**M&A候補**

- `generateMATargets()`（`js/engine.js:1588`）は、8社名 × 乱数の valuation/margin で**毎回合成される架空企業**。世界に既に存在する企業ではない。
- 買収後の `maSubsidiaries` も抽象モデル。`operatingProfit/52 × rand(.8,1.2)`、valuation はランダムウォーク（`js/engine.js:1998`）。

### 2.6 運営・組織・委任

**運営の深さ**

- `market.js` / `supply.js` / `workforce.js` の詳細シミュレーションは ramen 中心（`SIMULATION_SYSTEMS`, `TARGET_BUSINESS_IDS`）。
- 他の柱は業種固有モデルを持つ（`docs/GAME_OVERVIEW.md` §3）:
  - conveni: 品揃え/ドミナント/PB
  - gym: 会員ストック
  - REA: 案件パイプライン
  - IT: プロダクトライフサイクル
- 新規出店できる業種: `FOUNDABLE_BUSINESS_IDS=['ramen','conveni','gym','realEstateAgency']`（＋productVentures）。

**委任**

- `autoManage`（全社1トグル）＋ `autoManageStyle`（aggressive/balanced/defensive）。CEOが必要。
- 自動化されている範囲:
  - 自動出店: `estimateStoreOpening` の比較
  - ブランド投資
  - 店長がいる店舗の営業時間調整（`js/engine.js:2063-2133`）
  - CFO委任（`processExecutiveDelegation`）
  - executiveDirectives
- **領域ごとの権限や階層（店長→エリア→CXO）はまだない。**

### 2.7 UI

**ナビゲーション**（`js/d-ui-shell.js:12-22`）

| 種類 | 構成 |
|---|---|
| `ALL_NAV` | **19タブ**: home, map, business, office, market, venture, ma, overseas, assets, bank, report, founder, strategy, media, legacy, missions, rivals, news, settings ＋ `pe-portfolio` |
| `PRIMARY_NAV` | 10件 |
| `DOCK_NAV` | 6件 |

**Signal-first の部品は既にある**

- `js/executive-secretary.js`: critical/high/medium/opportunity の優先度付きアラート
- `js/ceo-dashboard.js`: 成長候補など
- `capital-allocation-*`（13ファイル）: 中身は主に**財務防衛**（借入返済・復旧資金・ストレステスト・スコア・メモ）。**成長投資の案件比較ボードではない。**

### 2.8 計測: 週次処理コストとセーブサイズ

条件: `tests/harness.js` の full production composition、LCG seed、Node（コンテナ環境）。**iPhone実機ではない。**

| 店舗数 | 1週 中央値 | p95 | 状態JSON | 保存ペイロード |
|---|---|---|---|---|
| 1 | 252ms | 305ms | 1.52MB | — |
| 10 | 541ms | 790ms | 4.62MB | — |
| 40（104週後） | **1,193ms** | 1,404ms | **7.47MB** | **6.65MB**（main key） |

- 40店舗時の上位フィールド: `finance` 3.08MB、`purchaseOrders` 2.19MB、`properties` 0.56MB、`competitorMarketStrategy` 0.43MB。
- CPUプロファイル（10店舗）の内訳:

| 処理 | 比率 |
|---|---|
| `clone`（save-storage の structuredClone） | 28.5% |
| `storagePayload` | 13.1% |
| `proto.save` | 5.7% |
| `finance.validate` | 5.6% |
| `isProtectedTransaction` / `runTransaction` / `archiveTransactions` | 合計 約6% |

→ **週次時間の約半分以上が保存とスナップショット**。ゲームロジック本体ではない。

---

## 3. Existing Features（実装済み機能の要約）

| 領域 | 実装済み（主なもの） |
|---|---|
| 店舗経営 | テナント契約、出店見積（decisionProfit/payback/siteSuitability）、価格、営業時間、設備（`store-equipment.js`）、メニュー/R&D、conveni品揃え・PB・ドミナント、gym会員・プラン・混雑、REAパイプライン・セグメント方針、IT製品ファネル・ライフサイクル |
| 需要/市場 | ramen: softmax離散選択＋共食い（`market.js`）。マクロ景気循環（`macro-cycle.js`）、業界イベント＋対応策 |
| 供給 | 発注・ロット在庫・廃棄・サプライヤー契約（リードタイム/支払条件）・スポット調達・垂直統合資産 |
| 人員 | チーム・候補者・採用オンボーディング・研修・疲労・離職・部門・プロジェクト |
| 本社 | 部門、CXO、重要社員、取締役会、指示、社内VC、オフィス/支社 |
| 競合 | ramen の完全AI（価格/広告/品質/能力/参入/信用/distress/倒産）、グループ予算配分、競合新製品と対抗キャンペーン、ランキング、競合ダッシュボード |
| 資金調達 | 銀行借入・コベナンツ・リファイナンス・債務返済フック、社債・格付け、転換社債、創業者出資/創業者ローン、危機対応（流動性アクション・再建・コスト再構築・債権者交渉・ターンアラウンド計画） |
| 資本市場 | 上場株売買（会社/個人口座）、信用取引、株式分割、MBO（`executeMBO`）、IPO（市場選択）、配当・自社株買い（安全配当可能額の制約つき）、アクティビスト/委任状争奪/株主価値毀損、敵対的買収の受け手（`inboundBuyoutOffers`） |
| M&A | Deal Room（ラウンド・競合入札・売り手選好）、買収ファイナンス（能力・原子性）、取締役会承認、投資委員会、PMI 100日計画、のれん・減損、統合シナジー |
| グループ | 子会社マンデート、予算KPI、業績レビュー、グループ資本配分計画/実行、ホールディング統治、再編候補/進捗、上場子会社（TOB/スクイーズアウト/追加募集/再上場）、子会社IPO準備・売出し、海外子会社（現地留保・為替・送金） |
| VC/PE | VC直接投資（DD・ラウンド・希薄化・フォローオン・セカンダリー・IPO/償却）、VCファンドLP、エンジェル、PEファンド（4ゲート組成・GP/LP・運用報酬/キャリー・複数ファンド・ソーシング/紹介/独占・Exit Decision Center・IPO/Secondary/Strategic Exit・Exit要因分解・5本柱の経営ブリッジ）、Microcap |
| 不動産 | 会社/個人の取得・賃貸・開発・再開発・保険・修繕・税・借換・管理・ポートフォリオダッシュボード、個人の住宅ローン・短期賃貸・不動産法人 |
| 個人 | 個人投資（投信・債券）、高級資産/オークション、スポーツチーム、家族信託、財団、ロビー、承継、エンディング6種 |
| UI | D UI shell、Phase 2都市マップ、CEOダッシュボード、秘書アラート、週次インパクト要約、財務三表、株価チャート |

---

## 4. Complete Feature Matrix（142項目）

凡例:

- **Src**: W=Wall Street Raider / B=Big Ambitions / G=Global Business Tycoon
- **Status**: A=十分 / B=浅い / C=構造的に分断 / D=部分実装 / E=未実装 / F=実装すべきでない / G=コピーでなく再設計
- **Diff**: E=Easy / M=Medium / H=Hard / Ar=Architectural
- **Mob**: Ex=Excellent / Gd=Good / Ad=Needs adaptation / Pr=Poor
- **Str**: Core / High / Med / Low

### 4.1 株式市場・証券（W/G）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 1 | 市場価格（発行体ファンダ連動） | W | C（ランダムウォーク） | Ar | Gd | Core | 価格 = f(内在価値, センチメント, 流動性) に再設計 | Valuation Service, Corporate Shell |
| 2 | Bid / Ask | W/G | E | M | Ad | Med | 板は作らず、流動性tierから気配スプレッドを導出 | #3 |
| 3 | スプレッド | W | E | E | Gd | Med | 流動性tier × ボラティリティで算出 | #3 |
| 4 | 流動性（ADV） | W/G | B（発行済5%上限） | M | Gd | High | 5%上限をADVベースへ置換（互換値を保持） | Corporate Shell |
| 5 | Partial fill | G | D（clamp＋分割plan） | M | Ad | Med | 複数週にわたる執行注文（TWAP風）としてUI化 | #4 |
| 6 | 価格インパクト | W | A | — | Gd | Med | 維持（ADV化の際に係数を再校正） | #4 |
| 7 | 取引手数料 | W | A | — | Ex | Low | 維持 | — |
| 8 | 時価総額 | W/G | A | — | Ex | Med | 維持 | — |
| 9 | PER/PBR/EV/EBITDA 表示 | W | B（perはランダム変動） | M | Gd | High | Shellの財務から算出する派生値にする | Corporate Shell |
| 10 | 保有株への配当受取 | W | B（dividendYieldフィールド） | E | Ex | Med | Shellの配当方針から支払う | Corporate Shell |
| 11 | 株式分割 | W/G | A | — | Ex | Low | 維持 | — |
| 12 | 空売り | W | E | H | Ad | Low | 見送り（P3以降、しかも個人口座のみ） | 借株モデル |
| 13 | 信用取引（個人） | W | A | — | Gd | Low | 維持 | — |
| 14 | 保有比率（第三者企業） | W/G | B（計算可能だが意味を持たない） | M | Ex | Core | Ownership Edge化 | Ownership Graph |
| 15 | 議決権 | W | E | Ar | Gd | Core | edgeに `votingShares` を持たせ、支配を導出 | #14 |
| 16 | 支配閾値ラダー | W | E | M | Ex | Core | 日本法の閾値でControl Ladder化（§11） | #15 |
| 17 | 市場買い集め→支配 | W/G | E | Ar | Gd | Core | 5%超で大量保有報告イベント、1/3超でTOB義務 | #15, #18 |
| 18 | 第三者へのTOB | W/G | D（上場子会社のみ） | H | Gd | Core | `listed-subsidiary-control-actions` を一般化 | #1, #15 |
| 19 | スクイーズアウト | W | D（上場子会社のみ） | M | Gd | High | 一般化 | #18 |
| 20 | 自社への敵対的買収（受け手） | W | B（inboundBuyoutOffers・competitorOwnedRatio） | H | Gd | High | AIの実保有edgeから発生させる | AI Corporate Actions |
| 21 | 買収防衛策 | W | B | M | Gd | Med | 閾値ラダー上の防衛アクションとして再設計 | #16 |
| 22 | 大量保有報告/市場シグナル | W | E | E | Ex | Med | 5%/10%超過をニュース化し株価に反映 | #15 |
| 23 | 株式スクリーナー | W/G | E | M | Ad | High | フィルタ＋ソート（Terminal Mode） | #9 |
| 24 | セクターヒートマップ | W | E | E | Ad | Med | 業種別の週次騰落タイル | Sector taxonomy |
| 25 | リサーチレポート | W | E | M | Gd | High | 情報の非対称性を作る「調査」アクション（DD予算を消費） | Bandwidth |
| 26 | アナリスト予想/ガイダンス | W | E | M | Gd | Med | 自社上場後のEPS期待 vs 実績サプライズ | #1 |
| 27 | 会社ニュース | W/G | A（newspaper/media） | — | Ex | Med | 維持 | — |
| 28 | 株価チャート | W/G | A | — | Gd | Med | 維持 | — |
| 29 | 第三者企業の財務諸表 | W/G | E | Ar | Ad | Core | Corporate Shell（簡易三表） | Entity Model |
| 30 | 株式持合い（AI間） | W | E | H | Ad | Med | AI同士のedge（上限つき） | #14 |
| 31 | 自社IPO | W/G | A | — | Gd | High | 維持（Deal Bookへ接続） | — |
| 32 | 子会社IPO/売出し | W | A | — | Gd | High | 維持 | — |
| 33 | 自社の公募増資 | W | D（上場子会社の追加募集あり、自社は未確認） | M | Gd | High | 自社版を追加（希薄化をownerに反映） | Ownership Graph |
| 34 | 自社株買い | W/G | A（安全配当可能額の制約） | — | Ex | High | 維持 | — |
| 35 | 通常配当 | W/G | A | — | Ex | High | 維持 | — |
| 36 | 特別配当 | W | E | E | Ex | Med | 配当ルートの1オプションとして追加 | #35 |
| 37 | MBO | W | B（`executeMBO`） | M | Gd | Med | Control Ladder上の非公開化アクションとして統合 | #16 |
| 38 | 株式交換 | W | B（premium 1.08） | M | Gd | Med | 取得側の株式発行をownerに反映 | Ownership Graph |
| 39 | Greenmail | W | — | — | Pr | — | **F**（§8） | — |
| 40 | ポイズンピル（米国型） | W | — | — | Pr | — | **G**: 日本型の買収防衛（事前警告型）へ再設計 | #21 |

### 4.2 M&A・企業再編（W）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 41 | 友好的買収 | W | A（Deal Room） | — | Gd | Core | 維持。Deal Book の1ソースにする | — |
| 42 | 敵対的買収（非上場候補） | W | B（premium 1.35の係数のみ） | M | Gd | High | 上場企業ではTOB経由のみにする | #18 |
| 43 | 買収候補の生成 | W | C（毎回乱数で合成） | Ar | Gd | Core | 世界に常在する企業（Shell）から選ぶ | Corporate Shell |
| 44 | 競合企業の買収 | W/B | E | Ar | Gd | Core | competitorStates を Shell と上場銘柄に接続 | #43, AI統合 |
| 45 | 合併（法人統合） | W | E | Ar | Ad | Med | 買収後の「吸収合併」で子会社を本体に統合 | Entity Model |
| 46 | LBO | W | D（買収ファイナンス・PE） | M | Gd | High | 対象会社への負債push-down（portfolioCompany） | Ledger pools |
| 47 | 買収ファイナンス | W | A | — | Gd | High | 維持 | — |
| 48 | DD | W | A（M&A/VC/PE） | — | Gd | High | Bandwidthコストを付与 | Bandwidth |
| 49 | 取締役会承認 | W | A | — | Gd | Med | 維持 | — |
| 50 | 競合入札/オークション | W | A | — | Gd | High | 維持。AI入札者をShellから出す | #43 |
| 51 | PMI | W | A（100日計画） | — | Gd | High | 維持 | — |
| 52 | のれん・減損 | W | A | — | Ex | High | 維持 | — |
| 53 | 事業/資産売却 | W | B | M | Gd | High | Deal Book の「売却」側としてまとめる | Valuation Service |
| 54 | スピンオフ | W | D（再編/社内VCの断片） | H | Gd | Med | 子会社株をownerへ現物配当する | Ownership Graph |
| 55 | リストラクチャリング | W | A（危機・グループ再編） | — | Gd | High | 維持 | — |
| 56 | ジョイントベンチャー | W | E | H | Gd | Low | 見送り（P3） | #15 |
| 57 | 独禁法審査 | W | E | M | Gd | High | 地域×業種シェアに閾値→審査/是正条件 | Market share |
| 58 | 買収後の実運営（抽象→詳細） | W/B | D（PEは5柱ブリッジ、maSubsidiariesは抽象） | Ar | Gd | High | Company Entity化で bridge を不要にする | Entity Model |

### 4.3 企業金融・負債・会計・税（W）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 59 | 銀行借入 | W | A | — | Gd | Core | 維持 | — |
| 60 | コベナンツ | W | A | — | Gd | High | 維持 | — |
| 61 | リファイナンス | W | A/B | — | Gd | High | 満期ラダー表示を追加 | — |
| 62 | 社債発行・格付け | W | A | — | Gd | High | 維持 | — |
| 63 | 転換社債 | W | A | — | Ad | Med | 維持（潜在株をownerに） | Ownership Graph |
| 64 | 社債の繰上償還（コール） | W | B | E | Gd | Med | 金利低下局面の選択肢として明示 | #74 |
| 65 | 長短負債区分 | W | E（`longTermDebt=0`固定） | M | Ex | High | BSで区分し、流動比率を正しくする | Ledger |
| 66 | 連結財務諸表 | W | E | Ar | Ad | Core | 子会社Entityの三表を連結（内部取引消去は最小限） | Entity Model |
| 67 | 非支配株主持分 | W | E | H | Ad | High | 連結と同時に導入 | #66 |
| 68 | 持分法（20–50%） | W | E | H | Ad | High | 関連会社の利益×持分をPLに | #14 |
| 69 | 有価証券の時価評価 | W | B（原価。未実現は別集計） | M | Ex | Med | その他有価証券評価差額（OCI）で処理 | Ledger |
| 70 | 法人税 | W | B | M | Ex | Med | 維持＋繰越欠損 | — |
| 71 | 連結納税/グループ通算 | W | E | H | Ad | Low | 見送り（P3） | #66 |
| 72 | 規制/法務リスク | W | B（イベント） | M | Gd | Med | 独禁・金融規制に集約 | #57 |
| 73 | 受託者責任 | W | B（LP promise compliance） | — | Gd | Med | 維持 | — |
| 74 | 政策金利 | W | A | — | Ex | Core | 維持（Hurdle rateとしてUIに出す） | — |
| 75 | インフレ | W | B | M | Gd | Med | 原価/賃金/賃料に一貫して反映 | — |
| 76 | 信用サイクル（スプレッド） | W | D | M | Gd | High | macro cycle → 借入スプレッド・LBO可能倍率 | #74 |
| 77 | 為替 | W | B（海外） | — | Gd | Low | 維持 | — |
| 78 | 危機/流動性管理 | W | A | — | Gd | High | 維持 | — |

### 4.4 その他の金融資産（W）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 79 | 国債（投資対象） | W | B（個人の投信・債券） | E | Ex | Med | 会社口座からも買える「待機資金」の受け皿に | Deal Book |
| 80 | 事業会社の社債への投資 | W | E | M | Gd | Med | Shellの発行債を購入（信用リスクあり） | Corporate Shell |
| 81 | オプション | W | — | — | Pr | — | **F** | — |
| 82 | 先物 | W | — | — | Pr | — | **F** | — |
| 83 | コモディティ取引 | W | — | — | Pr | — | **G**: 原材料価格指数として供給原価に反映するだけ | supply |
| 84 | 暗号資産 | W | — | — | Pr | — | **F** | — |
| 85 | 銀行の所有 | W | E | Ar | Ad | Med | Stage 6で「金融子会社」として導入（簡易） | Ledger, Entity |
| 86 | 貸出ポートフォリオ | W | E | H | Ad | Med | 銀行子会社の資産（業種別の貸出枠のみ） | #85 |
| 87 | Prime/Subprime | W | — | — | Pr | — | **G**: 信用リスクtier 3段階へ単純化 | #86 |
| 88 | 自己資本規制 | W | E | M | Gd | Med | 銀行子会社の制約1本（自己資本比率） | #85 |

### 4.5 VC / PE（W/G）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 89 | VC直接投資 | W/G | A | — | Gd | High | 維持 | — |
| 90 | 希薄化/ラウンド | W | A | — | Gd | High | 維持（ownership edgeへ移す） | Ownership Graph |
| 91 | フォローオン/セカンダリー | W | A | — | Gd | Med | 維持 | — |
| 92 | VCファンドLP | W | A | — | Gd | Med | 維持 | — |
| 93 | PEファンド組成 GP/LP | W | A | — | Gd | Core | 維持 | — |
| 94 | キャピタルコール/未払込 | W | E（LPは組成時に全額拠出） | M | Gd | Med | 案件実行時の払込に変更（新ファンドのみ） | Fund ledger |
| 95 | NAV/DPI/TVPI/IRR | W | B（NAV・DPI・MOIC、TVPIなし） | E | Gd | High | 派生指標として追加（読み取りのみ） | — |
| 96 | 運用報酬/キャリー/ハードル | W | A | — | Gd | Med | 維持 | — |
| 97 | Value creation | W | A | — | Gd | High | 維持 | — |
| 98 | Exit（売却/IPO/Secondary/Strategic） | W | A | — | Gd | High | Strategic buyer を Shell/AI から出す | #43 |
| 99 | PE買収先の実経営 | W/B | A（5柱ブリッジ） | — | Gd | High | Entity化で統合（bridge削減） | Entity Model |
| 100 | 独自ソーシング | W | A | — | Gd | Med | 維持 | — |
| 101 | Microcap | W | A | — | Gd | Low | Shellの最小tierとして統合 | Corporate Shell |

### 4.6 事業運営（B）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 102 | テナント契約/出店 | B | A | — | Ex | Core | 維持（Deal Book の1ソースに） | — |
| 103 | 業種選択 | B | A（4＋IT） | — | Ex | High | 維持。業種の追加は柱方針に従う | — |
| 104 | 内装/設備 | B | B（store-equipment） | M | Gd | Med | CapExの選択肢として Deal Book に出す | Deal Book |
| 105 | 商品構成 | B | A（ramen/conveni） | — | Gd | High | 維持 | — |
| 106 | 営業時間 | B | A | — | Ex | Med | 維持（委任対象） | — |
| 107 | 価格設定 | B | A | — | Ex | Core | 維持（委任対象） | — |
| 108 | 需要/客層 | B | A（ramen）/B（他） | H | Gd | High | 柱ごとに段階的に深掘り（既存方針） | — |
| 109 | 店舗容量/客流 | B | B | M | Gd | Med | 維持 | — |
| 110 | 在庫 | B | A（ramen）/D（他） | H | Gd | High | 既存方針どおり1業種ずつ | — |
| 111 | 発注/配送 | B | A（ramen） | — | Gd | Med | 維持 | — |
| 112 | サプライヤー契約 | B | A | — | Gd | Med | 維持 | — |
| 113 | 広告 | B | A | — | Gd | High | 維持（委任対象） | — |
| 114 | 採用 | B | A（ramen） | — | Gd | High | 維持 | — |
| 115 | スキル/給与/満足度 | B | B | M | Gd | Med | 維持 | — |
| 116 | シフト単位のスケジューリング | B | — | — | Pr | — | **G**: 「人員配置方針」＝時間帯×人数のプリセット | workforce |
| 117 | 研修 | B | A | — | Gd | Med | 維持 | — |
| 118 | 店長 | B | D（営業時間の自動調整のみ） | M | Ex | Core | Delegation Policy の担い手にする | §14 |
| 119 | エリアマネージャー | B | E | M | Ex | High | 都道府県クラスタ単位の委任者 | #118 |
| 120 | 本社部門 | B | A | — | Gd | High | 維持 | — |
| 121 | CXO | B/G | A | — | Gd | High | 委任領域の最上位者 | §14 |
| 122 | 領域別の委任ポリシー | B | D | M | Ex | Core | 新規（§14） | #118 |
| 123 | 輸入/倉庫/物流拠点 | B | D（垂直統合資産の断片） | H | Ad | Med | **G**: 「物流拠点」を地域CapExとして（在庫日数・原価に効く） | supply |
| 124 | 車両 | B | — | — | Pr | — | **F** | — |
| 125 | 製造（原料→製品） | B | E | H | Ad | Med | **G**: 自社工場＝PB原価と供給安定性を買うCapEx | supply, conveni PB |
| 126 | 不動産 賃借/購入/売却 | B/G | A | — | Gd | High | 維持 | — |
| 127 | 事業×不動産の統合 | B | B（未確認: 自社物件への出店の賃料内部化） | M | Gd | High | 自社保有物件への出店で賃料を内部化・連結消去 | #66 |
| 128 | 個性のあるライバル企業 | B | A（ramen）/B（他） | H | Gd | Core | Shellで全業種に「顔」を与える | Corporate Shell |
| 129 | 価格戦争 | B | A | — | Gd | High | 維持 | — |
| 130 | 人材獲得競争 | B | E | M | Gd | Low | 見送り（P3） | workforce |
| 131 | 都市マップ上の資産表示 | B | A | — | Gd | Med | 維持（倉庫/HQ/工場マーカーはDOM予算内で） | Map contract |
| 132 | 3D/アバター操作 | B | — | — | Pr | — | **F** | — |
| 133 | 生活シム（住居・体力） | B | —（founderHealthは2026-08に廃止済み） | — | Pr | — | **F** | — |

### 4.7 CEO UI / 情報設計（G）

| # | Feature | Src | Status | Diff | Mob | Str | Recommended Action | Dependencies |
|---|---|---|---|---|---|---|---|---|
| 134 | CEOダッシュボード | G | B（ceo-dashboard＋秘書アラート） | M | Ex | Core | Signal-first の「今週の判断」3枚に再構成 | Deal Book |
| 135 | 事業ポートフォリオ比較表 | G | D | M | Ad | Core | BU単位の横並び表（売上/利益/率/成長/シェア/評価額/負債/人員/CapEx） | BU read model |
| 136 | 多業種グループ | G | B（4柱＋抽象子会社） | H | Gd | High | Entity化で全子会社を同じ表に | Entity Model |
| 137 | BUカード | G | D | E | Ex | High | 共通カードコンポーネント | #135 |
| 138 | Cards→Table→Filter→Search | G | E | M | Ad | High | 件数が閾値（例: 12）を超えたら自動でTable表示 | #135 |
| 139 | Group→BU→Store→Metric のドリルダウン | G | D | M | Ex | Core | 3層ナビ＋戻る | IA §12 |
| 140 | 不動産物件カード | G | A/B | — | Gd | Med | 維持（共通カード化） | — |
| 141 | Ownership→Control→Takeover のフロー | G | E | H | Gd | Core | Control Ladder UI | #16 |
| 142 | Terminal Mode | W | E | M | Ad | High | 高密度等幅テーブル。設定で切替 | #23 |

補足: ミッション/エンディング/承継/財団/スポーツ/高級資産は実装済み（A/B）。表外。戦略的な重要度は Low〜Med。

---

## 5. WSR Core Analysis — Capital Allocation エンジンとして何を採用するか

### 5.1 採用する思想

1. **全ての現金は機会費用を持つ。** 1円をどこに置くかを、同じ物差しで比較できる状態にする。
2. **企業は資産である。** 自社・子会社・ライバル・上場企業のどれもが「買える／売れる／支配できる」対象になる。
3. **所有と支配は別物。** 49%でも支配できる（筆頭＋分散株主）し、51%でも特別決議は通せない。
4. **資本構成そのものが戦略。** 負債・株式・現金のバランスが次の一手を制約する。
5. **世界は自分なしでも動く。** AI企業も同じ会計で成長・借金・倒産・買収をする。

### 5.2 採用する最小セット（WSRの網羅性ではなく「判断の種類」で選ぶ）

| 判断の種類 | 採用する仕組み | 既存資産 |
|---|---|---|
| 成長投資 vs 還元 | Deal Book で「出店/CapEx/M&A」と「配当/自社株買い/返済」を同じ列に並べる | 出店見積、shareholder-returns、treasury |
| 支配の獲得 | Control Ladder（市場買い→大量保有→TOB→スクイーズアウト） | listed-subsidiary-control-actions を一般化 |
| レバレッジ | LBO/借入余力/格付け/コベナンツ | bank-loans-covenants、corporate-bonds、acquisition-financing |
| 流動性 | 資産ごとに換金週数と割引率を持たせる | stockOrderPlan、PE exit |
| 資本の階層 | Player → Holding → Sub → Store、Player → Fund → PortCo | 各所有表現（統合が必要） |
| サイクル | 金利・信用スプレッド・景気が「今は買い時か売り時か」を変える | macro-cycle、policyRate |

### 5.3 必要な共通経済エンジン（関係図）

```
                 ┌────────────── Market Cycle (policyRate, credit spread, sector sentiment) ─────────────┐
                 ▼                                                                                        ▼
  Operations ──► Entity P&L ──► Entity Cash Pool ──► Capital Allocation (Deal Book) ──► Transfers (moveCash)
  (stores,BUs)     │                  ▲                  │         │          │                │
                   ▼                  │                  │         │          │                ▼
            Accounting Ledger ◄───────┴──────────────────┘         │          │         Ownership Edges
            (per pool; BS/PL/CF)                                   │          │        (shares, votes, cost)
                   │                                               │          │                │
                   ▼                                               ▼          ▼                ▼
            Valuation Service ◄──────────── Debt Book (loans, bonds, covenants, ratings)   Control Resolver
      (book / intrinsic / market / deal)                                                   (subsidiary? affiliate?)
                   │                                                                            │
                   ▼                                                                            ▼
      Security Price (listed) = anchor(intrinsic) × sentiment × liquidity           Corporate Actions
                   │                                                               (dividend, buyback, issue,
                   └──────────────► Investment Returns (realized/unrealized, IRR, DPI) ◄── TOB, merger, spin-off)
```

---

## 6. Big Ambitions Analysis — Progression / Operations / Automation

**採用するもの**

- **仕事の中身が変わる成長曲線**: 自分で値付け → 店長に任せる → 地域最適化 → 全社方針だけ決める。
- **委任は「バフ」ではなく「自動化レイヤ」**: 任せた領域はポリシー＋ガードレールで自走し、例外だけが上がってくる（秘書アラートの既存基盤を使う）。
- **物理世界との接続**: 既存の Phase 2 マップで、店舗・ライバル・不動産・HQを表示する。倉庫/工場を追加する場合も、CLAUDE.md §4 のマーカー契約とDOM予算に従う。
- **ライバルに顔がある**: ramen の competitorStates の水準を、Corporate Shell によって全業種に広げる。

**採用しないもの・形を変えるもの**

- 手動の配送・車両・3D移動・アバター生活シム → **F**。
- シフト表の編集 → **G**（人員方針プリセット）。
- 倉庫・製造 → **G**。独立した生産ミニゲームにはしない。「CapExで原価・欠品率・在庫日数を買う」資本配分の案件として実装する。

**既存方針との整合**

- 5本柱を深くする方針（CLAUDE.md §1）と矛盾しない。
- 運営の深さは柱単位で増やす。委任フレームワークは**業種非依存の共通層**として作る。

---

## 7. Global Business Tycoon Analysis — Dashboard / Portfolio UI

**採用するもの**

- **ポートフォリオ横並び表**: BU/子会社/投資先を同じ列定義で比較できる表。今のゲームで最も欠けているUI。
- **ドリルダウン**: Group → BU → Store/Asset → Metric。
- **物件カード**: 購入価格・時価・賃料・ローン・CF・利回り・稼働率・状態（既存の不動産ダッシュボードを共通カード化）。
- **Ownership → Control → Takeover の一本道の体験**。

**採用しないもの・形を変えるもの**

- 業種を大量に（10+）並べる多業種の横展開 → 5本柱方針に反する。業種の追加ではなく、**M&Aで取得した抽象子会社**でポートフォリオの幅を出す（G）。
- 全ての数値を常時表示するダッシュボード → Signal-first の方針に反する。

---

## 8. Features NOT to Adopt（理由つき）

| 機能 | 出典 | 判定 | 理由（「面白い判断を生むか？」） |
|---|---|---|---|
| オプション・先物 | W | F | 資本配分でなくトレーディング技術のゲームになる。モバイルで理解コストが高い。実体経済とつながらない |
| 暗号資産 | W | F | 世界観の一貫性がなく、ギャンブル化する。同一会計モデルへの貢献がない |
| コモディティ直接売買 | W | G | 供給原価の指数として間接的に効かせれば十分 |
| Greenmail | W | F | 日本の文脈で不自然。支配ラダー上の利得は通常の売却で表現できる |
| サブプライム融資の詳細 | W | G | 銀行子会社は信用tier 3段階で十分 |
| 米国型ポイズンピル | W | G | 日本型の事前警告型買収防衛へ置き換える |
| 空売り（初期） | W | 保留 | 需要が確認されるまで見送る。借株・リコール・無限損失のUIコストが高い |
| 連結納税 | W | 保留 | 判断を増やさず計算だけが増える |
| 3D/アバター/徒歩 | B | F | iPhone優先の方針に反する。操作量が増えるだけで判断は増えない |
| 手動配送・車両管理 | B | F | 作業であって判断ではない。後半ほど苦痛になる |
| シフト表の細かい編集 | B | G | 方針プリセットに置き換える |
| 生活シム（食事・睡眠・住居） | B | F | founderHealth は既に廃止済み（2026-08-26）。再導入しない |
| 内装の自由配置 | B | F | モバイルで重く、資本配分との関係が薄い。設備tier選択で十分 |
| 業種の大量追加（10+業種を均等に） | G | F | 5本柱方針（CLAUDE.md §1）に反する |
| 全数値の常時表示 | G | F | Signal-first に反する |
| リアルタイム進行 | B/G | F | 週次ターン制の決定論的設計と矛盾する |

---

## 9. Unified Architecture

### 9.1 レイヤ構成（目標）

```
┌──────────────────────────────── UI (D UI shell) ────────────────────────────────┐
│ Command(Home) │ Operate │ Capital(Deal Book) │ Markets │ Empire(Ownership) │ More │
│        Progressive disclosure: Card → Table → Terminal                          │
└──────────────▲──────────────────────────────────────────────▲─────────────────┘
               │ read models (pure, no RNG, no mutation)       │ commands
┌──────────────┴──────────────── Application Layer ───────────┴──────────────────┐
│ DealBook aggregator │ Portfolio read model │ Control resolver │ Delegation policy │
└──────────────▲──────────────────────────────────────────────▲─────────────────┘
               │                                              │
┌──────────────┴──────────────── Economic Kernel ─────────────┴──────────────────┐
│ Entity Registry │ Ownership Edges │ Cash Pools + moveCash() │ Ledger(finance.js) │
│ Valuation Service │ Debt Book │ Corporate Actions │ Market Pricing              │
└──────────────▲──────────────────────────────────────────────▲─────────────────┘
               │                                              │
┌──────────────┴──────────────── Simulation Layer ────────────┴──────────────────┐
│ Weekly Phase Registry (explicit order):                                         │
│  1 macro → 2 demand/market → 3 supply → 4 workforce → 5 store settle →          │
│  6 BU/subsidiary settle → 7 AI corporate (tiered) → 8 securities pricing →      │
│  9 corporate actions/debt service → 10 funds → 11 governance/events →           │
│  12 ledger close/validate → 13 history/bounded logs                             │
└──────────────▲──────────────────────────────────────────────────────────────────┘
               │
┌──────────────┴─────────── Persistence (saveVersion 9, additive) ───────────────┐
│ dirty-section save │ compact logs │ IDB primary │ legacy arrays = source of truth│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 設計原則

- **Read model から作る。** Entity Registry / Ownership / Valuation / Deal Book は、最初は既存状態から**導出するだけ**の純関数にする。書き込み経路は変えない。
- 同じ値を新旧両方で計算し、一致をテストで保証してから、書き手を1系統ずつ移す（Strangler パターン）。
- **Weekly Phase Registry**: 既存の16重 `advanceWeek` ラッパを、宣言的な `{id, after, run}` に段階的に移す。まず現行順序を**スナップショットテストで固定**してから動かす。

---

## 10. Unified Accounting Model（Money Flow）

### 10.1 目標

**すべての資金移動は `moveCash(fromPool, toPool, amount, category, meta)` を通る。**

```
                     ┌─────────────── External World ───────────────┐
                     │ customers, suppliers, landlords, banks,       │
                     │ tax authority, market counterparties, LPs     │
                     └───▲───────────┬──────────────▲───────────┬────┘
               sales/rent│           │costs/tax     │loans      │proceeds
                         │           ▼              │           ▼
 ┌──────────────┐  dividend  ┌──────────────────┐  capital  ┌──────────────────┐
 │ Personal Pool│◄───────────│ Company Pool     │──────────►│ Subsidiary Pools │
 │ personalCash │  salary    │ companyCash      │◄──────────│ (overseas local, │
 │ (NEW: ledger)│───────────►│ (finance.js)     │ dividend  │  future: each    │
 └──────┬───────┘ contribute └───────┬──────────┘ upstream  │  consolidated sub)│
        │ GP commit / LP              │ investment          └──────────────────┘
        ▼                             ▼
 ┌──────────────┐  capital call ┌──────────────────┐
 │ Fund Pool    │──────────────►│ PortCo Pools     │
 │ fund.cash    │◄──────────────│ portfolioCompany │
 └──────────────┘  exit proceeds│ .cash            │
                                └──────────────────┘
```

### 10.2 不変条件（テストで守る）

1. `Σ pools(after) = Σ pools(before) + external inflow − external outflow`（内部移転は合計ゼロ）
2. Company BS: `Assets = Liabilities + Equity`（既存。許容誤差±2円 → **整数円化して0円**を目標にする）
3. 各 `moveCash` はちょうど1つのイベントを持つ（ledgerのないプールへは personal-lite ledger を新設）
4. M&A: `Buyer cash out = Seller proceeds`、`Consideration = FV(identifiable net assets) + Goodwill − bargain gain`、取得負債は Debt Book へ引き継ぐ（Deal Room は既存テスト済み。一般化の際に同じ式を使う）
5. 同じ利益を二重計上しない: 子会社の利益は「連結PL」か「受取配当」のどちらか一方だけ（持分法も同じ）

### 10.3 既存コードとのギャップ

| ギャップ | 実状態 | 対応 |
|---|---|---|
| 直接代入＋event の二重書き | 全域（例 `js/engine.js:1335`） | `moveCash` ヘルパを作り、新規コードで強制。既存は coverage テストで守りつつ移行する |
| 個人側にledgerがない | `personalCash` はスカラーのみ | Personal-lite ledger（カテゴリ最小。表示は資金繰り表のみ） |
| 長短負債の区分がない | `longTermDebt:0` | Debt Book から満期で区分 |
| 連結/非支配持分がない | 子会社は原価 | P1で連結 read model → P2で表示 → PLへの反映 |
| M&A子会社の利益が親PLに直接入る | `js/engine.js:1998` で `profit+=` し、同時に子会社の `retainedEarnings` にも加算 | 連結時に「子会社の留保利益」を二重に数えない整理が必要（現在の retainedEarnings は表示用トラッカーと推定。要確認） |

---

## 11. Unified Ownership Model

### 11.1 データ構造（最小）

```js
// 追加は1つのトップレベルだけ（saveVersion 9 のまま、ensure*で補完）
capitalGraph: {
  schemaVersion: 1,
  entities: { [entityID]: { id, kind, name, ledgerRef, poolRef, listing?: {stockID}, legacyRef } },
  // kind: 'player' | 'company'(player HQ) | 'subsidiary' | 'affiliate' | 'rival' |
  //       'listed' | 'startup' | 'fund' | 'portco' | 'personalCorp' | 'trust'
  edges: [ { holder, issuer, shares, votingShares, costBasis, acquiredWeek, via } ]
}
```

- **Phase 1 では保存しない（導出のみ）**。`legacyRef` から次を毎回組み立てる:
  - `companyStocks` / `personalStocks` / `startups.owned*` / `subsidiaries.ownership` / `maSubsidiaries` / `peDeals` / `founderShares`
- 保存するのは、新規の所有表現（第三者上場企業の支配・AI間持合い）が必要になった時点から。

### 11.2 Control Resolver（日本法に寄せた閾値）

| 議決権比率 | 状態 | ゲーム上の効果 |
|---|---|---|
| ≥1%（または300個） | 株主提案権 | 配当増額・取締役提案（アクティビスト行動をプレイヤーも使える） |
| ≥3% | 帳簿閲覧/臨時総会請求 | 詳細な財務情報を開示（情報の非対称性が解消される） |
| >5% | 大量保有報告 | ニュース化され株価が反応。相手AIが防衛を検討する |
| ≥20% | 持分法適用会社 | 利益×持分をPLへ |
| >1/3 | 拒否権（特別決議の阻止） | 合併・事業譲渡を阻止できる。市場買付で超えるにはTOBが必要 |
| >1/2 | 子会社（連結） | 取締役選任・配当方針・経営委任 |
| ≥2/3 | 特別決議 | 合併・スピンオフ・定款変更 |
| ≥90% | 特別支配株主 | スクイーズアウト |

> **登録時注記（2026-09-29）**: 採用した Control Ladder の支配の段階は 1% / 3% / 1/3 / 1/2 / 2/3 / 90% です。上の表の 5%（大量保有報告）と 20%（持分法）は、支配の段階ではなく、開示・会計上の区切りとして残します（第1部 A-5）。

`Ownership`（経済的持分）と `Control`（議決権）は**分離する**。理由:

- 種類株・自己株・持合い・ファンド経由の保有で、両者はずれる。
- PE Fund（GP 2%経済持分）が PortCo を100%支配する構造を正しく表現するため。

### 11.3 グラフ例

```
Player ──100%──► Personal Corp
  │ 62% (votes 62%)
  ▼
HoldCo (player company) ──100%──► Ramen Sub ──► Stores×N
  │            ├──51%──► Listed Sub (NCI 49%)
  │            └──24%──► Rival A (affiliate, equity method)
  │
Player ──GP 2% / control 100%──► PE Fund I ──100%──► PortCo X
                                    └─ LP 98% (NPC LPs)
Rival A ──8%──► HoldCo   (AI stake → takeover threat)
```

**循環出資**: 持合いを許すと評価が再帰する。反復回数を上限3回にした固定点計算を行い、深さは最大4に制限する。

---

## 12. Mobile UX Architecture

### 12.1 ボトムナビ（現行19タブ → 5＋More）

| Tab | 役割 | 取り込む既存タブ |
|---|---|---|
| **ホーム**（Command） | 今週の判断3件、Net Worth / Company Cash / Personal Cash / 売上 / 利益 / 負債、アラート | home, news, missions |
| **事業**（Operate） | BU → 店舗 → 指標。マップはここのサブビュー | business, map, office, founder, strategy, media, overseas |
| **資本**（Capital） | **Deal Book**、資金源（現金・借入余力・発行余力）、配分履歴、Capital Score | bank, ma, venture, pe-portfolio |
| **市場**（Markets） | 上場銘柄、スクリーナー、セクター、ライバル | market, rivals |
| **帝国**（Empire） | Ownership Graph、ポートフォリオ表、連結財務、個人資産 | assets, report, legacy |
| More | 設定・ヘルプ・承継など | settings, legacy |

**段階解放**: 資本/市場/帝国タブは、それぞれ Stage 2/4/5 で出現する（それまでは淡色で「解放条件」を表示）。

### 12.2 画面階層（Screen → Subscreen → Action）

```
ホーム
 ├ 今週の判断カード ×3（秘書アラート上位＋Deal Book上位）──► [承認][後で][委任]
 ├ KPI帯（Net Worth / Company Cash / Personal Cash / Revenue / Profit / Debt）
 └ 週送り

事業
 ├ Group一覧（BUカード → 12件超で自動的にTable）
 │   └ BU詳細（売上/利益/率/成長/シェア/人員/CapEx）
 │        ├ 店舗一覧（Table + Filter + Search）
 │        │    └ 店舗詳細 ──► [価格][営業時間][設備][閉店]
 │        └ 委任ポリシー ──► [担当者][権限レベル][ガードレール]
 └ マップ（Canvas、既存）

資本
 ├ Deal Book（Opportunity一覧: 必要資金・期待IRR・回収週・リスク・流動性・Fit・Bandwidth）
 │    └ 案件詳細（Deal Model: 前提・感応度・資金源選択）──► [実行][条件交渉][見送り]
 ├ 資金源（現金・借入余力・社債枠・株式発行枠・資産売却候補）
 └ 還元（配当・自社株買い・返済）

市場
 ├ 銘柄一覧 / スクリーナー / セクター
 │    └ 銘柄詳細（Shell財務・株主構成・チャート）──► [買う][売る][大量保有][TOB]
 └ ライバル（戦略・財務・持株）

帝国
 ├ Ownership Graph（ツリー表示。ノード→Entity詳細）
 ├ ポートフォリオ表（全Entity同列）
 ├ 連結財務（三表）
 └ 個人（個人資産・ファンド・信託）

Advanced（どこからでも「≡」→ Terminal Mode）
```

### 12.3 Progressive Disclosure のルール

- **L1 Card**: 1画面につき数値は最大4個＋シグナル色。
- **L2 Table**: 列は最大5個（横スクロールなし）、ソート・フィルタ付き。
- **L3 Terminal**: 等幅・高密度・全列。横スクロールは**表の内側だけ**許可（ページに横オーバーフローを出さない。CLAUDE.md §3）。

---

## 13. Progression（各段階で何を操作するか）

| Stage | 解放条件（既存資産に対応付け） | Playerが操作するもの | 委任されるもの |
|---|---|---|---|
| 1 Founder | 開始時（店舗ルート） | 価格・営業時間・メニュー/品揃え・採用・広告・仕入 | なし |
| 2 Operator | 3店舗＋店長の採用 | 出店場所の選択、サプライヤー契約、店長の任命、設備CapEx | 店長: 営業時間・発注・日々の価格の微調整 |
| 3 CEO | 本社＋部門＋CXO（既存） | 事業別予算、借入/社債、出店計画、BU方針 | エリアマネージャー/CXO: 地域価格・広告配分・採用 |
| 4 Conglomerate | 投資部門＋M&A完了1件または子会社2社 | M&A、子会社マンデート、不動産、グループ資本配分、ポートフォリオの入替 | 子会社社長: 事業運営全般（マンデートの範囲内） |
| 5 Capital Allocator | 上場、または投資会社ルートの開始 | 株式・VC・TOB・自社株買い/配当・IPO・スピンオフ | CFO: 財務規律（返済・流動性） |
| 6 Financial Empire | PE Exit 1件（既存のPEゲート） | ファンド組成・LP・キャピタルコール・複数ファンド・（将来）金融子会社 | ファンドのパートナー: ソーシング・PortCoの運営 |

**投資会社ルート（CLAUDE.md §1）** は Stage 5 の「lite」から始まる（会社口座で株式/VCのみ）。Stage 3–4 の機能は通常の解放条件を満たすまで開かない。つまり、どちらのルートも段階的な進行を保つ。Stage は `foundingRoute` という state ではなく、**capability 判定関数**で実装する（CLAUDE.md の方針に合わせる）。

---

## 14. Delegation Model

### 14.1 構造

```
Delegation Policy = { domain, delegate, authority, guardrails }
domain    : pricing | hours | procurement | staffing | marketing | capex | expansion | treasury | investing
delegate  : player | storeManager | areaManager | CXO(CEO/COO/CMO/CFO/CHRO) | subsidiaryPresident | fundPartner
authority : manual | advise(提案のみ) | auto(ガードレール内で自動) | full
guardrails: { budgetPerWeek, minMargin, maxPriceChangePct, cashReserveFloor, maxLeverage, maxSingleDeal }
```

### 14.2 委任できるもの

| Domain | Founder | Store Mgr | Area Mgr | CXO | 例外として上がる条件 |
|---|---|---|---|---|---|
| 価格 | 手動 | 店舗の±5% | 地域の価格帯 | 全社の価格戦略 | 競合の値下げで粗利率がガードレールを下回ったとき |
| 営業時間 | 手動 | 自動（既存ロジック） | — | — | 人員不足 |
| 仕入 | 手動 | 発注点の自動化 | サプライヤー選定 | 調達戦略 | 欠品率 > X% |
| 人員 | 手動 | 欠員補充 | 地域の採用枠 | 賃金水準 | 離職急増 |
| 広告 | 手動 | — | 地域配分 | 全社予算 | ROI < ハードル |
| 出店 | 手動 | — | 候補の提案 | 自動（既存 autoManageStoreExpansion） | 投資額 > maxSingleDeal |
| 財務 | 手動 | — | — | CFO: 返済・借換（既存の委任） | コベナンツ接近 |
| 投資 | 手動 | — | — | CIO（新）: 上限内の株式/VC | 5%超の取得（支配に関わる判断は常にPlayer） |

**原則**

1. 委任先の品質（スキル）はガードレール内での最適化精度に効く。
2. 委任は**Bandwidth を解放する**（Playerが同時に扱える案件数が増える）。
3. **支配・M&A・資本構成は委任できない**。これがプレイヤーの仕事として残る。

既存の `autoManage` / `autoManageStyle` は、ポリシーのプリセット（aggressive/balanced/defensive）として互換マッピングする。

---

## 15. Simulation Model

### 15.1 相互作用

```
Macro (policyRate, cycle phase, inflation, credit spread)
   │ ├─► 需要係数（既存 economy）      ├─► 借入金利/スプレッド（既存 companyBorrowRate）
   │ └─► セクター・センチメント        └─► バリュエーションの割引率
   ▼
Markets (per business × prefecture)
   │  player stores + rival presences → share, price, demand（ramen: softmax、他柱: 業種モデル）
   ▼
Entities settle P&L → Cash Pools → Ledger
   ▼
Corporate Actions（Player: 手動/委任、AI: 四半期ごとの意思決定表）
   │  dividend / buyback / borrow / repay / expand / acquire / divest / IPO
   ▼
Valuation → Listed price = intrinsic × sentiment(sector, momentum) × liquidity discount
   ▼
Ownership changes → Control changes → 支配権の移転（TOB、倒産時の債権者支配）
```

### 15.2 AI の忠実度 Tier（完全対称は非現実的なので近似する）

| Tier | 対象 | 忠実度 | 週次コスト |
|---|---|---|---|
| A | プレイヤーと同じ市場にいるライバル（ramen の competitorStates。他柱へ拡張） | 店舗単位、価格/広告/能力AI、財務、信用、倒産（既存） | 中 |
| B | その他のライバル・上場企業（Corporate Shell） | 簡易三表（売上・EBITDA・純負債・株数・配当性向）＋四半期ごとの Corporate Action | 小（固定式） |
| C | 背景企業・Microcap | 価格系列と財務の要約のみ | 極小 |

- 同じ企業が Tier を昇格/降格できる（例: プレイヤーの市場へ参入したら C→B→A）。
- **AIの対称性ルール**: AIも `moveCash` と Ledger を使う（Tier B は簡易ledger）。金利/コベナンツ/倒産判定はプレイヤーと同じ関数を使う。AIが「プレイヤーだけ免除」「AIだけ免除」される経路を作らない。

### 15.3 Market Simulation の実装可能性

| 項目 | 現状 | 実装可能性 |
|---|---|---|
| 需給 | ramen で詳細、他柱は業種モデル | 既存方針で段階的に拡張 |
| 業界成長 | マクロ・業界イベント | Easy: セクターごとの成長ドリフトを追加 |
| 競争/シェア | ramen は完全、他は簡易 | Medium（Tier A 拡張） |
| 価格弾力性 | ramen の softmax | 既存 |
| 金利 | 既存 | 既存（信用スプレッドだけ追加） |
| インフレ | 部分的 | Medium（原価/賃金/賃料へ一貫反映） |
| 信用サイクル | 部分的 | Medium |
| 資産価格 | 株はランダムウォーク、不動産はサイクル | **Architectural**（Valuation Service） |
| 株式評価 | 自社のみ利益項 | Architectural（同上） |
| 不動産価格 | realEstateCycle あり | 既存を Valuation Service に登録 |

---

## 16. Performance Risks（iPhone Safari）

### 16.1 計測に基づく評価

- 現状（Node/コンテナ）: 1店舗で約250ms/週、1店舗増えるごとに約+25ms。40店舗で約1.2秒/週、保存6.65MB。
- iPhone Safari は一般にこの計測環境より遅いと想定される（**実機では未計測**）。40店舗の時点で体感を損なう可能性が高い。
- localStorage は Safari では一般に約5MB程度が上限とされる。40店舗時の6.65MBは emergency/critical のcompactionプロファイルか IDB に落ちる可能性が高い（`js/save-storage.js` の PROFILES）。**実機でどう振る舞うかは未確認。**
- **1000店舗を線形外挿すると数十秒/週**になり、成立しない。

### 16.2 ボトルネックと対策

| リスク | 原因（確認済み） | 対策 | 優先度 |
|---|---|---|---|
| 週次の保存コスト | `runTransaction` 開始時の `JSON.stringify(g)`、save 時の structuredClone＋compaction＋stringify | スナップショットを「変更セクション単位」に。保存は週末1回＋debounce。validate はサンプリング/dirty時のみ | **P0** |
| セーブ肥大 | `finance` 3.1MB、`purchaseOrders` 2.2MB | 完了した発注の要約化、transaction のアーカイブ閾値を短縮、IDBを主にする | **P0** |
| 店舗数に比例する処理 | 店舗ごとの market/supply/workforce 詳細処理 | 委任店舗は**コホート（同業種×同地域）で集約計算**、詳細は「注目店舗」のみ | P1 |
| AI企業数 | 現状は少数 | Tier B/C の固定式、四半期ごとの意思決定 | P1 |
| Ownership Graph | 未実装 | Entity数 ≤ 数百、edge ≤ 千、固定点は3反復まで → O(E) | P2 |
| 描画 | 19タブ＋enhancer 79 | Table の仮想化（表示行のみDOM化）、enhancer 予算の維持 | P1 |
| 起動 | 205 script、約3.5MB | 当面は許容（既存の lazy map）。将来は画面単位の遅延ロード | P2 |

**100社・1000店舗のUIについて**: 表示はTable＋Filter＋Search＋仮想化で**可能**。問題はUIではなくシミュレーションと保存であり、上のP0/P1対策が前提になる。

---

## 17. Save Migration Risks

| リスク | 内容 | 対策 |
|---|---|---|
| saveVersion 9 固定 | 不変条件（CLAUDE.md §2） | **全て additive**。新しいトップレベルは `capitalGraph` / `delegation` / `dealBook`（揮発なら保存しない）の3つまで。各々 internal `schemaVersion` を持ち、`ensure*` で補完 |
| 既存フィールドの意味変更 | 例: `companyCash` を連結現金にしたくなる | **禁止**。連結は read model で作る。`companyCash` は親単体のまま |
| 所有表現の二重管理 | legacy と graph の不一致 | Phase 1–2 は導出のみ（保存しない）。保存を始める時点で「legacy → graph の一方向同期＋一致検証テスト」 |
| 株価の意味変化 | ランダムウォーク → ファンダ連動で既存保有の評価が急変する | 旧saveは初回ロード時に現価格を**アンカー**にし、内在価値へ52週で収束させる（ジャンプしない） |
| 合成M&A候補の消失 | 既存の `acquisitionTargets` は期限13週 | 期限まで旧形式を尊重し、新規生成から Shell 由来にする |
| PEファンドのキャピタルコール | 既存ファンドは全額拠出済み | 新規組成ファンドにだけ適用（`fund.capitalCallModel:'upfront'` を既定値に） |
| saveVersion 10 が必要になるケース | 所有表現の保存形式を一本化し legacy を削除する場合 | ユーザーの明示承認＋専用migration PR＋旧save fixture群での往復テスト。**本構想の P0–P2 では不要** |

---

## 18. Technical Debt（構想の前に直すべきもの）

**必須（これを直さずに進めると破綻する）**

1. **週次処理がデコレータ連鎖で組まれている**: advanceWeek 16重、normalize 46重、updateParityWeekly 27重。順序が script ロード順に依存している。新しい経済フェーズ（AI Corporate Actions・証券評価）を差し込む位置を宣言できない。→ Weekly Phase Registry。（登録時注記: 最終確定処理の境界は #776 で固定済み。対象は境界内の中間順序。§2.2 の注記を参照）
2. **永続化コスト**: 週時間の約50%、保存6.65MB/40店舗。店舗を増やす設計のすべてを阻害する。
3. **資金移動プリミティブがない**: 直接代入＋event の二重書き。個人側にledgerがない。4つ目以降のプール（子会社・AI）を増やすと保存則の証明が不可能になる。→ `moveCash`＋personal-lite ledger。
4. **プレイヤー会社が暗黙のシングルトン、業種レコードが共有**: PE の detached bridge を5つ作る必要があった根本原因。子会社を「実運営できる会社」にするには Company Entity の抽象が要る（最初は read model＋書き込みアダプタ）。

**重要（該当フェーズの前に直す）**

5. **評価ロジックの分散**（`companyValue` / Deal Room bridge / PE / startup / listed-sub）→ Valuation Service に集約（最初は既存関数への委譲だけ）。
6. **競合の二系統**（`competitors` と `competitorStates`）→ Corporate Shell を共通の親にする。
7. **BSの構造欠落**（長短区分・連結・非支配持分・原価評価）。
8. **個人純資産に自社株持分がない**: 設計意図は未確認。エンディング `capital_king`（個人純資産≥1兆）の意味に影響する。持株の評価を「参考値として別表示」にするか「算入」するかを明示的に決める必要がある。（登録時注記: 第1部 A-1〜A-4 で「算入する」と確定済み）
9. **合成M&A候補**（乱数企業）→ 世界に常在する企業へ。

**軽微（随時）**

10. BS許容誤差±2円 → 整数円化（`store-weekly-integer-yen` の流れを全域へ）。
11. 19タブ → 5＋More。
12. `capital-allocation-*` 13ファイルが防衛寄りに分散している → Deal Book の「Treasury」セクションへ統合。

---

## 19. Recommended Architecture Changes

### P0（基盤。これが終わるまで新しい経済機能を足さない）

- P0-1: Weekly Phase Registry。現行順序のスナップショットテスト → ラッパの段階移行（1PRで1モジュール）。登録時注記: 最終境界は #776 で固定済みなので、対象は境界内の中間フェーズに限る。
- P0-2: Persistence のダイエット。transaction スナップショットのセクション化、保存の週末1回化、`purchaseOrders` の要約化、finance archive の閾値見直し、IDB を主にする。**計測値（週ms・保存bytes）の回帰テストも追加する。**
- P0-3: `moveCash()` プリミティブ＋プール定義＋保存則テスト（既存呼び出しは移行しない。新規コードで必須化）。
- P0-4: 個人純資産の定義を決める（自社株持分の扱い）。**これはユーザー判断**。（登録時注記: 第1部 A-1〜A-4 で確定済み。残るのは実装のみ）

### P1（読み取りモデル）

- P1-1: Entity Registry（導出のみ）。
- P1-2: Ownership Edges（導出のみ）＋ Control Resolver（純関数）。
- P1-3: Valuation Service（既存評価関数のファサード）。
- P1-4: Portfolio read model（BU横並び表のデータ）。
- P1-5: Deal Book aggregator（読み取りのみ。出店見積・Deal Room・PE・VC・不動産・返済・還元を正規化）。

### P2（書き込みと体験）

- P2-1: Corporate Shell（Tier B）＋ 上場銘柄のファンダ・アンカー化（旧saveはアンカー収束）。
- P2-2: 競合を Shell にぶら下げる → 上場ライバル → 買収可能。
- P2-3: Control Ladder の一般化（大量保有・TOB・スクイーズアウト）。
- P2-4: 連結 read model ＋ 非支配持分 ＋ 持分法。
- P2-5: Delegation Policy フレームワーク。
- P2-6: Bandwidth リソース。
- P2-7: 5タブIA ＋ Terminal Mode。

### P3（拡張）

- AI Corporate Actions（配当/自社株買い/M&A/IPO/倒産）の完全化、AI間持合い。
- PE キャピタルコール、TVPI/IRR。
- 金融子会社（銀行）。
- 物流拠点/工場 CapEx。
- 独禁法審査。
- スピンオフ/合併。
- エンドゲーム（メガM&A、活動家、承継の拡張）。

---

## 20. Development Roadmap（実コードに合わせて最適化）

1 PR = 1 concern（CLAUDE.md §2）。各 Phase は複数PRで構成する。

| Phase | 名称 | 目的 | 主な成果物（PR単位の例） | 完了条件 |
|---|---|---|---|---|
| 0 | Foundation | 拡張可能な土台 | (a) 週次順序スナップショットテスト (b) Phase Registry 導入（空）(c) 既存ラッパを1つずつ移す (d) 保存の週末化・セクションスナップショット (e) purchaseOrders 要約 (f) 性能回帰テスト | 40店舗で週<400ms（Node）、保存<3MB。全 canonical 緑、決定論 fingerprint 不変 |
| 1 | Unified Money | 資金移動の一元化 | (a) `moveCash`＋プール定義 (b) personal-lite ledger (c) 保存則テスト (d) 長短負債区分 | 全プールで保存則。BS差0円 |
| 2 | Ownership & Valuation (read) | 帝国を「見える」ようにする | (a) Entity Registry (b) Ownership Edges (c) Control Resolver (d) Valuation Service (e) 帝国タブ（Graph＋Portfolio表） | 既存の全所有表現が graph に出る。legacy との一致テスト |
| 3 | Capital Allocation (Deal Book) | 配分をゲームの中心にする | (a) Opportunity 正規化（読み取り）(b) 資本タブ (c) Bandwidth (d) 比較UI（IRR/回収/リスク/流動性/Fit） | 週ごとに「最も良い案件」が状況で変わることを playtest で確認 |
| 4 | Living Market | 株価と世界の実体化 | (a) Corporate Shell (b) ファンダ・アンカー価格 (c) ライバルの上場 (d) スクリーナー/セクター | 決算サプライズで株価が動く。既存 save はジャンプしない |
| 5 | Control & Consolidation | 支配をゲームにする | (a) 大量保有/TOB/スクイーズアウトの一般化 (b) ライバル買収 (c) 連結 read model＋非支配持分 (d) 持分法 | 市場買い→TOB→子会社化→連結の一連を E2E テスト |
| 6 | Delegation | 判断レイヤの上昇 | (a) Policy モデル (b) 店長/エリア/CXO の権限 (c) 例外アラート (d) 委任店舗のコホート計算 | 100店舗で「毎週触る画面数」が Stage 1 と同等以下 |
| 7 | Operations Depth | 5本柱の継続的な深掘り | 既存ロードマップ（`docs/gameplay-systems-roadmap.md`）に従う＋物流拠点/工場CapEx | 各柱の既存テスト方針 |
| 8 | AI Symmetry & Advanced Finance | 世界が自走する | (a) AI Corporate Actions (b) AIによる敵対的買収（実保有から）(c) キャピタルコール/TVPI/IRR (d) 金融子会社 | 208週で AI の倒産/買収/IPO が発生し、会計の不変条件を満たす |
| 9 | Endgame | 終盤の目的 | メガM&A、コングロマリット・ディスカウントと分割、活動家としてのプレイヤー、危機時の救済買収、承継 | 終盤の「判断密度」を計測 |

**Phase 7 は Phase 3 以降と並行してよい**（柱の深掘りは独立している）。

---

## 21. Dependency Graph

```
P0 Phase Registry ─┬─► P0 Persistence diet ─► P1 Cohort sim ─► Phase 6 Delegation(scale)
                   │
                   └─► Phase 1 moveCash/pools ─► Phase 2 Entity Registry ─┬─► Ownership Edges ─► Control Resolver
                                                                          │         │                   │
                                                                          │         ▼                   ▼
                                                                          ├─► Valuation Service ─► Phase 4 Corporate Shell
                                                                          │         │                   │
                                                                          │         ▼                   ▼
                                                                          └─► Portfolio read ─► Phase 3 Deal Book ◄─ Bandwidth
                                                                                                        │
                        Phase 4 Shell + Control Resolver ─► Phase 5 TOB/Rival M&A ─► Consolidation/NCI ─┤
                                                                                                        ▼
                                                                          Phase 8 AI Corporate Actions ─► Phase 9 Endgame
```

---

## 22. Risk Register

| Level | Risk | 影響 | 対策 |
|---|---|---|---|
| **High** | 株価をファンダ連動に変えると既存 save の資産評価が急変する | 旧save破損と同等の体験 | アンカー＋52週収束、旧 fixture での評価差の上限テスト |
| **High** | Phase Registry への移行で順序が変わり、RNG消費順が変化する | fingerprint 崩壊、決定論テストの大量更新 | 移行前に順序と RNG 消費数のスナップショットを取り、**1PRで1ラッパ** |
| **High** | 永続化の性能を直さずに機能を追加する | iPhone で週送りが数秒、保存が quota 超過 | P0 完了を Phase 2 以降の着手条件にする |
| **High** | 資本配分が「IRR最大を押すだけ」になる | ゲーム性の崩壊 | Bandwidth・流動性・支配・サイクル・機会の期限を同時に効かせる（§ Q10） |
| **High** | 所有表現の二重管理で不整合 | 会計の不変条件違反 | 導出のみ → 一方向同期 → 一致テスト |
| Medium | 情報量の過多（WSR化） | モバイル離脱 | Progressive disclosure、段階的なタブ解放 |
| Medium | AI の Tier 境界で挙動が不連続になる | 違和感・エクスプロイト | 昇格/降格時に状態を保存則で写像 |
| Medium | 連結の導入で既存の子会社利益計上と二重になる | 利益二重計上 | 連結は read model から開始し、PLへの反映は専用PR |
| Medium | enhancer 予算79 / observer 数の超過 | CI 失敗 | 新しい画面は D UI の既存 hook を拡張する |
| Low | Terminal Mode のタップ領域不足 | iPhone 操作性 | 行全体をタップ対象（44px）にする |
| Low | 日本法の閾値が海外ユーザーに分かりにくい | 理解コスト | 閾値ごとに1行の効果説明 |

---

## 23. Final Recommendation

### 何を作るか

**「Capitalism Tycoon = 日本を舞台にした、所有と支配の資本配分シミュレーション」**。

プレイヤーは毎週、次の2つを配分する。

1. **Cash**: 会社・個人・ファンドの3財布。混ざらない（既存の不変条件をゲーム性に変える）。
2. **Bandwidth**: 経営の注意力。自分で見られる案件数には限りがある。委任すると増えるが、委任先の質が結果を左右する。

配分先は**全て Deal Book に同じ形式で並ぶ**。

- 新店舗、設備、広告キャンペーン
- 競合の株、ライバル企業のTOB
- 不動産、VCラウンド、PE案件
- 借入の返済、自社株買い、配当

各案件は期待リターン・回収期間・リスク・流動性・戦略適合・Bandwidth消費・**期限**を持つ。景気サイクル・金利・ライバルの動きで、最適解が毎週変わる。

### 3作品の長所をどう統合するか

- **Big Ambitions の「ゼロから育てる感覚」**: Stage 1–2 で店舗を自分の手で回す体験（既存の5本柱）。成長に伴って委任が増え、プレイヤーの仕事が「操作」から「方針」へ、そして「資本」へと移る。
- **GBT の「帝国を見渡すUI」**: ホームの「今週の判断3件」、事業タブのポートフォリオ表、帝国タブの Ownership Graph。Cards → Table → Terminal と深さを選べる。
- **WSR の「資本が本当に動く世界」**: 全ての企業（自社・子会社・ライバル・上場企業・PE投資先）が同じ会計と評価で動き、株を通じて支配が移る。ライバルは倒産もするし、プレイヤーを買収しにも来る。

### 独自性（既存の経営シミュとの明確な違い）

1. **Operator から Allocator への移行そのものがゲームの進行軸**。店舗経営ゲームで終わらず、金融ゲームから始まりもしない（両ルートが同じ世界で合流する）。
2. **Control Ladder**: 日本の会社法の閾値が戦略的な節目になる（1/3の拒否権、2/3の特別決議、90%のスクイーズアウト）。
3. **会社財布と個人財布の厳格な分離**を「配当で個人に抜くか、会社で再投資するか」という判断に変える（WSRにもGBTにも、この日本的オーナー経営の緊張はない）。
4. **Bandwidth**: 資本配分に「経営能力」という2つ目の制約を与え、「最もIRRが高い案件を全部取る」を不可能にする。
5. **地域（47都道府県）の物理マップと資本市場が同じ世界**: 出店したライバル店舗の親会社の株を市場で買える。

---

## 付録: 13の質問への回答

**Q1. WSR の Capital Allocation を Core Loop にできるか**
できる。既存の Deal Room・PE・VC・社債・配当/自社株買い・コベナンツが部品として揃っている。Core Loop は次の形にする。

> 週送り → ホームで「今週の判断」→ Deal Book で配分 → 結果が P&L / Cash / Valuation / Ownership に反映 → 次週

**Q2. 現在のコードベースを維持したまま可能か**
**維持したまま可能。ただし P0（Phase Registry・永続化・moveCash）と Entity/Ownership の read model が前提**。全面書き直しは不要。既存の205モジュールと609テストは、Strangler 方式で活かせる。「根本的変更」が必要なのは次の2点だけ。
1. 週次処理の組み立て方（デコレータ → 宣言的フェーズ）
2. 上場株価の生成方法（ランダムウォーク → ファンダのアンカー）

**Q3. 店舗経営と Capital Allocation の接続**
3本の橋で接続する。
1. 出店見積（`estimateStoreOpening` の decisionProfit/payback）、設備、広告を **Opportunity として Deal Book に出す**。
2. 店舗・BUの利益は `moveCash` で会社プールに入り、同じプールから M&A・返済・還元へ出る。
3. 店舗群の価値を Valuation Service で BU評価額にし、ポートフォリオ表・M&A売却・IPO評価に使う。

**Q4. Big Ambitions 型の委任をどう導入するか**
Delegation Policy（domain × delegate × authority × guardrails、§14）。既存の `autoManage`・店長の営業時間調整・CFO委任は、このモデルのプリセットとして吸収する。委任の報酬は Bandwidth の解放。支配・M&A・資本構成は委任不可。

**Q5. GBT 型 Dashboard を現在のUIにどう統合するか**
D UI shell の中で次のように統合する。
- ホームを「今週の判断3件」（秘書アラート＋Deal Book上位）と KPI 帯に再構成。
- 事業タブにポートフォリオ表とドリルダウン。
- 19タブ → 5＋More。
- 新しいデザインシステムは作らない（CLAUDE.md §3, DESIGN.md）。

**Q6. 100社・1000店舗でも iPhone で操作可能な UI にできるか**
UI は可能: Table の仮想化＋フィルタ＋検索＋委任による例外管理（毎週触るのは例外だけ）。**シミュレーションと保存は現状では不可能**（計測で約25ms/店舗/週、保存は数MB単位で増える）。P0 の永続化ダイエットと P1 のコホート計算を前提にすれば到達可能。

**Q7. WSR ほど複雑な金融をモバイルで理解可能にするには**
1. 全ての金融行為を「Opportunity カード」という同じ型で見せる。
2. 閾値に意味のラベルを付ける（「1/3超＝拒否権」）。
3. Progressive disclosure（Card → Table → Terminal）。
4. 実行前のプレビュー（既存の Exit Decision Center / Sourcing Desk と同じ「読み取り専用シミュレーション」パターン）。
5. 商品数を絞る（§8）。

**Q8. 不要な WSR 機能**
オプション、先物、暗号資産、コモディティ直接売買、Greenmail、サブプライムの詳細、米国型ポイズンピル、連結納税。空売りは保留。

**Q9. 不要な Big Ambitions 機能**
3D/アバター移動、生活シム、手動配送・車両、内装の自由配置、シフト表の細かい編集（プリセットで代替）、人材獲得競争（保留）。

**Q10. 不要な GBT 機能**
業種の大量横展開（5本柱方針に反する）、全数値の常時表示ダッシュボード、リアルタイム進行。

**Q10補足. 「一番IRRが高いものを押す」ゲームにしないための Decision System**
1. **Bandwidth**: 案件ごとに消費。上限は役員/委任の状態で決まる。
2. **期限**: 案件は数週で消え、待つことにもコストがある。
3. **流動性**: 換金週数と割引。危機時に効く。
4. **レバレッジ**: 格付け・コベナンツが次の案件を制約する。
5. **サイクル**: 金利/スプレッド/センチメントで同じ案件の価値が変わる。
6. **戦略適合・シナジー**: 同業種・同地域で効くが、独禁法審査を招く。
7. **リスクの分布**: 期待値ではなくレンジで示す（P10/P50/P90）。
8. **支配価値**: 同じ10%でも、1/3に届くかどうかで意味が違う。
9. **規制**: 独禁法・金融規制。
10. **機会費用**: Deal Book に常に「国債/返済」の基準線を表示する。

**Q11. 最大の Architecture Bottleneck**
2つが同率。
1. **週次処理と永続化の構造**: 16重デコレータの advanceWeek、毎トランザクションの全状態 JSON スナップショット、週時間の約50%を占める保存処理。
2. **Entity/Ownership の不在**: プレイヤー会社が暗黙のシングルトンで、所有表現が10種以上に分散し、上場株が実体企業につながっていない。

**Q12. 絶対に直すべき Technical Debt**
§18 の必須4項目。
1. Weekly Phase Registry
2. 永続化コストとセーブサイズ
3. `moveCash` と personal-lite ledger
4. Company Entity の抽象（まず read model）

加えて、ユーザー判断として「個人純資産に自社株持分を含めるか」の決定。（登録時注記: 第1部 A-1 で「含める」と確定済み）

**Q13. 実装した場合、既存の経営シミュと何が明確に違うゲームになるか**
- 「店を経営するゲーム」でも「株を売買するゲーム」でもない。
- **会社・個人・ファンドの3つの財布と経営の注意力を、同じ Deal Book の上で毎週配分し、日本の会社法の閾値を登って企業を支配していく**ゲームになる。
- 店舗は帝国の利回りを生む資産であり、ライバルは買収対象であり、同時に自分を買収しに来る相手でもある。

---

### 付録B: 監査で使った根拠の一覧

- `CLAUDE.md`, `AGENTS.md`（存在を確認）, `DESIGN.md`
- `docs/GAME_OVERVIEW.md`, `docs/gameplay-systems-roadmap.md`, `docs/CURRENT_SAVE_SCHEMA.md`, `docs/FINANCE_ENGINE_DESIGN.md`, `docs/COMPETITOR_FINANCE_GUIDE.md`, `docs/PHASE5B4_COMPETITOR_DISTRESS.md`
- `js/engine.js`: 516-541, 605-650, 743-760, 860-912, 1327-1370, 1578-1600, 1713-1723, 1977, 1998, 2063-2133
- `js/finance.js`: CATEGORIES, `bsFrom`, `validate`
- `js/expansion.js:783`, `js/shareholder-returns.js`, `js/save-storage.js:1-160`, `js/d-ui-shell.js:12-22`, `js/management-context.js`（冒頭コメント）, `js/listed-subsidiary-control-actions.js`
- デコレータ数: `grep -o 'prototype\.[a-zA-Z]*=' js/*.js | sort | uniq -c`
- 性能計測: `tests/harness.js` の `loadGame({headless:true})`、LCG seed 12345、1/10/40店舗、52–104週、`node --cpu-prof`（計測スクリプトはリポジトリ外。コード変更なし）

### 付録C: 未確認事項（実装前に確認すべきもの）

1. 自社の公募増資（Secondary offering）の有無。上場子会社の追加募集は確認済み。
2. `maSubsidiaries[].retainedEarnings` が表示用トラッカーか、会計上の意味を持つか。
3. `market[]` 銘柄の配当が実際に支払われる経路（`investmentDividend` カテゴリは存在する）。
4. 自社保有物件への出店時に賃料が内部化されているか。
5. iPhone 実機（Safari）での週送り時間と保存の挙動（IDB へのフォールバック頻度）。
