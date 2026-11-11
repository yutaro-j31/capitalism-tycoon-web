# UI v3 移行台帳

現行の画面から**消える操作**と、その**v3での行き先**の台帳。`README.md` は「新しい画面に何を置くか」を決め、この台帳は「現行の画面にあった操作がどこへ行ったか」を記録する。

- 各画面の作業の最初に、担当がその画面の表を作る（`README.md` 7章「各作業の進め方」）。
- 行き先の無い行を残さない。決まらない行は「現行UI（6.5）」とし、残件の表にも書く。
- 操作は、現行の画面を実際に開いて洗い出す。`js/app.js` の描画だけでなく、enhancer が差し込む操作も含める。

## 確かめる状態

操作は状態によって出たり消えたりする。少なくとも次の状態で洗い出す。その画面に関係の無い状態は「該当なし」と書く。

| 状態 | 作り方の例 |
| --- | --- |
| 創業直後 | 既定の設定で創業 |
| 1号店の開店後 | 出店して4週進める |
| 資金繰りが「安定」以外 | 確認専用に `g.playerCrisis.status` を書き換える（リポジトリには入れない） |
| 本社あり・部門あり | 画面に関係する部門を設置した状態 |
| 上場後 | 画面に関係する場合のみ |
| その画面の主な対象が1件以上ある | 例：保有株、投資先、借入、物件、買収案件 |

確かめられなかった状態は、表の下に「未確認」として書く。

## 残件（現行UIに任せている状態）

UI3-9b で解消する。UI3-11 の時点で0件であること。

