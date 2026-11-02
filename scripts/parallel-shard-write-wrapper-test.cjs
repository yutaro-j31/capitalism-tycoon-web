'use strict';

// Small owned fixtures only: npm wrappers are not evidence of complete descendant coverage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { prepare, collect } = require('./parallel-shard-write-observation.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'write-wrapper-'));
try {
  const project = path.join(directory, 'project');
  fs.mkdirSync(project);
  const effect = path.join(project, 'effect.json');
  const childFile = path.join(project, 'child.cjs');
  fs.writeFileSync(childFile, `require('node:fs').writeFileSync(${JSON.stringify(effect)}, JSON.stringify({pid:process.pid,node:process.version,value:'fixture'}));process.stdout.write('wrapper-control\\n');process.stderr.write('expected stderr\\n');`);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'write-wrapper-control', version: '1.0.0', scripts: { probe: 'node child.cjs' } }));
  const userConfig = path.join(directory, 'user.npmrc'), globalConfig = path.join(directory, 'global.npmrc');
  fs.writeFileSync(userConfig, ''); fs.writeFileSync(globalConfig, '');
  const env = { ...process.env, NODE_OPTIONS: '',
    NPM_CONFIG_USERCONFIG: userConfig, NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_CACHE: path.join(directory, 'cache'), NPM_CONFIG_OFFLINE: 'true',
    NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_UPDATE_NOTIFIER: 'false', NPM_CONFIG_LOGS_MAX: '0' };
  delete env.PSR_WRITE_AUDIT_DIR;
  const run = command => {
    const result = cp.spawnSync(command.command, command.args, { cwd: project, env: command.env,
      timeout: 15000, maxBuffer: 1024 * 1024 });
    assert.ifError(result.error);
    assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr?.toString());
    return result;
  };
  const npm = { label: 'npm-wrapper-control', command: 'npm', args: ['run', 'probe', '--silent'], env };
  const baseline = run(npm);
  assert.equal(baseline.stdout.toString(), 'wrapper-control\n');
  assert.equal(baseline.stderr.toString(), 'expected stderr\n');
  fs.unlinkSync(effect);
  const commands = prepare([npm], path.join(directory, 'npm-audit'));
  const wrapped = run(commands[0]);
  assert.deepEqual(wrapped.stdout, baseline.stdout); assert.deepEqual(wrapped.stderr, baseline.stderr);
  const child = JSON.parse(fs.readFileSync(effect, 'utf8'));
  assert.equal(child.node, process.version); assert.equal(child.value, 'fixture');
  assert.notEqual(child.pid, wrapped.pid);
  const trace = (command, result) => [{ command: command.command, args: command.args, pid: result.pid }];
  const observed = collect(commands, trace(commands[0], wrapped));
  const childLog = observed.commands[0].processes.find(p => p.pid === child.pid);
  assert.ok(childLog, 'npm script child must inherit the preload');
  assert.ok(childLog.events.some(e => e.operation === 'fs.writeFileSync' && e.target === effect));
  assert.equal(observed.ok, false, 'writes and opaque child calls remain findings');
  assert.ok(observed.coverage.opaqueChildCalls > 0);
  assert.ok(observed.coverage.pidLogs >= 2);
  fs.unlinkSync(effect);

  const script = `const cp=require('node:child_process');const env={...process.env};delete env.NODE_OPTIONS;delete env.PSR_WRITE_AUDIT_DIR;const r=cp.spawnSync(process.execPath,[${JSON.stringify(childFile)}],{env,timeout:5000,maxBuffer:1048576});if(r.error)throw r.error;process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(r.status===null?1:r.status);`;
  const sanitized = prepare([{ label: 'sanitized-child-control', command: process.execPath, args: ['-e', script], env }], path.join(directory, 'sanitized-audit'));
  const parent = run(sanitized[0]);
  assert.deepEqual(parent.stdout, baseline.stdout); assert.deepEqual(parent.stderr, baseline.stderr);
  const hidden = JSON.parse(fs.readFileSync(effect, 'utf8'));
  assert.equal(hidden.value, 'fixture'); assert.notEqual(hidden.pid, parent.pid);
  const incomplete = collect(sanitized, trace(sanitized[0], parent));
  assert.equal(incomplete.commands[0].processes.length, 1);
  assert.ok(!incomplete.commands[0].processes.some(p => p.pid === hidden.pid), 'sanitized child writes are unobserved');
  assert.equal(incomplete.ok, false, 'opaque spawn must prevent a clean finding result');
  assert.equal(incomplete.coverage.opaqueChildCalls, 1);
  for (const report of [observed, incomplete]) {
    assert.equal(report.coverage.rootInvocations, 1);
    assert.equal(report.coverage.completeDescendantCoverage, false);
    assert.equal(report.coverage.nativeSyscallCoverageComplete, false);
    assert.equal(report.coverage.workerCoverageComplete, false);
  }
  console.log('write wrapper controls: PASS (npm inheritance, sanitized child gap, byte-identical output)');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
