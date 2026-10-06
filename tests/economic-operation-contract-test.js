'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function errorCodes(result) { return new Set(result.errors.map(error => error.code)); }
function hasCode(result, code) { return errorCodes(result).has(code); }
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'economic-operation.js'), 'utf8');
for (const [label, pattern] of [
  ['host RNG', /Math\\.random\\s*\\(/],
  ['wall clock', /Date\\.now\\s*\\(/],
  ['simulation RNG', /simulationRng/],
  ['localStorage', /localStorage/],
  ['sessionStorage', /sessionStorage/],
  ['save call', /\\.save\\s*\\(/],
  ['emit call', /\\.emit\\s*\\(/],
  ['company cash writer', /companyCash\\s*=/],
  ['personal cash writer', /personalCash\\s*=/]
]) {
  assert.equal(pattern.test(source), false, `shadow operation foundation must not depend on ${label}`);
}

const loaded = loadGame({ headless: true });
const core = loaded.modules.economicOperation;
assert.ok(core, 'economicOperation module must load through production index.html');
assert.equal(core.SCHEMA_VERSION, 1);
assert.equal(core.ACCOUNT_TAXONOMY_VERSION, 1);
assert.ok(core.LEGAL_ENTITY_KINDS.includes('company'));
assert.equal(core.EXTERNAL_ENTITY_IDS.seller, 'external:seller');
assert.ok(core.isKnownAccount('asset:cash'));
assert.equal(core.isKnownAccount('asset:not-real'), false);

const entity = {
  entityId: 'entity:company:player',
  legalEntityKind: 'company',
  legalName: 'Player Company',
  status: 'active',
  roles: ['operatingCompany'],
  listingStatus: 'private',
  jurisdiction: 'JP',
  metadata: { source: 'legacy-player-company' }
};
assert.equal(core.validateEntity(entity).ok, true, JSON.stringify(core.validateEntity(entity).errors));

function validOperation() {
  return {
    schemaVersion: 1,
    operationId: 'op-shadow-asset-purchase-1',
    idempotencyKey: 'idem-shadow-asset-purchase-1',
    operationType: 'shadowAssetPurchase',
    decisionPeriod: 10,
    recognitionPeriod: 10,
    settlementPeriod: 10,
    effectivePeriod: 10,
    status: 'validated',
    metadata: { source: 'phase1-contract-test', nested: { deterministic: true } },
    postings: [
      {
        postingId: 'post-1',
        operationId: 'op-shadow-asset-purchase-1',
        postingSequence: 0,
        entityId: 'entity:company:player',
        accountId: 'asset:fixed-assets',
        side: 'debit',
        amount: 1234567.89,
        currency: 'JPY',
        assetId: 'asset:test-1',
        counterpartyEntityId: 'external:seller',
        metadata: { leg: 'asset' }
      },
      {
        postingId: 'post-2',
        operationId: 'op-shadow-asset-purchase-1',
        postingSequence: 1,
        entityId: 'entity:company:player',
        accountId: 'asset:cash',
        side: 'credit',
        amount: 1234567.89,
        currency: 'JPY',
        counterpartyEntityId: 'external:seller',
        metadata: { leg: 'cash' }
      }
    ]
  };
}

// 1. A balanced operation validates in integer minor units.
{
  const op = validOperation();
  const result = core.validateOperation(op);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(JSON.parse(JSON.stringify(result.currencyBalances.JPY)), {
    debitMinorUnits: 123456789,
    creditMinorUnits: 123456789
  });
}

// 2. Currency balance fails closed.
{
  const op = validOperation();
  op.postings[1].amount -= 1;
  const result = core.validateOperation(op);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, 'OPERATION_CURRENCY_UNBALANCED'));
}

// 3. Monetary domain rejects negative, non-finite, sub-cent and out-of-envelope values.
for (const [amount, code] of [
  [-1, 'POSTING_AMOUNT_NEGATIVE'],
  [Infinity, 'POSTING_AMOUNT_NON_FINITE'],
  [1.001, 'POSTING_AMOUNT_NOT_QUANTIZED'],
  [Number.MAX_SAFE_INTEGER / 100 + 1, 'POSTING_AMOUNT_OUT_OF_ENVELOPE']
]) {
  const op = validOperation();
  op.postings[0].amount = amount;
  const result = core.validateOperation(op);
  assert.equal(result.ok, false, `amount ${amount} must fail`);
  assert.ok(hasCode(result, code), `amount ${amount}: expected ${code}, got ${[...errorCodes(result)].join(',')}`);
}
assert.equal(core.roundMoney(12.345), 12.35);
assert.throws(() => core.roundMoney(Infinity), /finite/);
assert.throws(() => core.roundMoney(Number.MAX_SAFE_INTEGER), /envelope/);

// 4. Duplicate IDs/sequences and nondeterministic posting input order fail.
{
  const duplicateId = validOperation();
  duplicateId.postings[1].postingId = duplicateId.postings[0].postingId;
  assert.ok(hasCode(core.validateOperation(duplicateId), 'POSTING_ID_DUPLICATE'));

  const duplicateSeq = validOperation();
  duplicateSeq.postings[1].postingSequence = 0;
  const duplicateResult = core.validateOperation(duplicateSeq);
  assert.ok(hasCode(duplicateResult, 'POSTING_SEQUENCE_DUPLICATE'));
  assert.ok(hasCode(duplicateResult, 'POSTING_ORDER_INVALID'));

  const reversed = validOperation();
  reversed.postings.reverse();
  assert.ok(hasCode(core.validateOperation(reversed), 'POSTING_ORDER_INVALID'));
}

// 5. Unknown account and parent-operation mismatch fail.
{
  const unknown = validOperation();
  unknown.postings[0].accountId = 'asset:not-approved';
  assert.ok(hasCode(core.validateOperation(unknown), 'POSTING_ACCOUNT_UNKNOWN'));

  const mismatch = validOperation();
  mismatch.postings[0].operationId = 'other-operation';
  assert.ok(hasCode(core.validateOperation(mismatch), 'POSTING_OPERATION_MISMATCH'));
}

// 6. A quantity-only position leg does not require fake monetary side/currency fields.
{
  const op = {
    schemaVersion: 1,
    operationId: 'op-shadow-position-1',
    idempotencyKey: 'idem-shadow-position-1',
    operationType: 'shadowPositionChange',
    status: 'validated',
    metadata: {},
    postings: [{
      postingId: 'post-position-1',
      operationId: 'op-shadow-position-1',
      postingSequence: 0,
      entityId: 'entity:company:player',
      accountId: 'asset:security-investment',
      quantityDelta: 10,
      securityClassId: 'security:test-common',
      counterpartyEntityId: 'external:seller',
      metadata: {}
    }]
  };
  const result = core.validateOperation(op);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(Object.keys(result.currencyBalances), []);
}

// 7. Metadata rejects circular, executable and non-finite values.
{
  const circular = validOperation();
  circular.metadata.loop = circular.metadata;
  assert.ok(hasCode(core.validateOperation(circular), 'METADATA_CIRCULAR'));

  const executable = validOperation();
  executable.postings[0].metadata.fn = () => true;
  assert.ok(hasCode(core.validateOperation(executable), 'METADATA_NOT_JSON_SAFE'));

  const nonFinite = validOperation();
  nonFinite.metadata.bad = NaN;
  assert.ok(hasCode(core.validateOperation(nonFinite), 'METADATA_NON_FINITE'));
}

// 8. Validation is pure: no input mutation, game-state mutation, RNG draw or finance-row write.
{
  const engine = new loaded.engineModule.TycoonEngine();
  const op = validOperation();
  const opBefore = JSON.stringify(op);
  const stateBefore = JSON.stringify(engine.g);
  const drawsBefore = engine.g.simulationRng.draws;
  const financeRowsBefore = engine.g.finance.transactions.length;
  const result = core.validateOperation(op);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(JSON.stringify(op), opBefore, 'validator must not mutate its operation input');
  assert.equal(JSON.stringify(engine.g), stateBefore, 'shadow validator must not mutate production game state');
  assert.equal(engine.g.simulationRng.draws, drawsBefore, 'shadow validator must not consume production RNG');
  assert.equal(engine.g.finance.transactions.length, financeRowsBefore, 'shadow validator must not write legacy finance rows');
}

console.log('economic operation contract foundation tests passed');
