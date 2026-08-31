const fs = require('node:fs');
const assert = require('node:assert/strict');

const index = fs.readFileSync('index.html', 'utf8');
const bridge = fs.readFileSync('css/d-ui-context-tabs.css', 'utf8');

assert.match(index, /href="\.\/css\/d-ui-context-tabs\.css"/, 'runtime must load the D UI stylesheet bridge');
const imports = [
  '@import url("./d-ui-home.css");',
  '@import url("./d-ui-finance.css");',
  '@import url("./d-ui-business.css");'
];
for (const statement of imports) {
  assert.ok(bridge.includes(statement), `runtime bridge must include ${statement}`);
}
const firstRule = bridge.search(/\n[^@/\s][^{]*\{/);
for (const statement of imports) {
  const position = bridge.indexOf(statement);
  assert.ok(position >= 0 && (firstRule < 0 || position < firstRule), `${statement} must remain before normal CSS rules`);
}
for (const file of ['css/d-ui-home.css','css/d-ui-finance.css','css/d-ui-business.css']) {
  assert.ok(fs.existsSync(file), `${file} must exist for runtime import`);
  assert.ok(fs.statSync(file).size > 0, `${file} must not be empty`);
}
assert.doesNotMatch(bridge, /d-ui-market\.css/, 'market stylesheet stays out until its dedicated v2 migration PR');
console.log('D UI v2 runtime stylesheet contract passed');