| 画面 | 状態 | 現行UIで出る操作 | 仕組み |
| --- | --- | --- | --- |
| `home` | 資金繰りが「安定」以外 | `founder-capital`、`emergency-bridge`、`sponsor-injection`、`turnaround-fund`、資産売却、経費削減（`js/player-crisis-ui.js` のパネル）、再建計画の開始（`data-player-turnaround-action`、`js/player-turnaround-plan-ui.js`） | 枠の規則 `CURRENT_UI_RULES.home` |
| `map` | 3Dの地図が使えない（WebGL・アセット・コンテキストの失敗） | 現行のCanvas2D地図とその操作一式（`city-retry`、一覧の `details`、現行のマーカーと詳細パネル） | 画面の登録の `useCurrentUI`（失敗を検知したら、その後は現行UI） |
| `business` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="business"`）を押したとき（次の `tab` 操作まで） | 営業時間（`data-store-hours`）、メニュー構成（`store-menu-price` `reset-store-menu-price` `remove-store-menu` `add-store-menu`）、市場分析・顧客レビュー・競合分析・プロダクトの詳細・フランチャイズの一覧と、enhancer が差し込む欄（供給・人事・広告など） | 枠の `openCurrentUI` |
| `business` | リコール危機が未対応（`activeRecallCrisis` が有効で `responded` が偽） | `respond-recall-crisis`（自主回収・補償）と、リコール危機の欄（`renderRecallCrisisSection()`） | 枠の規則 `CURRENT_UI_RULES.business` |
| `office` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="office"`）を押したとき（次の `tab` 操作まで） | 組織・2Dキャンパス・部門の設置と採用・CXO・重要社員・取締役会とIPO・指示と社内VC（`office-tab` の8タブの中の操作すべて）、支社の契約解除（`close-branch-office`）。仕様は設計担当が UI3-9b に含めて書く | 枠の `openCurrentUI` |
| `market` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="market"`）を押したとき（次の `tab` 操作まで） | 自社株の操作（`stock-split` `stock-mbo` `founder-share-sale` `defense` `view-earnings` `set-dividend` `buyback`）、チャート（`stock-chart-range`）、信用取引の欄、資本配分の操作（`data-capital-allocation-*`）、業種の絞り込みと銘柄の詳細（`select-stock`） | 枠の `openCurrentUI` |
| `venture` | 子会社のIPO、新規事業の分析、資本配分の実行、ベンチャー拡張の欄 | 子会社IPO（`ipo-subsidiary` と準備の各段階）、`data-new-business-analysis-action`、`data-group-capital-execution-action`、`renderVentureExpansion()` | 画面の行 `data-ui3-current="venture"`（利用者が押したとき。次の `tab` 操作まで） |
| `ma` | 案件の交渉、統合の進め方、買収ポートフォリオの最優先操作 | `ma-start-dd` `ma-submit-offer` `ma-accept-counter` `ma-financing-*` `ma-board-*` `ma-close-deal` `ma-withdraw-deal`、`start-ma-pmi` `support-ma-pmi` `transport-rebuild`、`data-ma-portfolio-action` | 画面・案件のシートの行 `data-ui3-current="ma"` |
| `assets` | 土地の建設、投信・債券・高級資産・スポーツ、個人資産の内訳 | `build-property`（名前入力）、`asset-tab` の3タブの購入・売却、`founder-wealth-capture` | 画面の行 `data-ui3-current="assets"` |
| `pe-portfolio` | 6つのレバー・Exit・ファンドの組成 | `data-pe-portfolio-price` ほか、`exit-pe`、`pe-initiative`、`transfer-pe`、ファンドの組成 | 画面・シートの行 `data-ui3-current="pe-portfolio"` |

## その他の残件

| 内容 | 扱い |
| --- | --- |
| ホームの「今週やること」と週間レポートの「次の一手」の選定ロジックが重複している | 共通化は v1.0 では行わない（設計担当の決定 2026-11-11）。 |
| 金額・数量の入力ダイアログ（`askMoney`、iPhone用の入力ダイアログ） | **UI3-9a で v3 の金額入力シートにした**（`modules.ui3.amountSheet`。`?ui=3` では現行のダイアログは出ない）。残件なし。名前の入力（`askText`）は現行のダイアログのまま（UI3-9b に含める）。 |
| 銀行画面（`bank`、未移植）の借入・返済の入力で、iPhone 用ダイアログにあった「利用可能枠」「返済後残高」の行（`?ui=3` では `interceptMoney` を止めたので一時的に出ない） | UI3-7 で `bank` を作るとき、`setAmountContext` の `preview` で戻す。 |

## 画面ごとの表

### `home`（UI3-1）

洗い出し：UI3-1の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=home` で、創業直後・1号店の開店後・資金繰り危機・本社あり（出店→本社契約→部門設置）・上場後（`g.publicCompany` を確認専用に書き換えた状態。実際のIPOではない）を確認した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`（`‹`） | enhancer（`city-lab-work-header`） | 常時 | 下のタブ「マップ」 |
| `advance-week` | enhancer（`city-lab-capital`） | 常時（iPhone幅のCSSでは隠れる） | 枠の「進める」ボタン |
| `founding-tutorial-jump`（手順は状態で変わる。確認できたのは `dashboard`＝創業直後、`weekly_recap`＝1号店の開店後・本社あり） | `renderHome()`（創業ガイドのカード） | 創業ガイドの表示中 | 今週やることの1件（同じ操作・同じ `data-step`。表題は `創業ガイド N/10：…`） |
| `founding-tutorial-jump` → `missions`（成長ロードマップへ） | `renderHome()`（創業ガイドのカード） | 創業ガイドが要約・完了の表示のとき（上場後で確認） | ホームの「目標」の行 `進行・目標`（`tab` → `missions`、常設。設計担当の決定 2026-11-11）。「今週やること」には出さない。UI3-9 で `missions` がホームのシートになったら見直す |
| `secretary-jump`（確認する。確認できた行き先は `business` `rivals`。資金不足のときは `bank`） | `renderHome()`（経営秘書の優先タスク） | 秘書のタスクがあるとき（1号店の開店後・本社ありで確認） | 今週やること（同じ操作。最大3件、危険なものを先頭に） |
| `tab` → `strategy`（すべて見る） | `renderHome()` | 秘書のタスクがあるとき | 事業タブ › 戦略（現行UI。UI3-9で作り直す） |
| `secretary-jump` → `ma`（買収候補探索を確認。`data-ceo-ma-action` は同じボタンの目印） | `renderHome()`（M&Aガバナンスの欄） | 常時 | 投資タブ › M&A（`ma`。UI3-6）。ホームには置かない |
| `tab` → `map` `office` `ma` `business` `overseas`（成長の欄の行） | `renderHome()` | 1店以上かつ会社現金が1,000万円を超える→`map`、IPOの条件がすべて満たされた→`office`、買収候補がある→`ma`、未リリースの商品がある→`business`、海外子会社か海外部門がある→`overseas` | 下のタブとチップ（マップ、事業タブ、投資タブ）。**未確認**：再現していない。`js/ceo-dashboard.js` の `growth()` から書いた |
| 危機対応の操作：`founder-capital` `emergency-bridge` `sponsor-injection` `turnaround-fund`（`data-player-crisis-action`）。売却できる資産や削減できる経費があれば、資産売却と経費削減も | enhancer（`js/player-crisis-ui.js`） | 資金繰りが「安定」以外（確認できたのは先頭の4つ。資産売却・経費削減は候補が無く出なかった） | 現行UI（6.5）。残件 |
| `data-player-turnaround-action` = `start`（8週間の再建計画を開始） | enhancer（`js/player-turnaround-plan-ui.js`） | 資金繰りが「安定」以外 | 現行UI（6.5）。残件 |
| （操作なし）`[data-economic-foundation]` の欄 | enhancer | 常時 | 置かない（読み物。必要な数字は会社 › 決算） |
| （新規）ニュースの行 `tab` → `news` | v3のホーム | 常時 | 現行の操作の移行ではない。UI3-9でシートに替える |

未確認：1号店の開店後、本社あり、上場後に現行ホームへ差し込まれる操作。UI3-1のPRで確かめて、この表に足す。

### `map`（UI3-3）

洗い出し：UI3-3の担当エージェント、2026-11-10、Chromium・390×664。創業直後の現行地図（`?ui=2`）で、`#app` 内の `data-action`・`data-d-ui-action`・`data-city-camera`・`data-bind` を数えた（「出店候補・物件・オフィス一覧」の `details` を開いた状態を含む）。保有物件・本社設置済みの状態は、確認専用に `g` を書き換えて v3 側の届き先を確かめた（現行UIでの出方は読んだだけ）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `data-d-ui-action="map-filter"`（6種の絞り込み） | `js/city-lab-map.js` の表示ボタンの中 | 常時 | チップ（すべて／自社店舗／出店候補／オフィス／不動産／競合） |
| `data-city-camera` `in` `out` | 3D地図の右端 | 常時 | 右端の ＋ − |
| `data-city-camera` `fit`（全体） | 同上 | 常時 | 置かない（仕様の3ボタンは ＋ − 一覧。縮小で代替） |
| `data-city-camera` `filter`（表示） | 同上 | 常時 | チップが常に出ているので不要 |
| `data-bind="selectedPref"`（都道府県） | 3D地図の左上 | 常時 | チップ行の先頭（同じ `select` を移した。既存の操作） |
| `data-bind="selectedBusiness"`（8個） | 一覧の `details` の中、テナントごと | 空きテナントがあるとき | 出店シートの業種の切り替え（`.u-seg`。表示状態のみ） |
| `open-store`（8個） | 一覧の `details`／ピンの詳細パネル | 空きテナントがあるとき | ピン／一覧 → 出店シート `出店する`（同じ操作、`#business-<ID>` の入力つき） |
| `contract-office`（3個） | 一覧／ピンの詳細パネル | 本社が無いとき、オフィスの空きがあるとき | ピン／一覧 → オフィスのシート `契約する` |
| `contract-branch-office` | 一覧（本社を設置済みのとき） | 本社あり | 同上のシート `支社として契約する` |
| `buy-property-company` `buy-property-personal`（各6個） | 一覧／ピンの詳細パネル | 売出物件があるとき | ピン／一覧 → 不動産のシート `会社で購入` `個人で購入` |
| `negotiate-property-company` `negotiate-property-personal`（各6個） | 一覧 | 同上 | 不動産のシートの行 `会社で価格交渉` `個人で価格交渉` |
| `sell-property` | 一覧 | 保有物件があるとき | 不動産のシートの行 `この物件を売却` |
| `tab` → `business` / `office` / `rivals` | ピンの詳細パネル | 自社店舗／契約済みオフィス／競合のピンを選んだとき | 各シートの主ボタン（`店舗を見る` `本社・組織へ` `競合を見る`）。不動産は `tab` → `assets` |
| `advance-week`（地図の下の「1週間進める」） | 3D地図のフッター | 常時 | 枠の「進める」ボタン |
| `tab` → `home`（今週の経営判断 ›） | 3D地図の上のカード | 常時 | 下のタブ「ホーム」（README 5.2：地図には置かない） |
| 選択中の建物の「この建物へ寄る」 | ピンの詳細パネル | ピンを選んだとき | ピンを選ぶと自動でカメラが寄る |
| 詳細パネルの開閉（ハンドル） | 同上 | 同上 | 置かない（シートは58%固定。地図の上をタップで閉じる） |
| `city-retry`（3D地図の再試行） | 予備表示の通知 | 3Dが使えないとき | 現行UI（6.5）。残件 |
| 「出店候補・物件・オフィス一覧」の `details`（全件の一覧） | `js/city-lab-map.js` | 常時 | 一覧ボタン → 一覧シート（絞り込みに従う）。各行はピンと同じシートへ |
| `d-ui:toggle-menu` | D UI の枠 | 常時 | 下のタブ |
| `tab` → 19画面（`d-ui` のナビ） | D UI の枠 | 常時 | 下のタブと、隠した全画面の一覧（枠） |

