'use strict';
// P3-11 founder wealth read-only projection: formulas, honest incompleteness,
// snapshot binding, currency gate, fail-closed input, purity and installed wiring.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./harness');
let seed=7,draws=0;
const loaded=loadGame({headless:true,random:()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}});
const api=loaded.modules.phase3FounderWealth;
const plain=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
// Output arrays come from the game realm; compare structurally across realms.
const deq=(a,b,m)=>assert.deepEqual(plain(a),plain(b),m);
const frozenDeep=x=>{if(x&&typeof x==='object'){assert(Object.isFrozen(x));Object.values(x).forEach(frozenDeep);}};
function fixture(){return {saveVersion:9,ticker:'OWN',week:7,currentCompanySerial:1,isCompanySold:false,companyName:'Co',playerName:'Founder',
 publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:400,stockPrice:20,
 market:[{id:'OWN',price:20},{id:'X',price:5}],startups:[],personalStocks:{OWN:{qty:100,avg:2},X:{qty:20,avg:4}},
 companyStocks:{X:{qty:30,avg:5}},personalCash:10,personalDebt:30,finance:{loans:[]}};}
function project(state,external){
 const b=api.captureFounderWealthEvidence(state,external);
 return api.projectFounderWealth(state,b.ownershipSnapshot,b.valuationEvidence,b.liabilityEvidence);
}
const comp=(r,id)=>r.components.find(c=>c.componentId===id);
const codes=rows=>rows.map(r=>r.code);
function noReference(value,target,seen=new Set()){
 if(value===target)return false;
 if(!value||typeof value!=='object'||seen.has(value))return true;
 seen.add(value);return Object.values(value).every(v=>noReference(v,target,seen));
}

