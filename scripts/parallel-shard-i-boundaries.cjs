'use strict';
// Read-only, bounded lexical inventory. Hits are candidates, never a safety verdict.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const cp = require('node:child_process'), crypto = require('node:crypto');
const runner = require('./parallel-shard-runner');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inventory(root, commands, maxDepth = 2) {
  root = fs.realpathSync(root);
  assert.ok(Number.isInteger(maxDepth) && maxDepth >= 0 && maxDepth <= 8);
  const read = file => {
    const abs = fs.realpathSync(path.resolve(root, file));
    assert.ok(abs.startsWith(root + path.sep), 'source path must stay inside root, including symlinks');
    return fs.readFileSync(abs, 'utf8');
  };
  const packageText = read('package.json'), scripts = JSON.parse(packageText).scripts || {};
  const invocations = commands.map(command => {
    const gaps = [], files = [], seen = new Set();
    let entry = null, npmScript = null;
    if (command.command === 'node' && command.args.length === 1 && !command.args[0].startsWith('-')) entry = command.args[0];
    else if (command.command === 'npm' && command.args.length === 3 && command.args[0] === 'run' && command.args[2] === '--silent') {
      npmScript = scripts[command.args[1]] ?? null;
      // No shell interpretation: only the exact simple Node script form is resolved.
      const match = typeof npmScript === 'string' && /^node (tests\/[\w./-]+\.c?js)$/.exec(npmScript);
      if (match) entry = match[1]; else gaps.push({ kind: 'unresolved-npm-script', script: command.args[1] });
    } else gaps.push({ kind: 'unresolved-command' });
    const walk = (file, depth) => {
      file = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
      if (seen.has(file)) return;
      assert.ok(seen.size < 128, 'bounded dependency inventory exceeded'); seen.add(file);
      const text = read(file), hits = [];
      const patterns = [
        ['filesystem', /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|mkdir(?:Sync)?|mkdtemp(?:Sync)?|createWriteStream|rename(?:Sync)?|copyFile(?:Sync)?|unlink(?:Sync)?|rm(?:Sync)?|openSync)\s*\(/g],
        ['child-process', /\b(?:spawn(?:Sync)?|execFile(?:Sync)?|execSync|fork)\s*\(|(?:node:)?child_process/g],
        ['port', /\b(?:listen|bind|createServer)\s*\(/g],
        ['temporary-path', /tmpdir\s*\(|\/tmp\//g],
        ['dynamic-code', /\b(?:runInContext|runInNewContext|runInThisContext|eval)\s*\(|new\s+(?:vm\.)?Script\s*\(/g]
      ];
      for (const [kind, pattern] of patterns) for (const match of text.matchAll(pattern)) hits.push({ kind,
        line: text.slice(0, match.index).split('\n').length, token: match[0] });
      files.push({ path: file, sha256: hash(text), depth, hits: hits.sort((a,b) => a.line-b.line || a.kind.localeCompare(b.kind)) });
      // Deliberately lexical: comments/strings may match and dynamic requires may not.
      for (const match of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const specifier = match[1];
        if (!specifier.startsWith('.')) continue;
        const base = path.resolve(root, path.dirname(file), specifier);
        const target = [base, `${base}.js`, `${base}.cjs`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!target) { gaps.push({ kind: 'unresolved-relative-require', from: file, specifier }); continue; }
        const relative = path.relative(root, target).split(path.sep).join('/');
        if (depth >= maxDepth) gaps.push({ kind: 'depth-boundary', from: file, target: relative });
        else walk(relative, depth + 1);
      }
    };
    if (entry) walk(entry, 0);
    return { ...command, entry, npmScript, files, gaps };
  });
  return { schema: 'i-source-boundary-inventory-v1', packageSha256: hash(packageText), maxDepth, invocations,
    lexicalCandidatesOnly: true, dependencyClosureVerified: false, runtimeExecuted: false,
    sharedWriteSafetyQualified: false, parallelExecutionQualified: false, productionAuthorized: false };
}
function manifest(root, pin) {
  root = path.resolve(root); assert.match(pin, /^[a-f0-9]{40}$/, 'explicit full source SHA required');
  const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const check = () => { assert.equal(git(['rev-parse', 'HEAD']), pin, 'source pin mismatch');
    assert.equal(git(['status', '--porcelain']), '', 'source tree must be clean including untracked files'); };
  check();
  const commands = runner.enumerateShard('I', { root });
  assert.equal(commands.length, 8, 'I8 invocation contract required');
  const report = inventory(root, commands);
  check();
  return { sourceSha: pin, enumerationDigest: runner.digestOf(commands), ...report };
}
module.exports = { inventory, manifest };
if (require.main === module) {
  try { assert.equal(process.argv.length, 4, 'usage: i-boundaries.cjs ROOT FULL_SOURCE_SHA');
    console.log(JSON.stringify(manifest(process.argv[2], process.argv[3]), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
