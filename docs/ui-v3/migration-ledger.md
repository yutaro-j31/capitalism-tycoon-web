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

## その他の残件

| 内容 | 扱い |
| --- | --- |
| ホームの「今週やること」と週間レポートの「次の一手」の選定ロジックが重複している | 共通化は v1.0 では行わない（設計担当の決定 2026-11-11）。 |

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
