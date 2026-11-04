'use strict';
// P3-6 §14: subsidiary relationships produced by the installed writers that the direct-source adapter must classify,
// not only hand-built rows. Required (and awaited) by phase3-subsidiary-relationships-test.js.
// - Internal-venture spin-off (spinOffInternalVenture): reciprocal venture provenance -> observed wholly owned edge.
// - New-business commercialization spin-out (commercializeNewBusiness 'spinout'): the row keeps no ownership and no
//   deal provenance, so it stays unresolved with IDENTITY_UNPROVEN (missing evidence, not a competing claimant), and
//   its fixed valuation never becomes an economic fraction.
// Also: insertion-order permutation, overseas missing/duplicate IDs, purity (state, RNG) and durable reload.
const assert = require('node:assert/strict');
const plain = x => JSON.parse(JSON.stringify(x));
const codes = row => row.reasons.map(x => x.code);
// Paths carry array indices; compare order-free facts per edge.
const facts = view => view.relationships.map(r => [r.edgeId, r.status, r.economicFraction.value, r.observedFraction.value, r.childEntityId,
  [...new Set(codes(r))].sort().join(',')]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

async function run() {
  const venture = require('./fixtures/internal-venture-spinoff-atomicity');
  const research = require('./fixtures/new-business-commercialization-atomicity');

  // Installed internal-venture spin-off.
  const v = await venture.fixture('first');
  assert.equal(venture.command(v), true, 'installed spin-off');
  const g = v.game.g, read = v.modules.economicReadModel;
  const rngBefore = JSON.stringify(g.simulationRng), stateBefore = JSON.stringify(g);
  const spun = read.projectSubsidiaryRelationships(g);
  const edge = spun.relationships.find(r => r.edgeId === `relationship:subsidiaries:${v.subsidiaryID}`);
  assert.ok(edge, 'spun-off subsidiary edge');
  assert.equal(edge.status, 'observed'); assert.equal(edge.economicFraction.value, 1); assert.equal(edge.votingFraction, null);
  assert.ok(edge.sourceRefs.some(x => x.family === 'internal-venture' && x.durableId === v.ventureID && x.role === 'historical'));
  assert.deepEqual([...new Set(codes(edge))].sort(), ['CLASS_UNKNOWN', 'RIGHTS_UNKNOWN']);
  assert.equal(spun.positions.length, 0, 'hierarchy edge is not another asset');
  assert.equal(JSON.stringify(g), stateBefore); assert.equal(JSON.stringify(g.simulationRng), rngBefore);
  assert.equal(v.game.save(), true); await v.backend.flush();
  const reloaded = new v.engineModule.TycoonEngine(plain(g));
  assert.deepEqual(facts(read.projectSubsidiaryRelationships(reloaded.g)), facts(spun), 'v9 reload keeps the spin-off edge');
  // A second subsidiary claiming the same venture breaks reciprocity for both rows.
  const twin = plain(g); twin.subsidiaries.push({ ...twin.subsidiaries.find(s => s.id === v.subsidiaryID), id: 'twin' });
  const claimants = read.projectSubsidiaryRelationships(twin).relationships.filter(r => [v.subsidiaryID, 'twin'].includes(r.sourceRefs[0].durableId));
  assert.equal(claimants.length, 2);
  assert.ok(claimants.every(r => r.economicFraction.value === null && codes(r).includes('ALIAS_CONFLICT')));

  // Installed commercialization spin-out.
  const c = await research.fixture('spinout');
  assert.equal(research.command(c), true, 'installed spin-out');
  const h = c.game.g, row = h.maSubsidiaries[0];
  assert.ok(/^spinout-/.test(row.id) && !Object.hasOwn(row, 'ownership') && !Object.hasOwn(row, 'acquisitionDealID'), 'writer shape as characterized by the P3-6 contract');
  const out = c.modules.economicReadModel.projectSubsidiaryRelationships(h);
  const so = out.relationships.find(r => r.edgeId === `relationship:maSubsidiaries:${row.id}`);
  assert.equal(so.status, 'unresolved'); assert.equal(so.economicFraction.value, null); assert.equal(so.observedFraction.value, null);
  assert.equal(so.childEntityId, null);
  assert.ok(codes(so).includes('IDENTITY_UNPROVEN') && !codes(so).includes('ALIAS_CONFLICT'), 'missing provenance is not a conflict');
  assert.ok(codes(so).includes('ECONOMIC_FRACTION_UNKNOWN'));
  // Two spin-out rows with one ID are a real conflict.
  const dup = plain(h); dup.maSubsidiaries.push({ ...dup.maSubsidiaries[0] });
  const dupRows = c.modules.economicReadModel.projectSubsidiaryRelationships(dup).relationships;
  assert.equal(dupRows.length, 2);
  assert.ok(dupRows.every(r => r.childEntityId === null && codes(r).includes('ALIAS_CONFLICT')));

  // Combined installed families: row order never changes the classification.
  const both = plain(g); both.maSubsidiaries = plain(h.maSubsidiaries);
  both.subsidiaries.push({ id: 'plain-sub', ownership: .4, status: 'active' }, { id: 'old-sub', ownership: .3, status: 'sold' });
  const forward = facts(read.projectSubsidiaryRelationships(both));
  const reversed = plain(both); for (const key of ['subsidiaries', 'maSubsidiaries', 'internalVentures']) reversed[key].reverse();
  assert.deepEqual(facts(read.projectSubsidiaryRelationships(reversed)), forward, 'insertion-order permutation');
  assert.equal(forward.length, 4);

  // Overseas: unique rows stay unsupported, duplicates conflict, a missing ID invalidates the inventory.
  const overseas = list => { const s = plain(both); s.overseasSubsidiaries = list; return read.projectSubsidiaryRelationships(s); };
  let o = overseas([{ id: 'os', status: 'active', ownership: 1 }]).relationships.find(r => r.edgeId === 'relationship:overseasSubsidiaries:os');
  assert.equal(o.economicFraction.value, null); assert.ok(codes(o).includes('ISSUER_FAMILY_UNSUPPORTED'));
  o = overseas([{ id: 'os', status: 'active' }, { id: 'os', status: 'active' }]);
  const overseasRows = o.relationships.filter(r => r.sourceRefs[0].family === 'overseasSubsidiaries');
  assert.equal(overseasRows.length, 2);
  assert.ok(overseasRows.every(r => r.edgeId === null && codes(r).includes('ALIAS_CONFLICT')));
  o = overseas([{ status: 'active' }]);
  assert.equal(o.relationships.length, 0); assert.ok(o.issues.some(x => x.code === 'INPUT_INVALID' && x.path === 'overseasSubsidiaries[0].id'));
  assert.equal(JSON.stringify(g.simulationRng), rngBefore, 'no simulation RNG consumed by any projection');
}
module.exports = { run };
