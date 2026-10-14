# Phase 4 Additional P1 Audit — 2026-10-15 JST

**Read-only production audit. Six additional P1 findings reproduced. IMPLEMENTATION NOT READY; Phase 4 Entry: NOT AUTHORIZED.** This addendum does not authorize a repair, migration, debt-authority cutover or merge. It extends the earlier design audit; it does not replace the formal roadmap.

## Baselines and evidence limits

- GitHub main and freshly fetched origin/main: `4a7e20c6148f20861321b3b17a8964f82debcadd` (rechecked 2026-10-15 JST).
- Repair comparison: PR [#990](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/990) head `390d62d40593f5b09f4dbbca5ebeeaf8c3a43f55`, including PR [#989](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/989) head `d90fbc38ab18e1d0ff8d04d3fba369ce184a87f0`. Local comparison tree was independently checked against GitHub tree `d61ea9c61a43ac73760599d7fa8eca0bef46f77d`.
- All six findings reproduce on **both** baselines. They are pre-existing defects outside the scoped fixes in #989/#990, not regressions attributed to those PRs. Neither PR has been merged at this audit cutoff.
- Executed: 19 installed-engine characterization scenarios on each baseline (38 scenario executions), plus three founder-capital save faults on each (six additional executions). The independent evidence oracle asserts the observed defects and controls on both baselines. A successful *audit oracle* means the defect reproduced; it does not mean the product passed.
- Runtime: Node production `tests/harness.js`, real installed prototype composition and seeded `simulationRng=83951617`. The capital persistence probe uses the existing deterministic fake IndexedDB, production reload and a fresh harness hydration. **No new browser/WebKit/physical-iPhone verification was performed for these six findings.** The earlier successful WebKit jobs verify only the scoped repairs in #989/#990.
- Fixtures use a real initial property template, configured initial state, complete money/book setup, `ensureFinance`, reseeding and final production normalization. Opening company books are asserted valid. No production function is replaced to manufacture a financial outcome. The interest trace records writes without altering their values; save-fault injection is explicitly identified.
- Scope is current debt/financing, repayment, interest, default and neighboring founder-capital flows. This is not an exhaustive all-game proof: PE/VC/fund/ownership/UI families were not all re-executed here, and legacy imported saves were not migrated.

## Findings and source anchors

All source links below are pinned to the inspected main. IDs are audit-document identifiers, not new runtime operation types.

| ID | Severity / actual writer | Reproduced outcome | Relevant UI / source |
|---|---|---|---|
| P4-AUD-003 | P1 — founder capital contribution, `contributeFounderCapital` | Save rejection returns success with company cash +1M, personal cash -1M and one new equity-financing row. A post-admission exception leaves the failed contribution durable. | [engine.js:1642-1652](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/engine.js#L1642-L1652); [app.js:901](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/app.js#L901) |
| P4-AUD-004 | P1 — personal generic repayment versus property service/prepayment | Repay a personal property loan of 30M through `repay(...,'personal')`: aggregate debt becomes zero, specialist loan stays 30M. A second specialist repayment charges another 30M and produces **personalDebt=-30M**, retained after production reload. | [engine.js:1631-1635](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/engine.js#L1631-L1635); [complete-cycle.js:43/47/52](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/real-estate-complete-cycle.js#L43-L52) |
| P4-AUD-005 | P1 — non-active principal allocation in generic repayment, treasury prepayment and aggregate maturity | A naturally defaulted bank loan has 40M principal and valid books. Generic or voluntary repayment of 1M reduces company cash and aggregate debt to 39M but leaves the loan at 40M. Aggregate maturity pays 4M but leaves the loan at 40M against aggregate 36M. `P2-DEBT-INSTRUMENTS` fails. | [engine.js:1633](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/engine.js#L1633); [treasury-prepayment.js:26-27](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/treasury-prepayment.js#L26-L27); [player-debt-service.js:24-25](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/player-debt-service.js#L24-L25) |
| P4-AUD-006 | P1 — double personal interest | On one 30M personal property loan, one real `advanceWeek(false)` charges generic personal interest **32,423.653846 yen**, then specialist interest **23,076.92 yen** on the same principal. Both cash writes are traced; company validation still passes. | [engine.js:2186](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/engine.js#L2186); [complete-cycle.js:47](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/real-estate-complete-cycle.js#L47) |
| P4-AUD-007 | P1 — independent property-mortgage liability omission | Fixed mortgage on a 300M property sets `mortgageBalance=195M` and credits 192.66M net cash, but neither aggregate debt nor finance loan principal increases. Company BS identity fails by **195M**; next weekly close throws and reload retains the invalid books. Personal aggregate debt also stays zero. | [mortgage-refinancing.js:10-12](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/real-estate-mortgage-refinancing.js#L10-L12); [finance.js aliases/event](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/finance.js#L16-L19); [mortgage UI](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/real-estate-mortgage-refinancing-ui.js#L2) |
| P4-AUD-008 | P1 — refinancing principal/cash conservation | Lower-LTV refinancing silently reduces the existing mortgage with zero repayment cash. Switching back draws the difference again. With genuine week advances, two personal variable→conservative→variable cycles each pay **62,784,384.62 yen** from refinancing alone; company validation remains true. | [mortgage-refinancing.js:5/10](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/real-estate-mortgage-refinancing.js#L5-L10); [mortgage UI](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/4a7e20c6148f20861321b3b17a8964f82debcadd/js/real-estate-mortgage-refinancing-ui.js#L2) |

These are six root-cause families, not one P1 per probe or owner. P4-AUD-007 and the interest findings promote earlier CODE-level design concerns to executed evidence; they are not claimed to be previously unknown code paths. P4-AUD-004 is the personal sibling of P4-AUD-002; #990 intentionally scopes its hook to matching company property loans and does not address personal allocation. P4-AUD-005 is a separate eligibility/allocation defect: all three aggregate reduction loops filter `status==='active'`, although companyDebt and finance validation include unpaid defaulted/workout principal.

## Persistence evidence for P4-AUD-003

Three independent runs use the existing shared fixture and deterministic fake IDB. Company and personal cash move by opposite 1M amounts, and one ledger row is added in all three failed cases.

| Injected fault | Public result | Live company cash delta | Durable payload changed | Reload / fresh hydration delta |
|---|---|---:|---|---:|
| save-false | true | +1M | no | 0 / 0 |
| save-before-throw | throws | +1M | no | 0 / 0 |
| save-throw after admission | throws | +1M | **yes** | **+1M / +1M** |

This is economic/persistence failure, not merely the separate success-toast issue #969. The transaction repair in #989 wraps founder *loans*, not `contributeFounderCapital`.

## Default, personal interest and refinancing controls

P4-AUD-005 starts with an actual `borrowFromBank(40M,52)` contract. To arrange default without introducing a false accounting failure, the fixture exhausts company cash with a matched cash/expense event and saves the closing snapshot before changing the test clock. Three actual bank-service calls produce `status='defaulted'`. Actual founder capital injection supplies 10M cash. Company validation is true immediately before each repayment command. The principal divergence is therefore introduced by repayment, not by a malformed opening save. Raw bank-service calls here characterize the installed subsystem; they do not claim full weekly/hydration coverage of default.

For P4-AUD-006, the real weekly call returns true. The cash trace shows a debit of 32,423.653846 at `updatePersonalAssets`, and a later debit of 127,351.66 at property `processLoans`; the latter comprises principal 104,274.74 plus interest 23,076.92. Rent and other personal flows are separate trace entries. Unlike the company interest calculation, the generic personal pool does not subtract individually serviced personal property principal. Do not add personalRealEstateHoldings or margin principal to personalDebt indiscriminately: their inclusion contracts differ.

P4-AUD-008 uses real week advances, not a same-week cooldown bypass. Starting with variable principal 216M:

| Week | Action | Prior mortgage | New mortgage | Immediate cash change |
|---|---|---:|---:|---:|
| 10 | initial variable | 0 | 216,000,000 | +212,544,000 |
| 11 | conservative after service | 215,480,769.23 | 150,000,000 | **0** |
| 12 | variable after service | 149,759,615.38 | 216,000,000 | **+62,784,384.62** |
| 13 | conservative after service | 215,480,769.23 | 150,000,000 | **0** |
| 14 | variable after service | 149,759,615.38 | 216,000,000 | **+62,784,384.62** |

The two repeat draw receipts total 125,568,769.24; that total excludes the original financing receipt and weekly cash flows. It is not asserted to be an equal change in displayed net worth. The source sets `mortgageBalance=target` after clamping gross to nonnegative and net proceeds to nonnegative; negative refinancing cash obligations are never settled. Fees on a downward personal refinancing are also recorded in history without a cash debit. The cash-creation path is repeatable while the property remains eligible. Severity is at least P1; potential P0 treatment of an unbounded cash path requires explicit triage, not an invented formal severity rule.

Negative controls: save-false on `borrowFromBank`, `borrowAgainstProperty`, `refinancePropertyMortgage` and `prepayCompanyDebtVoluntarily` returns false with the entire normalized state unchanged on both baselines. A 12-week bank loan services to zero and company validation passes after 14 service/save iterations. These controls do not certify every fault or every debt family.

## Known work, uncertainties and disposition

- Existing P4-AUD-001/002: fixes are #989/#990, not merged at this cutoff. Their dedicated real WebKit gates succeeded. Repository-wide CI was still running with no observed failure; this is not a final all-green or merge authorization.
- [#988](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/988) already describes repeated forced earnings pumping and cash-out. It remains a known separate P1 candidate and is **not counted among the six additional families**. Transaction PR #964 does not fix that pricing policy.
- #954 is an open historical Track A tracker; its title alone is not evidence that every old child defect remains. #976 is a listed-subsidiary accounting-policy question; #979 concerns already damaged legacy saves. No automatic repair is authorized here. Phase 3 #909 is still incomplete.
- An unowned-property direct API call can originate a complete-cycle loan, but the inspected property UI filters owned properties (`real-estate-ui.js:11`, complete-cycle UI selector). Without a normal UI/reachability proof, this audit keeps it as an API guard/ownership candidate, **not a seventh confirmed P1**.
- Cross-product collateral reuse, legacy D17 service and all PE/fund/ownership families need their own scoped tests. Passing company finance validation does not prove personal principal/cash conservation, specialist completeness, or a complete all-repository audit.
- Initial exploratory bank/default samples had delayed snapshot finalization and an incomplete minimal property fixture. Those artifacts were rejected. The published reproduction below uses a complete property template, production normalization, valid pre-action books, and service/save boundaries. No P1 is based on those discarded fixture failures.

## Repair boundaries and proposed one-concern PRs

No production repair is included in this documentation amendment. Existing approval for P4-AUD-001/002 is not treated as blanket permission to change all six newly verified families.

| Proposed repair | Minimal concern / completion evidence | Owner decision before implementation |
|---|---|---|
| P4-AUD-008 cash conservation (highest exploit priority) | Reject or correctly settle a refinancing with old principal + fee exceeding new proceeds; prove lowering LTV cannot forgive principal; cycle/reload/save faults | Downward refinancing cash/fee settlement and fail-closed compatibility policy |
| P4-AUD-007 liability completeness (weekly-close blocker) | Align the existing mortgage contract with owner debt, itemized company principal and gross/fee/payoff postings; prove valid next close | Legacy mortgage authority boundary and treatment of already inconsistent saves; no automatic migration |
| P4-AUD-003 capital atomicity (smallest technical repair) | Reuse existing runTransaction/checkpoint for cash, equity, ledger, RNG/news; full shared faults + WebKit/durable reload | Separate existing-writer fix approval |
| P4-AUD-004 personal principal allocation | One payment reduces both included aggregate principal and the correct personal specialist claim; prohibit negative debt / second collection | Allocation among unsecured and specialized personal debt; preserve ownership/cash pools |
| P4-AUD-005 non-active repayment | Allocate or fail closed before moving cash; cover active/defaulted/workout mixes in all three entry paths | Eligibility for repayment of defaulted/workout debt; no silent forgiveness |
| P4-AUD-006 one personal interest charge | Exclude only actually serviced principal from generic personal interest; keep outside-aggregate debt separate | Which existing contract supplies each charge; historical corrections remain separate |

All future fixes require RED/GREEN, pre/post invariant checks, transaction rollback, save-false/save-throw, pending/cache/durable/fresh hydration, deterministic replay and relevant actual WebKit gates. Use current origin/main at implementation time; keep one concern per PR and no writer cutover. Phase 4 Entry additionally needs evidence-based disposition of P4-AUD-003–008; #989/#990 alone cannot clear it.

## Reproduction scripts and verified output

Run the following Node snippets from an isolated checkout of **the stated audited baseline**, not from the older design-PR source tree. Save them as the `/tmp` filenames shown. They only mutate in-memory/harness-local saves. They do not modify production source, canonical tests, workflows or user saves.

```sh
node /tmp/additional-debt-probe.js > /tmp/additional-debt-main.jsonl
node /tmp/capital-atomicity-audit.js > /tmp/capital-atomicity-main.jsonl
# Repeat from the #990 head checkout, writing *-fixed-head.jsonl.
node /tmp/verify-additional-debt-evidence.js /tmp/additional-debt-main.jsonl /tmp/additional-debt-fixed-head.jsonl
```

Oracle output on both baselines: 19 scenarios; P4-AUD-003,004,005,006,007,008 reproduced; four save-false controls restore full state; bank amortization closes valid books; negative personal debt remains -30M after reload; repeated refinancing receipts are 62,784,384.62 each (floating point serialization may display 62784384.620000005).

### Characterization probe — `/tmp/additional-debt-probe.js`

```js
'use strict';
const {loadGame}=require(process.cwd()+'/tests/harness');
function fixture(owner='company'){
 const s=loadGame({headless:true}),e=new s.engineModule.TycoonEngine(s.engineModule.createInitialState({configured:true}));
 Object.assign(e.g,{configured:true,week:10,companyCash:100_000_000,personalCash:100_000_000,companyDebt:0,personalDebt:0});
 e.g.properties=[{...e.g.properties[0],id:'AUDIT-P',name:'Audit Building',owner,marketValue:300_000_000,value:300_000_000,purchasePrice:300_000_000,realEstate:{monthlyRent:4_000_000,occupancyRate:1,expenseRatio:.2}}];
 s.modules.realEstate.ensure(e.g);e.g.finance=s.modules.finance.defaultFinanceState(e.g);s.modules.finance.ensureFinance(e.g);s.modules.simulationRng.reseed(e.g,83951617);e.normalize();if(!s.modules.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw Error('invalid opening fixture');
 return {...s,e};
}
function view(s){const g=s.e.g;return {companyCash:g.companyCash,personalCash:g.personalCash,companyDebt:g.companyDebt,personalDebt:g.personalDebt,mortgage:g.properties[0]?.mortgageBalance,loans:g.finance.loans.map(x=>({id:x.loanID,p:x.outstandingPrincipal,status:x.status})),market:g.realEstateMarket.loans.map(x=>({id:x.id,p:x.balance,status:x.status})),validation:s.modules.finance.validate(JSON.parse(JSON.stringify(g))),roll:s.modules.finance.debtRollforwardStatus(JSON.parse(JSON.stringify(g)))};}
function run(id,fn){try{console.log(JSON.stringify({id,...fn()}));}catch(e){console.log(JSON.stringify({id,error:e.message,stack:e.stack?.split('\n').slice(0,3)}));}}
run('capital-save-false',()=>{const s=fixture(),e=s.e,before=view(s),n=e.g.finance.transactions.length;e.save=()=>false;const result=e.contributeFounderCapital(1_000_000);return {result,before,after:view(s),rowsAdded:e.g.finance.transactions.length-n};});
run('personal-generic-repay',()=>{const s=fixture('personal'),e=s.e;const loan=e.borrowAgainstProperty('AUDIT-P',30_000_000,{rateType:'fixed',termWeeks:260});const result=e.repay(30_000_000,'personal');const afterGeneric=view(s),second=e.prepayRealEstateLoan(loan.id,30_000_000);return {result,afterGeneric,second,afterSecond:view(s),reloadPersonalDebt:s.engineModule.TycoonEngine.load().g.personalDebt};});
for(const owner of ['company','personal'])run('mortgage-'+owner,()=>{const s=fixture(owner),before=view(s),result=s.e.refinancePropertyMortgage('AUDIT-P','fixed'),after=view(s);s.e.g.week++;const service=s.modules.realEstateMortgageRefinancing.processWeek(s.e);return {result,before,after,service,afterService:view(s),posted:s.e.g.finance.transactions.map(x=>({category:x.category,amount:x.amount,liability:x.liabilityEffect,cash:x.cashEffect,profit:x.profitEffect}))};});
run('personal-interest',()=>{const s=fixture('personal'),e=s.e,loan=e.borrowAgainstProperty('AUDIT-P',30_000_000,{rateType:'fixed',termWeeks:260});const calls=[],base=e.personalBorrowRate;e.personalBorrowRate=function(...args){const r=base.apply(this,args);calls.push({week:this.g.week,debt:this.g.personalDebt,cash:this.g.personalCash,rate:r,genericInterest:this.g.personalDebt*r/52});return r;};const before=view(s),result=e.advanceWeek({showSummary:false});return {result,before,after:view(s),calls,history:e.g.realEstateMarket.history.filter(x=>x.type==='debt-service'),flags:{gameOver:e.g.gameOver,sold:e.g.isCompanySold,news:e.g.news.slice(0,4),report:e.g.lastReport}};});
run('bank-maturity',()=>{const s=fixture(),e=s.e;const result=e.borrowFromBank?.(10_000_000,12);if(!result)return {methods:Object.keys(s.modules.bankLoansCovenants||{}),result};const samples=[];for(let i=0;i<14;i++){e.g.week++;s.modules.bankLoansCovenants.service(e.g);e.save();samples.push(view(s));}return {result,samples};});
run('unowned-property',()=>{const s=fixture(null),before=view(s),result=s.e.borrowAgainstProperty('AUDIT-P',60_000_000,{rateType:'fixed',termWeeks:260});return {result,before,after:view(s)};});

for(const owner of ['company','personal'])run('mortgage-downsize-'+owner,()=>{const s=fixture(owner),e=s.e;e.refinancePropertyMortgage('AUDIT-P','variable');const before=view(s),worthBefore=owner==='personal'?e.personalNetWorth():e.companyValue();e.g.week++;const result=e.refinancePropertyMortgage('AUDIT-P','conservative');return {result,before,after:view(s),worthBefore,worthAfter:owner==='personal'?e.personalNetWorth():e.companyValue()};});
for(const method of ['repay','prepayCompanyDebtVoluntarily','maturity'])run('defaulted-'+method,()=>{const s=fixture(),e=s.e;e.borrowFromBank(40_000_000,52);const expense=e.g.companyCash;e.g.companyCash=0;s.modules.finance.event(e.g,'otherOperating',expense,{cashEffect:-expense,profitEffect:-expense,sourceType:'audit-fixture'});e.save();for(let i=0;i<3;i++){e.g.week++;s.modules.bankLoansCovenants.service(e.g);}const status=e.g.finance.loans[0].status;e.contributeFounderCapital(10_000_000);const before=view(s);let result;if(method==='maturity'){const r=s.modules.playerDebtService.refinancingState(e);r.nextMaturityWeek=e.g.week;result=e.runTransaction(()=>{s.modules.playerDebtService.processDebtMaturity(e);return true;});}else result=e[method](1_000_000,'company');return {status,result,before,after:view(s)};});
run('personal-interest-trace',()=>{const s=fixture('personal'),e=s.e;e.borrowAgainstProperty('AUDIT-P',30_000_000,{rateType:'fixed',termWeeks:260});let cash=e.g.personalCash;const moves=[];Object.defineProperty(e.g,'personalCash',{enumerable:true,configurable:true,get(){return cash;},set(v){if(v!==cash)moves.push({from:cash,to:v,delta:v-cash,stack:new Error().stack.split('\n').slice(2,5)});cash=v;}});const result=e.advanceWeek(false);Object.defineProperty(e.g,'personalCash',{enumerable:true,configurable:true,writable:true,value:cash});return{result,moves,service:e.g.realEstateMarket.history.filter(x=>x.type==='debt-service'),valid:s.modules.finance.validate(JSON.parse(JSON.stringify(e.g)))};});
run('personal-refinance-cycle',()=>{const s=fixture('personal'),e=s.e,events=[];const action=product=>{const cash=e.g.personalCash,balance=e.g.properties[0].mortgageBalance||0,result=e.refinancePropertyMortgage('AUDIT-P',product);events.push({week:e.g.week,product,cashChange:e.g.personalCash-cash,balanceBefore:balance,balanceAfter:e.g.properties[0].mortgageBalance,result,valid:s.modules.finance.validate(JSON.parse(JSON.stringify(e.g))).ok});};action('variable');for(let i=0;i<2;i++){if(e.advanceWeek(false)!==true)throw Error('week rejected');action('conservative');if(e.advanceWeek(false)!==true)throw Error('week rejected');action('variable');}return{events,final:view(s)};});
for(const name of ['borrowFromBank','borrowAgainstProperty','refinancePropertyMortgage','prepayCompanyDebtVoluntarily'])run('control-save-false-'+name,()=>{const s=fixture(),e=s.e;if(name==='prepayCompanyDebtVoluntarily')e.borrowFromBank(10_000_000,52);const before=JSON.stringify(e.g);e.save=()=>false;let result;if(name==='borrowFromBank')result=e[name](1_000_000,52);if(name==='borrowAgainstProperty')result=e[name]('AUDIT-P',10_000_000,{rateType:'fixed'});if(name==='refinancePropertyMortgage')result=e[name]('AUDIT-P','fixed');if(name==='prepayCompanyDebtVoluntarily')result=e[name](1_000_000);const old=JSON.parse(before);return{result,unchanged:JSON.stringify(e.g)===before,economicUnchanged:['companyCash','personalCash','companyDebt','personalDebt','simulationRng','finance','realEstateMarket'].every(k=>JSON.stringify(e.g[k])===JSON.stringify(old[k])),changedFinanceKeys:Object.keys(e.g.finance).filter(k=>JSON.stringify(e.g.finance[k])!==JSON.stringify(old.finance[k])),changedKeys:Object.keys(e.g).filter(k=>JSON.stringify(e.g[k])!==JSON.stringify(old[k]))};});

run('company-mortgage-week',()=>{const s=fixture(),e=s.e,result=e.refinancePropertyMortgage('AUDIT-P','fixed');let weekResult,error;try{weekResult=e.advanceWeek(false);}catch(ex){error=ex.message;}return {result,weekResult,error,after:view(s),reloadValidation:s.modules.finance.validate(s.engineModule.TycoonEngine.load().g)};});
```

### Capital persistence probe — `/tmp/capital-atomicity-audit.js`

```js
'use strict';
const assert=require('node:assert/strict');
const {scenario}=require(process.cwd()+'/tests/fixtures/stock-split-atomicity');
const {inject,indexedDBFor}=require(process.cwd()+'/tests/fixtures/pe-fund-acquisition-faults');
const {loadGame}=require(process.cwd()+'/tests/harness');
(async()=>{for(const fault of ['save-false','save-before-throw','save-throw']){
 const s=await scenario('own'),e=s.game,before=JSON.parse(JSON.stringify(e.g)),bytes=s.backend.readSync(s.key);
 let injection;if(fault==='save-before-throw'){const base=e.save;e.save=()=>{throw Error('save before admission threw');};injection={restore(){e.save=base;}};}else injection=inject(e,s.modules,s.ctx.localStorage,s.key,fault);
 let result,error;try{result=e.contributeFounderCapital(1_000_000);}catch(ex){error=ex.message;}finally{injection.restore();}
 await s.backend.flush();const durable=s.durable.get(s.key),reload=s.engineModule.TycoonEngine.load().g;
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();const hydrated=fresh.engineModule.TycoonEngine.load().g;
 console.log(JSON.stringify({fault,result,error,liveCompanyCashDelta:e.g.companyCash-before.companyCash,livePersonalCashDelta:e.g.personalCash-before.personalCash,ledgerRowsAdded:e.g.finance.transactions.length-before.finance.transactions.length,durableChanged:durable!==bytes,reloadCompanyCashDelta:reload.companyCash-before.companyCash,freshHydrationCompanyCashDelta:hydrated.companyCash-before.companyCash}));
 assert.equal(e.g.companyCash-before.companyCash,1_000_000);if(fault==='save-false')assert.equal(result,true);if(fault==='save-throw'){assert.notEqual(durable,bytes);assert.equal(hydrated.companyCash-before.companyCash,1_000_000);}else assert.equal(durable,bytes);
 }} )().catch(e=>{console.error(e);process.exitCode=1;});
```

### Evidence oracle — `/tmp/verify-additional-debt-evidence.js`

```js
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
function verify(file){const rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse),d=Object.fromEntries(rows.map(x=>[x.id,x]));assert.equal(rows.length,19);
 const capital=d['capital-save-false'];assert.equal(capital.result,true);assert.equal(capital.after.companyCash-capital.before.companyCash,1_000_000);assert.equal(capital.rowsAdded,1);
 const personal=d['personal-generic-repay'];assert.equal(personal.afterGeneric.personalDebt,0);assert.equal(personal.afterGeneric.market[0].p,30_000_000);assert.equal(personal.afterSecond.personalDebt,-30_000_000);assert.equal(personal.reloadPersonalDebt,-30_000_000);
 for(const key of ['repay','prepayCompanyDebtVoluntarily','maturity']){const r=d['defaulted-'+key];assert.equal(r.before.validation.ok,true);assert.equal(r.status,'defaulted');assert.equal(r.result,true);assert.equal(r.after.validation.ok,false);assert.equal(r.after.loans[0].p,40_000_000);assert.ok(r.after.roll.errors.some(x=>x.includes('P2-DEBT-INSTRUMENTS')));}
 const trace=d['personal-interest-trace'];assert.equal(trace.result,true);assert.equal(trace.valid.ok,true);assert.ok(trace.moves.some(x=>x.delta<0&&x.stack.some(y=>y.includes('updatePersonalAssets'))));assert.ok(trace.moves.some(x=>x.delta<0&&x.stack.some(y=>y.includes('processLoans'))));assert.ok(trace.service[0].interest>0);
 const mortgage=d['mortgage-company'];assert.equal(mortgage.before.validation.ok,true);assert.equal(mortgage.after.validation.ok,false);assert.equal(mortgage.after.companyDebt,0);assert.equal(mortgage.after.mortgage,195_000_000);assert.equal(mortgage.after.loans.length,0);assert.match(d['company-mortgage-week'].error,/standalone-accounting-close-failed/);assert.equal(d['company-mortgage-week'].reloadValidation.ok,false);
 const cycle=d['personal-refinance-cycle'];assert.ok(cycle.events.every(x=>x.valid));const switches=cycle.events.filter(x=>x.product==='conservative');assert.equal(switches.length,2);assert.ok(switches.every(x=>x.cashChange===0&&x.balanceBefore-x.balanceAfter>60_000_000));const cashouts=cycle.events.filter(x=>x.product==='variable'&&x.balanceBefore>0);assert.equal(cashouts.length,2);assert.ok(cashouts.every(x=>x.cashChange>60_000_000));
 for(const row of rows.filter(x=>x.id.startsWith('control-'))){assert.equal(row.result,false);assert.equal(row.unchanged,true);}
 assert.equal(d['bank-maturity'].samples.at(-1).companyDebt,0);assert.equal(d['bank-maturity'].samples.at(-1).validation.ok,true);
 return {baseline:file,scenarios:rows.length,confirmed:['P4-AUD-003','P4-AUD-004','P4-AUD-005','P4-AUD-006','P4-AUD-007','P4-AUD-008'],controls:'four save-false controls fully restore state; bank amortization closes valid books',refinanceCashOuts:cashouts.map(x=>x.cashChange),negativeDebtAfterReload:personal.reloadPersonalDebt};
}
for(const path of process.argv.slice(2))console.log(JSON.stringify(verify(path)));
```