未確認：競合のピン（創業直後の東京には無い）、`contract-branch-office` と `sell-property` の実行（行き先の存在だけを、強制した状態で確認。実行はしていない）、`close-branch-office`・`cancel-office` は現行地図に出ないので対象外。

### 週間レポート（UI3-2）

画面（`selectedTab`）ではなく、週を進めたあとに `showWeeklySummary()`（`js/app.js`）が `#modal-root` に出すモーダル。洗い出し：UI3-2の担当エージェント、2026-11-11、Chromium・390×664。創業後の1週目、1号店の開店後（出店して4週進めた次の週）、資金繰り危機（`g.playerCrisis` を確認専用に書き換え）で、`#modal-root` の `data-*action*` を調べた。3つの状態とも同じ3つだった。`scripts/ui3-dump-screen-actions.js` は `#screen` だけを調べるので使っていない（確認用の一時スクリプト）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `close-modal`（モーダルの背景） | `showWeeklySummary()` | 常時 | シートの背景（同じ操作） |
| `close-modal`（閉じる） | `showWeeklySummary()` | 常時 | シートの「閉じる」（主ボタン。同じ操作） |
| `tab` → `home`（次の優先タスクを見る） | `showWeeklySummary()` | 常時 | シートの「次の一手」。行き先は固定の `home` ではなく、秘書の最優先タスク（危険なら警告）→ 創業ガイドの現在の手順 → 秘書の先頭のタスク → ホーム、の順に決まる（`tab`） |
| （操作なし）再建計画レポートの欄（`data-player-turnaround-weekly-report`） | enhancer（`js/player-turnaround-plan-report.js`） | 再建計画の進行中 | 置かない（読み取り専用）。1行の要約は `summary.newNews` の先頭に入るため、今週の出来事の先頭に出る |
| （操作なし）売上・費用・利益・会社現金・企業価値・個人資産の一覧、週間インパクト、「利益と現金の差」、主なニュースの全件 | `showWeeklySummary()` | 常時 | 利益・売上・会社現金だけシートに置く。残りは会社 › 決算（`report`。UI3-7）。それまでは現行UIの決算画面 |

