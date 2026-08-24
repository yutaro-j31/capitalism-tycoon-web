'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const {loadGame}=require('./harness');
const loaded=()=>loadGame({headless:true});

// Policy schema and malformed/legacy fallback are bounded to five company-wide choices.
{
 const mod=loaded().modules.realEstateAgencyPipeline;
 assert.deepEqual(Array.from(mod.FOCUS_ORDER),['balanced','residential','luxury','investment','corporateDeal']);
 assert.equal(mod.focusFor({}).id,'balanced');assert.equal(mod.focusFor({brokerageFocusID:'bad'}).id,'balanced');
 assert.equal(mod.FOCUSES.corporateDeal.id,'corporateDeal');assert.equal(mod.FOCUS_WEIGHT_MULTIPLIER,3);
}

// Balanced uses the exact pre-feature cumulative-weight algorithm for individual identities.
{
 const mod=loaded().modules.realEstateAgencyPipeline;
 assert.equal(mod.segmentForDeal(4242,'deal-109','store-a','balanced'),'residential','pre-feature main identity at the residential boundary must remain exact');
 for(const seed of [1,77,731,9999])for(const store of ['s1','tokyo-main','branch-3'])for(let i=0;i<50;i++){
  const id=`deal-${i}`;assert.equal(mod.segmentForDeal(seed,id,store,'balanced'),mod.legacySegmentForDeal(seed,id,store));
 }
}

// Deterministic 1,000-ID distributions increase the target while retaining all four segments.
const distributions={};
{
 const mod=loaded().modules.realEstateAgencyPipeline;
 for(const focus of mod.FOCUS_ORDER){const counts=Object.fromEntries(mod.SEGMENTS.map(x=>[x,0]));for(let i=0;i<1000;i++)counts[mod.segmentForDeal(4242,`deal-${i}`,'store-a',focus)]++;distributions[focus]=counts;assert.ok(Object.values(counts).every(value=>value>0));}
 for(const focus of mod.SEGMENTS)assert.ok(distributions[focus][focus]>distributions.balanced[focus]);
 assert.deepEqual(distributions,(()=>{const out={};for(const focus of mod.FOCUS_ORDER){const c=Object.fromEntries(mod.SEGMENTS.map(x=>[x,0]));for(let i=0;i<1000;i++)c[mod.segmentForDeal(4242,`deal-${i}`,'store-a',focus)]++;out[focus]=c;}return out;})());
 console.log('BROKERAGE_FOCUS_DISTRIBUTION '+JSON.stringify(distributions));
}

// Focus action changes no account or ledger, preserves active deals, persists, and rejects invalid/same values.
{
 const x=loaded(),e=new x.engineModule.TycoonEngine();e.configure({playerName:'Focus',companyName:'Focus Realty',difficulty:'normal',scenario:'free'});const b=e.business('realEstateAgency');
 const cash=e.g.companyCash,personal=e.g.personalCash,tx=e.g.finance.transactions.length;
 assert.equal(e.changeBrokerageFocus('investment'),true);assert.equal(b.brokerageFocusID,'investment');assert.equal(e.g.companyCash,cash);assert.equal(e.g.personalCash,personal);assert.equal(e.g.finance.transactions.length,tx);assert.equal(e.changeBrokerageFocus('investment'),false);assert.equal(e.changeBrokerageFocus('bad'),false);
 const store={id:'legacy-store',businessID:'realEstateAgency',status:'open',brokeragePipeline:{activeDeals:[{id:'active',createdWeek:1,askingValue:40e6,segment:'residential'},{id:'legacy',createdWeek:1,askingValue:40e6}],totals:{}}};e.g.stores.push(store);x.modules.realEstateAgencyPipeline.ensureStore(store,b,e.g.week,e.g.seed);const active=store.brokeragePipeline.activeDeals.find(d=>d.id==='active'),legacy=store.brokeragePipeline.activeDeals.find(d=>d.id==='legacy');assert.equal(active.segment,'residential');assert.equal(legacy.segment,x.modules.realEstateAgencyPipeline.legacySegmentForDeal(e.g.seed,'legacy',store.id));
 assert.equal(e.changeBrokerageFocus('corporateDeal'),true);assert.equal(active.segment,'residential');assert.equal(legacy.segment,x.modules.realEstateAgencyPipeline.legacySegmentForDeal(e.g.seed,'legacy',store.id));
 e.save();const reloaded=x.engineModule.TycoonEngine.load();assert.equal(reloaded.business('realEstateAgency').brokerageFocusID,'corporateDeal');assert.equal(reloaded.g.stores.find(s=>s.id===store.id).brokeragePipeline.activeDeals.find(d=>d.id==='active').segment,'residential');
}

