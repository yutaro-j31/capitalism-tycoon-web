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

v1.0（UI3-11）の時点で残してよいものは、`README.md` 10.1 で決めている。`home` × 資金繰り危機は UI3-9b-1 で解消する。それ以外の「ほかの詳細」の行と、`map` × 3D不可、`business` × リコール危機は、v1.0では残し、リリース後に順に移す。

| 画面 | 状態 | 現行UIで出る操作 | 仕組み |
| --- | --- | --- | --- |
| `map` | 3Dの地図が使えない（WebGL・アセット・コンテキストの失敗） | 現行のCanvas2D地図とその操作一式（`city-retry`、一覧の `details`、現行のマーカーと詳細パネル） | 画面の登録の `useCurrentUI`（失敗を検知したら、その後は現行UI） |
| `business` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="business"`）を押したとき（次の `tab` 操作まで） | 営業時間（`data-store-hours`）、メニュー構成（`store-menu-price` `reset-store-menu-price` `remove-store-menu` `add-store-menu`）、市場分析・顧客レビュー・競合分析・プロダクトの詳細・フランチャイズの一覧と、enhancer が差し込む欄（供給・人事・広告など） | 枠の `openCurrentUI` |
| `business` | リコール危機が未対応（`activeRecallCrisis` が有効で `responded` が偽） | `respond-recall-crisis`（自主回収・補償）と、リコール危機の欄（`renderRecallCrisisSection()`） | 枠の規則 `CURRENT_UI_RULES.business` |
| `office` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="office"`）を押したとき（次の `tab` 操作まで） | 組織・2Dキャンパス・部門の設置と採用・CXO・重要社員・取締役会とIPO・指示と社内VC（`office-tab` の8タブの中の操作すべて）、支社の契約解除（`close-branch-office`）。仕様は設計担当が UI3-9b に含めて書く | 枠の `openCurrentUI` |
| `market` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="market"`）を押したとき（次の `tab` 操作まで） | 自社株の操作（`stock-split` `stock-mbo` `founder-share-sale` `defense` `view-earnings`）、チャート（`stock-chart-range`）、信用取引の欄、資本配分の操作（`data-capital-allocation-*`）、業種の絞り込みと銘柄の詳細（`select-stock`） | 枠の `openCurrentUI` |
| `report` | 利用者が「ほかの詳細（現行の画面）」（`data-ui3-current="report"`）を押したとき（次の `tab` 操作まで） | チャート（`#report-chart`）と表示する指標の選択（`data-bind="reportMetric"`）、会計用語メモ、13週の資金繰り予測（`bank` のシートでも読める） | 枠の `openCurrentUI` |
| `venture` | 子会社のIPO、新規事業の分析、資本配分の実行、ベンチャー拡張の欄 | 子会社IPO（`ipo-subsidiary` と準備の各段階）、`data-new-business-analysis-action`、`data-group-capital-execution-action`、`renderVentureExpansion()` | 画面の行 `data-ui3-current="venture"`（利用者が押したとき。次の `tab` 操作まで） |
| `ma` | 案件の交渉、統合の進め方、買収ポートフォリオの最優先操作 | `ma-start-dd` `ma-submit-offer` `ma-accept-counter` `ma-financing-*` `ma-board-*` `ma-close-deal` `ma-withdraw-deal`、`start-ma-pmi` `support-ma-pmi` `transport-rebuild`、`data-ma-portfolio-action` | 画面・案件のシートの行 `data-ui3-current="ma"` |
| `assets` | 土地の建設、投信・債券・高級資産・スポーツ、個人資産の内訳 | `build-property`（名前入力）、`asset-tab` の3タブの購入・売却、`founder-wealth-capture` | 画面の行 `data-ui3-current="assets"` |
| `pe-portfolio` | 6つのレバー・Exit・ファンドの組成 | `data-pe-portfolio-price` ほか、`exit-pe`、`pe-initiative`、`transfer-pe`、ファンドの組成 | 画面・シートの行 `data-ui3-current="pe-portfolio"` |
| `strategy` | 店舗ごとの仕入先・自動発注・安全在庫・緊急発注、在庫の表 | `supply-select-supplier` `supply-policy` `supply-safety` `supply-emergency` ほか（`renderSupplyTab()`） | 画面の行 `data-ui3-current="strategy"` |
| `overseas` | 本社への送金・ローカライズ・ブランド投資 | `overseas-repatriate`（25%・50%・全額）、`overseas-action` の各操作（`renderOverseas()` の海外子会社の欄） | 画面の行 `data-ui3-current="overseas"` |
| `founder` | 個人不動産・PE・エンジェル投資・行動履歴 | `establish-personal-re-corp` `buy-personal-re` と個人不動産の賃貸方式・再開発（`switch-rental-mode` `start-personal-re-redevelopment` ほか）、`create-pe`（個人・会社）、`create-angel`、行動履歴 | 画面の行 `data-ui3-current="founder"` |
| `legacy` | 信託への移管、新会社の創業、エンディング・殿堂記録・歴代会社 | `transfer-trust`（金額入力）、`new-company`（フォーム）、記録の表示 | 画面の行 `data-ui3-current="legacy"` |
| `settings` | 診断・再起動・不具合報告・保存領域・動作確認のツール、保存待ちセーブの復元 | `data-release-diagnostics-action` `data-playtest-report-action` `data-save-storage-action` `data-physical-action` `data-probe-action`、`restore-stored-save` `dismiss-stored-save` | 画面の行 `data-ui3-current="settings"` |