未確認：再建計画の進行中に出る欄（状態を作っていない。読み取り専用で操作が無いことはソースで確認した）。
未確認：実際のIPOを経た上場後、成長の欄の行、資産売却と経費削減の操作。

### `business`（UI3-4）

洗い出し：UI3-4の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=business --states=founding,store-open,office,listed`（創業直後・1号店の開店後・本社あり・上場後）。`data-action` 以外（`data-store-hours` の選択など）は現行の描画（`renderBusiness()` `renderStoreEquipment()`）を読んで足した。enhancer が差し込む欄は、操作の一覧には出ないものがあるため未確認（下）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`（`‹`） | enhancer（`city-lab-work-header`） | 常時 | 下のタブ「マップ」 |
| `advance-week` | enhancer（`city-lab-capital`） | 常時 | 枠の「進める」ボタン |
| `tab` → `map`（未出店の業種の行、`data-business-idle`） | `renderBusiness()` | 未出店の業種があるとき | 「未出店の業種」の行（同じ操作） |
| `business-invest`（品質・広告・効率化・DX） | `businessFullCard()` | 運営中の事業 | 運営中の事業の行 → 事業のシート（同じ操作。金額は v3 の金額入力シート） |
| `business-price` | `businessFullCard()` | 運営中の事業 | 事業のシート（同じ操作） |
| `start-franchise`（FC本部を設置） | 事業ポートフォリオの上 | 常時（条件を満たさないと失敗） | 事業のシートの行 → **確認シート**（費用と実行後の会社現金）→ 同じ操作。直営3店未満は行を押せない |
| `recruit-franchise` | フランチャイズの欄 | FC本部の設置後 | 事業のシートの行（同じ操作） |
| `store-concept`（3種） | 店舗の欄 | 店舗がある | 店舗のシートの行 → **確認シート** → 同じ操作 |
| `upgrade-store-equipment` | 店舗の欄 | 店舗がある（最大レベル未満） | 店舗のシートの行 → **確認シート** → 同じ操作 |
| `renovate-store` | 店舗の欄 | 改装が必要なとき | 店舗のシートの行 → **確認シート** → 同じ操作 |
| `store-price`、`reset-store-price` | 店舗の欄 | 店舗がある／店舗別価格のとき | 店舗のシートの行（同じ操作。金額は v3 の金額入力シート） |
| `close-store` | 店舗の欄 | 店舗がある | 店舗のシートの行（同じ操作。結果の事前提示は現行の確認ダイアログ） |
| `found-digital-business` | IT・デジタル事業 | 店舗を持たない創業直後 | 「IT・デジタル事業」の行 → シート（同じ操作。名前は現行のダイアログ） |
| `launch-product` | IT・デジタル事業 | 商品開発部門があるとき | 同上 |
| 営業時間（`data-store-hours` の `select`） | 店舗の欄 | 店舗がある | 現行UI（6.5）。残件 |
| メニュー構成（`store-menu-price` `reset-store-menu-price` `remove-store-menu` `add-store-menu`） | 店舗の欄 | ラーメン店がある | 現行UI（6.5）。残件 |
| `respond-recall-crisis`（自主回収・補償） | リコール危機の欄 | リコール危機のとき | 現行UI（6.5）。残件 |
| 市場分析・顧客レビュー・競合分析・プロダクトの詳細・FCの一覧（読み取り中心） | `renderMarketInsightSection()` ほか | 店舗・プロダクトがあるとき | 現行UI（6.5）。残件 |

