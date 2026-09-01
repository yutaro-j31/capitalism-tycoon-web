const fs = require('node:fs');
const assert = require('node:assert/strict');

const index = fs.readFileSync('index.html', 'utf8');
const bridge = fs.readFileSync('css/d-ui-context-tabs.css', 'utf8');
const mobileStyle = fs.readFileSync('css/d-ui-mobile-company.css', 'utf8');
const commandStyle = fs.readFileSync('css/d-ui-command-menu-v2.css', 'utf8');
const officeStyle = fs.readFileSync('css/d-ui-office.css', 'utf8');
const founderStyle = fs.readFileSync('css/d-ui-founder.css', 'utf8');
const strategyStyle = fs.readFileSync('css/d-ui-strategy.css', 'utf8');
const rivalsStyle = fs.readFileSync('css/d-ui-rivals.css', 'utf8');
const mediaStyle = fs.readFileSync('css/d-ui-media.css', 'utf8');
const shell = fs.readFileSync('js/d-ui-shell.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(index, /href="\.\/css\/d-ui-context-tabs\.css"/, 'runtime must load the D UI stylesheet bridge');
assert.match(index, /href="\.\/css\/d-ui-mobile-company\.css"/, 'runtime must load the D UI mobile/company stylesheet chain');
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

assert.ok(mobileStyle.includes('@import url("./d-ui-office.css");'), 'runtime mobile/company chain must import the Office stylesheet');
assert.match(officeStyle, /body\.d-ui-active \[data-screen="office"\]\{/, 'Office v2 must stay scoped to the active Office screen');
assert.match(officeStyle, /--d2-office-violet:#7c5cff/, 'Office v2 must use the approved violet primary accent');
assert.match(officeStyle, /--d2-office-blue:#5c8dff/, 'Office v2 must retain the approved blue data accent');
assert.match(officeStyle, /--d2-office-cyan:#46c6e8/, 'Office v2 must retain the approved cyan secondary accent');
assert.match(officeStyle, /\.subtabs button\{[\s\S]*?min-height:44px;/, 'Office contextual tabs must preserve a 44px touch target');
assert.match(officeStyle, /overflow-x:auto/, 'Office contextual tabs must remain horizontally reachable on compact screens');
assert.match(officeStyle, /safe-area-inset-bottom/, 'Office v2 must respect iPhone safe areas');
assert.match(officeStyle, /prefers-reduced-motion:reduce/, 'Office v2 motion must respect reduced-motion preferences');
assert.match(officeStyle, /forced-colors:active/, 'Office v2 must remain legible in forced-colors mode');
assert.match(officeStyle, /focus-visible[\s\S]*--d2-office-violet-hi/, 'Office v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(officeStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Office v2 must not hide existing Office information or actions');
assert.doesNotMatch(officeStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Office v2 must not create page-level viewport overflow');
assert.doesNotMatch(officeStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Office v2 must not hide scroll affordances');
assert.doesNotMatch(officeStyle, /https?:\/\//, 'Office v2 must not add remote runtime assets');
for (const label of ['組織','本社','2Dキャンパス','部門','CXO','重要社員','取締役会・IPO','指示・社内VC']) {
  assert.ok(app.includes(label), `Office v2 must retain Office destination: ${label}`);
}
for (const action of ['office-tab','cancel-office','workforce-invest','establish-department','hire-executive','execute-ipo','approve-internal']) {
  assert.ok(app.includes(action), `Office v2 must retain existing Office action: ${action}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-founder.css");'), 'runtime mobile/company chain must import the Founder stylesheet');
assert.match(founderStyle, /body\.d-ui-active \[data-screen="founder"\]\{/, 'Founder v2 must stay scoped to the active Founder screen');
assert.match(founderStyle, /--d2-founder-violet:#7c5cff/, 'Founder v2 must use the approved violet primary accent');
assert.match(founderStyle, /--d2-founder-blue:#5c8dff/, 'Founder v2 must retain the approved blue data accent');
assert.match(founderStyle, /--d2-founder-cyan:#46c6e8/, 'Founder v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(founderStyle, /--d-gold/, 'Founder v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.match(founderStyle, /\.btn\{[\s\S]*?min-height:44px;/, 'Founder buttons must preserve a 44px touch target');
assert.match(founderStyle, /safe-area-inset-bottom/, 'Founder v2 must respect iPhone safe areas');
assert.match(founderStyle, /prefers-reduced-motion:reduce/, 'Founder v2 motion must respect reduced-motion preferences');
assert.match(founderStyle, /forced-colors:active/, 'Founder v2 must remain legible in forced-colors mode');
assert.match(founderStyle, /focus-visible[\s\S]*--d2-founder-violet-hi/, 'Founder v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(founderStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Founder v2 must not hide existing Founder information or actions');
assert.doesNotMatch(founderStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Founder v2 must not create page-level viewport overflow');
assert.doesNotMatch(founderStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Founder v2 must not hide scroll affordances');
assert.doesNotMatch(founderStyle, /https?:\/\//, 'Founder v2 must not add remote runtime assets');
for (const label of ['創業者プロフィール','創業者ホーム','自宅から個人開発','自己投資','行動履歴','オルタナティブ投資','個人不動産','PE・エンジェル']) {
  assert.ok(app.includes(label), `Founder v2 must retain Founder destination: ${label}`);
}
for (const action of ['founder-action','upgrade-home','launch-home-product','founder-invest','buy-personal-re','sell-personal-re','create-pe','create-angel','exit-angel']) {
  assert.ok(app.includes(action), `Founder v2 must retain existing Founder action: ${action}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-strategy.css");'), 'runtime mobile/company chain must import the Strategy stylesheet');
assert.match(strategyStyle, /body\.d-ui-active \[data-screen="strategy"\]\{/, 'Strategy v2 must stay scoped to the active Strategy screen');
assert.match(strategyStyle, /--d2-strategy-violet:#7c5cff/, 'Strategy v2 must use the approved violet primary accent');
assert.match(strategyStyle, /--d2-strategy-blue:#5c8dff/, 'Strategy v2 must retain the approved blue data accent');
assert.match(strategyStyle, /--d2-strategy-cyan:#46c6e8/, 'Strategy v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(strategyStyle, /--d-gold/, 'Strategy v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.match(strategyStyle, /\.subtabs button\{[\s\S]*?min-height:44px;/, 'Strategy contextual tabs (supply/rd/segments) must preserve a 44px touch target');
assert.match(strategyStyle, /overflow-x:auto/, 'Strategy contextual tabs must remain horizontally reachable on compact screens');
assert.match(strategyStyle, /safe-area-inset-bottom/, 'Strategy v2 must respect iPhone safe areas');
assert.match(strategyStyle, /prefers-reduced-motion:reduce/, 'Strategy v2 motion must respect reduced-motion preferences');
assert.match(strategyStyle, /forced-colors:active/, 'Strategy v2 must remain legible in forced-colors mode');
assert.match(strategyStyle, /focus-visible[\s\S]*--d2-strategy-violet-hi/, 'Strategy v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(strategyStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Strategy v2 must not hide existing Strategy information or actions');
assert.doesNotMatch(strategyStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Strategy v2 must not create page-level viewport overflow');
assert.doesNotMatch(strategyStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Strategy v2 must not hide scroll affordances');
assert.doesNotMatch(strategyStyle, /https?:\/\//, 'Strategy v2 must not add remote runtime assets');
for (const label of ['戦略システム','研究テーマ','特許ポートフォリオ','業態別顧客セグメント・市場シェア','Phase 1C 仕入・原材料在庫','垂直統合','サプライチェーン履歴']) {
  assert.ok(app.includes(label), `Strategy v2 must retain Strategy destination: ${label}`);
}
for (const action of ['strategy-tab','start-rd','license-patent','start-menu-research','supply-select-supplier','supply-policy','supply-safety','supply-emergency','vertical-integration']) {
  assert.ok(app.includes(action), `Strategy v2 must retain existing Strategy action: ${action}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-rivals.css");'), 'runtime mobile/company chain must import the Rivals stylesheet');
assert.match(rivalsStyle, /body\.d-ui-active \[data-screen="rivals"\]\{/, 'Rivals v2 must stay scoped to the active Rivals screen');
assert.match(rivalsStyle, /--d2-rivals-violet:#7c5cff/, 'Rivals v2 must use the approved violet primary accent');
assert.match(rivalsStyle, /--d2-rivals-blue:#5c8dff/, 'Rivals v2 must retain the approved blue data accent');
assert.match(rivalsStyle, /--d2-rivals-cyan:#46c6e8/, 'Rivals v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(rivalsStyle, /--d-gold/, 'Rivals v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.match(rivalsStyle, /\.btn\{[\s\S]*?min-height:44px;/, 'Rivals buttons must preserve a 44px touch target');
assert.match(rivalsStyle, /safe-area-inset-bottom/, 'Rivals v2 must respect iPhone safe areas');
assert.match(rivalsStyle, /prefers-reduced-motion:reduce/, 'Rivals v2 motion must respect reduced-motion preferences');
assert.match(rivalsStyle, /forced-colors:active/, 'Rivals v2 must remain legible in forced-colors mode');
assert.match(rivalsStyle, /focus-visible[\s\S]*--d2-rivals-violet-hi/, 'Rivals v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(rivalsStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Rivals v2 must not hide existing Rivals information or actions');
assert.doesNotMatch(rivalsStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Rivals v2 must not create page-level viewport overflow');
assert.doesNotMatch(rivalsStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Rivals v2 must not hide scroll affordances');
assert.doesNotMatch(rivalsStyle, /https?:\/\//, 'Rivals v2 must not add remote runtime assets');
for (const label of ['競合の新製品と対抗','対抗手段','競合反撃システム','既存ライバル','競合イベント']) {
  assert.ok(app.includes(label), `Rivals v2 must retain Rivals destination: ${label}`);
}
for (const action of ['counter-competitor-product','respond-rival']) {
  assert.ok(app.includes(action), `Rivals v2 must retain existing Rivals action: ${action}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-media.css");'), 'runtime mobile/company chain must import the Media stylesheet');
assert.match(mediaStyle, /body\.d-ui-active \[data-screen="media"\]\{/, 'Media v2 must stay scoped to the active Media screen');
assert.match(mediaStyle, /--d2-media-violet:#7c5cff/, 'Media v2 must use the approved violet primary accent');
assert.match(mediaStyle, /--d2-media-blue:#5c8dff/, 'Media v2 must retain the approved blue data accent');
assert.match(mediaStyle, /--d2-media-cyan:#46c6e8/, 'Media v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(mediaStyle, /--d-gold/, 'Media v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.match(mediaStyle, /\.btn\{[\s\S]*?min-height:44px;/, 'Media buttons must preserve a 44px touch target');
assert.match(mediaStyle, /safe-area-inset-bottom/, 'Media v2 must respect iPhone safe areas');
assert.match(mediaStyle, /prefers-reduced-motion:reduce/, 'Media v2 motion must respect reduced-motion preferences');
assert.match(mediaStyle, /forced-colors:active/, 'Media v2 must remain legible in forced-colors mode');
assert.match(mediaStyle, /focus-visible[\s\S]*--d2-media-violet-hi/, 'Media v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(mediaStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Media v2 must not hide existing Media information or actions');
assert.doesNotMatch(mediaStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Media v2 must not create page-level viewport overflow');
assert.doesNotMatch(mediaStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Media v2 must not hide scroll affordances');
assert.doesNotMatch(mediaStyle, /https?:\/\//, 'Media v2 must not add remote runtime assets');
for (const label of ['広報・SNS','TYCOON WEEKLY','大型ビジネスニュース','広報履歴','ベンチャーフォーラム','高級品オークション']) {
  assert.ok(app.includes(label), `Media v2 must retain Media destination: ${label}`);
}
for (const action of ['media-action','venture-forum','auction-bid']) {
  assert.ok(app.includes(action), `Media v2 must retain existing Media action: ${action}`);
}

console.log('D UI v2 runtime stylesheet contract passed');
