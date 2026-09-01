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
const settingsStyle = fs.readFileSync('css/d-ui-settings.css', 'utf8');
const missionsStyle = fs.readFileSync('css/d-ui-missions.css', 'utf8');
const newsStyle = fs.readFileSync('css/d-ui-news.css', 'utf8');
const legacyStyle = fs.readFileSync('css/d-ui-legacy.css', 'utf8');
const mapStyle = fs.readFileSync('css/d-ui-map.css', 'utf8');
const mapFocusStyle = fs.readFileSync('css/d-ui-map-focus.css', 'utf8');
const contextTabsScript = fs.readFileSync('js/d-ui-context-tabs.js', 'utf8');
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

assert.ok(mobileStyle.includes('@import url("./d-ui-settings.css");'), 'runtime mobile/company chain must import the Settings stylesheet');
assert.match(settingsStyle, /body\.d-ui-active \[data-screen="settings"\]\{/, 'Settings v2 must stay scoped to the active Settings screen');
assert.match(settingsStyle, /--d2-settings-violet:#7c5cff/, 'Settings v2 must use the approved violet primary accent');
assert.match(settingsStyle, /--d2-settings-blue:#5c8dff/, 'Settings v2 must retain the approved blue data accent');
assert.match(settingsStyle, /--d2-settings-cyan:#46c6e8/, 'Settings v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(settingsStyle, /--d-gold/, 'Settings v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.match(settingsStyle, /\.btn\{min-height:44px;/, 'Settings buttons must preserve a 44px touch target');
// 設定行はチェックボックス本体が22pxしかないので、ラベル行全体を44pxのタップ対象として固定する。
assert.match(settingsStyle, /\.switch-row\{[^}]*min-height:44px;/, 'Settings toggle rows must expose a 44px touch target around the 22px checkbox');
assert.match(settingsStyle, /\.field select,[^}]*min-height:44px;/, 'Settings select controls must preserve a 44px touch target');
// セーブ容量不足の警告は css/app.css に .notice の定義が無く素の<div>だったため、ここで枠を与えている。
assert.match(settingsStyle, /\.notice\.warning\{[^}]*border-color:rgba\(242,184,75/, 'Settings storage warning must be visibly flagged with the D UI v2 warning accent');
assert.match(settingsStyle, /\.btn\.danger\{[^}]*rgba\(255,102,117/, 'Settings destructive actions must stay visually distinct with the negative accent');
assert.match(settingsStyle, /safe-area-inset-bottom/, 'Settings v2 must respect iPhone safe areas');
assert.match(settingsStyle, /prefers-reduced-motion:reduce/, 'Settings v2 motion must respect reduced-motion preferences');
assert.match(settingsStyle, /forced-colors:active/, 'Settings v2 must remain legible in forced-colors mode');
assert.match(settingsStyle, /focus-visible[\s\S]*--d2-settings-violet-hi/, 'Settings v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(settingsStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Settings v2 must not hide existing Settings information or actions');
assert.doesNotMatch(settingsStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Settings v2 must not create page-level viewport overflow');
assert.doesNotMatch(settingsStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Settings v2 must not hide scroll affordances');
assert.doesNotMatch(settingsStyle, /https?:\/\//, 'Settings v2 must not add remote runtime assets');
for (const label of ['ゲーム設定','セーブ管理','セーブスロット','データ情報','危険な操作','会社売却・エンディング']) {
  assert.ok(app.includes(label), `Settings v2 must retain Settings destination: ${label}`);
}
for (const action of ['save-now','export-save','import-save','save-slot','load-slot','reset-game','company-buyout','restore-stored-save','dismiss-stored-save']) {
  assert.ok(app.includes(action), `Settings v2 must retain existing Settings action: ${action}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-missions.css");'), 'runtime mobile/company chain must import the Missions stylesheet');
assert.match(missionsStyle, /body\.d-ui-active \[data-screen="missions"\]\{/, 'Missions v2 must stay scoped to the active Missions screen');
assert.match(missionsStyle, /--d2-missions-violet:#7c5cff/, 'Missions v2 must use the approved violet primary accent');
assert.match(missionsStyle, /--d2-missions-blue:#5c8dff/, 'Missions v2 must retain the approved blue data accent');
assert.match(missionsStyle, /--d2-missions-cyan:#46c6e8/, 'Missions v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(missionsStyle, /--d-gold/, 'Missions v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
// 完了ミッションはpositive、進行中はvioletで区別する。gold不使用でも状態が視覚的に分かることを固定する。
assert.match(missionsStyle, /\.mission\.done>span\{[^}]*color:var\(--d2-missions-positive\)/, 'Completed missions must be distinguished with the positive accent, not gold');
assert.match(missionsStyle, /safe-area-inset-bottom/, 'Missions v2 must respect iPhone safe areas');
assert.match(missionsStyle, /prefers-reduced-motion:reduce/, 'Missions v2 motion must respect reduced-motion preferences');
assert.match(missionsStyle, /forced-colors:active/, 'Missions v2 must remain legible in forced-colors mode');
assert.doesNotMatch(missionsStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Missions v2 must not hide existing Missions information or actions');
assert.doesNotMatch(missionsStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Missions v2 must not create page-level viewport overflow');
assert.doesNotMatch(missionsStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Missions v2 must not hide scroll affordances');
assert.doesNotMatch(missionsStyle, /https?:\/\//, 'Missions v2 must not add remote runtime assets');
for (const label of ['ミッション','実績','長期目標','業界ランキング','受賞歴']) {
  assert.ok(app.includes(label), `Missions v2 must retain Missions destination: ${label}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-news.css");'), 'runtime mobile/company chain must import the News stylesheet');
assert.match(newsStyle, /body\.d-ui-active \[data-screen="news"\]\{/, 'News v2 must stay scoped to the active News screen');
assert.match(newsStyle, /--d2-news-violet:#7c5cff/, 'News v2 must use the approved violet primary accent');
assert.match(newsStyle, /--d2-news-blue:#5c8dff/, 'News v2 must retain the approved blue data accent');
assert.match(newsStyle, /--d2-news-cyan:#46c6e8/, 'News v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(newsStyle, /--d-gold/, 'News v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.match(newsStyle, /safe-area-inset-bottom/, 'News v2 must respect iPhone safe areas');
assert.match(newsStyle, /prefers-reduced-motion:reduce/, 'News v2 motion must respect reduced-motion preferences');
assert.match(newsStyle, /forced-colors:active/, 'News v2 must remain legible in forced-colors mode');
assert.doesNotMatch(newsStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'News v2 must not hide existing News information');
assert.doesNotMatch(newsStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'News v2 must not create page-level viewport overflow');
assert.doesNotMatch(newsStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'News v2 must not hide scroll affordances');
assert.doesNotMatch(newsStyle, /https?:\/\//, 'News v2 must not add remote runtime assets');
for (const label of ['ニュース履歴','週次経営履歴']) {
  assert.ok(app.includes(label), `News v2 must retain News destination: ${label}`);
}
// enhanceNews()（js/d-ui-context-tabs.js）が実行時にnews画面のDOMを
// TYCOON WEEKLY 6面タブへ丸ごと差し替えるため、renderNews()の素のHTMLは
// 実際には画面に残らない。実際に表示される構造をここで固定する。
assert.match(contextTabsScript, /data-d-news-sections/, 'News v2 must retain the TYCOON WEEKLY newspaper enhancer structure');
for (const section of ['top','retail','management','stock','politics','sports']) {
  assert.ok(contextTabsScript.includes(`'${section}'`) || contextTabsScript.includes(`"${section}"`), `News v2 must retain the TYCOON WEEKLY section: ${section}`);
}
// news画面限定のoverride: 共有.d-context-tabs[role=tablist]は店舗詳細ドリルダウン
// （未移行）とも共用でgold定義のまま残っているが、news側だけviolet化する。
assert.match(newsStyle, /\[data-screen="news"\] \.d-context-tabs\[role="tablist"\] button\[aria-selected="true"\]\{[^}]*color:var\(--d2-news-violet-hi\)/, 'News v2 must recolor the TYCOON WEEKLY active section tab to violet, not gold');
assert.match(newsStyle, /\[data-screen="news"\] \.d-context-tabs\[role="tablist"\] button::after\{[^}]*background:var\(--d2-news-violet\)/, 'News v2 must recolor the TYCOON WEEKLY tab underline to violet, not gold');
// 小売/経営/政治面の記事カード（articleRows()が出す.media-article）もnews画面側でカバーする。
assert.match(newsStyle, /\[data-screen="news"\] \.media-article\{[^}]*border-bottom-color/, 'News v2 must restyle TYCOON WEEKLY article cards (retail/management/politics sections)');
// 政治面のマクロKPI（politicsNewsContent()の.kpi-grid mini/.stat）もnews画面側でカバーする。
assert.match(newsStyle, /\[data-screen="news"\] \.stat\{[^}]*border:1px solid rgba\(151,171,214,\.14\)/, 'News v2 must restyle TYCOON WEEKLY policy KPI stats (politics section)');

assert.ok(mobileStyle.includes('@import url("./d-ui-legacy.css");'), 'runtime mobile/company chain must import the Legacy stylesheet');
assert.match(legacyStyle, /body\.d-ui-active \[data-screen="legacy"\]\{/, 'Legacy v2 must stay scoped to the active Legacy screen');
assert.match(legacyStyle, /--d2-legacy-violet:#7c5cff/, 'Legacy v2 must use the approved violet primary accent');
assert.match(legacyStyle, /--d2-legacy-blue:#5c8dff/, 'Legacy v2 must retain the approved blue data accent');
assert.match(legacyStyle, /--d2-legacy-cyan:#46c6e8/, 'Legacy v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(legacyStyle, /--d-gold/, 'Legacy v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
// css/app.css の .progress i と .ending-record>span はgoldを使っているため、legacy画面限定で上書きする。
assert.match(legacyStyle, /\[data-screen="legacy"\] \.progress i\{background:linear-gradient\(90deg,var\(--d2-legacy-violet\),var\(--d2-legacy-blue\),var\(--d2-legacy-cyan\)\)/, 'Legacy v2 must recolor the successor readiness bar away from gold');
assert.match(legacyStyle, /\[data-screen="legacy"\] \.ending-record>span\{[^}]*background:linear-gradient\(145deg,rgba\(124,92,255/, 'Legacy v2 must recolor ending/hall-of-fame badges away from gold, consistent with Missions v2');
// css/app.css に .check-list の定義が無く素の<ul>だったため、legacy画面側で最低限のリスト整形を与える。
assert.match(legacyStyle, /\[data-screen="legacy"\] \.check-list\{[^}]*list-style:none/, 'Legacy v2 must style the retirement checklist (previously an unstyled bare <ul>)');
assert.match(legacyStyle, /\.btn\{[\s\S]*?min-height:44px;/, 'Legacy buttons must preserve a 44px touch target');
assert.match(legacyStyle, /safe-area-inset-bottom/, 'Legacy v2 must respect iPhone safe areas');
assert.match(legacyStyle, /prefers-reduced-motion:reduce/, 'Legacy v2 motion must respect reduced-motion preferences');
assert.match(legacyStyle, /forced-colors:active/, 'Legacy v2 must remain legible in forced-colors mode');
assert.match(legacyStyle, /focus-visible[\s\S]*--d2-legacy-violet-hi/, 'Legacy v2 keyboard focus must use the D UI v2 violet accent');
assert.doesNotMatch(legacyStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Legacy v2 must not hide existing Legacy information or actions');
assert.doesNotMatch(legacyStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Legacy v2 must not create page-level viewport overflow');
assert.doesNotMatch(legacyStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Legacy v2 must not hide scroll affordances');
assert.doesNotMatch(legacyStyle, /https?:\/\//, 'Legacy v2 must not add remote runtime assets');
for (const label of ['経営承継・ファミリートラスト','引退と世代交代','後継者','ファミリートラスト','エンディング・称号','殿堂記録','歴代会社・連続起業記録']) {
  assert.ok(app.includes(label), `Legacy v2 must retain Legacy destination: ${label}`);
}
for (const action of ['retire-founder','train-successor','execute-succession','appoint-successor','transfer-trust','establish-trust','download-result-card','new-company']) {
  assert.ok(app.includes(action), `Legacy v2 must retain existing Legacy action: ${action}`);
}

assert.ok(mobileStyle.includes('@import url("./d-ui-map.css");'), 'runtime mobile/company chain must import the Map stylesheet');
assert.match(mapStyle, /body\.d-ui-active \[data-screen="map"\]\{/, 'Map v2 must stay scoped to the active Map screen');
assert.match(mapStyle, /--d2-map-violet:#7c5cff/, 'Map v2 must use the approved violet primary accent');
assert.match(mapStyle, /--d2-map-blue:#5c8dff/, 'Map v2 must retain the approved blue data accent');
assert.match(mapStyle, /--d2-map-cyan:#46c6e8/, 'Map v2 must retain the approved cyan secondary accent');
assert.doesNotMatch(mapStyle, /--d-gold/, 'Map v2 must not reintroduce gold as a primary accent (prestige-only elsewhere)');
assert.doesNotMatch(mapFocusStyle, /#ffe097|rgba\(217,168,77/, 'Map marker focus-visible outline must not use gold (recolored to violet)');
// 4種類のマーカー: 出店済み店舗=blue, 未出店テナント候補=negative(赤), オフィス候補=violet, 不動産候補(新設)=cyan
assert.match(mapStyle, /\[data-screen="map"\] \.d-map-marker\.store\{background:linear-gradient\(180deg,#6f9cff/, 'Map v2 must color store markers blue');
assert.match(mapStyle, /\[data-screen="map"\] \.d-map-marker\.tenant\{background:linear-gradient\(180deg,#ff8f9b/, 'Map v2 must color unopened tenant-candidate markers with the negative accent');
assert.match(mapStyle, /\[data-screen="map"\] \.d-map-marker\.office\{background:linear-gradient\(180deg,#9a7cff/, 'Map v2 must color office-candidate markers violet');
assert.match(mapStyle, /\[data-screen="map"\] \.d-map-marker\.realestate\{background:linear-gradient\(180deg,#5fdcf5/, 'Map v2 must color the new real-estate-candidate markers cyan');
// 週間利益推移・ミッション・企業ニュースの白背景カードは他18画面と同じダークカードへ統一する
assert.match(mapStyle, /\[data-screen="map"\] \.d-white-card\{[^}]*background:linear-gradient\(150deg,rgba\(15,23,41,\.97\)/, 'Map v2 must darken the overlay cards away from the white "paper card" look');
assert.match(mapStyle, /\[data-screen="map"\] \.d-context-panel>header span\{color:var\(--d2-map-cyan\)\}/, 'Map v2 context panel header accent must not use gold');
assert.match(mapStyle, /\[data-screen="map"\] \.d-context-tabs b\{box-shadow:inset 0 -2px 0 var\(--d2-map-violet\)\}/, 'Map v2 context panel active tab underline must use violet, not gold');
assert.match(mapStyle, /\[data-screen="map"\] \.d-map-directory>summary\{color:var\(--d2-map-violet-hi\)\}/, 'Map v2 directory summary must use violet, not gold');
// マップ画面はcss/d-ui.cssのシェルchrome（.d-map-workspace / .d-bottom-dock）が既にsafe-area対応済みで、
// 他18画面のような画面固有padding-bottomは不要（レイアウト構造がfixed shell内で完結するため）。
assert.match(mapStyle, /prefers-reduced-motion:reduce/, 'Map v2 motion must respect reduced-motion preferences');
assert.match(mapStyle, /forced-colors:active/, 'Map v2 must remain legible in forced-colors mode');
assert.doesNotMatch(mapStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'Map v2 must not hide existing Map information');
assert.doesNotMatch(mapStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'Map v2 must not create page-level viewport overflow');
assert.doesNotMatch(mapStyle, /scrollbar-width\s*:\s*none|::-webkit-scrollbar[^}]*display\s*:\s*none/s, 'Map v2 must not hide scroll affordances');
assert.doesNotMatch(mapStyle, /https?:\/\//, 'Map v2 must not add remote runtime assets');
// terrain (city surface color, iso-hue building palette, roads/water/parks) is deliberately untouched in Phase A
assert.doesNotMatch(mapStyle, /d-iso-|d-city-surface|d-water|d-road-grid/, 'Map v2 (Phase A) must not touch terrain rendering, only UI chrome');

// real-estate candidate markers (new entity kind) must be wired into js/d-ui-shell.js
assert.match(shell, /kind:'realestate'/, 'Map v2 must add a real-estate entity kind to mapEntities()');
assert.match(shell, /buy-property-company/, 'Map v2 real-estate markers must reuse the existing buy-property-company action');
assert.match(shell, /buy-property-personal/, 'Map v2 real-estate markers must reuse the existing buy-property-personal action');
assert.match(shell, /entity\.kind===['"]realestate['"]/, 'Map v2 must render a dedicated context-panel detail view for real-estate candidates');
for (const label of ['出店候補・不動産・オフィス一覧を開く']) {
  assert.ok(shell.includes(label), `Map v2 must retain Map destination: ${label}`);
}
for (const action of ['open-store','contract-office','contract-branch-office']) {
  assert.ok(shell.includes(action), `Map v2 must retain existing Map marker action: ${action}`);
}

console.log('D UI v2 runtime stylesheet contract passed');