## その他の残件

| 内容 | 扱い |
| --- | --- |
| ホームの「今週やること」と週間レポートの「次の一手」の選定ロジックが重複している | 共通化は v1.0 では行わない（設計担当の決定 2026-11-11）。 |
| 金額・数量の入力ダイアログ（`askMoney`、iPhone用の入力ダイアログ） | **UI3-9a で v3 の金額入力シートにした**（`modules.ui3.amountSheet`。`?ui=3` では現行のダイアログは出ない）。残件なし。名前の入力（`askText`）は現行のダイアログのまま（UI3-9b に含める）。 |

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
| `buy-property-company` `buy-property-personal`（各6個） | 一覧／ピンの詳細パネル | 売出物件があるとき | ピン／一覧 → 不動産のシート `会社で購入` `個人で購入` → **確認シート**（購入価格・実行後の現金。UI3-10b。実行は同じ操作） |
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
| `office-tab`（組織・本社・2Dキャンパス・部門・CXO・重要社員・取締役会とIPO・指示と社内VC） | 8つのタブ | 常時 | 現行UI（6.5）。残件（v3 の画面は本社・社員数・固定費、全部門の一覧、在籍のCXOを出す。部門の設置・採用・閉鎖は UI3-9b-3 で v3 へ） |
| `establish-department`（部門の設置） | 「部門」タブ | 常時（本社・店舗数・現金・定員の条件はエンジンが拒否） | 部門の行→シート→確認シート（UI3-9b-3。同じ操作。条件を満たさないときは押せず理由を出す） |
| `hire-staff`（1名採用） | 「部門」タブ | 設置済みの部門 | 部門のシート→確認シート（同じ操作。採用費30万円） |
| `close-department`（閉鎖） | 「部門」タブ | 設置済みの部門 | 部門のシート→確認シート。確認シートの実行は新しい操作 `close-department-confirmed`（`js/app.js` に1行。`engine.closeDepartment(id)` を呼ぶ。現行の確認ダイアログが二重に出ないようにするため） |
| CXOの任命、重要社員、取締役会、IPO、指示、社内VC、2Dキャンパスの操作 | 各タブの中 | 本社・部門があるとき | 現行UI（6.5）。残件 |
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
| `founder-share-sale`、`defense`（3種）、`view-earnings` | 自社株の欄 | 上場後 | 現行UI（6.5）。残件 |
| `set-dividend`、`buyback`（現行の「株主還元・資本配分」の欄） | `js/shareholder-returns.js` | 上場後 | **v3 の「株主還元」**（UI3-9b-2）：「配当を設定」「自社株買い」の行（同じ操作、金額は金額入力シート）。数字6つは現行の欄と同じ読み取り。自社株買いは、安全還元可能額が1株の価格に足りないとき押せず、理由を出す（現行と同じ条件） |
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
| 自社株買い | `buyback` | 円（会社） | エンジンの判定に任せる。UI3-9b-2 で `js/shareholder-returns.js` を読んだ：上限は安全還元可能額、買えるのは1株ずつ（`floor(金額/株価)` 株、費用は `ceilYen(株数×株価)`）。シートの見込みに買い戻す株数と実行後の会社現金（概算）を出す |
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

名前の入力（`askText`）は UI3-9b-4 で v3 の入力シート（`modules.ui3.textSheet`）にした（下の表）。旧記述：現行のダイアログのまま（UI3-9b に含める。設計担当の決定 2026-11-11）。

### `bank`（UI3-7）

