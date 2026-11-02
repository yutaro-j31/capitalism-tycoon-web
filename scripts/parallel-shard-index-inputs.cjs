'use strict';
// Match the harness's lexical script extraction, but never compile/execute game code.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const cp = require('node:child_process'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inventory(root) {
  root = fs.realpathSync(root);
  const read = file => {
    const target = fs.realpathSync(path.resolve(root, file));
    assert.ok(target.startsWith(root + path.sep), 'script path escapes root, including symlinks');
    return fs.readFileSync(target);
  };
  const bytes = read('index.html'), html = bytes.toString('utf8'), scripts = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))
      attrs[attr[1].toLowerCase()] = attr[3] ?? attr[4] ?? attr[5] ?? '';
    const record = { index: scripts.length, startLine: html.slice(0, match.index).split(/\r?\n/).length, attrs };
    if (attrs.src !== undefined) {
      const src = attrs.src;
      assert.ok(src && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src) && !path.isAbsolute(src) && !src.includes('\\'),
        'script src must be a local relative path');
      const file = src.split(/[?#]/)[0];
      assert.ok(file, 'script src must name a file');
      const data = read(file);
      scripts.push({ ...record, kind: 'local', src, path: path.relative(root, path.resolve(root, file)).split(path.sep).join('/'),
        bytes: data.length, sha256: hash(data) });
    } else {
      const code = Buffer.from(match[2]);
      scripts.push({ ...record, kind: 'inline', bytes: code.length, sha256: hash(code) });
    }
  }
  assert.ok(scripts.length, 'index must contain script inputs');
  return { schema: 'harness-index-inputs-v1', indexSha256: hash(bytes), scripts,
    scriptCount: scripts.length, localScriptCount: scripts.filter(s => s.kind === 'local').length,
    inlineScriptCount: scripts.filter(s => s.kind === 'inline').length,
    // All script elements are inventory candidates, including non-JS types, like the harness.
    lexicalInventoryOnly: true, gameCodeExecuted: false, dependencyClosureVerified: false,
    sharedWriteSafetyQualified: false, parallelExecutionQualified: false, productionAuthorized: false };
}
function manifest(root, pin) {
  root = path.resolve(root); assert.match(pin, /^[a-f0-9]{40}$/, 'full source SHA required');
  const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const check = () => { assert.equal(git(['rev-parse', 'HEAD']), pin, 'source pin mismatch');
    assert.equal(git(['status', '--porcelain']), '', 'clean source including untracked files required'); };
  check();
  const report = inventory(root);
  const harnessFile = fs.realpathSync(path.join(root, 'tests/harness.js'));
  assert.ok(harnessFile.startsWith(fs.realpathSync(root) + path.sep), 'harness path escapes root');
  const harnessSha256 = hash(fs.readFileSync(harnessFile));
  check();
  return { sourceSha: pin, harnessSha256, ...report };
}
module.exports = { inventory, manifest };
if (require.main === module) {
  try { assert.equal(process.argv.length, 4, 'usage: index-inputs.cjs ROOT FULL_SOURCE_SHA');
    console.log(JSON.stringify(manifest(process.argv[2], process.argv[3]), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