function run(focus,cycle=1){const x=loaded(),mod=x.modules.realEstateAgencyPipeline,b={id:'realEstateAgency',quality:40,brand:55,efficiency:38,dx:30,brokerageFocusID:focus},store={id:'focus-store',businessID:'realEstateAgency',status:'open'},g={week:1,seed:8675309,realEstateCycle:cycle,stores:[store],businesses:[b]},pref={traffic:1.25};let maxActive=0,totalCloseWeeks=0;
 for(let i=0;i<208;i++){g.week=i+1;const row=mod.processStore(g,store,b,pref).kpi;maxActive=Math.max(maxActive,row.activeDeals);totalCloseWeeks+=row.averageCloseWeeks*row.closedDeals;}
 const t=store.brokeragePipeline.totals;return{inquiries:t.inquiries,mandates:t.mandates,closedDeals:t.closedDeals,lostDeals:t.lostDeals,closeRate:t.closedDeals/Math.max(1,t.closedDeals+t.lostDeals),averageCloseWeeks:t.closedDeals?totalCloseWeeks/t.closedDeals:0,averageTransactionValue:t.closedDeals?t.closedTransactionVolume/t.closedDeals:0,closedTransactionVolume:t.closedTransactionVolume,commissionRevenue:t.commissionRevenue,maxActive,capacity:store.brokeragePipeline.capacity,capacityUtilization:maxActive/store.brokeragePipeline.capacity,closedBySegment:t.closedBySegment};}

// 208-week and cycle probes stay finite/capacity-bounded and expose existing segment tradeoffs.
{
 const mod=loaded().modules.realEstateAgencyPipeline,policies={};for(const focus of mod.FOCUS_ORDER){policies[focus]=run(focus);for(const value of Object.values(policies[focus]).filter(Number.isFinite))assert.ok(value>=0);assert.ok(policies[focus].maxActive<=policies[focus].capacity);}
 const cycles={recession:{},neutral:{},boom:{}};for(const [name,cycle] of [['recession',.7],['neutral',1],['boom',1.4]])for(const focus of mod.FOCUS_ORDER)cycles[name][focus]=run(focus,cycle);
 const investmentSwing=cycles.boom.investment.commissionRevenue-cycles.recession.investment.commissionRevenue,residentialSwing=cycles.boom.residential.commissionRevenue-cycles.recession.residential.commissionRevenue;assert.ok(investmentSwing>residentialSwing);
 console.log('BROKERAGE_FOCUS_208 '+JSON.stringify(policies));console.log('BROKERAGE_FOCUS_CYCLES '+JSON.stringify(cycles));
}

// No random source or new UI surface; all five choices are wired into the existing card.
{
 const source=fs.readFileSync('js/real-estate-agency-pipeline.js','utf8'),app=fs.readFileSync('js/app.js','utf8');assert.doesNotMatch(source,/Math\.random/);for(const id of ['balanced','residential','luxury','investment','corporateDeal'])assert.ok(source.includes(id));assert.ok(app.includes("'set-brokerage-focus'"));assert.ok(app.includes('営業方針:'));assert.ok(app.includes('商談中内訳'));assert.doesNotMatch(app,/brokerage-focus-modal/);
}
console.log('real estate agency focus tests passed');