確認済み（UI3-4、`tests/ui3-business-webkit-test.js`）：設備強化・コンセプト変更・FC本部の設置の実行（確認シートに出た金額のとおり現金が減る）。未確認：改装の実行（改装が必要な状態を作っていない）、enhancer が `business` に差し込む欄の操作（供給・人事・広告の連携など。現行UIの「ほかの詳細」にすべて残るので届かなくなることはないが、一覧は作っていない。UI3-9b の前に洗い出す）。

### `office`（UI3-4）

洗い出し：同上（`--screen=office`）。`data-action` 以外は `renderOffice()` `renderOfficeTab()` を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `workforce-invest`（福利厚生投資） | 「組織」タブ | 常時 | 「操作」の行（同じ操作。金額は v3 の金額入力シート） |
| `toggle-remote`（リモートワーク ON/OFF） | 「組織」タブ | 常時 | 「操作」の行（同じ操作） |
| `cancel-office`（本社契約解除） | 「本社」タブ | 本社があるとき | 「操作」の行（同じ操作。現行の確認ダイアログ） |
| `office-tab`（組織・本社・2Dキャンパス・部門・CXO・重要社員・取締役会とIPO・指示と社内VC） | 8つのタブ | 常時 | 現行UI（6.5）。残件（v3 の画面は本社・社員数・固定費、設置済みの部門、在籍のCXOを読み取りで出す） |
| 部門の設置と採用、CXOの任命、重要社員、取締役会、IPO、指示、社内VC、2Dキャンパスの操作 | 各タブの中 | 本社・部門があるとき | 現行UI（6.5）。残件 |
| `close-branch-office`（支社の解約） | 「本社」タブ | 支社があるとき | 現行UI（6.5）。残件 |

未確認：「本社あり・部門あり」で各タブに出る操作の一覧（タブごとに内容が違い、dump では `office-tab` の切り替えを押していない）。「ほかの詳細」から現行UIに入れば、すべて残る。

### `market`（UI3-5）

