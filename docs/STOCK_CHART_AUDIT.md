# Stock chart audit

## コード上の事実

- `renderMarket()` は `js/app.js` の株式タブ描画関数で、投資口座と業種フィルターのカード、銘柄一覧テーブル、資本市場カード、決算カードを返していた。
- 変更前の株式タブには株価チャート用の `<canvas>`、チャート期間UI、選択中銘柄の詳細カードがなかった。
- 株式画面の一時UI状態は `ui.selectedAccount` と `ui.stockSector` が中心で、選択中銘柄IDはなかった。
- `g.market[]` の銘柄は `id`, `name`, `sector`, `price`, `previous`, `marketCap`, `per`, `pbr`, `dividendYield`, `dividendPerShare`, `issuedShares`, `shareholders`, `volatility`, `trend` などを持つ。
- `normalizeMasterData()` とIPO/子会社IPOでは `priceHistory` が作られていたが、変更前は数値配列だった。
- `updateMarket()` は `advanceWeek()` 中に1回呼ばれ、各銘柄について `previous = price` の後に既存の乱数式で `move` を計算し、更新後 `price` を `priceHistory` に追加していた。
- `buyStock()` と `sellStock()` は取引インパクトで `price` と `marketCap` を更新するが、週次履歴追加の契機ではない。
- `drawLine()` は `home-chart` と `report-chart` の簡易折れ線描画に使われ、`drawCharts()` はその2つだけを描画していた。
- `render()` は `app.innerHTML` で画面を再生成した後、`requestAnimationFrame(drawCharts)` を呼ぶ。
- resize時は `window.addEventListener('resize', () => requestAnimationFrame(drawCharts))` で再描画していた。

## 推測・判断

- チャートが表示されなかった主因は、保存済みの価格履歴があっても株式タブにCanvasと選択銘柄UIがなく、`drawCharts()` が株式チャートを対象にしていなかったため。
- iPhone Safariでは表示直後に `canvas.clientWidth` が0になる可能性があるため、描画時は `clientWidth` だけでなく親要素幅と固定フォールバック幅を使うのが安全。
- 既存の市場データとの参照関係を壊さないため、履歴は各銘柄の `priceHistory` に保持する方式が自然。
