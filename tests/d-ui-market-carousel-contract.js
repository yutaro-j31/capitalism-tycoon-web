const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('js/app.js', 'utf8');
const script = fs.readFileSync('js/d-ui-context-tabs.js', 'utf8');
const css = fs.readFileSync('css/d-ui-market.css', 'utf8');

assert.match(app, /stockSector:\s*'all'/, 'market UI state must retain the canonical stockSector filter');
assert.match(app, /select data-bind="stockSector"/, 'renderMarket must retain the canonical stockSector binding');
for (const action of ['select-stock','buy-stock','sell-stock','favorite-stock']) {
  assert.match(app, new RegExp(`data-action="${action}"|['"]${action}['"]`), `market action must remain wired: ${action}`);
}

assert.match(script, /function enhanceMarket\(uiContext=null\)/, 'existing D UI enhancer must provide the market presentation transform');
assert.match(script, /select\[data-bind="stockSector"\]/, 'market transform must derive tabs from the canonical sector select');
assert.match(script, /input\.dataset\.bind='stockSector'/, 'industry tabs must reuse the canonical stockSector change binding');
assert.match(script, /tabs\.setAttribute\('role','radiogroup'\)/, 'industry tabs must expose radiogroup semantics');
assert.match(script, /tabs\.setAttribute\('aria-label','株式市場の業種'\)/, 'industry tabs must expose an accessible group label');
assert.match(script, /track\.className='d-market-carousel-track'/, 'company rows must be moved into a dedicated horizontal carousel track');
assert.match(script, /track\.setAttribute\('role','list'\)/, 'company carousel must expose list semantics');
assert.match(script, /card\.setAttribute\('role','listitem'\)/, 'each company card must remain an accessible list item');
assert.match(script, /track\.addEventListener\('scroll',\(\)=>updateMarketPager\(track,pager\),\{passive:true\}\)/, 'carousel pager must follow real horizontal scrolling without polling');
assert.match(script, /intro\.after\(table\)/, 'company carousel must move directly below market filters before the long detail panel');
assert.match(script, /enhanceNews\(false,context\);enhanceMarket\(context\);/, 'market transform must reuse the existing d-ui-context-tabs enhancer registration');
assert.equal((script.match(/registerUIEnhancer\(/g) || []).length, 1, 'market carousel must not consume another enhancer registration');
assert.doesNotMatch(script, /new MutationObserver|setTimeout|setInterval|queueMicrotask|Math\.random/, 'market carousel must not introduce observer, timer, microtask or RNG loops');

assert.match(css, /\.d-market-sector-tabs\{[^}]*overflow-x:auto/s, 'industry tabs must scroll horizontally when the tab set exceeds the viewport');
assert.match(css, /\.d-market-sector-tab\{[^}]*min-height:48px/s, 'industry tabs must preserve a generous desktop touch target');
assert.match(css, /\.market-table\.d-market-carousel\{[^}]*overflow:hidden/s, 'page-level market container must remain width-bound');
assert.match(css, /\.d-market-carousel-track\{[^}]*display:flex[^}]*overflow-x:auto[^}]*scroll-snap-type:x mandatory/s, 'company cards must use a dedicated snap-enabled horizontal scroller');
assert.match(css, /\.d-market-carousel-track>[^}]*\.market-row:not\(\.header\)\{[^}]*scroll-snap-align:center/s, 'company cards must snap to the center');
assert.match(css, /max-width:820px[\s\S]*\.d-market-carousel-track>[^}]*\.market-row:not\(\.header\)\{[^}]*flex-basis:84%/s, 'iPhone company cards must leave neighboring cards visibly peeking');
assert.match(css, /\.d-market-carousel-track>[^}]*\.button-row>\.btn\{[^}]*min-height:44px/s, 'company-card actions must remain at least 44px high');
assert.match(css, /\.d-market-carousel-pager/, 'company carousel must render a compact position indicator');
assert.match(css, /\.d-market-carousel-hint/, 'company carousel must communicate horizontal swipe affordance');
assert.doesNotMatch(css, /100vw/, 'market D UI must not create viewport-width overflow');
assert.doesNotMatch(css, /display\s*:\s*none/, 'market D UI must not hide market information to satisfy mobile layout');

console.log('D UI market carousel contract passed');
