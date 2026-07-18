'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readIndex } = require('./harness');

const html = readIndex();
const scriptPath = path.join(ROOT, 'js', 'd-ui-shell.js');
const stylePath = path.join(ROOT, 'css', 'd-ui.css');
assert.ok(fs.existsSync(scriptPath), 'D UI shell script is required');
assert.ok(fs.existsSync(stylePath), 'D UI stylesheet is required');
const script = fs.readFileSync(scriptPath, 'utf8');
const style = fs.readFileSync(stylePath, 'utf8');

assert.match(html, /<link[^>]+href="\.\/css\/d-ui\.css"/i, 'D UI stylesheet must load from index');
assert.match(html, /<script[^>]+src="\.\/js\/d-ui-shell\.js"/i, 'D UI shell must load from index');
const playtestIndex = html.indexOf('src="./js/playtest-report-ui.js"');
const shellIndex = html.indexOf('src="./js/d-ui-shell.js"');
const recoveryIndex = html.indexOf('src="./js/runtime-recovery-ui.js"');
assert.ok(playtestIndex !== -1 && shellIndex > playtestIndex, 'D UI shell must load after playtest reporting');
assert.ok(recoveryIndex > shellIndex, 'runtime recovery must remain after the D UI shell');

for (const label of ['マップ','本社','店舗','資金調達','研究開発','採用','危機対応','実績','目標','一週進める']) {
  assert.ok(script.includes(label), `D UI shell is missing ${label}`);
}
for (const token of ['d-kpi-strip','d-sidebar','d-map-workspace','d-context-panel','d-bottom-dock','d-command-menu']) {
  assert.ok(script.includes(token) || style.includes(token), `D UI contract is missing ${token}`);
}
assert.match(script, /modules\.playerEngineBridge\.getEngine/, 'D UI must reuse the existing engine instance');
assert.match(script, /data-action="tab"/, 'D UI navigation must use the existing tab action contract');
assert.match(script, /data-action="open-store"/, 'D UI tenant action must preserve the existing open-store action');
assert.match(script, /if\(open\)menu\.querySelector\('\[data-d-ui-action="toggle-menu"\]'\)\?\.focus\(\)/, 'opening the command menu must move focus into the dialog');
assert.match(script, /setCommandMenu\(open,!open\)/, 'pointer dismissal must restore focus to the menu trigger');
assert.match(script, /setCommandMenu\(false,true\)/, 'Escape dismissal must restore focus to the menu trigger');
assert.match(script, /event\.target===menu[\s\S]*setCommandMenu\(false,true\)/, 'backdrop activation must close the command menu and restore trigger focus');
assert.match(script, /if\(event\.key!==['"]Tab['"]\)return false/, 'command menu must handle Tab only while open');
assert.match(script, /menu\.querySelectorAll\('button:not\(\[disabled\]\)/, 'command menu must enumerate focusable controls');
assert.match(script, /event\.shiftKey&&active===first/, 'Shift+Tab must wrap to the final command');
assert.match(script, /!event\.shiftKey&&active===last/, 'Tab must wrap to the first command');
assert.match(script, /!menu\.contains\(active\)/, 'focus escaping the open dialog must be recovered');
assert.doesNotMatch(script, /localStorage\.(?:setItem|removeItem|clear)/, 'D UI shell must not mutate save storage directly');
assert.doesNotMatch(script, /Math\.random/, 'D UI marker placement must remain deterministic');
assert.doesNotMatch(script + style, /https?:\/\//, 'D UI shell must not add remote runtime assets');
assert.match(style, /@media\(max-width:820px\)/, 'D UI must include an iPhone layout');
assert.match(style, /grid-template-columns:minmax\(480px,1fr\) 350px 300px/, 'desktop D layout columns are missing');
assert.match(style, /--d-gold:/, 'D UI design tokens are missing');

console.log('D UI shell contract passed');
