const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT } = require('./harness');

function lcg(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function marketScreen(options = {}) {
  const { ctx } = loadGame({ random: lcg(options.seed || 4242) });
  const e = ctx.__ct_engine, ui = ctx.__ct_ui;
  assert(e && ui, 'harness exposes engine and ui');
  e.g.configured = true;
  ui.showSetup = false;
  e.g.selectedTab = 'market';
  const html = () => String(ctx.document.getElementById('app').innerHTML || '');
  const panel = () => {
    const h = html();
    const start = h.indexOf('stock-trade-panel');
    const end = h.indexOf('stock-detail-head');
    assert(start >= 0, '株式詳細に売買パネルが描画されていない');
    assert(end > start, '売買パネルは株式詳細ヘッダーより前に置く');
    return h.slice(start, end);
  };
  e.advanceWeek(false);
  return { e, ui, html, panel };
}

// 1. The purchase controls exist on the market screen without horizontal scrolling.
{
  const { e, html, panel } = marketScreen();
  const h = html();
  assert(h.includes('data-screen="market"'), '株式市場画面が描画されている');
  assert(h.includes('data-stock-trade-panel'), '売買パネルが存在する');
  assert(
    h.indexOf('stock-trade-panel') < h.indexOf('market-table'),
    '売買パネルは横スクロールする銘柄テーブルより前に描画する'
  );
  const p = panel();
  for (const action of ['buy-stock', 'sell-stock', 'favorite-stock']) {
    assert(p.includes(`data-action="${action}"`), `${action} がパネル内にある`);
  }
  const selectedID = e.g.market.find(s => p.includes(`data-id="${s.id}"`))?.id;
  assert(selectedID, 'パネルのボタンが選択中の銘柄IDを持つ');
  for (const m of p.matchAll(/data-action="(?:buy|sell|favorite)-stock" data-id="([A-Z0-9_-]+)"/g)) {
    assert.equal(m[1], selectedID, 'パネル内のボタンは同一銘柄を指す');
  }
}

// 2. 売る is disabled without a holding and enabled after a purchase; holdings are shown.
{
  const { e, ui, panel } = marketScreen({ seed: 99 });
  const before = panel();
  assert(/disabled>売る/.test(before), '未保有では売却ボタンを無効にする');
  assert(!/disabled>買う/.test(before), '個人口座で資金があれば購入ボタンは有効');

  const id = e.g.market[0].id;
  ui.selectedStockId = id;
  assert(e.buyStock(id, 10, 'personal'), '個人口座で購入できる');
  e.advanceWeek(false);
  const after = panel();
  assert(!/disabled>売る/.test(after), '保有後は売却ボタンが有効になる');
  assert(/保有<\/span><strong>10株/.test(after), '保有株数をパネルに表示する');
}

// 3. 会社口座は投資部門が無いと購入できない。パネルがその理由を明示する。
{
  const { e, ui, panel } = marketScreen({ seed: 77 });
  assert(!e.g.departments.investment, '初期状態では投資部門は未設置');
  ui.selectedAccount = 'company';
  e.advanceWeek(false);
  const p = panel();
  assert(/disabled>買う/.test(p), '投資部門が無い会社口座では購入ボタンを無効にする');
  assert(p.includes('投資部門'), '無効な理由をパネルに表示する');
}

// 4. Reachability: the panel is still usable in ordinary play at week 208.
{
  const { e, ui, panel } = marketScreen({ seed: 2081 });
  ui.selectedAccount = 'personal';
  for (let i = 0; i < 208 && !e.g.gameOver; i++) e.advanceWeek(false);
  assert(e.g.week >= 208, `208週に到達する (week=${e.g.week})`);
  const p = panel();
  assert(p.includes('data-action="buy-stock"'), '第208週でも購入ボタンが描画される');
  assert(/購入可能<\/span><strong>[\d,]+株/.test(p), '購入可能株数を表示する');
}

// 5. Styling hooks exist so the panel does not fall back to unstyled markup.
{
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert(css.includes('.stock-trade-panel{'), '売買パネルのCSSが存在する');
  assert(css.includes('.stock-trade-meta{'), '売買パネルの指標行CSSが存在する');
  assert(/\.stock-trade-panel \.btn\{[^}]*min-height:44px/.test(css), 'タップ領域44px以上を維持する');
  assert(app.includes('function renderStockTradePanel('), 'パネル描画関数が存在する');
  assert(app.includes('${renderStockTradePanel(stock,h)}'), '株式詳細カードがパネルを呼び出す');
}

console.log('stock trade panel tests passed');