洗い出し：UI3-7の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=bank --states=founding,store-open,listed`（創業直後・1号店の開店後・上場後）。`renderBank()` を読んで足した（資金繰り予測は読み取り専用）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `borrow-company`（会社借入） | `renderBank()` | 常時 | 「操作」の行（同じ操作。UI3-9a の金額入力シートが確認：借入後の残高・残りの借入余力を出す。借入余力が無いと押せない） |
| `repay-company`（会社返済） | 同上 | 常時 | 「操作」の行（同じ操作。返済後の残高・実行後の会社の現金を出す。借入か現金が無いと押せない） |
| `borrow-personal`、`repay-personal` | 同上 | 常時 | 口座を「個人」にして同じ行（同じ操作） |
| 信用スコア・金利・借入限度額（表示のみ） | 同上 | 常時 | カード（借入余力）と「条件」の行 |
| 13週の資金繰り予測（`renderCashflowForecast()`、表示のみ） | 同上 | 常時 | 「13週の資金繰り予測」のシート（読み取り専用） |
| 借入金の一覧（`g.finance.loans`、表示のみ。現行では決算画面） | `renderReport()` | 借入があるとき | 「借入金の一覧」のシート（読み取り専用） |

UI3-9a で `?ui=3` のときは iPhone 用の入力ダイアログ（利用可能枠・返済後残高の行）を止めたが、v3 の `bank` は同じ情報を金額入力シートの `preview` で出す（残件は無くなった）。未移植の現行UIの銀行画面から借入・返済を押した場合は、見込みの行の無い金額入力シートになる（`?ui=3` の間。`bank` は v3 になったので、通常は起きない）。

### `report`（UI3-7）

洗い出し：同上（`--screen=report`）。`renderReport()` を読んで足した。操作（`data-action`）は `tab` `advance-week` だけで、期間と指標の選択は `data-bind`（`ui` の中の表示設定）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `data-bind="financePeriod"`（今週・13週・四半期・年度・52週） | `renderReport()` | 常時 | 画面の上の期間チップ（画面の表示状態。`modules.finance.buildStatements` に直接渡す） |
| `data-bind="reportMetric"`（チャートの指標）と `#report-chart` | 同上 | 常時 | 現行UI（6.5）。残件 |
| 財務サマリー・損益計算書・貸借対照表・キャッシュフロー計算書・財務指標・運転資本・配当可能額・週次履歴（表示のみ） | 同上 | 1週進めたあと | 「決算の内訳」の行 → 読み取り専用のシート |
| 会計用語メモ・13週の資金繰り予測（表示のみ） | 同上 | 常時 | 現行UI（6.5。資金繰り予測は `bank` のシートでも読める） |

決算の値は、現行の画面と同じ `buildStatements` の呼び出し（描画のたびに呼ぶ。集計用の項目が整うことがある）。

未確認：上場後（確認用の旗）の決算の項目の違い。

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
| `buy-property-company` / `buy-property-personal`、`negotiate-property-*` | マップの物件のシート | 常時 | 既存の入口（マップ。UI3-3）。購入は確認シートを通る（UI3-10b）。この画面には「物件を買う（マップ）」の行 |
| `build-property`（建物の種類は名前入力 `askText`） | 物件の行 | 会社の土地 | 現行UI（6.5）。残件（名前入力は UI3-9b-4 で v3 のシートになる） |
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

### `strategy`（UI3-9）

洗い出し：UI3-9の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=strategy --states=founding,store-open,office,listed`（創業直後6操作、1号店の開店後は店舗ごとの仕入先・方針などが加わる）。R&D・顧客のタブは現行の描画（`renderStrategyTab()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `strategy-tab`（サプライチェーン・R&D・顧客） | `renderStrategy()` | 常時 | 画面の上の `.u-seg`（表示状態。v3 は状態を書かない） |
| `vertical-integration`（費用は項目ごと） | 垂直統合の欄 | 未導入の項目 | 項目の行→確認シート（費用・実行後の会社現金）。同じ操作 |
| `start-rd`（費用は項目ごと。商品開発部門かDX部門が必要） | 研究テーマの欄 | 未着手の項目 | 項目の行→確認シート。部門が無いときは押せず、理由を出す（現行は押せるがエンジンが拒否する）。同じ操作 |
| `license-patent` | 特許の欄 | 特許があるとき | 「特許」の行（同じ操作。提供中／停止中を行に出す） |
| `supply-select-supplier`、`supply-policy`、`supply-safety`、`supply-emergency`（店舗ごと） | サプライチェーンの欄 | 営業中の店舗があるとき | 現行UI（6.5）。残件 |
| 顧客セグメント・市場シェアの表示 | 顧客のタブ | 常時 | 「顧客・市場シェア」の表示（読むだけ） |

