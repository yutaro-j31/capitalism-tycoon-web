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

## その他の残件

| 内容 | 扱い |
| --- | --- |
| ホームの「今週やること」と週間レポートの「次の一手」の選定ロジックが重複している | 共通化は v1.0 では行わない（設計担当の決定 2026-11-11）。 |
| 週間レポートの `z-index` の個別上書き（`css/ui3-weekly-report.css`） | #1377 で `ui3.css` を 100 / 101 に直した後に消す（#1378）。 |
| 地図のシートの `.u-seg` 44px の個別上書き（`css/ui3-map.css`） | 同上（#1379）。 |

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

未確認：実際のIPOを経た上場後、成長の欄の行、資産売却と経費削減の操作。
