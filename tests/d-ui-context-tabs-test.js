const fs = require('node:fs');
const assert = require('node:assert/strict');

const script = fs.readFileSync('js/d-ui-context-tabs.js', 'utf8');
const css = fs.readFileSync('css/d-ui-context-tabs.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(script, /const TABS=\[\['overview','概要'\],\['finance','財務'\],\['staff','スタッフ'\],\['product','商品'\]\]/, 'store detail tab set must remain complete');
assert.match(script, /role=\"tab\"/, 'context controls must expose the ARIA tab role');
assert.match(script, /aria-selected/, 'active context tab must be announced');
assert.match(script, /aria-controls=\"d-context-tabpanel\"/, 'tabs must reference their panel');
assert.match(script, /event\.key==='ArrowRight'/, 'right arrow keyboard navigation must remain supported');
assert.match(script, /event\.key==='ArrowLeft'/, 'left arrow keyboard navigation must remain supported');
assert.match(script, /event\.key==='Home'/, 'Home keyboard navigation must remain supported');
assert.match(script, /event\.key==='End'/, 'End keyboard navigation must remain supported');
assert.match(script, /const cost=Math\.max\(0,sales-profit\)/, 'finance tab must remain read-only and derive cost from existing results');
assert.doesNotMatch(script, /companyCash\s*(?:\+=|-=|\*=|\/=|=)/, 'context tabs must not mutate company cash');
assert.doesNotMatch(script, /lastProfit\s*=/, 'context tabs must not mutate store results');
assert.match(css, /min-height:44px/, 'tab controls must preserve the minimum touch target');
assert.match(css, /prefers-reduced-motion:reduce/, 'tab transitions must respect reduced motion');
assert.match(css, /forced-colors:active/, 'tab selection must remain visible in forced-colors mode');
assert.match(html, /css\/d-ui-context-tabs\.css/, 'context tab stylesheet must load in production');
assert.match(html, /js\/d-ui-context-tabs\.js/, 'context tab script must load in production');
assert.ok(html.indexOf('js/d-ui-shell.js') < html.indexOf('js/d-ui-context-tabs.js'), 'context tabs must load after the D UI shell');
assert.match(html, /capitalism_tycoon_web_v1|js\/save-v9\.js/, 'save compatibility contract must remain present');

console.log('D UI context tabs contract passed');