未確認：特許のライセンス切り替えの実行（特許を持つ状態を作っていない。操作は現行と同じ `license-patent`）、店舗ごとの仕入れの操作（現行UIで行う）。

### `overseas`（UI3-9）

洗い出し：UI3-9の担当エージェント、2026-11-11。`node scripts/ui3-dump-screen-actions.js --screen=overseas --states=founding,store-open,office,listed`（3操作）。海外子会社の操作は現行の描画（`renderOverseas()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `open-overseas`（設立費用＝国の費用＋店舗費の2倍。本社とCEOが必要） | 進出先の欄 | 常時 | 進出先の行→シート（事業のチップ）→確認シート（設立費用・実行後の会社現金）。本社とCEOが無いときは押せず、理由を出す。現行の `select` は隠して置き、実行の直前に値を合わせる（同じ操作） |
| `overseas-repatriate`（25%・50%・全額）、ローカライズ・ブランド投資 | 海外子会社の欄 | 海外子会社があるとき | 現行UI（6.5）。残件。海外子会社の一覧は読み取り |

未確認：海外子会社がある状態の送金・投資（現行UIで行う）。

### `media`（UI3-9）

洗い出し：UI3-9の担当エージェント、2026-11-11。`node scripts/ui3-dump-screen-actions.js --screen=media --states=founding,store-open,office,listed`（3操作）。フォーラム・オークションは現行の描画（`renderMedia()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `media-action`（費用は施策ごと、会社の現金） | 広報・SNSの欄 | 常時 | 施策の行→確認シート（費用・実行後の会社現金）。同じ操作 |
| `venture-forum`（参加費、個人の現金） | ベンチャーフォーラムの欄 | 案内があるとき | 行→確認シート。同じ操作 |
| `auction-bid`（落札価格＝現在価格×1.08、個人の現金） | 高級品オークションの欄 | 開催中の出品があるとき | 行→確認シート（価格はエンジンの式の写し。検査が一致を確かめる）。同じ操作 |
| 週刊新聞・大型ビジネスニュース・広報履歴の表示 | 各欄 | 常時 | 読み取りの一覧 |

### `rivals`（UI3-9）

洗い出し：UI3-9の担当エージェント、2026-11-11。`node scripts/ui3-dump-screen-actions.js --screen=rivals --states=founding,store-open,office,listed`（5操作）。競合の新製品への対抗は現行の描画（`renderCompetitorProducts()`）を読んで足した。README 5.5 は「読むだけ」だが、現行の画面にある操作は台帳の規則（届かなくなる操作を0にする）に従って載せた。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `respond-rival`（広告防衛200万円・品質防衛250万円・買収） | 競合反撃システムの欄 | 競合があるとき | 競合の行→シート→確認シート（費用・実行後の会社現金）。同じ週に同じ対策は押せず（エンジンが拒否）、買収は経営が苦しい競合だけ。買収の価格はエンジンの式の写し |
| `counter-competitor-product`（費用は対抗手段ごと） | 競合の新製品の欄 | 競合の新製品があるとき | 新製品の行→シート→確認シート（エンジンの対抗手段の一覧の費用）。現金が足りないときは押せない（現行と同じ） |

未確認：競合の買収の実行（経営が苦しい競合を作れていない。価格の表示と式の一致までを検査）、新製品への対抗の実行（新製品が出る状態を作っていない）。

### `missions`（UI3-9）

洗い出し：UI3-9の担当エージェント、2026-11-11。`node scripts/ui3-dump-screen-actions.js --screen=missions --states=founding,store-open,office,listed`（操作は枠のものだけ）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| ミッション・実績・長期目標の表示 | `renderMissions()` | 常時 | 読み取りの一覧（ミッション・長期目標6つ・業界ランキング・受賞歴・実績） |

### `news`（UI3-9）

洗い出し：UI3-9の担当エージェント、2026-11-11。操作は枠のものだけ。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| ニュース履歴・週次経営履歴の表示 | `renderNews()` | 常時 | 読み取りの一覧（それぞれ新しい30件） |

### `founder`（UI3-8）

