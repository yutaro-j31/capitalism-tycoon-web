const { spawnSync } = require('node:child_process');
const { readIndex, extractScripts } = require('./harness');

const scripts = extractScripts(readIndex()).filter(script => script.src).map(script => script.src);
const executiveSecretaryIndex = scripts.indexOf('./js/executive-secretary.js');
const ceoDashboardIndex = scripts.indexOf('./js/ceo-dashboard.js');
const appIndex = scripts.indexOf('./js/app.js');
if (!(executiveSecretaryIndex >= 0 && ceoDashboardIndex > executiveSecretaryIndex && appIndex > ceoDashboardIndex)) {
  throw new Error('ceo-dashboard.js must load after executive-secretary.js and before app.js');
}

const checks = ['tests/d-ui-shell-test.js', 'tests/javascript-module-split-test.js', 'tests/javascript-extraction-test.js'];
for (const file of checks) {
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status) process.exit(result.status || 1);
}
console.log('D UI contract aggregate tests passed');