// Listed formula (contract §7): original 400 + purchased own 100 = 500 × 20; generic own row excluded.
{
 const s=fixture(),before=JSON.stringify(s),drawsBefore=draws;
 const bundle=api.captureFounderWealthEvidence(s);
 const r=api.projectFounderWealth(s,bundle.ownershipSnapshot,bundle.valuationEvidence,bundle.liabilityEvidence);
 assert.equal(r.authority,'read-only');deq(r.reasons,[]);
 assert.equal(comp(r,'asset:own-company').amountJPY,10000);
 assert.equal(comp(r,'asset:own-company').valuationBasis,'marketPrice');
 assert.equal(comp(r,'asset:own-company').valuation.founderBeneficialShares,500);
 assert.equal(comp(r,'asset:listed:OWN'),undefined,'own ticker lot is not a second asset');
 assert(r.exclusions.some(x=>x.sourcePath==='personalStocks["OWN"]'&&x.basis==='included-in-own-company'));
 assert(r.exclusions.some(x=>x.sourcePath==='companyStocks["X"]'&&x.basis==='company-owned'),'company stocks never become personal wealth');
 assert.equal(comp(r,'asset:listed:X').amountJPY,100);
 assert.equal(comp(r,'asset:personal-cash').amountJPY,10);assert.equal(comp(r,'liability:personal-debt').amountJPY,-30);
 assert.equal(r.knownNetWorth,10080);
 // Unadapted families and liability coverage keep the total honest.
 assert.equal(r.complete,false);assert.equal(r.totalNetWorth,null);
 for(const id of ['asset:pe-interests','asset:unadapted-personal-families','liability:unreconciled-coverage']){
  assert(r.unvaluedComponents.includes(id));assert.equal(comp(r,id).amountJPY,null,'unknown is never zero');assert.equal(comp(r,id).completeness,'unknown');
 }
 deq(codes(comp(r,'asset:pe-interests').reasons),['VALUATION_INCOMPLETE']);
 deq(codes(comp(r,'liability:unreconciled-coverage').reasons),['LIABILITY_COVERAGE_UNKNOWN']);
 // Purity: input untouched/unfrozen, output frozen, deterministic, no RNG and no token escape.
 assert.equal(JSON.stringify(s),before);assert(!Object.isFrozen(s));assert(!Object.isFrozen(s.personalStocks));assert.equal(draws,drawsBefore);
 frozenDeep(r);frozenDeep(bundle);
 deq(plain(project(s)),plain(r));
 deq(plain(api.projectFounderWealth(s,bundle.ownershipSnapshot,bundle.valuationEvidence,bundle.liabilityEvidence)),plain(r),'reading twice is idempotent');
 assert(noReference(r,bundle.valuationEvidence.sourceSnapshotToken),'token never escapes into output');
 assert(noReference(r,s.personalStocks)&&noReference(r,s.market),'no live source reference escapes');
 // Raw versus serialized v9 reload and frozen input give identical output.
 deq(plain(project(plain(s))),plain(r));
 const ice=plain(s);(function f(x){if(x&&typeof x==='object'){Object.values(x).forEach(f);Object.freeze(x);}})(ice);
 deq(plain(project(ice)),plain(r));
 // Insertion-order permutation of source maps/rows does not change the projection.
 const p=plain(s);p.personalStocks={X:s.personalStocks.X,OWN:s.personalStocks.OWN};p.market=[s.market[1],s.market[0]];
 deq(plain(project(p)),plain(r));
}
// Negative net worth is preserved without a zero clamp.
{
 const s=fixture();s.publicCompany=false;s.personalStocks={};s.personalCash=10;s.personalDebt=30;
 const r=project(s);
 assert.equal(r.knownNetWorth,-20);assert.equal(r.totalNetWorth,null);
 deq(codes(comp(r,'asset:own-company').reasons),['VALUATION_INCOMPLETE'],'no approved private Equity Value source');
}
// Private formula: evidence-backed Equity Value × economic ownership × 0.70; EV is rejected.
{
 const s=fixture();Object.assign(s,{publicCompany:false,treasuryBuybackShares:0,founderShares:600,personalStocks:{},personalCash:0,personalDebt:0});
 const ev=(kind,extra={})=>({valuations:[{assetKey:'own-company',kind,amount:100e6,currency:'JPY',sourceMethod:'fixture-equity',sourceVersion:1,asOfWeek:7,coveredAssets:['subsidiaries'],coveredLiabilities:['finance.loans'],...extra}]});
 const r=project(s,ev('equityValue'));
 assert.equal(comp(r,'asset:own-company').amountJPY,42e6);assert.equal(api.PRIVATE_EQUITY_FACTOR,0.70);
 assert.equal(comp(r,'asset:own-company').valuation.founderEconomicOwnership,0.6);
 assert.equal(r.knownNetWorth,42e6);assert.equal(r.totalNetWorth,null);
 const e=project(s,ev('enterpriseValue'));
 assert.equal(comp(e,'asset:own-company').amountJPY,null);deq(codes(comp(e,'asset:own-company').reasons),['VALUATION_BASIS_UNSUPPORTED']);
 assert.equal(e.knownNetWorth,0);
 deq(codes(comp(project(s,ev('companyValue')),'asset:own-company').reasons),['VALUATION_BASIS_UNSUPPORTED']);
 deq(codes(comp(project(s,ev('equityValue',{amount:-1})),'asset:own-company').reasons),['VALUATION_BASIS_UNSUPPORTED']);
 const two=ev('equityValue');two.valuations.push({...two.valuations[0],amount:200e6});
 deq(codes(comp(project(s,two),'asset:own-company').reasons),['VALUATION_SOURCE_CONFLICT']);
 // A listed company is valued by market price only; supplied Equity Value is excluded.
 const listed=fixture(),lr=project(listed,ev('equityValue'));
 assert.equal(comp(lr,'asset:own-company').amountJPY,10000);
 assert(lr.exclusions.some(x=>x.basis==='listed-company-uses-market-price'));
 // Unsupported supplied asset keys and malformed supplied rows are explicit input failures.
 assert(project(s,{valuations:[{...ev('equityValue').valuations[0],assetKey:'fund'}]}).reasons.some(x=>x.code==='VALUATION_BASIS_UNSUPPORTED'&&x.path==='valuationEvidence.supplied.valuations[0].assetKey'));
 const bad=project(s,{valuations:[{assetKey:'own-company'}]});
 assert(bad.reasons.some(x=>x.code==='INPUT_INVALID'&&x.path==='valuationEvidence.supplied.valuations[0]'));assert.equal(bad.complete,false);
 let reads=0;const getter={valuations:[]};Object.defineProperty(getter,'liabilities',{enumerable:true,get(){reads++;return [];}});
 assert(project(s,getter).reasons.some(x=>x.code==='INPUT_INVALID'));assert.equal(reads,0);
}
// Own-company quote policy: conflicting/missing quotes and unproven generation stay unknown.
{
 const conflict=fixture();conflict.stockPrice=21;
 deq(codes(comp(project(conflict),'asset:own-company').reasons),['VALUATION_SOURCE_CONFLICT']);
 for(const change of [s=>{s.market=[{id:'X',price:5}];},s=>{delete s.stockPrice;},s=>{s.market[0].suspended=true;}]){
  const s=fixture();change(s);const c=comp(project(s),'asset:own-company');
  assert.equal(c.amountJPY,null);deq(codes(c.reasons),['VALUATION_INCOMPLETE']);
 }
 for(const change of [s=>{s.market[0].price=NaN;},s=>{s.stockPrice=-1;}]){
  const s=fixture();change(s);deq(codes(comp(project(s),'asset:own-company').reasons),['VALUATION_SOURCE_CONFLICT']);
 }
 for(const change of [s=>{s.currentCompanySerial=2;},s=>{s.isCompanySold=true;},s=>{s.market.push({id:'OWN',price:20});}]){
  const s=fixture();change(s);const r=project(s);
  assert.equal(comp(r,'asset:own-company').amountJPY,null);assert(comp(r,'asset:own-company').reasons.length>0);
 }
 const huge=fixture();huge.personalStocks.X.qty=Number.MAX_SAFE_INTEGER;huge.market[1].price=1e6;
 const hr=project(huge);deq(codes(comp(hr,'asset:listed:X').reasons),['NUMERIC_DOMAIN_UNSUPPORTED']);assert.equal(hr.knownNetWorth,10000-20);
 const nan=fixture();nan.personalCash=NaN;
 const nr=project(nan);deq(codes(comp(nr,'asset:personal-cash').reasons),['INPUT_INVALID']);assert.equal(nr.knownNetWorth,10000+100-30);
 const dup=fixture();dup.market.push({id:'X',price:6});
 assert.equal(comp(project(dup),'asset:listed:X').amountJPY,null);
}
// Currency: explicit JPY only; missing/USD/EUR/unknown labels give CURRENCY_UNSUPPORTED before arithmetic.
{
 const s=fixture();Object.assign(s,{publicCompany:false,treasuryBuybackShares:0,founderShares:600,personalStocks:{}});
 const ev=currency=>({valuations:[{assetKey:'own-company',kind:'equityValue',amount:100e6,currency,sourceMethod:'fixture-equity'}]});
 for(const currency of [undefined,'USD','EUR','円','jpy']){
  const r=project(s,ev(currency));
  deq(r.reasons.map(x=>[x.code,x.path]),[['CURRENCY_UNSUPPORTED','valuationEvidence.entries[1].currency']]);
  deq(codes(comp(r,'asset:own-company').reasons),['CURRENCY_UNSUPPORTED']);
  assert.equal(r.knownNetWorth,-20,'no rejected nominal amount contributes');assert.equal(r.totalNetWorth,null);assert.equal(r.complete,false);
 }
 const liability=(currency,amount=5)=>({liabilities:[{liabilityKey:'tax-bill',amount,currency,sourceMethod:'fixture-liability'}]});
 assert.equal(comp(project(s,liability('JPY')),'liability:supplied:tax-bill').amountJPY,-5);
 assert.equal(project(s,liability('JPY')).knownNetWorth,-25);
 const mixed=project(s,{...ev('JPY'),...liability('USD',1e9)});
 deq(mixed.reasons.map(x=>[x.code,x.path]),[['CURRENCY_UNSUPPORTED','liabilityEvidence.entries[1].currency']]);
 assert.equal(mixed.knownNetWorth,42e6-20);
 deq(codes(comp(project(s,{liabilities:[{liabilityKey:'personal-debt',amount:1,currency:'JPY',sourceMethod:'x'}]}),'liability:supplied:personal-debt').reasons),[]);
}
// Founder loans, margin, liability mirrors, VC/angel/PE families and the company/personal boundary.
{
 const s=fixture();
 s.finance.loans=[{loanID:'L1',sourceType:'founderShareholderLoan',status:'active',outstandingPrincipal:50},{loanID:'L2',sourceType:'founderShareholderLoan',status:'repaid',outstandingPrincipal:0},
  {loanID:'BANK',sourceType:'legacyFinance',status:'active',outstandingPrincipal:999}];
 s.personalMarginLoan={balance:7};s.realEstate={loans:[{loanID:'RE1',owner:'personal',status:'active'},{loanID:'RE2',owner:'company',status:'active'}]};
 s.startups=[{id:'s',alive:true,subsidiary:false,ownedCompany:.2,ownedPersonal:.1}];
 s.peDeals=[{id:'p1',ownerAccount:'personal',status:'active'},{id:'p2',ownerAccount:'company',status:'active'}];
 s.angelInvestments=[{id:'a1',status:'active'},{id:'a2',status:'exited'}];
 const r=project(s);
 assert.equal(comp(r,'asset:founder-loan:L1').amountJPY,50);assert.equal(comp(r,'asset:founder-loan:BANK'),undefined,'company debt is not a personal asset');
 assert.equal(comp(r,'liability:margin').amountJPY,-7);
 deq(comp(r,'liability:personal-debt').includesKeys,['personalDebt','realEstate.loans[0]']);
 assert(r.exclusions.some(x=>x.sourcePath==='realEstate.loans[0]'&&x.basis==='included-in-personal-debt'),'mirror not re-added');
 assert.equal(r.knownNetWorth,10000+100+10+50-30-7);
 assert.equal(comp(r,'asset:vc-personal:startups[0].ownedPersonal').amountJPY,null);
 assert(r.exclusions.some(x=>x.sourcePath==='startups[0].ownedCompany'&&x.basis==='company-owned'));
 deq(comp(r,'asset:pe-interests').includesKeys,['peDeals[0]']);assert.equal(comp(r,'asset:pe-interests').amountJPY,null);
 assert(r.exclusions.some(x=>x.sourcePath==='peDeals[1]'&&x.basis==='company-owned'));
 assert.equal(comp(r,'asset:angel:angelInvestments[0]').amountJPY,null);
 assert(r.exclusions.some(x=>x.sourcePath==='angelInvestments[1]'&&x.basis==='historical'));
 assert(r.exclusions.some(x=>x.sourcePath==='finance.loans[1]'&&x.basis==='historical'));
 const d=plain(s);d.finance.loans.push({...d.finance.loans[0]});
 deq(codes(comp(project(d),'asset:founder-loan:L1').reasons),['ALIAS_CONFLICT']);
 // P3-7 GP fund capital (NAV 1000, GP 2%) never becomes a founder amount; paid cash is not re-added.
 const f=plain(s);f.peFirm={funds:[{id:'F1',size:1000,gpCommit:20,lpContributed:980,status:'investing',nav:1000,gpDistributed:5,lpDistributed:0,gpCarryPaid:3,managementFeesPaid:1,deals:[]}]};
 const fr=project(f);
 deq(comp(fr,'asset:pe-interests').includesKeys,['peDeals[0]','peFirm.funds[0]']);assert.equal(comp(fr,'asset:pe-interests').amountJPY,null);
 assert(fr.exclusions.some(x=>x.sourcePath==='peFirm.funds[0]'&&x.basis==='historical-paid-cash'));assert.equal(fr.knownNetWorth,r.knownNetWorth);
 const bf=plain(f);bf.peFirm.funds[0].lpContributed=1;
 assert(codes(comp(project(bf),'asset:pe-interests').reasons).includes('CONTRIBUTION_MISMATCH'));
 // P4-AUD-004: only accountingTracked specialist loans are inside personalDebt; others stay unknown.
 const t=plain(s);t.realEstateMarket={loans:[{id:'M1',owner:'personal',status:'defaulted',accountingTracked:true},{id:'M2',owner:'personal',status:'active'},{id:'M3',owner:'personal',status:'paid'}]};
 const tr=project(t);
 assert(comp(tr,'liability:personal-debt').includesKeys.includes('realEstateMarket.loans[0]'));
 const u=comp(tr,'liability:untracked-property-loan:realEstateMarket.loans[1]');
 assert.equal(u.amountJPY,null);deq(codes(u.reasons),['LIABILITY_COVERAGE_UNKNOWN']);assert(tr.unvaluedComponents.includes(u.componentId));
 assert.equal(comp(tr,'liability:untracked-property-loan:realEstateMarket.loans[2]'),undefined);
 const m=plain(s);m.personalMarginLoan.balance=-1;deq(codes(comp(project(m),'liability:margin').reasons),['INPUT_INVALID']);
}
// Single committed-snapshot boundary: mixed, forged, missing, in-place changed and replaced evidence.
{
 const s=fixture(),a=api.captureFounderWealthEvidence(s);
 s.personalStocks.X.qty+=1;s.personalCash-=5;// same-week purchase
 const b=api.captureFounderWealthEvidence(s);
 const stale=(r,paths)=>{
  deq(r.reasons.map(x=>[x.code,x.path]),paths.map(p=>['STALE_EVIDENCE',`${p}.sourceSnapshotToken`]));
  assert.equal(r.components.length,0);assert.equal(r.knownNetWorth,null);assert.equal(r.totalNetWorth,null);assert.equal(r.complete,false);
  for(const x of r.reasons)deq(x.evidenceRefs,[x.path.split('.')[0]]);
 };
 stale(api.projectFounderWealth(s,a.ownershipSnapshot,b.valuationEvidence,b.liabilityEvidence),['ownershipSnapshot']);
 stale(api.projectFounderWealth(s,b.ownershipSnapshot,a.valuationEvidence,b.liabilityEvidence),['valuationEvidence']);
 stale(api.projectFounderWealth(s,b.ownershipSnapshot,b.valuationEvidence,a.liabilityEvidence),['liabilityEvidence']);
 stale(api.projectFounderWealth(s,a.ownershipSnapshot,a.valuationEvidence,a.liabilityEvidence),['liabilityEvidence','ownershipSnapshot','valuationEvidence']);
 stale(api.projectFounderWealth(s,{...b.ownershipSnapshot},b.valuationEvidence,b.liabilityEvidence),['ownershipSnapshot']);
 stale(api.projectFounderWealth(s,undefined,{sourceSnapshotToken:b.valuationEvidence.sourceSnapshotToken},b.liabilityEvidence),['ownershipSnapshot','valuationEvidence']);
 stale(api.projectFounderWealth(s,b.valuationEvidence,b.ownershipSnapshot,b.liabilityEvidence),['ownershipSnapshot','valuationEvidence']);
 assert.equal(api.projectFounderWealth(s,b.ownershipSnapshot,b.valuationEvidence,b.liabilityEvidence).reasons.length,0);
 // Two captures of one unchanged state carry different tokens; mixing them is rejected.
 const c=api.captureFounderWealthEvidence(s);
 stale(api.projectFounderWealth(s,c.ownershipSnapshot,b.valuationEvidence,b.liabilityEvidence),['liabilityEvidence','ownershipSnapshot','valuationEvidence']);
 // Hydration/rollback replacement: an equal but different object is another revision.
 stale(api.projectFounderWealth(plain(s),b.ownershipSnapshot,b.valuationEvidence,b.liabilityEvidence),['liabilityEvidence','ownershipSnapshot','valuationEvidence']);
 // Ownership-only fields (buyback/share issue) are bound through the ownership index as well.
 for(const change of [x=>{x.treasuryBuybackShares+=10;},x=>{x.founderShares-=1;},x=>{x.companyStocks.X.qty++;},x=>{x.personalDebt++;},x=>{x.finance.loans.push({loanID:'n',sourceType:'founderShareholderLoan',status:'active',outstandingPrincipal:1});}]){
  const t=fixture(),e=api.captureFounderWealthEvidence(t);change(t);
  stale(api.projectFounderWealth(t,e.ownershipSnapshot,e.valuationEvidence,e.liabilityEvidence),['liabilityEvidence','ownershipSnapshot','valuationEvidence']);
 }
}
// Malformed, cyclic, accessor and exotic raw input fails closed with INPUT_INVALID at rawState.
{
 const good=fixture(),ev=api.captureFounderWealthEvidence(good);
 let reads=0;
 const cases=[null,5,'state',[],new (class Exotic{})()];
 const getter=fixture();Object.defineProperty(getter,'personalCash',{enumerable:true,get(){reads++;return 1;}});cases.push(getter);
 const rowGetter=fixture();Object.defineProperty(rowGetter.market[0],'price',{enumerable:true,get(){reads++;return 20;}});cases.push(rowGetter);
 const cyclic=fixture();cyclic.personalStocks.X.self=cyclic.personalStocks;cases.push(cyclic);
 const sparse=fixture();sparse.market.length=5;cases.push(sparse);
 const symbol=fixture();symbol.personalStocks[Symbol('x')]={qty:1};cases.push(symbol);
 const hidden=fixture();Object.defineProperty(hidden,'personalDebt',{enumerable:false,value:1});cases.push(hidden);
 const wrong=fixture();wrong.market={};cases.push(wrong);
 const proto=fixture();proto.personalStocks=Object.create({inherited:true});cases.push(proto);
 for(const raw of cases){
  const r=api.projectFounderWealth(raw,ev.ownershipSnapshot,ev.valuationEvidence,ev.liabilityEvidence);
  deq(r.reasons.map(x=>[x.code,x.path]),[['INPUT_INVALID','rawState']]);
  assert.equal(r.components.length,0);assert.equal(r.knownNetWorth,null);assert.equal(r.totalNetWorth,null);assert.equal(r.complete,false);frozenDeep(r);
  const bundle=api.captureFounderWealthEvidence(raw);
  assert.equal(bundle.ownershipSnapshot,null);deq(bundle.issues.map(x=>[x.code,x.path]),[['INPUT_INVALID','rawState']]);
 }
 assert.equal(reads,0,'getters are never executed');
}
// Module registration and lexical read-only boundary.
{
 const code=fs.readFileSync(require.resolve('../js/phase3-founder-wealth.js'),'utf8');
 assert.throws(()=>vm.runInContext(code,loaded.ctx),/already registered/);
 assert.throws(()=>vm.runInNewContext(code,{__capitalismTycoonModules:{}}),/must precede/);
 for(const forbidden of ['Math.random','Date.now','new Date','localStorage','indexedDB','.save(','emit(','ensure','normalize','personalNetWorth','TycoonEngine','finance.event'])
  assert(!code.includes(forbidden),`read-only projection must not reference ${forbidden}`);
 assert(Object.isFrozen(api));
}
// Installed engine: real state, real same-week personal writers, no RNG/save/consumer change.
{
 const engine=new loaded.engineModule.TycoonEngine(),g=engine.g;
 g.configured=true;g.personalCash=50e6;engine.normalize();
 const storage=JSON.stringify([...loaded.ctx.__localStorageData]);
 const netWorth=engine.personalNetWorth(),credit=engine.personalCreditLimit(),snapshot=JSON.stringify(g),drawsBefore=draws;
 const first=api.captureFounderWealthEvidence(g),r=api.projectFounderWealth(g,first.ownershipSnapshot,first.valuationEvidence,first.liabilityEvidence);
 assert.equal(JSON.stringify(g),snapshot);assert.equal(draws,drawsBefore);assert.equal(JSON.stringify([...loaded.ctx.__localStorageData]),storage);
 assert.equal(engine.personalNetWorth(),netWorth);assert.equal(engine.personalCreditLimit(),credit);
 assert.equal(comp(r,'asset:personal-cash').amountJPY,g.personalCash);
 assert.equal(comp(r,'liability:personal-debt').amountJPY,g.personalDebt===0?0:-g.personalDebt);
 deq(plain(project(plain(g))),plain(r),'raw installed state equals its v9 JSON reload');
 assert.equal(r.totalNetWorth,null);assert.equal(r.complete,false);
 // Same-week personal borrowing changes the committed revision; prior evidence is stale.
 assert.notEqual(engine.borrow(1_000_000,'personal'),false);
 const after=api.projectFounderWealth(g,first.ownershipSnapshot,first.valuationEvidence,first.liabilityEvidence);
 assert(after.reasons.every(x=>x.code==='STALE_EVIDENCE')&&after.reasons.length===3);
 const fresh=project(g);
 assert.equal(comp(fresh,'liability:personal-debt').amountJPY,-g.personalDebt);assert.equal(comp(fresh,'asset:personal-cash').amountJPY,g.personalCash);
 assert.equal(fresh.knownNetWorth,r.knownNetWorth,'borrowing swaps cash for debt');
}
console.log('PASS P3-11 founder wealth: owner formulas, honest partial totals, snapshot binding, JPY gate, fail-closed input, purity and installed wiring');
