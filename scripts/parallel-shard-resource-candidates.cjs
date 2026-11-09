'use strict';
// Offline lexical grouping of observed API targets, never a conflict/safety gate.
const assert = require('node:assert/strict'), path = require('node:path').posix, fs = require('node:fs');
function summarize(observation) {
  assert.ok(Array.isArray(observation.commands), 'commands required');
  const resources = new Map(), unresolved = [];
  let findingCount = 0;
  for (const [index, command] of observation.commands.entries()) {
    assert.ok(typeof command.label === 'string' && command.label.length);
    assert.ok(Array.isArray(command.findings));
    for (const [findingIndex, event] of command.findings.entries()) {
      findingCount++;
      assert.ok(Number.isSafeInteger(event.pid) && event.pid > 0);
      if (event.threadId !== undefined) assert.ok(Number.isSafeInteger(event.threadId) && event.threadId >= 0);
      assert.ok(typeof event.cwd === 'string' && path.isAbsolute(event.cwd), 'POSIX absolute cwd required');
      assert.ok(typeof event.operation === 'string' && event.operation.length);
      assert.ok(typeof event.target === 'string' || typeof event.target === 'number');
      const witness = { ...event, index, label: command.label, findingIndex };
      const unknown = reason => unresolved.push({ reason, witness });
      const add = (kind, value, role) => {
        const key = JSON.stringify([kind,value]);
        if (!resources.has(key)) resources.set(key, { kind, value, participants: new Map() });
        const participants = resources.get(key).participants;
        if (!participants.has(index)) participants.set(index, { index, label: command.label, observations: [] });
        participants.get(index).observations.push({ role, witness });
      };
      const file = (value, role) => {
        if (typeof value !== 'string' || !value || value.includes('\0') || /^\[.*\]$/.test(value) || /^[a-z][a-z\d+.-]*:/i.test(value))
          return unknown(`unresolved-${role}`);
        add('filesystem-path',path.resolve(event.cwd,value),role);
      };
      if (event.operation.startsWith('fs.') || event.operation.startsWith('FileHandle.')) {
        file(event.target,'target');
        if (event.destination !== undefined) file(event.destination,'destination');
      } else if (event.operation === 'net.listen' || event.operation === 'dgram.bind') {
        if (Number.isInteger(event.target) && event.target > 0 && event.target <= 65535)
          add(event.operation === 'net.listen' ? 'tcp-port' : 'udp-port',event.target,'endpoint');
        else if (event.operation === 'net.listen' && typeof event.target === 'string' && event.target !== '[options omitted]')
          file(event.target,'unix-listen-path');
        else unknown('unresolved-or-ephemeral-endpoint');
      } else unknown('opaque-or-other-api');
    }
  }
  const all = [...resources.values()];
  return { schema: 'observed-resource-candidates-v1', commandCount: observation.commands.length, findingCount,
    observedResourceCount: all.length,
    candidateSharedResources: all.filter(r=>r.participants.size > 1).map(r=>({ ...r, participants:[...r.participants.values()] })),
    unresolved, pathSemantics:'posix-lexical-no-realpath', simultaneousExecutionVerified:false,
    endpointAddressCoverageComplete:false, descendantCoverageComplete:false,
    sharedWriteSafetyQualified:false, parallelExecutionQualified:false, productionAuthorized:false };
}
module.exports = { summarize };
if (require.main === module) {
  try { assert.equal(process.argv.length,3,'usage: resource-candidates.cjs WRITE_OBSERVATION.json');
    console.log(JSON.stringify(summarize(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));
  } catch(error) { console.error(error.stack); process.exitCode=1; }
}
