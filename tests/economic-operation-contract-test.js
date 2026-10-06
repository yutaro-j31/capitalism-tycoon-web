'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function errorCodes(result) { return new Set(result.errors.map(error => error.code)); }
function hasCode(result, code) { return errorCodes(result).has(code); }
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'economic-operation.js'), 'utf8');
for (const [label, pattern] of [
  ['host RNG', /Math\.random\s*\(/],
  ['wall clock', /Date\.now\s*\(/],
  ['simulation RNG', /simulationRng/],
  ['localStorage', /localStorage/],
  ['sessionStorage', /sessionStorage/],
  ['save call', /\.save\s*\(/],
  ['emit call', /\.emit\s*\(/],
  ['company cash writer', /companyCash\s*=/],
  ['personal cash writer', /personalCash\s*=/]
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

const reservedExternalEntity = { ...entity, entityId: 'external:typo' };
assert.ok(hasCode(core.validateEntity(reservedExternalEntity), 'EXTERNAL_ENTITY_ID_UNKNOWN'));

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
  assert.deepEqual(JSON.parse(JSON.stringify(result.entityCurrencyBalances['entity:company:player'].JPY)), {
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
  assert.ok(hasCode(result, 'OPERATION_ENTITY_CURRENCY_UNBALANCED'));
}

// Equal global currency totals must not let one legal entity offset another.
{
  const op = validOperation();
  op.postings[1].entityId = 'entity:person:founder';
  const result = core.validateOperation(op);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result, 'OPERATION_ENTITY_CURRENCY_UNBALANCED'));
  assert.deepEqual(JSON.parse(JSON.stringify(result.currencyBalances.JPY)), {
    debitMinorUnits: 123456789,
    creditMinorUnits: 123456789
  }, 'global diagnostic totals may balance while entity books do not');
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

// 5. Unknown account, parent-operation mismatch and mistyped external IDs fail closed.
{
  const unknown = validOperation();
  unknown.postings[0].accountId = 'asset:not-approved';
  assert.ok(hasCode(core.validateOperation(unknown), 'POSTING_ACCOUNT_UNKNOWN'));

  const mismatch = validOperation();
  mismatch.postings[0].operationId = 'other-operation';
  assert.ok(hasCode(core.validateOperation(mismatch), 'POSTING_OPERATION_MISMATCH'));

  const badExternal = validOperation();
  badExternal.postings[0].counterpartyEntityId = 'external:government-tx';
  assert.ok(hasCode(core.validateOperation(badExternal), 'EXTERNAL_ENTITY_ID_UNKNOWN'));

  const badExternalEntity = validOperation();
  badExternalEntity.postings[0].entityId = 'external:unknown-market';
  assert.ok(hasCode(core.validateOperation(badExternalEntity), 'EXTERNAL_ENTITY_ID_UNKNOWN'));
}

// 6. A quantity-only position leg does not require fake monetary side/currency fields, but it
//    does require the stable identity appropriate to its position account.
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

  const missingSecurityClass = JSON.parse(JSON.stringify(op));
  delete missingSecurityClass.postings[0].securityClassId;
  assert.ok(hasCode(core.validateOperation(missingSecurityClass), 'POSTING_POSITION_REFERENCE_REQUIRED'));

  const fractionalSecurity = JSON.parse(JSON.stringify(op));
  fractionalSecurity.postings[0].quantityDelta = 0.5;
  assert.ok(hasCode(core.validateOperation(fractionalSecurity), 'POSTING_SECURITY_QUANTITY_INVALID'));

  const unsafeSecurity = JSON.parse(JSON.stringify(op));
  unsafeSecurity.postings[0].quantityDelta = Number.MAX_SAFE_INTEGER + 1;
  assert.ok(hasCode(core.validateOperation(unsafeSecurity), 'POSTING_SECURITY_QUANTITY_INVALID'));

  const quantityOnCash = JSON.parse(JSON.stringify(op));
  quantityOnCash.postings[0].accountId = 'asset:cash';
  delete quantityOnCash.postings[0].securityClassId;
  assert.ok(hasCode(core.validateOperation(quantityOnCash), 'POSTING_QUANTITY_ACCOUNT_UNSUPPORTED'));

  const quantityOnRevenue = JSON.parse(JSON.stringify(op));
  quantityOnRevenue.postings[0].accountId = 'income:revenue';
  delete quantityOnRevenue.postings[0].securityClassId;
  assert.ok(hasCode(core.validateOperation(quantityOnRevenue), 'POSTING_QUANTITY_ACCOUNT_UNSUPPORTED'));

  for (const accountId of ['asset:debt-receivable','liability:debt-principal','asset:property','asset:fixed-assets','asset:intangible-assets','equity:share-capital','equity:treasury-stock']) {
    const missingReference = JSON.parse(JSON.stringify(op));
    missingReference.postings[0].accountId = accountId;
    delete missingReference.postings[0].securityClassId;
    assert.ok(
      hasCode(core.validateOperation(missingReference), 'POSTING_POSITION_REFERENCE_REQUIRED'),
      `${accountId} quantity change must carry its stable position identity`
    );
  }
}

// 7. Metadata rejects circular, executable, non-finite and prototype-bearing class values.
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

  class BadMetadata {
    constructor() { this.value = 1; }
    toJSON() { return 1n; }
  }
  const classRoot = validOperation();
  classRoot.metadata = new BadMetadata();
  assert.ok(hasCode(core.validateOperation(classRoot), 'METADATA_NOT_PLAIN_JSON'));

  const classNested = validOperation();
  classNested.metadata.bad = new BadMetadata();
  assert.ok(hasCode(core.validateOperation(classNested), 'METADATA_NOT_PLAIN_JSON'));
  assert.throws(() => JSON.stringify(classNested), /BigInt|serialize/i, 'fixture must prove the class instance is unsafe to stringify');

  const wrongPrototypeArray = [];
  Object.setPrototypeOf(wrongPrototypeArray, Date.prototype);
  const badArray = validOperation();
  badArray.metadata.bad = wrongPrototypeArray;
  assert.ok(hasCode(core.validateOperation(badArray), 'METADATA_NOT_PLAIN_JSON'));

  const forgedProto = Object.create(null);
  forgedProto.constructor = Object;
  forgedProto.toJSON = function toJSON() { return 1n; };
  const forgedMetadata = Object.create(forgedProto);
  forgedMetadata.value = 1;
  const forged = validOperation();
  forged.metadata = forgedMetadata;
  assert.ok(hasCode(core.validateOperation(forged), 'METADATA_NOT_PLAIN_JSON'));
  assert.throws(() => JSON.stringify(forged), /BigInt|serialize/i);

  const hiddenToJSON = { value: 1 };
  Object.defineProperty(hiddenToJSON, 'toJSON', {
    value() { return 1n; },
    enumerable: false
  });
  const hidden = validOperation();
  hidden.metadata = hiddenToJSON;
  assert.ok(hasCode(core.validateOperation(hidden), 'METADATA_NON_ENUMERABLE_PROPERTY'));
  assert.throws(() => JSON.stringify(hidden), /BigInt|serialize/i);

  let getterExecuted = false;
  const accessorMetadata = {};
  Object.defineProperty(accessorMetadata, 'value', {
    enumerable: true,
    get() { getterExecuted = true; throw new Error('metadata getter must never execute'); }
  });
  const accessor = validOperation();
  accessor.metadata = accessorMetadata;
  const accessorResult = core.validateOperation(accessor);
  assert.ok(hasCode(accessorResult, 'METADATA_ACCESSOR_PROPERTY'));
  assert.equal(getterExecuted, false, 'metadata validation must inspect descriptors without executing getters');

  let toStringTagExecuted = false;
  const taggedMetadata = { value: 1 };
  Object.defineProperty(taggedMetadata, Symbol.toStringTag, {
    get() { toStringTagExecuted = true; throw new Error('Symbol.toStringTag getter must never execute'); }
  });
  const tagged = validOperation();
  tagged.metadata = taggedMetadata;
  const taggedResult = core.validateOperation(tagged);
  assert.ok(hasCode(taggedResult, 'METADATA_SYMBOL_KEY'));
  assert.equal(toStringTagExecuted, false, 'metadata validation must not invoke Symbol.toStringTag');
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