洗い出し：UI3-5の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=market --states=founding,store-open,office,listed`。`data-bind`（`ui` の中の表示設定）は現行の描画（`renderMarket()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `data-bind="selectedAccount"`（投資口座：個人／会社） | `renderMarket()` | 常時 | 画面の上の `.u-seg`（個人口座／会社口座）。`buy-stock` `sell-stock` が読む現行UIの設定は、隠した `select` の `change` で合わせる（v3 は状態を書かない） |
| `buy-stock`（株数は現行のダイアログ） | 銘柄の行 | 常時 | 銘柄のシートの「買う」（同じ操作。株数の入力が要るため確認シートは通せず、v3 の金額入力シートが確認（概算の金額と実行後の現金を出す）） |
| `sell-stock`（同上） | 銘柄の行 | 保有があるとき | 銘柄のシートの「売る」（同上。保有が無いと押せない） |
| `favorite-stock` | 銘柄の行 | 常時 | 銘柄のシートの行（同じ操作）。お気に入りは一覧に出る |
| `select-stock`（銘柄の選択・詳細） | 銘柄の行 | 常時 | 銘柄の行 → 銘柄のシート |
| `data-bind="stockSector"`（業種の絞り込み） | `renderMarket()` | 常時 | 「銘柄を探す」のシートの業種チップ |
| `stock-chart-range`（13・26・52週・全期間） | 銘柄の詳細 | 銘柄を選んだとき | 現行UI（6.5）。残件 |
| `stock-split`（2分割）、`stock-mbo`（MBO） | 銘柄の詳細／自社株の欄 | 上場後・条件を満たすとき | 現行UI（6.5）。残件 |
| `founder-share-sale`、`defense`（3種）、`view-earnings`、`set-dividend`、`buyback` | 自社株の欄 | 上場後 | 現行UI（6.5）。残件 |
| 資本配分の操作（`data-capital-allocation-*`） | enhancer（`js/capital-allocation-ui.js` ほか） | 上場後・条件を満たすとき | 現行UI（6.5）。残件 |
| 信用取引の欄（`renderPersonalStockMargin()`） | `renderMarket()` | 条件を満たすとき | 現行UI（6.5）。残件 |

未確認：信用取引の欄の操作（欄が出る状態を作っていない）。実際の IPO を経た上場後の自社株の操作（確認用の旗でだけ見た）。

### 金額・数量の入力（`askMoney` の全29か所、UI3-9a）

`js/app.js` の `askMoney` を呼ぶ29か所を、すべて v3 の金額入力シート（5.7）が受ける。受け付ける値は、円が「0 以上の数値（小数可）」、株・店が「1 以上の整数」。0 や小数が意味を持つのは配当だけで、そのほかはエンジンが 0 を拒否する、または最低額に直す。「エンジンの判定に任せる」と書いた行は、この作業ではエンジンの該当箇所を読んでいない。

| 入力の題（`askMoney` の第1引数） | `action` | 単位 | 0・小数が意味を持つか（`engine` の判定） |
| --- | --- | --- | --- |
| 事業投資 | `business-invest` | 円（会社） | いいえ。`ceilYen` で整数円に切り上げ、0 は「投資額が不正」 |
| 価格変更 | `business-price` | 円 | 0 はいいえ（「価格が不正」）。小数は受け付ける |
| 加盟店募集数 | `recruit-franchise` | 店 | いいえ（画面側で 1 以上の整数に直す） |
| プロダクト追加投資 | `product-action` | 円（会社） | いいえ。切り上げ、0 は資金不足として拒否 |
| 四半期配当設定 | `set-dividend` | 円（1株あたり） | **はい。0（無配）も小数も有効**（`engine.setDividend` は `Math.max(0, 値)`） |
| 自社株買い | `buyback` | 円（会社） | エンジンの判定に任せる（`js/shareholder-returns.js` の経路。この作業では読んでいない） |
| 創業者資本注入 | `contribute-founder-capital` | 円（個人→会社） | いいえ。整数に切り捨て、0 は注入にならない |
| 創業者株主ローン | `founder-shareholder-loan` | 円（個人→会社） | いいえ。整数に切り捨て、0 はローンにならない |
| 福利厚生投資 | `workforce-invest` | 円（会社） | エンジンの判定に任せる（現金不足のみ確認。0 は費用 0） |
| 指示予算 | `add-directive` | 円（会社） | いいえ（0 は費用 0 の指示になるだけ）。切り上げ |
| 施策予算 | `start-campaign` | 円（会社） | いいえ（0 は費用 0 の施策になるだけ）。切り上げ |
| 購入株数 | `buy-stock` | 株 | いいえ（1 以上の整数。切り捨て、1 未満は拒否） |
| 売却株数 | `sell-stock` | 株 | いいえ（同上） |
| 会社VC投資 | `invest-startup-company` | 円（会社） | いいえ。切り上げ、0 以下は拒否 |
| 個人VC投資 | `invest-startup-personal` | 円（個人） | いいえ。同上 |
| 会社フォローオン投資 | `follow-on-startup-company` | 円（会社） | エンジンの判定に任せる（数値であることを確認し、残り枠と現金で判定） |
| 個人フォローオン投資 | `follow-on-startup-personal` | 円（個人） | 同上 |
| 海外事業投資 | `overseas-action` | 円（会社） | いいえ。0 以下は拒否 |
| 投資額（個人の運用商品） | `buy-personal-investment` | 円（個人） | いいえ。商品ごとの最低額（`minAmount`）未満は拒否 |
| 創業者保有株の売却株数 | `founder-share-sale` | 株 | いいえ（1 以上の整数。1 未満は拒否） |
| 投資額（PE案件の組成） | `create-pe` | 円（個人または会社） | いいえ。100万円未満は 100万円に切り上げ |
| エンジェル投資額 | `create-angel` | 円（個人） | いいえ。50万円未満は 50万円に切り上げ |
| ファミリートラストへ移管 | `transfer-to-family-trust` | 円（個人） | エンジェル同様、0 は移管にならない（エンジンの判定に任せる） |
| 店舗価格を変更 | `store-price` | 円 | エンジンの判定に任せる（`js/store-equipment.js`。この作業では読んでいない）。小数は受け付ける |
| メニュー価格を変更 | `store-menu-price` | 円 | 同上 |
| 会社借入 | `borrow-company` | 円（会社） | エンジンの判定に任せる（切り上げ。与信枠で判定） |
| 会社返済 | `repay-company` | 円（会社） | 0 は何も返済しない（債務額で頭打ち） |
| 個人借入 | `borrow-personal` | 円（個人） | 会社借入と同じ |
| 個人返済 | `repay-personal` | 円（個人） | 会社返済と同じ |

