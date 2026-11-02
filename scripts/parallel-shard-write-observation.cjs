'use strict';

// Diagnostic-only command/PID coverage. Observed APIs do not prove syscall completeness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function prepare(commands, directory) {
  directory = path.resolve(directory);
  assert.ok(!fs.existsSync(directory), 'write observation requires a fresh trial directory');
  fs.mkdirSync(directory, { recursive: true });
  const preload = path.join(__dirname, 'parallel-shard-write-audit.cjs');
  return commands.map((command, index) => {
    const target = path.join(directory, String(index));
    fs.mkdirSync(target);
    return { ...command, env: { ...command.env, PSR_WRITE_AUDIT_DIR: target,
      NODE_OPTIONS: `${command.env?.NODE_OPTIONS ?? process.env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(preload)}`.trim() } };
  });
}
function collect(commands, trace) {
  assert.equal(trace.length, commands.length, 'every audited command must have a traced PID');
  const reports = commands.map(command => {
    const matches = trace.filter(t => t.command === command.command && JSON.stringify(t.args) === JSON.stringify(command.args));
    assert.equal(matches.length, 1, `${command.label}: unique traced command`);
    const pid = matches[0].pid;
    assert.ok(Number.isSafeInteger(pid) && pid > 0, 'valid root PID required');
    const directory = command.env.PSR_WRITE_AUDIT_DIR;
    const files = fs.readdirSync(directory);
    assert.ok(files.includes(`${pid}.jsonl`), `${command.label}: root initialization missing`);
    const contexts = files.map(file => {
      const identity = /^([1-9]\d*)(?:\.thread-([1-9]\d*))?\.jsonl$/.exec(file);
      assert.ok(identity, 'audit file must identify a PID and optional worker thread');
      const expectedPid = Number(identity[1]), threadId = Number(identity[2] || 0);
      assert.ok(Number.isSafeInteger(expectedPid) && Number.isSafeInteger(threadId), 'safe context identity');
      const text = fs.readFileSync(path.join(directory, file), 'utf8');
      assert.ok(text.endsWith('\n'), 'audit must end with a complete record');
      const events = text.slice(0, -1).split('\n').map(line => JSON.parse(line));
      assert.equal(events[0]?.operation, 'initialized', 'initialization must precede observed APIs');
      assert.equal(events.filter(e => e.operation === 'initialized').length, 1, 'ambiguous PID reuse/initialization');
      for (const event of events) {
        assert.equal(event.pid, expectedPid, 'audit filename/PID consistency');
        // Legacy main-thread logs omit threadId; worker logs must always identify it.
        assert.equal(event.threadId === undefined && threadId === 0 ? 0 : event.threadId, threadId, 'audit filename/thread consistency');
        assert.ok(path.isAbsolute(event.cwd), 'audit cwd must be absolute');
        assert.equal(typeof event.operation, 'string');
        assert.ok(typeof event.target === 'string' || typeof event.target === 'number');
      }
      assert.equal(events[0].target, 'node-api-audit-v1');
      return { pid: expectedPid, threadId, events };
    });
    const processes = contexts.filter(c => c.threadId === 0), threads = contexts.filter(c => c.threadId !== 0);
    // Writes, ports and opaque child-process calls all need review, even when their test passed.
    const findings = contexts.flatMap(p => p.events.filter(e => e.operation !== 'initialized'));
    return { label: command.label, pid, directory, processes, threads, findings };
  });
  return { ok: reports.every(r => r.findings.length === 0), commands: reports,
    coverage: { kind: 'node-api-audit-v1', rootInvocations: reports.length,
      pidLogs: reports.reduce((n, r) => n + r.processes.length, 0),
      workerThreadLogs: reports.reduce((n, r) => n + r.threads.length, 0),
      opaqueWorkerCreations: reports.reduce((n, r) => n + r.findings.filter(e => e.operation === 'worker_threads.Worker').length, 0),
      opaqueChildCalls: reports.reduce((n, r) => n + r.findings.filter(e => e.operation.startsWith('child_process.')).length, 0),
      completeDescendantCoverage: false, nativeSyscallCoverageComplete: false, workerCoverageComplete: false } };
}
function selfTest() {
  const os = require('node:os'), cp = require('node:child_process');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'write-observation-'));
  try {
    const make = name => prepare([{ label: name, command: process.execPath, args: ['-e', "console.log('PASS control')"] }], path.join(directory, name));
    const commands = make('clean');
    const child = cp.spawnSync(commands[0].command, commands[0].args, { env: { ...process.env, ...commands[0].env } });
    assert.equal(child.status, 0); assert.equal(child.stdout.toString(), 'PASS control\n'); assert.equal(child.stderr.length, 0);
    const writes = prepare([{ label: 'real-write', command: process.execPath,
      args: ['-e', `require('fs').writeFileSync(${JSON.stringify(path.join(directory, 'fixture'))},'value');console.log('PASS write')`] }], path.join(directory, 'writes'));
    const writer = cp.spawnSync(writes[0].command, writes[0].args, { env: { ...process.env, ...writes[0].env } });
    assert.equal(writer.status, 0);
    const observed = collect(writes, [{ command: writes[0].command, args: writes[0].args, pid: writer.pid }]);
    assert.equal(observed.ok, false);
    assert.ok(observed.commands[0].findings.some(e => e.operation === 'fs.writeFileSync'));
    const trace = [{ command: commands[0].command, args: commands[0].args, pid: child.pid }];
    assert.equal(collect(commands, trace).ok, true);
    assert.throws(() => collect(commands, []), /traced PID/);
    assert.throws(() => prepare([], path.join(directory, 'clean')), /fresh trial/);
    const file = path.join(commands[0].env.PSR_WRITE_AUDIT_DIR, `${child.pid}.jsonl`), original = fs.readFileSync(file, 'utf8');
    const mutation = { pid: child.pid, cwd: directory, operation: 'fs.writeFileSync', target: '/shared/fixture' };
    fs.appendFileSync(file, JSON.stringify(mutation) + '\n');
    assert.equal(collect(commands, trace).ok, false, 'a successful command with writes is not a safety PASS');
    fs.writeFileSync(file, original + JSON.stringify({ ...mutation, operation: 'child_process.spawn' }) + '\n');
    assert.equal(collect(commands, trace).ok, false, 'opaque child calls need review');
    for (const corrupt of [original.trimEnd(), '{}\n', original + original,
      original.replace(`"pid":${child.pid}`, '"pid":1')]) {
      fs.writeFileSync(file, corrupt); assert.throws(() => collect(commands, trace));
    }
    fs.unlinkSync(file); assert.throws(() => collect(commands, trace), /root initialization missing/);
    console.log('write observation self-test: PASS');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
module.exports = { prepare, collect };
if (require.main === module) {
  selfTest();
  require('./parallel-shard-write-wrapper-test.cjs');
  require('./parallel-shard-write-worker-test.cjs');
}
