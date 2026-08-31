const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('js/app.js','utf8');
const appCss=fs.readFileSync('css/app.css','utf8');
const mobileCss=fs.readFileSync('css/d-ui-mobile-company.css','utf8');
const marketV2=fs.readFileSync('css/d-ui-market-v2.css','utf8');

// Preserve the existing real market data and script ordering contract.
assert(html.indexOf('js/market.js')<html.indexOf('js/engine.js'));
for(const word of ['市場概要','限界利益','機会損失']) assert(app.includes(word),`${word} UI missing`);
assert(appCss.includes('market-scroll'));

// D UI v2 must be explicitly connected after the legacy market skin so it can safely override presentation only.
assert(mobileCss.includes('@import url("./d-ui-market.css");'));
assert(mobileCss.includes('@import url("./d-ui-market-v2.css");'));
assert(mobileCss.indexOf('./d-ui-market-v2.css')>mobileCss.indexOf('./d-ui-market.css'));

// Market v2 visual language: deep canvas, violet primary, blue/cyan data accents, semantic gains/losses.
for(const token of ['--d2-market-canvas','--d2-market-violet','--d2-market-violet-hi','--d2-market-blue','--d2-market-cyan','--d2-market-positive','--d2-market-negative']){
  assert(marketV2.includes(token),`${token} missing`);
}
assert(marketV2.includes('[data-screen="market"]'));
assert(marketV2.includes('MARKET INTELLIGENCE'));
assert(marketV2.includes('font-variant-numeric:tabular-nums'));

// iPhone contracts: interactive market controls stay tappable and layouts collapse without viewport overflow.
assert(marketV2.includes('@media(max-width:820px)'));
assert(marketV2.includes('min-height:44px'));
assert(marketV2.includes('grid-template-columns:minmax(0,1fr)'));
assert(!marketV2.includes('100vw'),'market v2 must not introduce 100vw overflow');

// Horizontal market tracks remain usable instead of hiding their scroll affordance.
assert(marketV2.includes('overflow-x:auto'));
assert(marketV2.includes('scrollbar-width:auto'));
assert(!marketV2.includes('scrollbar-width:none'),'market v2 must not hide Firefox scrollbars');
assert(!marketV2.includes('::-webkit-scrollbar{display:none}'),'market v2 must not hide WebKit scrollbars');

console.log('market D UI v2 static checks passed');