名前の入力（`askText`：`found-digital-business` `launch-product` `add-directive` の指示内容 `start-campaign` の施策名 `create-pe` の業界）は対象外で、現行のダイアログのまま（UI3-9b に含める。設計担当の決定 2026-11-11）。

### `venture`（UI3-6）

洗い出し：UI3-6の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=venture --states=founding,store-open,office,listed`（どの状態でも同じ10操作）。投資先を持つ・追加ラウンドが出る・子会社がある状態の操作は、現行の描画（`renderVenture()`）とエンジン（`js/engine.js` `js/expansion.js`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `invest-startup-company` / `invest-startup-personal`（金額は `askMoney`） | 候補・投資先の行 | 運営中で追加ラウンドが無いとき | 投資先のシートの「会社で投資」「個人で投資」（同じ操作。金額は v3 の金額入力シート。財布・上限（その財布の現金）を渡す） |
| `follow-on-startup-company` / `follow-on-startup-personal`（金額は `askMoney`） | 投資先の行（追加ラウンド） | 追加ラウンドが開いていて持分があるとき | 投資先のシートの「追加出資」の行（同じ操作。金額は金額入力シート。上限は残りの額と現金の小さいほう） |
| `conduct-startup-dd` | 候補の行 | DD未実施 | 確認シート（費用＝最低投資額の5%、実行後の個人現金）。同じ操作 |
| `make-subsidiary` | 投資先の行 | 会社持分50%以上 | 確認シート（持分・評価額）。同じ操作 |
| `sell-startup-secondary-confirm` → `sell-startup-secondary`（会社／個人） | 投資先の行 | 持分があるとき | 確認シート（売却額＝`previewStartupSecondarySale`、実行後のその財布の現金、割引）。実行は `sell-startup-secondary`（現行の確認ダイアログは出さない） |
| `ipo-subsidiary`（IPOは準備の段階を踏む：監査・主幹事・審査・公開条件） | 子会社の行 | 常時（準備が完了するまでは失敗する） | 子会社のシートに準備の状況を表示。準備と実行は現行UI（6.5）。残件 |
| 新規事業の分析（`data-new-business-analysis-action`）、資本配分の実行（`data-group-capital-execution-action`）、ベンチャー拡張の欄（`renderVentureExpansion()`） | enhancer | 常時 | 現行UI（6.5）。残件 |

未確認：追加ラウンドが開いている状態の「追加出資」（開く状態を作っていない。操作は現行と同じ `follow-on-startup-*`）。

### `ma`（UI3-6）

洗い出し：UI3-6の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=ma --states=founding,store-open,office,listed`（5操作。投資部門なしの状態）。案件・買収済み企業がある状態の操作は、現行の描画（`renderMA()`）とエンジンを読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `generate-ma`（候補を入れ替える。費用なし） | 上のボタン | 投資部門があるとき | 確認シート（いまの候補は入れ替わる）。同じ操作 |
| `tab` → `pe-portfolio` | 上のボタン | 常時 | PEが解放済みのとき、「そのほか」の行（解放前は下のタブにも出ない） |
| `ma-open-deal` | 候補の行 | 候補があり案件が無いとき | 候補のシートの「案件を開く」（同じ操作。費用なし。実行後にシートを閉じる） |
| `ma-start-dd`、`ma-submit-offer`、`ma-accept-counter`、`ma-financing-*`、`ma-board-approve` / `ma-board-revoke`、`ma-close-deal`、`ma-withdraw-deal`（案件の交渉） | 案件のカード | 案件があるとき | 案件のシート（状態・期限・合意価格を表示）の行から現行UI（6.5）。残件 |
| `start-ma-pmi`、`support-ma-pmi`、`transport-rebuild`（統合の進め方） | 買収済み企業のカード | 買収済みがあるとき | 買収済み企業のシートの行から現行UI（6.5）。残件 |
| `sell-ma`（売却額は評価額の85〜130%の間で決まる） | 買収済み企業のカード | 買収済みがあるとき | 買収済み企業のシートの「売却する」→確認シート（評価額・いまの会社の現金。売却額は乱数で決まるため実行後の現金は出さない）。同じ操作 |
| `data-ma-portfolio-action`（買収ポートフォリオの最優先操作） | enhancer（`js/ma-portfolio-summary-ui.js`） | 常時 | 現行UI（6.5）。残件 |

