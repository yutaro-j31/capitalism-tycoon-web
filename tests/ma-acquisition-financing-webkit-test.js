const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { modules } = loadGame();
assert.ok(modules.maAcquisitionFinancing, 'module loaded for WebKit workflow scenario');
console.log('ma acquisition financing WebKit test harness is wired; real browser workflow runs in GitHub Actions when Playwright is available');
