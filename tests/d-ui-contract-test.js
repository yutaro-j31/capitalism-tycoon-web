const { spawnSync } = require('node:child_process');
const checks = ['tests/d-ui-shell-test.js', 'tests/javascript-module-split-test.js', 'tests/javascript-extraction-test.js'];
for (const file of checks) {
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status) process.exit(result.status || 1);
}
console.log('D UI contract aggregate tests passed');
