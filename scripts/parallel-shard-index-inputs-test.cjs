'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto'), { inventory } = require('./parallel-shard-index-inputs.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'index-inputs-'));
try {
  fs.mkdirSync(path.join(root,'js'));
  const source = "throw Error('MUST NOT EXECUTE');\n";
  fs.writeFileSync(path.join(root,'js/a.js'),source);
  const write = html => fs.writeFileSync(path.join(root,'index.html'),html);
  write('<!doctype html>\r\n<SCRIPT SRC="./js/a.js?rev=123#v" defer></SCRIPT>\n<script>throw Error("inline must not run");</script>\n<script src=js/a.js></script>');
  const report = inventory(root);
  assert.equal(report.scriptCount,3); assert.equal(report.localScriptCount,2); assert.equal(report.inlineScriptCount,1);
  assert.equal(report.scripts[0].startLine,2); assert.equal(report.scripts[0].path,'js/a.js');
  assert.equal(report.scripts[0].src,'./js/a.js?rev=123#v');
  assert.equal(report.scripts[0].sha256,report.scripts[2].sha256,'repeated inputs preserve invocation order');
  assert.equal(report.scripts[0].bytes,Buffer.byteLength(source));
  assert.equal(report.gameCodeExecuted,false); assert.equal(report.dependencyClosureVerified,false);
  assert.equal(report.sharedWriteSafetyQualified,false); assert.equal(report.parallelExecutionQualified,false);
  assert.equal(report.productionAuthorized,false);
  fs.writeFileSync(path.join(root,'js/a.js'),source+'// change');
  assert.notEqual(inventory(root).scripts[0].sha256,report.scripts[0].sha256);
  for (const src of ['https://example.com/a.js','//example.com/a.js','/tmp/a.js','../escape.js','?rev=1','']) {
    write(`<script src="${src}"></script>`); assert.throws(()=>inventory(root));
  }
  fs.symlinkSync(__filename,path.join(root,'js/escape.js'));
  write('<script src="js/escape.js"></script>'); assert.throws(()=>inventory(root),/escapes root/);
  write('<p>no scripts</p>'); assert.throws(()=>inventory(root),/script inputs/);
} finally { fs.rmSync(root,{recursive:true,force:true}); }
// Current repository contract: compare metadata to the actual harness extractor only.
// No loadGame/VM compilation or workload execution occurs.
const repo = path.resolve(__dirname,'..'), actual = inventory(repo);
const expected = require('../tests/harness').extractScripts();
assert.equal(actual.scripts.length,expected.length);
for (const [i, script] of expected.entries()) {
  const row=actual.scripts[i];
  assert.equal(row.startLine,script.startLine); assert.deepEqual(row.attrs,script.parsedAttrs);
  assert.equal(row.sha256,crypto.createHash('sha256').update(script.code).digest('hex'));
  if (script.file) assert.equal(row.path,path.relative(repo,script.file).split(path.sep).join('/'));
  else assert.equal(row.kind,'inline');
}
console.log(`Harness index inputs: PASS (${actual.scriptCount} lexical inputs; no game execution or safety qualification)`);
