const fs = require('node:fs');
const assert = require('node:assert/strict');

const index = fs.readFileSync('index.html', 'utf8');
const bridge = fs.readFileSync('css/d-ui-context-tabs.css', 'utf8');
const commandStyle = fs.readFileSync('css/d-ui-command-menu-v2.css', 'utf8');
const shell = fs.readFileSync('js/d-ui-shell.js', 'utf8');

assert.match(index, /href="\.\/css\/d-ui-context-tabs\.css"/, 'runtime must load the D UI stylesheet bridge');
const imports = [
  '@import url("./d-ui-home.css");',
  '@import url("./d-ui-finance.css");',
  '@import url("./d-ui-business.css");',
  '@import url("./d-ui-command-menu-v2.css");'
];
for (const statement of imports) {
  assert.ok(bridge.includes(statement), `runtime bridge must include ${statement}`);
}
const firstRule = bridge.search(/\n[^@/\s][^{]*\{/);
for (const statement of imports) {
  const position = bridge.indexOf(statement);
  assert.ok(position >= 0 && (firstRule < 0 || position < firstRule), `${statement} must remain before normal CSS rules`);
}
for (const file of ['css/d-ui-home.css','css/d-ui-finance.css','css/d-ui-business.css','css/d-ui-command-menu-v2.css']) {
  assert.ok(fs.existsSync(file), `${file} must exist for runtime import`);
  assert.ok(fs.statSync(file).size > 0, `${file} must not be empty`);
}
assert.doesNotMatch(bridge, /d-ui-market\.css/, 'market stylesheet remains on its dedicated D UI import chain');

assert.match(commandStyle, /body\.d-ui-active \.d-command-menu\{/, 'command menu v2 must stay scoped to the active D UI shell');
assert.match(commandStyle, /--d2-command-violet:#7c5cff/, 'command menu v2 must use the approved violet primary accent');
assert.match(commandStyle, /body\.d-ui-active \.d-command-grid\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, 'desktop command menu must use a dense four-column destination grid');
assert.match(commandStyle, /@media\(max-width:820px\)\{[\s\S]*?body\.d-ui-active \.d-command-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'iPhone command menu must collapse to a two-column destination grid');
assert.match(commandStyle, /body\.d-ui-active \.d-command-head button\{[\s\S]*?min-width:44px;[\s\S]*?min-height:44px;/, 'command menu close control must preserve a 44px touch target');
assert.match(commandStyle, /body\.d-ui-active \.d-command-grid \.d-nav-button\{[\s\S]*?min-height:68px;/, 'command destinations must preserve generous touch targets');
assert.match(commandStyle, /safe-area-inset-bottom/, 'command menu must respect iPhone safe areas');
assert.match(commandStyle, /100dvh/, 'command menu must use dynamic viewport height for the mobile dialog');
assert.match(commandStyle, /prefers-reduced-motion:reduce/, 'command menu motion must respect reduced-motion preferences');
assert.match(commandStyle, /forced-colors:active/, 'command menu must remain legible in forced-colors mode');
assert.match(commandStyle, /focus-visible[\s\S]*--d2-command-violet-hi/, 'command menu keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(commandStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'command menu v2 must not hide existing destinations');
assert.doesNotMatch(commandStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'command menu v2 must not create page-level viewport overflow');
assert.doesNotMatch(commandStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'command menu v2 must not hide scroll affordances');
assert.doesNotMatch(commandStyle, /https?:\/\//, 'command menu v2 must not add remote runtime assets');
for (const label of ['VC投資','M&A','海外','資産・不動産','メディア','承継','競合','ニュース','設定']) {
  assert.ok(shell.includes(label), `command menu must retain low-frequency destination: ${label}`);
}
assert.match(shell, /role="dialog" aria-modal="true" aria-label="経営メニュー"/, 'command menu must preserve its accessible dialog contract');
assert.match(shell, /event\.key!==['"]Tab['"]/, 'command menu must preserve its focus trap');
assert.match(shell, /setCommandMenu\(false,true\)/, 'command menu dismissal must preserve focus restoration');

console.log('D UI v2 runtime stylesheet contract passed');
