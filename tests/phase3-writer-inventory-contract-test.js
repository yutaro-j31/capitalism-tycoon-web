'use strict';
// FC-G01-01: static inventory consistency only. This does NOT prove runtime
// bypass closure, financial S_PASS, gateway routing or authority activation.
// Pinned inputs: #1080/#1081 matrices and #1089 at 36b1eca3 (67 route IDs).
// The embedded snapshot keeps CI offline and independent of unmerged docs PRs.
// Caller tags are declared review vocabulary, NOT verified dispatch edges.
// No engine/harness/writer/financial fixture is loaded or invoked. Only the
// pure planner module is evaluated to inspect its frozen policy export.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PIN = '36b1eca3bc1a4115a6e544f93a9104adc4fa2026';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const SNAPSHOT = `
W-INIT js/engine.js createInitialState replacement REPLACEMENT_UNSUPPORTED
W-BUY js/engine.js buyStock direct fact:personal-buy
W-SELL js/engine.js sellStock direct fact:personal-sell
W-MARGIN-RAW js/personal-stock-margin.js sellPersonalStockRaw raw INTERNAL_ENTRY
W-MARGIN-LIQ js/personal-stock-margin.js liquidate weekly fact:personal-sell
W-SPLIT js/expansion.js stockSplit direct fact:split
W-FOUNDER-SALE js/expansion.js sellFounderShares direct fact:founder-sale
W-INVESTOR js/expansion.js acceptInvestorOffer direct fact:external-issue
W-INVESTOR-AUX js/expansion.js refreshInvestorOffers direct NO_COMMON_QUANTITY_CHANGE
W-IPO-BASE js/engine.js executeIPO raw INTERNAL_ENTRY
W-IPO-CHAIN js/difficulty-scenario-balance.js baseExecuteIPO wrapper fact:ipo
W-ISSUE-RAW js/engine.js issueSharesToExternalHolders raw INTERNAL_ENTRY
W-SHARE-SWAP js/ma-deal-room.js completeTargetAcquisition wrapper fact:external-issue
W-ACQUIRE-COMPAT js/engine.js acquireTarget raw INTERNAL_ENTRY
W-MA-EQUITY/SH js/ma-acquisition-financing.js executeFinancing wrapper,shadow fact:external-issue
W-MBO js/expansion.js executeMBO direct ISSUER_FAMILY_UNSUPPORTED
W-DEFENSE js/expansion.js activateDefense direct HOLDER_UNPROVEN
W-RATIOS js/engine.js updateOwnershipRatios direct NO_COMMON_QUANTITY_CHANGE
W-DECLINE js/completion.js declineInboundBuyoutOffer direct NO_COMMON_QUANTITY_CHANGE
W-BUYBACK js/shareholder-returns.js buyback direct fact:buyback
W-BUYBACK-BASE js/engine.js buybackOwnShares raw INTERNAL_ENTRY
W-DIV-SET js/shareholder-returns.js setDividend direct NO_COMMON_QUANTITY_CHANGE
W-DIV-PAY js/shareholder-returns.js advanceWeek weekly NO_COMMON_QUANTITY_CHANGE
W-ACTIVISM js/shareholder-activism.js accept wrapper ORCHESTRATION_ONLY
W-SPONSOR js/player-crisis-actions.js requestSponsorInjection direct fact:external-issue
W-TURNAROUND-ACCEPT js/player-crisis-turnaround-fund.js accept direct fact:external-issue
W-TURNAROUND-RATCHET js/player-crisis-turnaround-fund.js settle weekly fact:external-issue
W-NEW-COMPANY js/completion.js foundNewCompanyAfterBuyout replacement REPLACEMENT_UNSUPPORTED
W-VC-INITIAL js/engine.js investStartup direct ISSUER_FAMILY_UNSUPPORTED
W-VC-FOLLOW js/engine.js participateStartupFundingRound direct ISSUER_FAMILY_UNSUPPORTED
W-VC-CLOSE js/engine.js closeStartupFundingRound direct ISSUER_FAMILY_UNSUPPORTED
W-VC-WRITEOFF js/engine.js writeOffStartup direct ISSUER_FAMILY_UNSUPPORTED
W-VC-LIST js/engine.js listStartup direct ISSUER_FAMILY_UNSUPPORTED
W-VC-SECONDARY js/expansion.js sellStartupSecondary direct ISSUER_FAMILY_UNSUPPORTED
W-MAKE-SUB js/engine.js makeSubsidiary direct ISSUER_FAMILY_UNSUPPORTED
W-SUB-IPO js/subsidiary-ipo-preparation.js ipoSubsidiary wrapper ISSUER_FAMILY_UNSUPPORTED
W-SUB-SECONDARY js/subsidiary-ipo-secondary-sale.js sellSubsidiaryIPOStake direct ISSUER_FAMILY_UNSUPPORTED
W-SUB-MARKET js/listed-subsidiary-market.js sellListedSubsidiaryStake direct ISSUER_FAMILY_UNSUPPORTED
W-SUB-CONTROL js/listed-subsidiary-control-actions.js launchListedSubsidiaryTenderOffer direct ISSUER_FAMILY_UNSUPPORTED
W-SUB-FOLLOWON js/listed-subsidiary-follow-on-offering.js executeListedSubsidiaryFollowOnOffering direct ISSUER_FAMILY_UNSUPPORTED
W-SUB-RELIST js/subsidiary-relisting-options.js relistSubsidiary direct ISSUER_FAMILY_UNSUPPORTED
W-GROUP-DISPOSAL js/group-restructuring-candidates.js executeGroupRestructuringSale direct ISSUER_FAMILY_UNSUPPORTED
W-GROUP-NEGOTIATED js/group-restructuring-progress.js closeSale direct ISSUER_FAMILY_UNSUPPORTED
W-INTERNAL-VENTURE js/internal-venture-business.js fundSubsidiaryFromParent direct ISSUER_FAMILY_UNSUPPORTED
W-COMMERCIAL-SPINOUT js/new-business-commercialization.js act direct ISSUER_FAMILY_UNSUPPORTED
W-MA-ACQUIRE js/pe-acquisition.js completeTargetAcquisition wrapper ORCHESTRATION_ONLY
W-MA-SALE js/engine.js sellMASubsidiary direct ISSUER_FAMILY_UNSUPPORTED
W-PE-FORM js/pe-fund.js createFund direct ISSUER_FAMILY_UNSUPPORTED
W-PE-FUND-ACQ js/pe-acquisition.js closeFundAcquisition direct ISSUER_FAMILY_UNSUPPORTED
W-PE-FUND-EXIT js/pe-portfolio-operations.js exitPortfolioCompany direct ISSUER_FAMILY_UNSUPPORTED
W-PE-PARENT js/pe-portfolio-operations.js acquirePEPortfolioCompany direct ISSUER_FAMILY_UNSUPPORTED
W-PE-LEGACY-CREATE js/expansion.js createPEDeal direct ISSUER_FAMILY_UNSUPPORTED
W-PE-LEGACY-EXIT js/expansion.js exitPEDeal direct ISSUER_FAMILY_UNSUPPORTED
W-PE-TRANSFER js/expansion.js transferPEDealToCompany direct ISSUER_FAMILY_UNSUPPORTED
W-PE-SYNC js/expansion.js syncPESubsidiary raw ISSUER_FAMILY_UNSUPPORTED
W-ANGEL js/expansion.js createAngelInvestment direct ISSUER_FAMILY_UNSUPPORTED
W-WEEK-COMPETITOR js/engine.js buyCompetitorStake weekly HOLDER_UNPROVEN
W-WEEK-MARKET js/engine.js updateMarket weekly NO_COMMON_QUANTITY_CHANGE
W-WEEK-STARTUPS js/engine.js updateStartups weekly ISSUER_FAMILY_UNSUPPORTED
W-WEEK-PE js/pe-fund.js processFundsWeek weekly ISSUER_FAMILY_UNSUPPORTED
W-WEEK-EXPANDED js/expansion.js updateCapitalMarketsExpandedWeekly weekly NO_COMMON_QUANTITY_CHANGE
W-EARNINGS js/parity.js runEarningsEventsIfNeeded weekly NO_COMMON_QUANTITY_CHANGE
W-CAPALLOC-PRICE js/capital-allocation-score.js advanceWeek weekly NO_COMMON_QUANTITY_CHANGE
W-LOAD-NORMALIZE js/engine.js normalizeHoldingMap load REPLACEMENT_UNSUPPORTED
W-LOAD-IMPORT js/save-v9.js migrateSave load REPLACEMENT_UNSUPPORTED
W-COMPACTION js/save-storage.js compactStateForStorage load REPLACEMENT_UNSUPPORTED
W-RESTORE/SH-REPLACE js/engine.js restoreTransactionSnapshot shadow,replacement REPLACEMENT_UNSUPPORTED
`.trim();
const CALLERS = new Set(['direct', 'raw', 'wrapper', 'weekly', 'shadow', 'load', 'replacement']);
const REFUSALS = new Set(['INTERNAL_ENTRY', 'REPLACEMENT_UNSUPPORTED', 'NO_COMMON_QUANTITY_CHANGE',
  'HOLDER_UNPROVEN', 'ORCHESTRATION_ONLY', 'ISSUER_FAMILY_UNSUPPORTED']);
const FACTS = new Set(['personal-buy', 'personal-sell', 'split', 'founder-sale', 'external-issue', 'ipo', 'buyback']);
const pinned = SNAPSHOT.split('\n').map(line => {
  const [id, file, symbol, callers, disposition] = line.split(' ');
  return { id, file, symbol, callers: callers.split(','), disposition };
});
// Reviewed id -> caller declarations at PIN, fixed independently of runtime input parsing. Deriving both actual
// and expected from SNAPSHOT would allow a wrong known tag to silently rewrite its own expected value.
const CALLER_DECLARATIONS_SHA256 = 'c24c39f31f2663c5b563ee1347af562638dc0426262f4a69e8ee285b9434b861';
const callerDeclarations = pinned.map(row => [row.id, [...row.callers].sort()])
  .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
assert.equal(createHash('sha256').update(JSON.stringify(callerDeclarations)).digest('hex'), CALLER_DECLARATIONS_SHA256,
  'caller declaration digest changed: review the fixed id/caller pin');

// Parse actual matrix rows, not incidental W-* mentions elsewhere in prose.
function matrixRows(text) {
  return text.split('\n').filter(line => /^\| W-[^:]+: /.test(line)).map(line => {
    const match = line.match(/^\| (W-[^:]+): `([^`]+)` `([^`]+)`/);
    assert.ok(match, 'unparseable matrix row');
    return { id: match[1], file: match[2].replace(/:\d+$/, ''), symbol: match[3] };
  });
}
function unique(rows, label) {
  const ids = rows.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length, label + ': duplicate route');
  assert.equal(ids.length, 67, label + ': route count');
  assert.deepEqual([...ids].sort(), pinned.map(row => row.id).sort(), label + ': route set');
}
function validate({ preflight, evidence, declarations, policies }) {
  unique(preflight, '#1080');
  unique(evidence, '#1081');
  unique(declarations, 'caller declarations');
  unique(Object.keys(policies).map(id => ({ id })), 'planner policies');
  for (const row of declarations) {
    const expected = pinned.find(item => item.id === row.id);
    assert.ok(Array.isArray(row.callers) && row.callers.length > 0, row.id + ': missing caller classification');
    assert.equal(new Set(row.callers).size, row.callers.length, row.id + ': duplicate caller tag');
    assert.ok(row.callers.every(tag => CALLERS.has(tag)), row.id + ': unknown caller classification');
    assert.deepEqual([...row.callers].sort(), [...expected.callers].sort(), row.id + ': caller classification changed');
    assert.equal(row.disposition, expected.disposition, row.id + ': disposition changed');
    for (const [label, entries] of [['#1080', preflight], ['#1081', evidence]]) {
      const actual = entries.find(item => item.id === row.id);
      assert.equal(actual.file, expected.file, label + '/' + row.id + ': file changed');
      assert.equal(actual.symbol, expected.symbol, label + '/' + row.id + ': symbol changed');
    }
    const policy = policies[row.id];
    if (row.disposition.startsWith('fact:')) {
      const kind = row.disposition.slice(5);
      assert.ok(FACTS.has(kind), row.id + ': unknown fact kind');
      assert.equal(policy.rejection, null, row.id + ': fact leg unexpectedly rejected');
      assert.deepEqual(Array.from(policy.kinds), [kind], row.id + ': fact kinds changed');
    } else {
      assert.ok(REFUSALS.has(row.disposition), row.id + ': unknown refusal');
      assert.equal(policy.rejection, row.disposition, row.id + ': unsupported disposition changed');
      assert.deepEqual(Array.from(policy.kinds), [], row.id + ': refused entry acquired a fact leg');
    }
  }
}

// Descriptor-only pure module loading, with no installed engine and no access
// to host clocks, RNG, persistence or other economic modules.
const constants = Object.freeze({ PLAYER_COMPANY_ENTITY_ID: 'entity:company:player',
  FOUNDER_ENTITY_ID: 'entity:person:founder', PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID: 'security:player-company:common' });
const registry = { economicReadModel: new Proxy(constants, {
  get(target, key) { assert.ok(Object.hasOwn(target, key), 'unexpected read-model access'); return target[key]; }
}) };
const context = vm.createContext({ __capitalismTycoonModules: registry });
vm.runInContext(`Date=new Proxy(function(){},{apply(){throw Error('clock');},construct(){throw Error('clock');},get(){throw Error('clock');}});Math.random=()=>{throw Error('RNG');};`, context);
vm.runInContext(read('js/phase3-ownership-planner.js'), context, { filename: 'js/phase3-ownership-planner.js' });
assert.ok(Object.isFrozen(registry.phase3OwnershipPlanner.WRITER_POLICIES));
const inputs = {
  preflight: matrixRows(read('docs/economic-engine/PHASE_3_P3_4_PREFLIGHT_AND_DESIGN.md')),
  evidence: matrixRows(read('docs/economic-engine/PHASE_3_P3_4_WRITER_FAILURE_WEBKIT_EVIDENCE.md')),
  declarations: pinned.map(row => ({ ...row, callers: [...row.callers] })),
  policies: JSON.parse(JSON.stringify(registry.phase3OwnershipPlanner.WRITER_POLICIES))
};
const clone = value => JSON.parse(JSON.stringify(value));
const before = JSON.stringify(inputs);
validate(inputs);
assert.equal(JSON.stringify(inputs), before, 'validation mutates inputs');
validate(clone(inputs));

let rejected = 0;
function negative(name, mutate, reason) {
  const candidate = clone(inputs);
  mutate(candidate);
  assert.throws(() => validate(candidate), reason, name + ': negative mutation escaped');
  rejected++;
  assert.equal(JSON.stringify(inputs), before, name + ': contaminated baseline');
  console.log('FC-G01-01 rejected mutation: ' + name);
}
for (const field of ['preflight', 'evidence', 'declarations']) {
  negative(field + '/missing', x => { x[field].pop(); }, /route count/);
  negative(field + '/duplicate', x => { x[field][1] = clone(x[field][0]); }, /duplicate route/);
  negative(field + '/unknown', x => { x[field][0].id = 'W-NOT-IN-INVENTORY'; }, /route set/);
}
negative('policy/missing', x => { delete x.policies['W-BUY']; }, /route count/);
negative('policy/unknown', x => { x.policies['W-NOT-IN-INVENTORY'] = x.policies['W-BUY']; delete x.policies['W-BUY']; }, /route set/);
for (const [name, id] of [['raw', 'W-MARGIN-RAW'], ['wrapper', 'W-IPO-CHAIN'],
  ['weekly', 'W-WEEK-PE'], ['shadow', 'W-MA-EQUITY/SH'], ['load', 'W-LOAD-IMPORT'],
  ['replacement', 'W-NEW-COMPANY'], ['direct', 'W-BUY']]) {
  negative('classification/' + name + '/removed', x => { delete x.declarations.find(row => row.id === id).callers; }, /missing caller classification/);
}
negative('classification/unknown', x => { x.declarations[0].callers = ['activated']; }, /unknown caller classification/);
negative('classification/wrong-known-tag', x => { x.declarations.find(row => row.id === 'W-MARGIN-RAW').callers = ['direct']; }, /caller classification changed/);
negative('source/file', x => { x.preflight[0].file = 'js/not-the-declared-source.js'; }, /file changed/);
negative('source/symbol', x => { x.evidence[0].symbol = 'unreviewedWriter'; }, /symbol changed/);
negative('unsupported/raw-accepted', x => { x.policies['W-MARGIN-RAW'] = { kinds: ['personal-sell'], rejection: null }; }, /unsupported disposition changed/);
negative('unsupported/replacement-accepted', x => { x.policies['W-NEW-COMPANY'] = { kinds: ['external-issue'], rejection: null }; }, /unsupported disposition changed/);
negative('supported/kind', x => { x.policies['W-BUY'].kinds = ['personal-sell']; }, /fact kinds changed/);
negative('declaration/disposition-removed', x => { delete x.declarations[0].disposition; }, /disposition changed/);
validate(inputs);
// Execute an actual edited source copy, not another candidate compared against an expectation derived from itself.
const originalSource = read('tests/phase3-writer-inventory-contract-test.js');
const mutatedSource = originalSource.replace('W-BUY js/engine.js buyStock direct fact:personal-buy',
  'W-BUY js/engine.js buyStock wrapper fact:personal-buy');
assert.notEqual(mutatedSource, originalSource, 'checked-in caller mutation reached SNAPSHOT');
const mutation = spawnSync(process.execPath, ['-e', `
  const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
  const file=process.argv[1],m=new Module(file);
  m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
  m._compile(fs.readFileSync(0,'utf8'),file);
`, __filename], { input: mutatedSource, encoding: 'utf8', timeout: 10000 });
assert.equal(mutation.error, undefined, 'source mutation child started and completed');
assert.equal(mutation.status, 1, 'wrong known caller in checked-in SNAPSHOT must exit 1');
assert.match(mutation.stderr, /caller declaration digest changed/);
rejected++;
console.log('FC-G01-01 rejected source mutation: W-BUY direct -> wrapper');
assert.equal(rejected, 27);
console.log(`FC-G01-01 PASS: 67 static route declarations; ${rejected} negative mutations rejected; pin=${PIN}; no runtime closure or activation evidence`);
