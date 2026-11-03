'use strict';
// Offline preservation of complete evidence. Never launches K test bodies.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), zlib = require('node:zlib');
const { expectedFrom, withArchive, auditPair } = require('./parallel-shard-k-evidence-audit.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function collect(root, artifactId) {
  assert.ok(Number.isSafeInteger(artifactId) && artifactId > 0, 'positive artifact ID required');
  root = path.resolve(root); const files = []; let totalBytes = 0;
  function walk(dir, prefix = '') {
    assert.ok(fs.lstatSync(dir).isDirectory(), 'regular artifact directory required');
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name), rel = prefix + name, st = fs.lstatSync(full);
      if (st.isDirectory()) walk(full, rel + '/');
      else {
        assert.ok(st.isFile(), 'only regular artifact files allowed; no symlinks');
        assert.ok(st.size <= 16 * 1024 * 1024, 'artifact file exceeds archive bound');
        assert.ok(files.length < 89, 'artifact exceeds complete file count');
        totalBytes += st.size; assert.ok(totalBytes <= 16 * 1024 * 1024, 'artifact exceeds byte bound');
        const bytes = fs.readFileSync(full);
        files.push({ path: rel, sha256: sha(bytes), base64: bytes.toString('base64') });
      }
    }
  }
  walk(root); return { artifactId, files };
}
function buildArchive(expected, inputs) {
  assert.match(expected.sha, /^[a-f0-9]{40}$/, 'explicit full source SHA required');
  assert.equal(inputs.length, 2, 'both Node artifacts required');
  const pack = { schema: 'k-full-artifact-evidence-v1', sourceSha: expected.sha,
    productionAuthorized: false, nodes: inputs.map(n => collect(n.root, n.artifactId)) };
  const json = Buffer.from(JSON.stringify(pack));
  assert.ok(json.length <= 16 * 1024 * 1024, 'pack exceeds existing decompression bound');
  const bytes = zlib.gzipSync(json, { level: 9 }), archiveSha256 = sha(bytes);
  // Existing restoration checks paths/counts/hashes/controls; existing auditPair
  // still checks all four passes, outputs, memory, writes and process cleanup.
  const audit = withArchive(bytes, archiveSha256, expected.sha,
    (reports, roots) => auditPair(reports, expected, roots));
  return { bytes, archiveSha256, audit };
}
function writeArchive(output, built) {
  assert.equal(sha(built.bytes), built.archiveSha256, 'archive bytes changed before save');
  fs.writeFileSync(output, built.bytes, { flag: 'wx' }); // never overwrite existing work
  return { archiveSha256: built.archiveSha256, compressedBytes: built.bytes.length, audit: built.audit };
}
module.exports = { buildArchive, writeArchive };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 9,
      'usage: k-archive-build.cjs SOURCE_ROOT PIN ROOT_A ARTIFACT_ID_A ROOT_B ARTIFACT_ID_B OUTPUT_GZ');
    const [source, pin, rootA, idA, rootB, idB, output] = process.argv.slice(2);
    assert.match(pin, /^[a-f0-9]{40}$/, 'explicit full source SHA required');
    const built = buildArchive(expectedFrom(path.resolve(source), pin), [
      { root: rootA, artifactId: Number(idA) }, { root: rootB, artifactId: Number(idB) }]);
    console.log(JSON.stringify(writeArchive(output, built), null, 2));
    process.exitCode = built.audit.differences.length ? 2 : 0;
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