洗い出し：UI3-8の担当エージェント、2026-11-11、Chromium・390×664。`node scripts/ui3-dump-screen-actions.js --screen=founder --states=founding,store-open,listed`（どの状態でも同じ16操作）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `founder-action`（店舗探索・地元イベント・学習3種・人脈） | `renderFounder()` | 常時 | 「自宅での行動」の行（同じ操作。費用なし） |
| `upgrade-home`（費用はランクごとの表） | `renderFounder()` | 自宅が最高ランクでないとき | 「自分への投資」の行→確認シート（費用・実行後の個人現金。費用表はエンジンの写しで、検査が一致を確かめる）。同じ操作 |
| `founder-invest`（後継者育成70万円、財団500万円） | 自己投資の欄 | 常時 | 「自分への投資」の行→確認シート。同じ操作 |
| 地元で見つけた候補の `tab` → `map` | 候補の欄 | 店舗探索の後 | 「地元で見つけた候補」の行（同じ操作） |
| `establish-personal-re-corp`、`buy-personal-re`、賃貸方式・再開発、`create-pe`、`create-angel`、行動履歴 | `renderPersonalAlternativeAssets()` ほか | 常時・条件を満たすとき | 現行UI（6.5）。残件 |

未確認：個人不動産・PE・エンジェル投資の操作（現行UIで行う）。

### `legacy`（UI3-8）

洗い出し：UI3-8の担当エージェント、2026-11-11。`node scripts/ui3-dump-screen-actions.js --screen=legacy --states=founding,store-open,listed`（6操作。創業直後は後継者が未指名）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `retire-founder`（現行は確認ダイアログ → `confirm-retire-founder`） | `renderRetirement()` | 常時（条件未達は押せない） | 「引退して承継する」の行→確認シート（見込み評価・現世代スコア）。実行は `confirm-retire-founder` |
| `appoint-successor`（費用は候補ごと） | 後継者の欄 | 後継者が未指名 | 候補の行→確認シート（費用・実行後の個人現金）。同じ操作 |
| `train-successor`（150万円） | 後継者の欄 | 後継者がいるとき | 「育成プログラム」の行→確認シート。同じ操作 |
| `execute-succession` | 後継者の欄 | 準備度70以上 | 「経営承継を実行」の行（同じ操作。準備度70未満は押せない） |
| `establish-trust`（1,000万円） | ファミリートラストの欄 | 未設立 | 「ファミリートラストを設立」の行→確認シート。同じ操作 |
| `download-result-card` | エンディングの欄 | 常時 | 「結果カードを保存」の行（同じ操作） |
| `transfer-trust`（金額）、`new-company`（会社名・出資額・開始方針のフォーム）、エンディング・殿堂記録・歴代会社の表示 | 各欄 | 設立済み・会社売却後 | 現行UI（6.5）。残件 |

未確認：引退・承継の実行（条件を満たす状態を作っていない。操作は現行と同じ `confirm-retire-founder` `execute-succession`）。

### `settings`（UI3-8）

洗い出し：UI3-8の担当エージェント、2026-11-11。`node scripts/ui3-dump-screen-actions.js --screen=settings --states=founding,store-open,listed`（23操作）。`data-setting` の3つのコントロールは、現行の描画（`renderSettings()`）を読んで足した。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `tab` → `map`、`advance-week` | enhancer | 常時 | 下のタブ、枠の「進める」ボタン |
| `data-setting`（自動経営・自動経営方針・動きを減らす） | `renderSettings()` | 常時 | `.u-seg`（隠した現行のコントロールを `change` で動かす。書き込みは現行のハンドラ） |
| `save-now`、`export-save`、`import-save`（`#import-file`） | セーブ管理 | 常時 | 「セーブ」の行（同じ操作。`#import-file` は画面に置く） |
| `save-slot`、`load-slot`（スロット1〜3） | セーブ管理 | 常時 | 「セーブスロット」の行→シート→確認シート（保存は上書き、読み込みは置き換え）。保存は `js/save-storage-ui.js` が先にクリックを取るため、確認シートを閉じてから、隠した現行の `save-slot` ボタンを押す（同じ経路） |
| `reset-game` → `confirm-reset` | セーブ管理 | 常時 | 「最初からやり直す」の行→確認シート。実行は `confirm-reset`（創業画面に戻る） |
| `company-buyout` → `confirm-buyout` | 設定 | 常時 | 「会社売却を検討」の行（企業価値2億円未満・売却済みは押せず、理由を出す）→確認シート（売却額（概算）＝企業価値×1.2、創業者の受取（概算））。実行は `confirm-buyout` |
| 診断・再起動・不具合報告・保存領域・動作確認のツール（`data-release-diagnostics-action` ほか） | enhancer | 常時 | 現行UI（6.5）。残件 |

