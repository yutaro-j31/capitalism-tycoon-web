# 作業3：画面の操作一覧（全ボタン・入力）

- 基準: `main` @ `47217818`。調査のみ。
- **測定方法**: Chromium(Playwright)で実起動し、新規ゲームを30週進めて「会社資金1,000億円・個人資金100億円」を与えた状態（会計の整合は崩さず `g` を直接設定しただけなので、次の週進行は行わない）を基準にし、各タブ（19タブ＋サブタブ）の全ボタンを**1種類につき1回**押して、(1) `engine.g` のトップレベルの変化（JSON比較）、(2) 出たモーダル/トースト、(3) 呼ばれた Engine メソッド、を記録した。押すたびに基準状態へ巻き戻した。金額入力モーダル（`askMoney`/`askText`）は既定値のまま「実行」を押した。
- **「結果に影響するか」の凡例**: 〇=業務状態が変化（変化したトップレベルキーを列挙）／ △=確認・入力画面を開くだけ ／ ×=変化なし（トーストの理由を併記。資金不足・前提未達など）／ 画面遷移のみ=`selectedTab` 等の選択だけ変化。
- **限界（正直に）**: (a) × は「その基準状態で無効だった」ことを示すだけで、機能が壊れているとは限らない（例: 売却ボタンは保有物がないと変化しない）。(b) 同じ種類のボタン（株銘柄ごとの「買う」等）は1件だけ押し、件数を右端に記録した。(c) 未実行: `tab`（遷移）・`advance-week`/`advance-4`（週送り。別途 156 週で確認済み）・`reset-game`/`confirm-reset`/`company-buyout`/`confirm-buyout`/`accept-inbound`（不可逆）・`export-save`/`import-save`/`restore-stored-save`（ファイル操作）・`close-modal`。(d) 「呼ぶ関数」の `観測:` は押下前後で実行回数が増えた Engine メソッド（上位5件）。`data-action` を持たない enhancer 系ボタンは `data-*` 属性名から生成箇所・処理箇所を grep で引いた。(e) `?ui=3` は同じ手順で別途測定（下の第2部）。ui3 の金額シートは確定ボタンの検出に失敗したものがあり、その場合は △ とした。
- 測定数: 既定UI ボタン要素 1520（うち種類ごとに1回押下）・入力欄 71／?ui=3 ボタン要素 724・入力欄 11。

## 第1部：既定UI（D UI。本番の既定URL）

### ナビゲーション（全タブ共通・タブ切替のみ）

呼ぶ関数（全行共通）: js/app.js:917 `case 'tab'`（`engine.g.selectedTab` 設定 → `engine.save()` → `render()`）。D UI 側のボタンは index.html の `data-d-ui-nav-proxy` が元のタブボタンの click に中継する。結果に影響するか（全行共通）: 画面遷移のみ（`selectedTab` のみ変化。業務状態は不変）。

| 表示名 | 遷移先タブ | 出現数 |
|---|---|---|
| ⌂ホーム | home | 68 |
| 🗾出店 | map | 34 |
| 🏪事業 | business | 34 |
| 🏢本社 | office | 34 |
| 📈株式 | market | 34 |
| 🚀VC | venture | 34 |
| 🤝M&A | ma | 34 |
| 🌐海外 | overseas | 34 |
| 💎資産 | assets | 34 |
| 🏦銀行 | bank | 34 |
| 📊決算 | report | 34 |
| 👤創業者 | founder | 34 |
| 🧩戦略 | strategy | 34 |
| 🗞メディア | media | 34 |
| 🏛承継 | legacy | 34 |
| 🎯進行 | missions | 34 |
| ⚔競合 | rivals | 68 |
| 📰ニュース | news | 34 |
| ⚙設定 | settings | 68 |
| ◉マップ | map | 34 |
| ▥本社 | office | 34 |
| ▣店舗 | business | 34 |
| ↗株式市場 | market | 68 |
| ◈資金調達 | bank | 34 |
| △研究開発 | strategy | 34 |
| ●採用 | founder | 34 |
| ✚危機対応 | home | 34 |
| ▥実績 | report | 34 |
| ✓目標 | missions | 34 |
| マップへ戻る | map | 33 |
| すべて見る | strategy | 1 |
| ▤レポート | report | 34 |
| ◴ダッシュボード | home | 34 |
| ▦子会社 | ma | 34 |
| ♟取締役会 | office | 34 |
| ♛ランキング | rivals | 34 |
| ?ヘルプ | settings | 34 |
| ◉出店マップ | map | 34 |
| ▣事業・店舗 | business | 34 |
| ▥本社・組織 | office | 34 |
| ◆VC投資 | venture | 34 |
| ◇M&A | ma | 34 |
| ◎海外 | overseas | 34 |
| ◫資産・不動産 | assets | 34 |
| ◈銀行・資金調達 | bank | 34 |
| ▤決算・レポート | report | 34 |
| ●創業者・採用 | founder | 34 |
| △戦略・研究開発 | strategy | 34 |
| ▰メディア | media | 34 |
| ♜承継 | legacy | 34 |
| ✓進行・目標 | missions | 34 |
| ●ニュース | news | 34 |
| 今週の経営判断 › | home | 1 |
| ラーメン 詳細最低 207.3万円› | map | 1 |
| コンビニ最低 467.3万円› | map | 1 |
| 不動産仲介最低 517.3万円› | map | 1 |
| ジム最低 1437.3万円› | map | 1 |
| 🏠実家・住居東京Lv1 | founder | 1 |
| 買収先の経営（PE） | pe-portfolio | 1 |