未確認：案件がある状態の各操作の実行（現行の画面で行う）、買収済み企業の売却の実行（買収済みの状態を作っていない）。

### `assets`（UI3-6）

洗い出し：UI3-6の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=assets --states=founding,store-open,office,listed`（7操作）。物件を持つ状態と他のタブの操作は、現行の描画（`renderAssets()` `renderAssetTab()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `asset-tab`（不動産・投信・債券・高級資産・スポーツ） | `renderAssets()` | 常時 | 不動産は画面本体。ほかのタブは現行UI（6.5）。残件 |
| `sell-property`（売却額は評価額の97%） | 物件の行 | 物件を持つとき | 物件のシートの「売却する」→確認シート（売却額、実行後のその財布の現金）。同じ操作 |
| `buy-property-company` / `buy-property-personal`、`negotiate-property-*` | マップの物件のシート | 常時 | 既存の入口（マップ。UI3-3）。この画面には「物件を買う（マップ）」の行 |
| `build-property`（建物の種類は名前入力 `askText`） | 物件の行 | 会社の土地 | 現行UI（6.5）。残件（`askText` は UI3-9b） |
| `buy-personal-investment` / `sell-personal-investment`、`buy-luxury` / `sell-luxury`、`buy-team-*` ほか（他のタブの操作） | `renderAssetTab()` | 各タブ | 現行UI（6.5）。残件 |
| `founder-wealth-capture`（内訳を算定） | `renderFounderWealthBreakdown()` | 常時 | 現行UI（6.5）。残件 |

未確認：売却時の譲渡益の税（確認シートの売却額は概算。実行後の通知で確認）。他のタブの操作の実行。

### `pe-portfolio`（UI3-6）

洗い出し：UI3-6の担当エージェント、2026-11-11。画面は PE が解放されるまで下のタブに出ず、`data-action="tab"` では開けないため、洗い出しスクリプトは「未確認」を返す。現行の描画（`renderPePortfolio()`、`renderPeFundFormation()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `data-pe-portfolio-price` ほかの6つのレバー（価格・品質・拠点・仕入れ・人員・商品構成）、`exit-pe`、`pe-initiative`、`transfer-pe` | 投資先のカード | 買収済みの企業があるとき | README の指定どおり「既存の操作をそのまま」。投資先のシート（読み取り）から現行UI（6.5）。残件 |
| ファンドの組成（`data-pe-gp-commit` ほか） | `renderPeFundFormation()` | 常時 | 現行UI（6.5）。残件 |

未確認：実際のPEファンドを経た投資先の表示（確認用に作った状態でだけ見た）。