未確認：会社売却の実行（確認シートまで）、JSONの書き出し・読み込みの実行（ファイルを扱うため。操作は現行と同じ `export-save` `import-save`）。

### 創業画面・ゲームオーバー（UI3-8b）

洗い出し：UI3-8bの担当エージェント、2026-11-11、Chromium・390×664。現行の創業画面（`renderSetup()`）は、フォーム（`#setup-form`）と、ページの起動スクリプト（`index.html` の `data-setup-recovery-bootstrap`）が `</form>` の後ろに足す復旧の欄からなる。ゲームオーバーは `renderGameOver()` の覆い（`.game-over`）で、操作は「設定を開く」だけ。覆いの「設定を開く」は、確認用に `g.gameOver` を立てただけの状態では設定の画面に移るが、実際に倒産した状態（`gameOver` が立ったまま）では同じ画面に戻るだけだった（設計担当が実際に押して確認）。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| フォームの6つの入力（`playerName` `companyName` `difficulty` `founderPrefID` `founderTraitID` `scenario`）と、`創業する`（送信） | `renderSetup()` | 創業前・やり直した直後 | 創業画面（同じ `id="setup-form"`、同じ `name` と選択肢、同じ送信の経路で `engine.configure` が呼ばれる）。「創業する」を下端に固定 |
| `import-save`（JSONセーブを読み込む）と隠した `#import-file` | 起動スクリプトが足す復旧の欄 | 創業前 | 創業画面の「JSONセーブを読み込む」の行（同じ操作、同じ `#import-file`）。起動スクリプトが二重に足さないよう、同じ印（`data-setup-recovery`）を付けて描く |
| 覆いの「設定を開く」（`tab` → `settings`）と、そこから届いた操作 | `renderGameOver()` | 倒産後 | 「設定を開く」の行は**置かない**（ゲームオーバーの間はどのタブでもこの画面が出るので、押しても同じ画面に戻るだけ。設計担当が実際に押して確認）。倒産後に意味のある操作は、すべて同じ画面にある：最初からやり直す（確認シート、`confirm-reset`）、スロット1〜3の読み込み（確認シート、`load-slot`）、JSON書き出し（`export-save`）、JSON読み込み（`import-save` と `#import-file`）、結果カードの保存（`download-result-card`）。診断・再起動・不具合報告・保存領域・動作確認のツールは、v1.0 では倒産後に届かなくてよい（README 10.1） |

未確認：JSONの読み込みの実行（ファイルを扱うため。操作は現行と同じ `import-save`）、倒産に至る実際の遊び（確認用に `g.gameOver` を立てて確かめた）。

### 資金繰り危機の対応（UI3-9b-1）

洗い出し：UI3-9b-1の担当エージェント、2026-11-12。現行の `js/player-crisis-ui.js`（`handleClick`）と `js/player-turnaround-plan-ui.js` を読んで、操作と押せる条件を写した。エンジンの関数を直接呼ぶ（`js/app.js` の `action()` を通らない）ため、`node scripts/ui3-dump-screen-actions.js` では `data-action` に現れない。状態は、検査の準備で本物の危機（`playerCrisis.evaluate`）を作って確かめた。

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `data-player-crisis-action="founder-capital"`（`injectFounderCapital`） | 危機パネル | 資金繰りが「安定」以外 | 危機対応シートの「創業者資金を注入」→金額入力シート（既定の金額は現行と同じ式、上限は個人資金、見込みは注入後の会社現金・個人現金）。押せる条件は現行と同じ |
| `emergency-bridge`（`requestEmergencyBridgeLoan`） | 同上 | 同上 | 「緊急融資を申請」→確認シート（予定額・利用可能枠）。押せないとき（枠なし・再申請まで）は理由を出す |
| `sponsor-injection`（`requestSponsorInjection`、現行は `window.confirm`） | 同上 | 同上 | 「スポンサー出資を申請」→確認シート（出資額・持分・希薄化の注意） |
| `turnaround-fund`（`acceptTurnaroundFund`、現行は `window.confirm`） | 同上 | 受け入れ可能なとき | 「（ファンド名）の出資を受け入れる」→確認シート（出資額・譲渡持分・期限・未達のときの追加の持分）。受け入れ済みは説明を出す |
| `dispose-asset`（`executeCrisisDisposition`、現行は `window.confirm`） | 事業整理候補 | 候補があるとき（3件まで） | 行→確認シート（想定回収額） |
| `reduce-cost`（`executeCrisisCostReduction`、現行は `window.confirm`） | 固定費削減候補 | 候補があるとき（3件まで） | 行→確認シート（週次の削減額・一時費用・実行後の現金・注意書き） |
| `data-player-turnaround-action="start"`（`startTurnaroundPlan`）と `cancel`（`cancelTurnaroundPlan`） | 再建計画 | 危機の間・計画の進行中 | 行→確認シート（現金目標・負債目標は現行と同じ見積もり）。開始できないときは理由を出す。進行中は現金・負債の目標と中止の行 |
| 直近の危機対応の履歴（3件） | 危機パネル | 履歴があるとき | シートの読み取りの一覧 |
| 危機パネルの表示（会社現金・不足額・猶予期間・回復確認） | 危機パネル | 同上 | シートの数字4つ（現行と同じ読み取り） |

