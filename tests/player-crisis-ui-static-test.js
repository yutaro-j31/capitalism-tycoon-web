const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'js', 'player-crisis-ui.js'), 'utf8');

const crisisIndex = html.indexOf('./js/player-crisis.js');
const actionsIndex = html.indexOf('./js/player-crisis-actions.js');
const uiIndex = html.indexOf('./js/player-crisis-ui.js');
const appIndex = html.indexOf('./js/app.js');
assert.ok(crisisIndex >= 0 && crisisIndex < actionsIndex, 'crisis lifecycle must load before actions');
assert.ok(actionsIndex < uiIndex && uiIndex < appIndex, 'crisis UI must capture the engine before app startup');
assert.match(source, /data-player-crisis-panel/);
assert.match(source, /data-crisis-action="founder"/);
assert.match(source, /data-crisis-action="bridge"/);
assert.match(source, /instance\.injectFounderCapital\(amount\)/);
assert.match(source, /instance\.requestEmergencyBridgeLoan\(\)/);
assert.match(source, /screen\.prepend\(panel\)/);
assert.match(source, /status==='stable'\|\|status==='insolvent'/);
assert.match(source, /button\.disabled/);
assert.ok(!source.includes('innerHTML+=') && !source.includes('document.write'), 'panel must not use destructive document writes');
assert.ok(source.length < 12_000, 'mobile UI module must remain bounded');

console.log('player crisis UI static test passed');