### タブ: home（ホーム）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 最初の店舗を出すの確認先へ移動 | — | js/app.js:960 case 'founding-tutorial-jump' → engine.save, foundingTutorialModule.acknowledgeDashboard | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 競合の動きを確認してくださいの確認先へ移動 | — | js/app.js:960 case 'secretary-jump' → （画面内操作のみ） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 買収候補探索の確認先へ移動 | — | js/app.js:960 case 'secretary-jump' → （画面内操作のみ） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: map（出店）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 不動産 東京 都心オフィスタワー | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 不動産 東京 小型レジデンス | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 不動産 東京 大型複合施設 | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 不動産 東京 駅前商業ビル | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 不動産 東京 郊外ロードサイド土地 | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 不動産 東京 物流センター用地 | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 駅ビルテナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 オフィス街テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 ITロフトテナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 郊外大型区画テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 商店街角地テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 駅前1階テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 住宅街入口テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | 出店候補 東京 ロードサイドテナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | オフィス 東京 プレミアムタワー | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | オフィス 東京 スモールHQ | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| ボタン | オフィス 東京 ビジネスセンター | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | × 変化なし | 1 |
| 選択 | 都道府県を切り替える | — | （id/nameなし）  / data: bind=selectedPref | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | ズームイン | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ズームアウト | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 全体 | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | × 変化なし | 1 |
| ボタン | 表示する拠点を選ぶ | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | すべて | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | × 変化なし | 1 |
| ボタン | 自社店舗 | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | × 変化なし | 1 |
| ボタン | 出店候補 | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | × 変化なし | 1 |
| ボタン | オフィス | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | × 変化なし | 1 |
| ボタン | 不動産 | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | × 変化なし | 1 |
| ボタン | 競合 | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | × 変化なし | 1 |
| 選択 | 北海道青森岩手宮城秋田山形福島茨城栃木群馬埼玉千葉東京神奈川新潟富山石川福井山梨 | — | （id/nameなし）  / data: bind=selectedPref | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-0`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 出店 | — | js/app.js:920 case 'open-store' → confirmOpenStore | 〇 状態変化: companyCash, stores, tenants, news, activeMissionIDs… 確定:この内容で出店する | 8 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-1`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-2`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-3`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-4`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-5`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-6`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）コンビニ（簡易シミュレーション）ジム（簡易シミュ | — | id/name=`business-tenant-tokyo-7`  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 本社契約 | — | js/app.js:921 case 'contract-office' → engine.contractOffice | 〇 状態変化: companyCash, rentalOffices, hasHeadOffice, officeName, officePrestige… | 3 |
| ボタン | 会社で購入 | — | js/app.js:922 case 'buy-property-company' → engine.buyProperty | 〇 状態変化: companyCash, properties, news, finance | 6 |
| ボタン | 個人で購入 | — | js/app.js:922 case 'buy-property-personal' → engine.buyProperty | 〇 状態変化: personalCash, properties, news | 6 |
| ボタン | 会社で価格交渉 | — | js/app.js:922 case 'negotiate-property-company' → confirmPropertyNegotiation | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 6 |
| ボタン | 個人で価格交渉 | — | js/app.js:922 case 'negotiate-property-personal' → confirmPropertyNegotiation | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 6 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: business（事業）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| 選択 | ラーメン（詳細シミュレーション）カフェ（簡易シミュレーション）コンビニ（簡易シミ | — | （id/nameなし）  / data: bind=selectedBusiness | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | FC本部を設置 | — | js/app.js:925 case 'start-franchise' → engine.startFranchise | × 変化なし（同一業態の直営店3店が必要です。） | 1 |
| ボタン | この事業で創業 | — | js/app.js:926 case 'found-digital-business' → engine.foundDigitalBusiness, askText | 〇 状態変化: companyCash, productVentures, formalProductLaunchCount, news, finance… 確定:実行 | 5 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: office（本社）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | — | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 福利厚生投資 | — | js/app.js:936 case 'workforce-invest' → engine.fail, engine.save, engine.emit, finance.event, askMoney | 〇 状態変化: companyCash, employeeSatisfaction, benefitLevel, finance 確定:実行 | 1 |
| ボタン | リモートOFF | — | js/app.js:937 case 'toggle-remote' → engine.save | 〇 状態変化: remoteWorkEnabled | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／dashboard | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／dashboard | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／dashboard | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／dashboard | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／dashboard | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／dashboard | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／dashboard | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 開始 | office-tab／dashboard | js/app.js:928 case 'start-workforce-project' → engine.startWorkforceProject | 測定時 disabled（押せない状態） | 5 |
| ボタン | 閉じる | office-tab／dashboard | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／overview | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／overview | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／overview | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／overview | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／overview | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／overview | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／overview | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 福利厚生投資 | office-tab／overview | js/app.js:936 case 'workforce-invest' → engine.fail, engine.save, engine.emit, finance.event, askMoney | 〇 状態変化: companyCash, employeeSatisfaction, benefitLevel, finance 確定:実行 | 1 |
| ボタン | リモートOFF | office-tab／overview | js/app.js:937 case 'toggle-remote' → engine.save | 〇 状態変化: remoteWorkEnabled | 1 |
| ボタン | 閉じる | office-tab／overview | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／campus | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／campus | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／campus | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／campus | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／campus | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／campus | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／campus | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 閉じる | office-tab／campus | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／departments | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／departments | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／departments | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／departments | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／departments | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／departments | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／departments | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 設置する | office-tab／departments | js/app.js:928 case 'establish-department' → engine.establishDepartment | × 変化なし（本社オフィスが必要です。） | 7 |
| ボタン | 閉じる | office-tab／departments | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／executives | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／executives | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／executives | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／executives | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／executives | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／executives | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／executives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 候補を更新 | office-tab／executives | js/app.js:928 case 'refresh-executives' → engine.refreshExecutives | 測定時 disabled（押せない状態） | 1 |
| ボタン | 交渉・採用 | office-tab／executives | js/app.js:929 case 'hire-executive' → engine.hireExecutive, modal | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 6 |
| ボタン | 閉じる | office-tab／executives | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／keypeople | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／keypeople | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／keypeople | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／keypeople | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／keypeople | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／keypeople | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／keypeople | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 候補を採用 | office-tab／keypeople | js/app.js:960 case 'hire-keyperson' → engine.hireKeyPerson | 測定時 disabled（押せない状態） | 1 |
| ボタン | 閉じる | office-tab／keypeople | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／board | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／board | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／board | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／board | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／board | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／board | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／board | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会を設置 | office-tab／board | js/app.js:930 case 'establish-board' → engine.establishBoard | × 変化なし（CEOとCFOが必要です。） | 1 |
| ボタン | IPOを実行 | office-tab／board | js/app.js:931 case 'execute-ipo' → engine.executeIPO, modal | 測定時 disabled（押せない状態） | 1 |
| ボタン | 資本注入 | office-tab／board | js/app.js:934 case 'contribute-founder-capital' → engine.contributeFounderCapital, askMoney | 〇 状態変化: companyCash, personalCash, news, finance, simulationRng… 確定:実行 | 1 |
| ボタン | 株主ローン | office-tab／board | js/app.js:935 case 'founder-shareholder-loan' → engine.foundersLoanToCompany, askMoney | 〇 状態変化: companyCash, companyDebt, personalCash, news, finance… 確定:実行 | 1 |
| ボタン | 閉じる | office-tab／board | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | office-tab／directives | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | office-tab／directives | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | office-tab／directives | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | office-tab／directives | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | office-tab／directives | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | office-tab／directives | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 組織 | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 本社 | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2Dキャンパス | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 部門 | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | CXO | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 重要社員 | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 取締役会・IPO | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 指示・社内VC | office-tab／directives | js/app.js:927 case 'office-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 新規提案を募集 | office-tab／directives | js/app.js:940 case 'propose-internal' → engine.proposeInternalVenture | 測定時 disabled（押せない状態） | 1 |
| ボタン | 閉じる | office-tab／directives | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: market（株式）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| 選択 | 個人口座会社口座 | — | （id/nameなし）  / data: bind=selectedAccount | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 全業種 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 外食・小売 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 不動産・REIT・金融 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | テック | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | AI・半導体 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | エネルギー | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | ヘルスケア | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 物流・インフラ | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 製造 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | ゲーム・エンタメ | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 防衛・宇宙 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 通信 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 自動車 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 小型株 | — | id/name=`d-market-sector` 参照: js/d-ui-context-tabs.js:152 / data: bind=stockSector | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 買う | — | js/app.js:942 case 'buy-stock' → engine.buyStock, askMoney | 〇 状態変化: personalCash, market, personalStocks, news 確定:実行 | 40 |
| ボタン | 売る | — | js/app.js:942 case 'sell-stock' → engine.sellStock, askMoney | 測定時 disabled（押せない状態） | 40 |
| ボタン | ☆ お気に入り | — | js/app.js:942 case 'favorite-stock' → engine.toggleFavorite | 〇 状態変化: favoriteStockIds | 1 |
| ボタン | 13週 | — | js/app.js:941 case 'stock-chart-range' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 3 |
| ボタン | 全期間 | — | js/app.js:941 case 'stock-chart-range' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本フードHD 選択中FOOD · 外食・小売1,206円-0.4%2328.7 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 詳細 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 39 |
| ボタン | ☆ | — | js/app.js:942 case 'favorite-stock' → engine.toggleFavorite | 〇 状態変化: favoriteStockIds | 39 |
| クリック要素(div) | 麺ロード RAMN · 外食・小売496円-1.6%735.86億円20.9倍  | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | ネオリテール RETL · 外食・小売1,873円+3.2%4197.20億円2 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 東都銀行 BANK · 不動産・REIT・金融1,049円+2.4%1.15兆円 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 都市REIT REIT · 不動産・REIT・金融2,126円-1.5%5264 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本プロパティ PROP · 不動産・REIT・金融4,113円+2.6%1.1 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本DX TECH · テック3,259円+5.0%1.26兆円42.8倍 /  | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | クラウドワークスJP SaaS · テック1,012円-1.4%1916.58億 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 東洋サイバー CYBR · テック1,122円+3.1%2054.84億円45. | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | AIクロス AIX · AI・半導体4,322円-10.8%1.44兆円65.1 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日の丸セミコン SEMI · AI・半導体11,691円+12.6%4.92兆円 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | チップマテリアル CHIP · AI・半導体1,816円-6.7%4884.29 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 新電力 ENER · エネルギー389円-4.9%1041.08億円12.9倍  | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本ソーラー SOLR · エネルギー1,327円-0.1%2280.79億円2 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 東洋ガス GASX · エネルギー2,094円-2.3%7293.08億円12. | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本ヘルスケア HLTH · ヘルスケア3,492円+3.8%1.01兆円24. | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 東都ファーマ PHRM · ヘルスケア6,708円-1.9%2.29兆円23.8 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | バイオネクスト BIOX · ヘルスケア951円-3.4%1462.57億円—  | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本ロジスティクス LOGI · 物流・インフラ1,922円-4.1%4966. | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 東西鉄道 RAIL · 物流・インフラ3,199円+2.7%1.37兆円20.1 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 港湾インフラ PORT · 物流・インフラ967円-1.7%2052.26億円1 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本精密工業 MFG1 · 製造1,144円+5.8%3537.15億円13.7 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | ロボファクトリー ROBO · 製造2,605円-6.4%6306.27億円30 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 大和ケミカル CHEM · 製造1,284円-3.4%3700.94億円13.3 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | サクラゲームス GAME · ゲーム・エンタメ2,199円-1.2%6059.9 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | アニメHD ANIM · ゲーム・エンタメ1,116円-1.1%2366.98億 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | ライブメディア LIVE · ゲーム・エンタメ1,048円+9.5%2360.9 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本防衛システム DEFS · 防衛・宇宙4,824円+5.7%1.19兆円30 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | オービット宇宙 SPAC · 防衛・宇宙582円+11.2%1246.79億円— | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 航空電子 AERO · 防衛・宇宙2,278円+3.7%5209.24億円23. | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本通信 TEL1 · 通信3,814円-0.2%4.21兆円14.2倍 / 1 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | モバイルネクスト MOBL · 通信1,188円-0.1%3788.18億円18 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | データセンターREIT DCTR · 通信3,139円-4.1%7876.27億 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 東都自動車 AUTO · 自動車3,266円+4.3%3.99兆円12.4倍 / | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | EVジャパン EVJP · 自動車1,143円+7.3%3283.33億円— / | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 日本部品工業 PART · 自動車1,216円-1.3%3811.67億円12. | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 蒼空素材 MC0012676304 · 小型株968円-5.0%9.68億円赤字 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 潮路システム MC0440954778 · 小型株1,850円+6.9%18.5 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| クリック要素(div) | 光輪システム MC4017588576 · 小型株1,740円+0.0%17.4 | — | js/app.js:941 case 'select-stock' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 2分割 | — | js/app.js:953 case 'stock-split' → engine.stockSplit | 〇 状態変化: market, news, stockSplitHistory | 4 |
| ボタン | MBO | — | js/app.js:953 case 'stock-mbo' → engine.executeMBO | × 変化なし（会社口座で過半数保有が必要です。） | 4 |
| ボタン | 需要防衛 2700.0万円 | — | data-industry-response-plan（生成 js/industry-event-response-plans-ui.js:11 / 処理 js/industry-event-response-plans-ui.js:15） | 〇 状態変化: companyCash, finance, activeIndustryEventResponsePlan, industryEventResponsePlanHistory | 1 |
| ボタン | 供給・原価ヘッジ 3750.0万円 | — | data-industry-response-plan（生成 js/industry-event-response-plans-ui.js:11 / 処理 js/industry-event-response-plans-ui.js:15） | 〇 状態変化: companyCash, finance, activeIndustryEventResponsePlan, industryEventResponsePlanHistory | 1 |
| ボタン | 技術投資 5400.0万円 | — | data-industry-response-plan（生成 js/industry-event-response-plans-ui.js:11 / 処理 js/industry-event-response-plans-ui.js:15） | 〇 状態変化: companyCash, finance, activeIndustryEventResponsePlan, industryEventResponsePlanHistory | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: venture（VC）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 詳細DDを実施 | — | js/app.js:943 case 'conduct-startup-dd' → engine.conductStartupDueDiligence | 〇 状態変化: personalCash, startups, news | 3 |
| ボタン | 会社で投資 | — | js/app.js:943 case 'invest-startup-company' → engine.investStartup, askMoney | × 確認画面→確定(実行)後も変化なし（会社投資には投資部門が必要です。） | 3 |
| ボタン | 個人で投資 | — | js/app.js:943 case 'invest-startup-personal' → engine.investStartup, askMoney | 〇 状態変化: personalCash, startups, news 確定:実行 | 3 |
| ボタン | 子会社化 | — | js/app.js:943 case 'make-subsidiary' → engine.makeSubsidiary | 測定時 disabled（押せない状態） | 3 |
| ボタン | 会社持分をセカンダリー売却 | — | js/app.js:943 case 'sell-startup-secondary-confirm' → engine.previewStartupSecondarySale, confirmModal | 測定時 disabled（押せない状態） | 3 |
| ボタン | 個人持分をセカンダリー売却 | — | js/app.js:943 case 'sell-startup-secondary-confirm' → engine.previewStartupSecondarySale, confirmModal | 測定時 disabled（押せない状態） | 3 |
| ボタン | 進捗を更新 | — | data-restructuring-refresh（生成 js/group-restructuring-progress.js:78 / 処理 —） | × 変化なし | 1 |
| ボタン | 資本配分を実行 | — | data-group-capital-execution-action（生成 js/group-capital-allocation-execution.js:31 / 処理 —） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 候補を分析 | — | data-new-business-analysis-action（生成 js/new-business-market-analysis.js:23 / 処理 —） | 〇 状態変化: news, newBusinessAnalysis | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: ma（M&A）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 最優先：買収候補探索 | — | data-ma-portfolio-action（生成 js/ma-portfolio-summary-ui.js:25 / 処理 —） | × 変化なし | 1 |
| ボタン | 候補企業を探索 | — | js/app.js:944 case 'generate-ma' → engine.generateMATargets | 測定時 disabled（押せない状態） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: overseas（海外）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| 選択 | ラーメン（詳細シミュレーション）カフェ（簡易シミュレーション）コンビニ（簡易シミ | — | id/name=`overseas-business-usa`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 現地法人設立 | — | js/app.js:945 case 'open-overseas' → engine.openOverseas | × 変化なし（本社とCEOが必要です。） | 5 |
| 選択 | ラーメン（詳細シミュレーション）カフェ（簡易シミュレーション）コンビニ（簡易シミ | — | id/name=`overseas-business-singapore`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）カフェ（簡易シミュレーション）コンビニ（簡易シミ | — | id/name=`overseas-business-taiwan`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）カフェ（簡易シミュレーション）コンビニ（簡易シミ | — | id/name=`overseas-business-thailand`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメン（詳細シミュレーション）カフェ（簡易シミュレーション）コンビニ（簡易シミ | — | id/name=`overseas-business-france`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: assets（資産）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| 選択 | 北海道 駅前商業ビル北海道 郊外ロードサイド土地北海道 小型レジデンス北海道 大 | — | （id/nameなし）  / data: reLoanProperty= | （入力欄。値は押下する操作の関数が読む） | 5 |
| 入力 | 借入希望額 | — | （id/nameなし）  / data: reLoanAmount= | （入力欄。値は押下する操作の関数が読む） | 5 |
| ボタン | 固定金利で借入 | — | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 変動金利で借入 | — | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | REIT | — | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 都市再開発 | — | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 海外投資 | — | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 不動産 | — | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投信・債券 | — | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 高級資産 | — | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | スポーツ | — | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 内訳を算定 | — | js/app.js:927 case 'founder-wealth-capture' → captureFounderWealthBreakdown | × 変化なし | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | asset-tab／property | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | asset-tab／property | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | asset-tab／property | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | asset-tab／property | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | asset-tab／property | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 固定金利で借入 | asset-tab／property | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 変動金利で借入 | asset-tab／property | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | REIT | asset-tab／property | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 都市再開発 | asset-tab／property | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 海外投資 | asset-tab／property | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 1週間進める | asset-tab／property | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 不動産 | asset-tab／property | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投信・債券 | asset-tab／property | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 高級資産 | asset-tab／property | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | スポーツ | asset-tab／property | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 内訳を算定 | asset-tab／property | js/app.js:927 case 'founder-wealth-capture' → captureFounderWealthBreakdown | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 閉じる | asset-tab／property | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | asset-tab／investment | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | asset-tab／investment | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | asset-tab／investment | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | asset-tab／investment | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | asset-tab／investment | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 固定金利で借入 | asset-tab／investment | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 変動金利で借入 | asset-tab／investment | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | REIT | asset-tab／investment | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 都市再開発 | asset-tab／investment | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 海外投資 | asset-tab／investment | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 1週間進める | asset-tab／investment | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 不動産 | asset-tab／investment | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投信・債券 | asset-tab／investment | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 高級資産 | asset-tab／investment | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | スポーツ | asset-tab／investment | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 内訳を算定 | asset-tab／investment | js/app.js:927 case 'founder-wealth-capture' → captureFounderWealthBreakdown | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 投資 | asset-tab／investment | js/app.js:946 case 'buy-personal-investment' → engine.buyPersonalInvestment, askMoney | 〇 状態変化: personalCash, personalInvestments, news, simulationRng 確定:実行 | 5 |
| ボタン | 閉じる | asset-tab／investment | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | asset-tab／luxury | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | asset-tab／luxury | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | asset-tab／luxury | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | asset-tab／luxury | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | asset-tab／luxury | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 固定金利で借入 | asset-tab／luxury | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 変動金利で借入 | asset-tab／luxury | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | REIT | asset-tab／luxury | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 都市再開発 | asset-tab／luxury | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 海外投資 | asset-tab／luxury | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 1週間進める | asset-tab／luxury | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 不動産 | asset-tab／luxury | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投信・債券 | asset-tab／luxury | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 高級資産 | asset-tab／luxury | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | スポーツ | asset-tab／luxury | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 内訳を算定 | asset-tab／luxury | js/app.js:927 case 'founder-wealth-capture' → captureFounderWealthBreakdown | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 購入 | asset-tab／luxury | js/app.js:947 case 'buy-luxury' → engine.buyLuxury | 〇 状態変化: personalCash, personalFame, luxuryAssets, news, simulationRng… | 5 |
| ボタン | 閉じる | asset-tab／luxury | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | asset-tab／sports | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | asset-tab／sports | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | asset-tab／sports | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | asset-tab／sports | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | asset-tab／sports | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 固定金利で借入 | asset-tab／sports | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 変動金利で借入 | asset-tab／sports | data-re-borrow（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | REIT | asset-tab／sports | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 都市再開発 | asset-tab／sports | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 海外投資 | asset-tab／sports | data-re-vehicle（生成 — / 処理 js/real-estate-complete-cycle-ui.js:2） | 〇 状態変化: realEstateMarket | 1 |
| ボタン | 1週間進める | asset-tab／sports | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 不動産 | asset-tab／sports | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投信・債券 | asset-tab／sports | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 高級資産 | asset-tab／sports | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | スポーツ | asset-tab／sports | js/app.js:927 case 'asset-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 内訳を算定 | asset-tab／sports | js/app.js:927 case 'founder-wealth-capture' → captureFounderWealthBreakdown | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 個人取得 | asset-tab／sports | js/app.js:947 case 'buy-team-personal' → engine.buySportsTeam | 〇 状態変化: personalCash, personalFame, sportsTeams, news, simulationRng… | 3 |
| ボタン | 会社取得 | asset-tab／sports | js/app.js:947 case 'buy-team-company' → engine.buySportsTeam | 〇 状態変化: companyCash, personalFame, sportsTeams, news, finance… | 3 |
| ボタン | 閉じる | asset-tab／sports | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: bank（銀行）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 借入 | — | js/app.js:960 case 'borrow-company' → engine.borrow, askMoney | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 返済 | — | js/app.js:960 case 'repay-company' → engine.repay, askMoney | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 借入 | — | js/app.js:960 case 'borrow-personal' → engine.borrow, askMoney | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 返済 | — | js/app.js:960 case 'repay-personal' → engine.repay, askMoney | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 500万円返済 | — | data-treasury-prepayment（生成 js/treasury-prepayment.js:31 / 処理 js/treasury-prepayment.js:35） | 測定時 disabled（押せない状態） | 2 |
| ボタン | 返済可能額を全額 | — | data-treasury-prepayment（生成 js/treasury-prepayment.js:31 / 処理 js/treasury-prepayment.js:35） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 短期・負債圧縮 | — | data-refinancing-policy（生成 js/treasury-refinancing-policy.js:35 / 処理 js/treasury-refinancing-policy.js:39） | 〇 状態変化: news, finance | 1 |
| ボタン | 標準 | — | data-refinancing-policy（生成 js/treasury-refinancing-policy.js:35 / 処理 js/treasury-refinancing-policy.js:39） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 長期・流動性重視 | — | data-refinancing-policy（生成 js/treasury-refinancing-policy.js:35 / 処理 js/treasury-refinancing-policy.js:39） | 〇 状態変化: news, finance | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: report（決算）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| 選択 | 週次利益週次売上企業価値個人純資産 | — | （id/nameなし）  / data: bind=reportMetric | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | 今週13週四半期年度52週 | — | （id/nameなし）  / data: bind=financePeriod | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: founder（創業者）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 街へ出て店舗探索 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderHomeActionLog, localReputationByPref, recommendedTenantIDsFromHomeSearch, lastStoreHuntWeek | 1 |
| ボタン | 地元イベント | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: news, simulationRng, founderSkillBusiness, founderSkillNegotiation, founderHomeActionLog… | 1 |
| ボタン | 経営を学ぶ | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillBusiness, founderHomeActionLog, founderEducationLevel | 1 |
| ボタン | 技術を学ぶ | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillTech, founderHomeActionLog, founderEducationLevel | 1 |
| ボタン | 金融を学ぶ | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillFinance, founderHomeActionLog, founderEducationLevel | 1 |
| ボタン | 人脈を作る | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillNegotiation, founderHomeActionLog, founderNetworkLevel | 1 |
| ボタン | 自宅アップグレード | — | js/app.js:948 case 'upgrade-home' → engine.upgradeFounderHome | 〇 状態変化: personalCash, news, currentFounderHomeRank, founderHomeLevel, founderHomeMonthlyCost… | 1 |
| ボタン | 後継者育成 70万円 | — | js/app.js:949 case 'founder-invest' → engine.investFounder | 〇 状態変化: personalCash, successorReadiness | 1 |
| ボタン | 財団へ500万円 | — | js/app.js:949 case 'founder-invest' → engine.investFounder | 〇 状態変化: personalCash, foundationEndowment, foundationReputation | 1 |
| ボタン | 法人を設立 | — | js/app.js:956 case 'establish-personal-re-corp' → engine.establishPersonalRealEstateCorp | 〇 状態変化: personalCash, news, personalRealEstateCorp | 1 |
| ボタン | 購入 | — | js/app.js:956 case 'buy-personal-re' → engine.buyPersonalRealEstate | 〇 状態変化: personalCash, news, simulationRng, personalRealEstateHoldings | 3 |
| ボタン | 個人でPE取得 | — | js/app.js:954 case 'create-pe' → engine.createPEDeal, askText, askMoney | × 確認画面→確定(実行)後も変化なし | 1 |
| ボタン | 会社でPE取得 | — | js/app.js:954 case 'create-pe' → engine.createPEDeal, askText, askMoney | 測定時 disabled（押せない状態） | 1 |
| ボタン | エンジェル投資 | — | js/app.js:955 case 'create-angel' → engine.createAngelInvestment, askMoney | 〇 状態変化: personalCash, news, simulationRng, angelInvestments 確定:実行 | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: strategy（戦略）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | サプライチェーン | — | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | R&D・特許 | — | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 顧客・市場シェア | — | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投資 | — | js/app.js:951 case 'vertical-integration' → engine.addVerticalIntegration | 〇 状態変化: companyCash, news, finance, simulationRng, verticalIntegrationAssets… | 9 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | strategy-tab／supply | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | strategy-tab／supply | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | strategy-tab／supply | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | strategy-tab／supply | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | strategy-tab／supply | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | strategy-tab／supply | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | サプライチェーン | strategy-tab／supply | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | R&D・特許 | strategy-tab／supply | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 顧客・市場シェア | strategy-tab／supply | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 投資 | strategy-tab／supply | js/app.js:951 case 'vertical-integration' → engine.addVerticalIntegration | 〇 状態変化: companyCash, news, finance, simulationRng, verticalIntegrationAssets… | 9 |
| ボタン | 閉じる | strategy-tab／supply | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | strategy-tab／rd | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | strategy-tab／rd | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | strategy-tab／rd | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | strategy-tab／rd | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | strategy-tab／rd | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | strategy-tab／rd | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | サプライチェーン | strategy-tab／rd | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | R&D・特許 | strategy-tab／rd | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 顧客・市場シェア | strategy-tab／rd | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 研究開始 | strategy-tab／rd | js/app.js:951 case 'start-rd' → engine.startRDProject | × 変化なし（商品開発部門またはDX部門が必要です。） | 5 |
| ボタン | 研究開始 | strategy-tab／rd | js/app.js:951 case 'start-menu-research' → engine.startMenuResearch | 測定時 disabled（押せない状態） | 6 |
| ボタン | 閉じる | strategy-tab／rd | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ◀ | strategy-tab／segments | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | strategy-tab／segments | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | strategy-tab／segments | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | strategy-tab／segments | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | strategy-tab／segments | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | strategy-tab／segments | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | サプライチェーン | strategy-tab／segments | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | R&D・特許 | strategy-tab／segments | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 顧客・市場シェア | strategy-tab／segments | js/app.js:950 case 'strategy-tab' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 閉じる | strategy-tab／segments | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: media（メディア）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 実行 | — | js/app.js:958 case 'media-action' → engine.startMediaAction | 〇 状態変化: companyCash, news, finance, simulationRng, mediaCampaigns… | 4 |
| ボタン | 入札 | — | js/app.js:958 case 'auction-bid' → engine.bidLuxuryAuction | 〇 状態変化: personalCash, personalFame, luxuryAssets, news, simulationRng… | 3 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: legacy（承継）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 引退して承継する | — | js/app.js:959 case 'retire-founder' → engine.retirementEligibility, confirmModal | 測定時 disabled（押せない状態） | 1 |
| ボタン | 指名 | — | js/app.js:959 case 'appoint-successor' → engine.appointSuccessor | 〇 状態変化: personalCash, news, successorReadiness, successorCandidate | 3 |
| ボタン | 1,000万円で設立 | — | js/app.js:959 case 'establish-trust' → engine.establishFamilyTrust | 〇 状態変化: personalCash, news, familyTrustEstablished, familyTrustCash | 1 |
| ボタン | 結果カードを保存 | — | js/app.js:960 case 'download-result-card' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: missions（進行）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: rivals（競合）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 広告防衛 | — | js/app.js:960 case 'respond-rival' → engine.respondToCompetitor | 〇 状態変化: companyCash, companyReputation, news, finance, rivalResponseHistory… | 2 |
| ボタン | 品質防衛 | — | js/app.js:960 case 'respond-rival' → engine.respondToCompetitor | 〇 状態変化: companyCash, businesses, news, finance, rivalResponseHistory… | 2 |
| ボタン | 買収 | — | js/app.js:960 case 'respond-rival' → engine.respondToCompetitor | 〇 状態変化: companyCash, competitors, subsidiaries, news, finance… | 2 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: news（ニュース）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | トップ | — | data-d-news-section（生成 js/d-ui-context-tabs.js:111 / 処理 js/d-ui-context-tabs.js:217） | × 変化なし | 1 |
| ボタン | 小売 | — | data-d-news-section（生成 js/d-ui-context-tabs.js:111 / 処理 js/d-ui-context-tabs.js:217） | × 変化なし | 1 |
| ボタン | 経営 | — | data-d-news-section（生成 js/d-ui-context-tabs.js:111 / 処理 js/d-ui-context-tabs.js:217） | × 変化なし | 1 |
| ボタン | 株式市場 | — | data-d-news-section（生成 js/d-ui-context-tabs.js:111 / 処理 js/d-ui-context-tabs.js:217） | × 変化なし | 1 |
| ボタン | 政治 | — | data-d-news-section（生成 js/d-ui-context-tabs.js:111 / 処理 js/d-ui-context-tabs.js:217） | × 変化なし | 1 |
| ボタン | スポーツ | — | data-d-news-section（生成 js/d-ui-context-tabs.js:111 / 処理 js/d-ui-context-tabs.js:217） | × 変化なし | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |

### タブ: settings（設定）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ◀ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | Ⅱ | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 一週進める » | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 全メニューを開く | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| 入力 | on | — | （id/nameなし）  / data: setting=autoManage | （入力欄。値は押下する操作の関数が読む） | 16 |
| 選択 | 成長重視バランス守備重視 | — | （id/nameなし）  / data: setting=autoManageStyle | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 現在データを保存 | — | js/app.js:961 case 'save-now' → engine.save | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | JSON書き出し | — | js/app.js:962 case 'export-save' → exportSaveFile | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | JSON読み込み | — | js/app.js:964 case 'import-save' → （画面内操作のみ） | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | スロット1保存 | — | js/app.js:961 case 'save-slot' → engine.save | 画面遷移/選択のみ（業務状態は不変） | 3 |
| ボタン | 読込 | — | js/app.js:961 case 'load-slot' → engine.loadSlot | 画面遷移/選択のみ（業務状態は不変） | 3 |
| 入力 | import-file | — | id/name=`import-file` 参照: js/ui3-setup.js:26, js/ui3-setup.js:28, js/app.js:834 | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 最初からやり直す | — | js/app.js:964 case 'reset-game' → confirmModal | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 会社売却を検討 | — | js/app.js:974 case 'company-buyout' → confirmModal | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | 最新版で再起動 | — | data-release-diagnostics-action（生成 js/playtest-report-ui.js:23 / 処理 js/playtest-report-ui.js:133） | 測定エラー | 1 |
| ボタン | 診断情報をコピー | — | data-release-diagnostics-action（生成 js/playtest-report-ui.js:23 / 処理 js/playtest-report-ui.js:133） | 測定エラー | 1 |
| ボタン | 不具合報告ファイルを保存 | — | data-playtest-report-button（生成 js/playtest-report-ui.js:22 / 処理 —） | 測定エラー | 1 |
| ボタン | JSONバックアップ | — | data-save-storage-action（生成 js/save-storage-ui.js:27 / 処理 js/save-storage-ui.js:29） | 測定エラー | 1 |
| ボタン | JSONから復元 | — | data-save-storage-action（生成 js/save-storage-ui.js:27 / 処理 js/save-storage-ui.js:29） | 測定エラー | 1 |
| ボタン | 履歴を整理して保存 | — | data-save-storage-action（生成 js/save-storage-ui.js:27 / 処理 js/save-storage-ui.js:29） | 測定エラー | 1 |
| 入力 | 例: iPhone 15 Pro | — | （id/nameなし）  / data: physicalField=model | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 例: 18.5 | — | （id/nameなし）  / data: physicalField=ios | （入力欄。値は押下する操作の関数が読む） | 2 |
| テキスト入力 | 画面名、操作、発生した症状を記録。問題がなければ「問題なし」と入力 | — | （id/nameなし）  / data: physicalField=notes | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 結果JSONを書き出す | — | data-physical-action（生成 js/physical-iphone-playtest.js:69 / 処理 js/physical-iphone-playtest.js:77） | 測定エラー | 1 |
| ボタン | 結果をコピー | — | data-physical-action（生成 js/physical-iphone-playtest.js:69 / 処理 js/physical-iphone-playtest.js:77） | 測定エラー | 1 |
| 選択 | 現在セーブのdetached cloneGrowth fixture v1（第1 | — | （id/nameなし）  / data: probeField=scenario | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | iPhone 15 Pro | — | （id/nameなし）  / data: probeField=model | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 18.5 | — | （id/nameなし）  / data: probeField=ios | （入力欄。値は押下する操作の関数が読む） | 2 |
| 選択 | coolwarmhot | — | （id/nameなし）  / data: probeField=thermal | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | 40-character main SHA | — | （id/nameなし）  / data: probeField=buildSha | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | Baselineを実行 | — | data-probe-action（生成 js/iphone-baseline-probe.js:42 / 処理 js/iphone-baseline-probe.js:103） | 測定エラー | 1 |
| ボタン | JSONコピー | — | data-probe-action（生成 js/iphone-baseline-probe.js:42 / 処理 js/iphone-baseline-probe.js:103） | 測定時 disabled（押せない状態） | 1 |
| ボタン | JSON書き出し | — | data-probe-action（生成 js/iphone-baseline-probe.js:42 / 処理 js/iphone-baseline-probe.js:103） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 最終Gate Cチェック開始 | — | data-probe-action（生成 js/iphone-baseline-probe.js:42 / 処理 js/iphone-baseline-probe.js:103） | 測定エラー | 1 |
| ボタン | 最終チェックJSON書き出し | — | data-probe-action（生成 js/iphone-baseline-probe.js:42 / 処理 js/iphone-baseline-probe.js:103） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 閉じる | — | data-d-ui-action（生成 js/d-ui-shell.js:84 / 処理 js/d-ui-shell.js:390） | 測定エラー | 1 |

## 第2部：?ui=3（UI v3。`?ui=3` を付けたときだけ有効）

### ナビゲーション（全タブ共通・タブ切替のみ）

呼ぶ関数（全行共通）: js/app.js:917 `case 'tab'`（`engine.g.selectedTab` 設定 → `engine.save()` → `render()`）。D UI 側のボタンは index.html の `data-d-ui-nav-proxy` が元のタブボタンの click に中継する。結果に影響するか（全行共通）: 画面遷移のみ（`selectedTab` のみ変化。業務状態は不変）。

| 表示名 | 遷移先タブ | 出現数 |
|---|---|---|
| 業界イベント「資源価格ショック」が発生。原材料と物流費が上昇（8週間）第26週› | news | 1 |
| 四半期決算を発表しました。第26週› | news | 1 |
| 進行・目標初店舗› | missions | 1 |
| ⌂ホーム | home | 15 |
| ◉マップ | map | 19 |
| ▣事業 | business | 4 |
| ↗投資 | market | 14 |
| ▥会社 | bank | 10 |
| ホーム | home | 19 |
| 進行・目標 | missions | 19 |
| ニュース | news | 19 |
| マップ | map | 19 |
| 店舗・事業 | business | 25 |
| 本社 | office | 25 |
| 戦略 | strategy | 25 |
| 海外 | overseas | 25 |
| メディア | media | 25 |
| 競合 | rivals | 25 |
| 株式 | market | 23 |
| ベンチャー | venture | 23 |
| M&A | ma | 23 |
| 不動産 | assets | 23 |
| 資金調達 | bank | 24 |
| 決算 | report | 24 |
| 創業者 | founder | 24 |
| 承継 | legacy | 24 |
| 設定 | settings | 24 |
| 今週の経営判断 › | home | 1 |
| ▣事業 | rivals | 4 |
| ラーメン最低 207.3万円› | map | 1 |
| コンビニ最低 467.3万円› | map | 1 |
| 不動産仲介最低 517.3万円› | map | 1 |
| ジム最低 1437.3万円› | map | 1 |
| ▣事業 | office | 4 |
| ↗投資 | venture | 1 |
| ⚠M&Aには投資部門が必要です本社の部門を設定する | office | 1 |
| ↗投資 | ma | 2 |
| ▣事業 | overseas | 3 |
| 物件を買う（マップ）購入は出店マップの物件から› | map | 1 |
| ↗投資 | assets | 2 |
| ▥会社 | report | 1 |
| ▥会社 | founder | 3 |
| ▣事業 | strategy | 1 |
| ▣事業 | media | 3 |
| ▥会社 | legacy | 4 |
| ⌂ホーム | missions | 2 |
| ⌂ホーム | news | 2 |
| ▥会社 | settings | 1 |

### タブ: home（ホーム）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 📘創業ガイド 2/10：最初の店舗を出す地図でテナントを選び、業種を決めて出店し | — | js/app.js:960 case 'founding-tutorial-jump' → engine.save, foundingTutorialModule.acknowledgeDashboard | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 💡競合の動きを確認してください競合イベントまたは株式保有圧力が検出されています。 | — | js/app.js:960 case 'secretary-jump' → （画面内操作のみ） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: map（出店）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 不動産 東京 都心オフィスタワー | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 不動産 東京 小型レジデンス | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 不動産 東京 大型複合施設 | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 不動産 東京 駅前商業ビル | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 不動産 東京 郊外ロードサイド土地 | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 不動産 東京 物流センター用地 | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 駅ビルテナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 オフィス街テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 ITロフトテナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 郊外大型区画テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 商店街角地テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 駅前1階テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 住宅街入口テナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 出店候補 東京 ロードサイドテナント | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | オフィス 東京 プレミアムタワー | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | オフィス 東京 スモールHQ | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | オフィス 東京 ビジネスセンター | — | data-city-index（生成 js/city-lab-map.js:150 / 処理 —） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ズームイン | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ズームアウト | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 全体 | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | × 変化なし | 1 |
| ボタン | 表示する拠点を選ぶ | — | data-city-camera（生成 js/city-lab-map.js:49 / 処理 js/city-lab-map.js:51） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 表示中の拠点の一覧 | — | data-ui3-map-list（生成 js/ui3-map.js:77 / 処理 js/ui3-map.js:78） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 1週間進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| 選択 | 都道府県を切り替える | — | （id/nameなし）  / data: bind=selectedPref | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | すべて | — | data-ui3-map-filter（生成 js/ui3-map.js:60 / 処理 js/ui3-map.js:75） | × 変化なし | 2 |
| ボタン | 自社店舗 | — | data-ui3-map-filter（生成 js/ui3-map.js:60 / 処理 js/ui3-map.js:75） | × 変化なし | 2 |
| ボタン | 出店候補 | — | data-ui3-map-filter（生成 js/ui3-map.js:60 / 処理 js/ui3-map.js:75） | × 変化なし | 2 |
| ボタン | オフィス | — | data-ui3-map-filter（生成 js/ui3-map.js:60 / 処理 js/ui3-map.js:75） | × 変化なし | 2 |
| ボタン | 不動産 | — | data-ui3-map-filter（生成 js/ui3-map.js:60 / 処理 js/ui3-map.js:75） | × 変化なし | 2 |
| ボタン | 競合 | — | data-ui3-map-filter（生成 js/ui3-map.js:60 / 処理 js/ui3-map.js:75） | × 変化なし | 2 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: business（事業）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | IT・デジタル事業プロダクトの開発・創業› | — | data-ui3-biz（生成 js/ui3-business.js:54 / 処理 js/ui3-business.js:290） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | ほかの詳細（現行の画面）営業時間・メニュー・市場分析・フランチャイズの一覧など› | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: office（本社）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 経理部門設置費 170.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 人事部門設置費 150.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 商品開発部門設置費 180.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 生産管理部門設置費 150.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 宣伝部門設置費 160.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 技術部門設置費 220.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 投資部門設置費 240.0万円未設置 | — | data-ui3-dept（生成 js/ui3-office.js:36 / 処理 js/ui3-office.js:126） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 福利厚生投資金額を入力して投資する› | — | js/app.js:936 case 'workforce-invest' → engine.fail, engine.save, engine.emit, finance.event, askMoney | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | リモートワークいまは OFF（押すと ON）OFF | — | js/app.js:937 case 'toggle-remote' → engine.save | 〇 状態変化: remoteWorkEnabled | 1 |
| ボタン | ほかの詳細（現行の画面）CXO・取締役会とIPO・社内VC・キャンパスなど› | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: market（株式）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 個人口座 | — | data-ui3-mkt-account（生成 js/ui3-market.js:59 / 処理 js/ui3-market.js:175） | × 変化なし | 1 |
| ボタン | 会社口座 | — | data-ui3-mkt-account（生成 js/ui3-market.js:59 / 処理 js/ui3-market.js:175） | × 変化なし | 1 |
| 選択 | 個人口座会社口座 | — | （id/nameなし）  / data: bind=selectedAccount | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 銘柄を探す38銘柄› | — | data-ui3-mkt（生成 js/ui3-market.js:59 / 処理 js/ui3-market.js:175） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | ほかの詳細（現行の画面）自社株の分割・MBO・防衛策・創業者株の売却、チャート、 | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: venture（VC）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 麺AIラボSeries A · AI需要予測1.12億円 | — | data-ui3-vc（生成 js/ui3-venture.js:45 / 処理 js/ui3-venture.js:145） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 無人レジクラウドSeries B · 小売DX5.94億円 | — | data-ui3-vc（生成 js/ui3-venture.js:45 / 処理 js/ui3-venture.js:145） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 観光カフェOSSeed · 店舗SaaS1.27億円 | — | data-ui3-vc（生成 js/ui3-venture.js:45 / 処理 js/ui3-venture.js:145） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | ほかの詳細（現行の画面）新規事業の分析・資本配分の実行・ベンチャー拡張の欄› | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: ma（M&A）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 候補企業を探索いまの候補0件は新しい候補に入れ替わります› | — | data-ui3-ma（生成 js/ui3-ma.js:31 / 処理 js/ui3-ma.js:111） | 測定時 disabled（押せない状態） | 1 |
| ボタン | ほかの詳細（現行の画面）案件の交渉（DD・オファー・資金調達・取締役会・クロージ | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: overseas（海外）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 米国基礎需要1.35 · リスク11.0% · FX 0.9818500.0万円 | — | data-ui3-os（生成 js/ui3-overseas.js:29 / 処理 js/ui3-overseas.js:69） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | シンガポール基礎需要1.18 · リスク7.0% · FX 0.9325500. | — | data-ui3-os（生成 js/ui3-overseas.js:29 / 処理 js/ui3-overseas.js:69） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 台湾基礎需要1.14 · リスク8.0% · FX 0.9034500.0万円 | — | data-ui3-os（生成 js/ui3-overseas.js:29 / 処理 js/ui3-overseas.js:69） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | タイ基礎需要1.08 · リスク13.0% · FX 0.8633200.0万円 | — | data-ui3-os（生成 js/ui3-overseas.js:29 / 処理 js/ui3-overseas.js:69） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | フランス基礎需要1.12 · リスク10.0% · FX 1.0307000.0 | — | data-ui3-os（生成 js/ui3-overseas.js:29 / 処理 js/ui3-overseas.js:69） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | ほかの詳細（現行の画面）本社への送金・ローカライズ・ブランド投資› | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| 選択 | ラーメンカフェコンビニ居酒屋ファミレスベーカリー弁当店高級レストランドラッグスト | — | id/name=`overseas-business-usa`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメンカフェコンビニ居酒屋ファミレスベーカリー弁当店高級レストランドラッグスト | — | id/name=`overseas-business-singapore`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメンカフェコンビニ居酒屋ファミレスベーカリー弁当店高級レストランドラッグスト | — | id/name=`overseas-business-taiwan`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメンカフェコンビニ居酒屋ファミレスベーカリー弁当店高級レストランドラッグスト | — | id/name=`overseas-business-thailand`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| 選択 | ラーメンカフェコンビニ居酒屋ファミレスベーカリー弁当店高級レストランドラッグスト | — | id/name=`overseas-business-france`  | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: assets（資産）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | ほかの詳細（現行の画面）土地の建設・投信・債券・高級資産・スポーツ・個人資産の内 | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: bank（銀行）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 会社 | — | data-ui3-bank-account（生成 js/ui3-bank.js:47 / 処理 js/ui3-bank.js:106） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 個人 | — | data-ui3-bank-account（生成 js/ui3-bank.js:47 / 処理 js/ui3-bank.js:106） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 会社で借りる借入余力 408.00億円› | — | js/app.js:960 case 'borrow-company' → engine.borrow, askMoney | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 会社の借入を返す借入はありません› | — | js/app.js:960 case 'repay-company' → engine.repay, askMoney | 測定時 disabled（押せない状態） | 1 |
| ボタン | 借入金の一覧0件› | — | data-ui3-bank（生成 js/ui3-bank.js:46 / 処理 js/ui3-bank.js:104） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 13週の資金繰り予測週ごとの現金・入金・返済› | — | data-ui3-bank（生成 js/ui3-bank.js:46 / 処理 js/ui3-bank.js:104） | 〇 状態変化: finance | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: report（決算）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 今週 | — | data-ui3-report-period（生成 js/ui3-report.js:36 / 処理 js/ui3-report.js:76） | 〇 状態変化: finance | 1 |
| ボタン | 13週 | — | data-ui3-report-period（生成 js/ui3-report.js:36 / 処理 js/ui3-report.js:76） | 〇 状態変化: finance | 2 |
| ボタン | 四半期 | — | data-ui3-report-period（生成 js/ui3-report.js:36 / 処理 js/ui3-report.js:76） | 〇 状態変化: finance | 1 |
| ボタン | 年度 | — | data-ui3-report-period（生成 js/ui3-report.js:36 / 処理 js/ui3-report.js:76） | 〇 状態変化: finance | 1 |
| ボタン | 損益計算書売上から当期純利益まで› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 貸借対照表資産・負債・純資産› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | キャッシュフロー計算書営業・投資・財務› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 財務指標利益率・安全性› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 運転資本売掛金・買掛金・CCC› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 配当可能額理論上・安全額› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 週次履歴直近30週› | — | data-ui3-report-sheet（生成 js/ui3-report.js:45 / 処理 js/ui3-report.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | ほかの詳細（現行の画面）チャート、会計用語、13週の資金繰り予測› | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 〇 状態変化: finance | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: founder（創業者）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 街へ出て店舗探索有望なテナントを探す・地元信用が上がる実行 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderHomeActionLog, localReputationByPref, recommendedTenantIDsFromHomeSearch, lastStoreHuntWeek | 1 |
| ボタン | 地元イベント地元に顔を出す実行 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: personalFame, news, simulationRng, founderHomeActionLog, localReputationByPref… | 1 |
| ボタン | 経営を学ぶ経営スキルが上がる実行 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillBusiness, founderHomeActionLog, founderEducationLevel | 1 |
| ボタン | 技術を学ぶ技術スキルが上がる実行 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillTech, founderHomeActionLog, founderEducationLevel | 1 |
| ボタン | 金融を学ぶ金融スキルが上がる実行 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillFinance, founderHomeActionLog, founderEducationLevel | 1 |
| ボタン | 人脈を作る人脈と交渉スキルが上がる実行 | — | js/app.js:948 case 'founder-action' → engine.founderHomeAction | 〇 状態変化: founderSkillNegotiation, founderHomeActionLog, founderNetworkLevel | 1 |
| ボタン | 自宅アップグレードランク1 → 2 · 個人の現金から80.0万円 | — | data-ui3-founder（生成 js/ui3-founder.js:33 / 処理 js/ui3-founder.js:78） | 〇 状態変化: personalCash, news, currentFounderHomeRank, founderHomeLevel, founderHomeMonthlyCost… 確定:アップグレードする | 1 |
| ボタン | 後継者育成後継者の準備度が上がります70.0万円 | — | data-ui3-founder（生成 js/ui3-founder.js:33 / 処理 js/ui3-founder.js:78） | 〇 状態変化: personalCash, successorReadiness 確定:実行する | 1 |
| ボタン | 財団への寄付財団の評価が上がります500.0万円 | — | data-ui3-founder（生成 js/ui3-founder.js:33 / 処理 js/ui3-founder.js:78） | 〇 状態変化: personalCash, foundationEndowment, foundationReputation 確定:実行する | 1 |
| ボタン | ほかの詳細（現行の画面）個人不動産・PE・エンジェル投資・行動履歴› | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: strategy（戦略）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | サプライチェーン | — | data-ui3-strat-tab（生成 js/ui3-strategy.js:54 / 処理 js/ui3-strategy.js:68） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | R&D・特許 | — | data-ui3-strat-tab（生成 js/ui3-strategy.js:54 / 処理 js/ui3-strategy.js:68） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 顧客・市場シェア | — | data-ui3-strat-tab（生成 js/ui3-strategy.js:54 / 処理 js/ui3-strategy.js:68） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 製麺工場週次費65.0万円 · 原価低減5.5% · リスク8.0%8000.0 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | スープ工場週次費52.0万円 · 原価低減4.5% · リスク7.0%6500. | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 食品加工工場週次費76.0万円 · 原価低減5.0% · リスク9.0%9500 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 物流倉庫週次費90.0万円 · 原価低減6.0% · リスク10.0%1.20億 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 自社配送網週次費140.0万円 · 原価低減7.0% · リスク12.0%1.8 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | POSシステム週次費32.0万円 · 原価低減2.5% · リスク4.0%450 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 仕入れプラットフォーム週次費48.0万円 · 原価低減4.0% · リスク6.0 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | データ分析基盤週次費62.0万円 · 原価低減3.5% · リスク5.5%900 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | クラウド・サーバー基盤週次費110.0万円 · 原価低減4.0% · リスク11 | — | data-ui3-strat（生成 js/ui3-strategy.js:25 / 処理 js/ui3-strategy.js:68） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | ほかの詳細（現行の画面）店舗ごとの仕入先・自動発注・安全在庫・緊急発注、在庫の表 | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 測定不能（クリック後に再描画で消えた） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: media（メディア）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 記者会見経営方針を説明し、企業評判と創業者知名度を上げる。 · 1週250.0万 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: companyCash, news, finance, simulationRng, mediaCampaigns… 確定:実行する | 1 |
| ボタン | SNSキャンペーン認知を伸ばす一方、炎上リスクも少し上がる。 · 4週120.0 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: companyCash, news, finance, simulationRng, mediaCampaigns… 確定:実行する | 1 |
| ボタン | 危機対応広報炎上・赤字・不祥事への説明を強化する。 · 2週500.0万円 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: companyCash, news, finance, simulationRng, mediaCampaigns… 確定:実行する | 1 |
| ボタン | IRロードショー株主信頼と資本市場評価を高める。 · 6週800.0万円 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: companyCash, news, finance, simulationRng, mediaCampaigns… 確定:実行する | 1 |
| ボタン | クラシックカー★5 · 自動車 · 期限 第32週3623.4万円 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: personalCash, personalFame, luxuryAssets, news, simulationRng… 確定:入札する | 1 |
| ボタン | ヴィンテージ腕時計★4 · 時計 · 期限 第32週1504.6万円 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: personalCash, personalFame, luxuryAssets, news, simulationRng… 確定:入札する | 1 |
| ボタン | 歴史的企業家の書簡★4 · 史料 · 期限 第32週716.8万円 | — | data-ui3-media（生成 js/ui3-media.js:23 / 処理 js/ui3-media.js:51） | 〇 状態変化: personalCash, personalFame, luxuryAssets, news, simulationRng… 確定:入札する | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: legacy（承継）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 世代第1世代 · 創業会社 第1社 · 創業者20歳 | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | レガシースコア現世代 5151 | — | （data属性なし。DOM直結のリスナー） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 引退して承継する条件を満たすと引退できます条件未達 | — | data-ui3-legacy（生成 js/ui3-legacy.js:28 / 処理 js/ui3-legacy.js:66） | 測定時 disabled（押せない状態） | 1 |
| ボタン | 家族後継者を指名family · 個人の現金から70.0万円 | — | data-ui3-legacy（生成 js/ui3-legacy.js:28 / 処理 js/ui3-legacy.js:66） | 〇 状態変化: personalCash, news, successorReadiness, successorCandidate 確定:指名する | 1 |
| ボタン | 社内エースを指名internal · 個人の現金から180.0万円 | — | data-ui3-legacy（生成 js/ui3-legacy.js:28 / 処理 js/ui3-legacy.js:66） | 〇 状態変化: personalCash, news, successorReadiness, successorCandidate 確定:指名する | 1 |
| ボタン | プロ経営者を指名professional · 個人の現金から450.0万円 | — | data-ui3-legacy（生成 js/ui3-legacy.js:28 / 処理 js/ui3-legacy.js:66） | 〇 状態変化: personalCash, news, successorReadiness, successorCandidate 確定:指名する | 1 |
| ボタン | ファミリートラストを設立家族資産の長期管理と世代承継に使う1000.0万円 | — | data-ui3-legacy（生成 js/ui3-legacy.js:28 / 処理 js/ui3-legacy.js:66） | 〇 状態変化: personalCash, news, familyTrustEstablished, familyTrustCash 確定:設立する | 1 |
| ボタン | 結果カードを保存エンディングと記録を画像で保存保存 | — | js/app.js:960 case 'download-result-card' → （画面内操作のみ） | 表示切替のみ（UI内部状態。g は不変） | 1 |
| ボタン | ほかの詳細（現行の画面）信託への移管・新会社の創業・エンディングと殿堂記録・歴代 | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: missions（進行）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: rivals（競合）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | メガ麺ラーメン · 関東 · 買収の機会強さ25 | — | data-ui3-rival（生成 js/ui3-rivals.js:29 / 処理 js/ui3-rivals.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | メガ麺 中部ラーメン · 中部 · 買収の機会強さ23 | — | data-ui3-rival（生成 js/ui3-rivals.js:29 / 処理 js/ui3-rivals.js:82） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: news（ニュース）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

### タブ: settings（設定）

| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |
|---|---|---|---|---|---|
| ボタン | オン | — | data-ui3-set（生成 js/ui3-setup.js:14 / 処理 js/ui3-settings.js:79） | 〇 状態変化: autoManage | 2 |
| ボタン | オフ | — | data-ui3-set（生成 js/ui3-setup.js:14 / 処理 js/ui3-settings.js:79） | 画面遷移/選択のみ（業務状態は不変） | 2 |
| ボタン | 成長重視 | — | data-ui3-set（生成 js/ui3-setup.js:14 / 処理 js/ui3-settings.js:79） | 〇 状態変化: autoManageStyle | 1 |
| ボタン | バランス | — | data-ui3-set（生成 js/ui3-setup.js:14 / 処理 js/ui3-settings.js:79） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | 守備重視 | — | data-ui3-set（生成 js/ui3-setup.js:14 / 処理 js/ui3-settings.js:79） | 〇 状態変化: autoManageStyle | 1 |
| ボタン | 現在データを保存この端末に保存する保存 | — | js/app.js:961 case 'save-now' → engine.save | 画面遷移/選択のみ（業務状態は不変） | 1 |
| ボタン | JSON書き出しバックアップのファイルを保存する書き出し | — | js/app.js:962 case 'export-save' → exportSaveFile | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | JSON読み込みバックアップのファイルから復元する読み込み | — | js/app.js:964 case 'import-save' → （画面内操作のみ） | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | セーブスロットスロット1〜3に保存・読み込み› | — | data-ui3-settings（生成 js/ui3-settings.js:28 / 処理 js/ui3-settings.js:88） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 最初からやり直す進行状況をすべて削除する削除 | — | data-ui3-settings-confirm（生成 js/ui3-settings.js:46 / 処理 js/ui3-settings.js:97） | △ 確認/入力画面を開くのみ（確定ボタン未検出・未実行） | 1 |
| ボタン | 会社売却を検討事業経営を終えて個人資産モードへ売却 | — | data-ui3-settings-confirm（生成 js/ui3-settings.js:46 / 処理 js/ui3-settings.js:97） | 〇 状態変化: personalCash, news, isCompanySold, simulationRng, hallOfRecords… 確定:売却する | 1 |
| ボタン | ほかの詳細（現行の画面）診断・最新版で再起動・不具合報告・保存領域・動作確認のツ | — | data-ui3-current（生成 js/ui3-business.js:9 / 処理 js/ui3-shell.js:302） | 画面遷移/選択のみ（業務状態は不変） | 1 |
| 入力 | on | — | （id/nameなし）  / data: setting=autoManage | （入力欄。値は押下する操作の関数が読む） | 2 |
| 選択 | 成長重視バランス守備重視 | — | （id/nameなし）  / data: setting=autoManageStyle | （入力欄。値は押下する操作の関数が読む） | 1 |
| 入力 | import-file | — | id/name=`import-file` 参照: js/ui3-setup.js:26, js/ui3-setup.js:28, js/app.js:834 | （入力欄。値は押下する操作の関数が読む） | 1 |
| ボタン | （ラベルなし） | — | js/app.js:961 case 'save-slot' → engine.save | 測定不能（クリック後に再描画で消えた） | 3 |
| ボタン | 4週進める | — | js/app.js:918 case 'advance-4' → engine.advanceWeek, showWeeklySummary | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |
| ボタン | ▶ 進める | — | js/app.js:918 case 'advance-week' → engine.advanceWeek | 未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記） | 1 |