入口：枠の札（どの画面からでも。ホームにも出る）だけ。ホームの「今週やること」には足さない（入口が2つ続けて出るため）。シートを登録すると `CURRENT_UI_RULES.home` は効かなくなり、危機の間もホームは v3 のまま。
未確認：スポンサー出資・事業再生ファンド・事業整理・固定費削減の実行（確認シートの見積もりがエンジンと一致することまで。創業者資金の注入・緊急融資・再建計画の開始は実行して現金・負債の動きを確かめた）。

### 名前の入力（`askText`、UI3-9b-4）

`js/app.js` の `askText` の先頭に1行だけ足し、`?ui=3` では `modules.ui3.textSheet` が受ける。現行のダイアログは `?ui=3` なしで変わらない。現行の `askText` は空も長い文字も受け付けるので、v3 の既定も同じ（呼び出し元ごとの規則は引数 `allowEmpty` `maxLength` で渡せる。7か所とも現行どおり既定）。

| 呼び出し（`data-action`） | 見出し／ラベル／初期値 | 続き | v3での行き先 |
| --- | --- | --- | --- |
| `open-store`（見積もりが取れないときの新店舗） | 新店舗／店舗名／「会社名 N号店」 | `engine.openStore` | 入力シート（同じ呼び出し） |
| `build-property` | 土地開発／建物種別／本社ビル | `engine.buildOnLand` | 入力シート |
| `found-digital-business` | IT・デジタル事業を創業／プロダクト名／ひな形の名前 | `engine.foundDigitalBusiness` | 入力シート |
| `launch-product` | プロダクト開発／プロダクト名／ひな形の名前 | `engine.launchProduct` | 入力シート |
| `add-directive` | CXO指示／指示内容／成長投資 | 指示予算の金額入力シート → `engine.addDirective` | 入力シート |
| `start-campaign` | 部門施策／施策名／重点改善キャンペーン | 施策予算の金額入力シート → `engine.startCampaign` | 入力シート |
| `create-pe` | PE案件組成／業界／テック | 投資額の金額入力シート → `engine.createPEDeal` | 入力シート |

### UI3-10b の追加（全ボタンの検査で見つけたもの）

| 現行の操作 | 出どころ | 出る状態 | v3での行き先 |
| --- | --- | --- | --- |
| `sell-property`（マップの物件のシートの「この物件を売却」） | マップの物件のシート | 保有物件 | 確認シート（売却額＝評価額の97%、実行後の現金）→ 同じ操作。以前は確認なしで売却されていた |
| `founder-action`（自宅での行動6つ）の結果の表示 | 創業者の画面 | 常時 | 直近3件の「行動履歴」を読み取りで表示（以前は、地元イベントを押しても画面に何も出なかった） |

### 「今週やること」の行き先（秘書タスクと創業ガイド、UI3-10c）

ホームの行（`data-ui3-dest`）の行き先を決め直した表。「対処の操作」は、検査（`tests/ui3-destinations-webkit-test.js`）が、行を押した先で**見えて・押せて・指で届く**ことを確かめるもの。仕組みは README 10.10。

| タスク ID | 現行の行き先 | v3 の行き先（画面／シート） | そこで押せる対処の操作 |
| --- | --- | --- | --- |
| `finance_cash_negative` | bank | **危機対応シート**（危機の宣言前は資金調達の画面） | 創業者資金の注入・緊急融資など（宣言前：資金調達の読み取り。借入余力が0なので「借りる」は押せない） |
| `finance_cash_runway` | bank | 資金調達（v3） | 「借りる」（`data-ui3-bank-amount="borrow"`） |
| `finance_loss_runway` | report | 決算（v3） | 情報のみ（決算の要約）。対処は資金調達・事業の画面 |
| `finance_debt_due` | bank | 資金調達（v3） | 「返す」（`data-ui3-bank-amount="repay"`） |
| `finance_high_interest` | bank | 資金調達（v3） | 「返す」 |
| `finance_debt_heavy` | bank | 資金調達（v3） | 「返す」 |
| `supply_stockout` | business | 事業（v3）→ **その店舗のシート**→「在庫と仕入れ」へスクロール | 自動発注の方針・安全在庫・緊急仕入れ・仕入先を変える |
| `supply_overstock` | business | 同上 | 同上 |
| `store_loss` | business | 事業（v3）→ **赤字の店舗のシート** | 店舗価格を変更（`store-price`）ほか |
| `workforce_fatigue` | office | 本社（v3） | 福利厚生投資（`workforce-invest`）・リモートワーク（`toggle-remote`） |
| `workforce_retention` | office | **現行の本社を直接開く**（重要社員タブ） | 重要社員の育成（`train-keyperson`）。focus は現行と同じ |
| `growth_product_ready` | business | **現行の事業を直接開く** | 現行の事業画面のプロダクト欄（v3 にプロダクトの投入・改善は無い）。focus は現行と同じ |
| `growth_competitor_alert` | rivals | 競合（v3） | 競合の行 → 広告防衛・品質防衛・買収 |
| `growth_ipo_ready` | office | **現行の本社を直接開く**（取締役会・IPOタブ） | IPO実行（`execute-ipo`）。focus は現行と同じ |
| `growth_expansion_capacity` | map | マップ（v3） | ピン → 出店する |
| `crisis_active` | strategy | **危機対応シート**（宣言前は資金調達の画面） | 同 `finance_cash_negative` |
| `ma_dd_completed_*` `ma_counter_*` `ma_competing_bid_*` `ma_financing_*` `ma_financing_invalid_*` `ma_accepted_*` `ma_board_*` `ma_deadline_*` | ma | **現行のM&A画面を直接開く**（案件の部屋が画面に出る） | 案件の操作（DD・オファー・資金調達・取締役会・クロージング）。v3 の M&A 画面にあるのは候補と案件の読み取りだけ |
| `ma_pmi_planning_*` `ma_pmi_stalled_*` | ma | **現行のM&A画面を直接開く**（子会社の欄） | 統合の進め方（PMI方針）。focus は現行と同じ |

| 創業ガイドの手順 | 現行の行き先 | v3 の行き先 | 対処の操作 |
| --- | --- | --- | --- |
| `dashboard`（会社の現在地） | home | ホーム（v3） | 情報のみ（今週の成績）。押すと確認済みになる（`js/app.js` の処理のまま） |
| `first_store`（最初の店舗） | map | マップ（v3） | ピン → 出店する |
| `unit_economics`（価格・商品・供給） | strategy（サプライチェーン） | 事業（v3）→ **最初の店舗のシート**→「在庫と仕入れ」へスクロール | 在庫と仕入れの操作（`supply_stockout` と同じ） |
| `first_week`（最初の週を進める） | home | ホーム（v3） | 「進める」（画面下の `.u-advance`） |
| `weekly_recap`（週間インパクト） | home | ホーム（v3） | 情報のみ（今週の成績） |
| `first_improvement`（最初の改善） | business | 事業（v3）→ **事業のシート** | 投資（`business-invest`）・価格（`business-price`） |
| `cash_runway`（黒字と現金余力） | report | 決算（v3） | 情報のみ（決算の要約） |
| `growth_step`（2店舗目） | map | マップ（v3） | ピン → 出店する |
| `organization`（組織経営） | office | 本社（v3） | 部門の行 → 設置する |
| `graduation`（完了） | missions | 進行・目標（v3） | 情報のみ（長期目標・進行中のミッション） |

- 秘書タスクの ID は26種（財務6・供給2・赤字店1・組織2・成長4・危機1・M&A 10）。設計担当の「15種」は、このうち成長の出店余力とM&A 10種を除いた数と思われる。創業ガイドは10手順。
- 「対処の操作が v3 に無い」ものを現行の画面で開く行き先は、残件（10.1「残してよいもの」の『ほかの詳細』と同じ扱い）。戻るボタン（UI3-9b-5）で v3 に戻れる。
- 検査で確かめられていないもの：M&A の `ma_accepted_*` は、承認の連鎖（条件・上場・DD）を作らず、承認の検証を「有効」に差し替えて行を出した。`growth_product_ready` の行き先は、現行の画面が開くことまで（プロダクトの操作の有無は、プロダクトの状態が必要なので確かめていない）。
