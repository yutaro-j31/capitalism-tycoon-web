'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');

function boot(seed=0x51f15e){
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/0x100000000;};
  return loadGame({random,isolatedLegacyIndex:true});
}
function engineWithFund(size,fee=.02,seed){
  const loaded=boot(seed),e=new loaded.engineModule.TycoonEngine(),pf=loaded.modules.peFund;
  const fund=pf.createFund(e.g,{size,terms:{fee,carry:.2,hurdle:.08}});
  return {...loaded,e,pf,fund};
}

// A. The Fund I path uses the production formation and fee formulas end to end.
{
  const loaded=boot(),e=new loaded.engineModule.TycoonEngine(),pf=loaded.modules.peFund;
  e.g.personalCash=1_000_000_000;e.g.peFirm.trackRecord.score=5;
  const size=pf.formableFundSize(e.g),terms=pf.fundTermsForScore(5);
  const fund=pf.createFund(e.g,{size,terms});
  assert.ok(Math.abs(size-2_800_000_000)/2_800_000_000<.05);
  assert.ok(pf.annualManagementFee(fund)>=42_000_000&&pf.annualManagementFee(fund)<=46_000_000);
  assert.equal(pf.teamCapacity(fund),2);
  assert.equal(pf.externalHireCapacity(fund),1,'GP is implicit, so only one external hire fits Fund I');
  assert.ok(pf.slotCapacity(e.g,fund)>=2&&pf.slotCapacity(e.g,fund)<=3);
}

// B-D/F/G. Fee-derived team capacity, calibrated slot tiers, partner bonus and ceilings.
{
  const mid=engineWithFund(13_200_000_000,.019);
  assert.equal(mid.pf.teamCapacity(mid.fund),12);
  assert.ok(mid.pf.baseSlotCapacity(mid.fund)>=4&&mid.pf.baseSlotCapacity(mid.fund)<=6);
  const base=mid.pf.slotCapacity(mid.e.g,mid.fund);
  assert.ok(mid.pf.addTeamMember(mid.e.g,'investmentPartner'));
  assert.equal(mid.pf.slotCapacity(mid.e.g,mid.fund),base+1);
  mid.e.g.executives={cfo:{skill:100}};
  assert.equal(mid.pf.slotCapacity(mid.e.g,mid.fund),base+1,'ordinary executives are not PE team members');

  const high=engineWithFund(81_000_000_000,.021);
  assert.equal(high.pf.teamCapacity(high.fund),60);
  assert.equal(high.pf.baseSlotCapacity(high.fund),8);
  high.pf.addTeamMember(high.e.g,'investmentPartner');
  assert.equal(high.pf.slotCapacity(high.e.g,high.fund),8);
  const stress=engineWithFund(5_000_000_000_000,.05);
  for(let i=0;i<100;i++)stress.pf.addTeamMember(stress.e.g,'investmentPartner');
  assert.equal(stress.pf.teamCapacity(stress.fund),60);
  assert.equal(stress.e.g.peFirm.team.length,59);
  assert.equal(stress.pf.slotCapacity(stress.e.g,stress.fund),8);

  const lowFee=engineWithFund(13_200_000_000,.01);
  const highFee=engineWithFund(13_200_000_000,.02);
  assert.ok(lowFee.pf.teamCapacity(lowFee.fund)<highFee.pf.teamCapacity(highFee.fund));
}

// E/H. Attention is finite at zero and directly scales resolved production improvements.
{
  const {e,pf,modules,fund}=engineWithFund(2_800_000_000,.0155);
  pf.addTeamMember(e.g,'industryExpert');
  assert.ok(pf.attention(e.g,1,fund)>=1);
  assert.equal(pf.attention(e.g,2,fund),1);
  assert.ok(pf.attention(e.g,3,fund)<1);
  assert.ok(Number.isFinite(pf.attention(e.g,0,fund)));
  assert.ok(pf.attentionImprovementMultiplier(e.g,3,fund)<pf.attentionImprovementMultiplier(e.g,2,fund));
  e.g.week=10;
  e.g.peDeals=[1,2,3].map(n=>({id:`d${n}`,status:'active',ownerAccount:'personal',improvementScore:20,currentValuation:100,pendingInitiative:n===1?{initiativeID:'cost-cut',matched:true,succeeded:true,scoreDelta:10,valuationDelta:.1,resolveWeek:10}:null}));
  modules.peValueCreation.resolvePendingInitiatives(e);
  assert.ok(Math.abs(e.g.peDeals[0].improvementScore-(20+10*2/3))<1e-9,'production score gain must use attention');
  assert.ok(e.g.peDeals[0].currentValuation<110,'understaffing must visibly reduce production valuation gain');
}

// H/I/J/K. Malformed legacy normalization, JSON round-trip and same-state determinism.
{
  const first=engineWithFund(13_200_000_000,.019,77);
  first.pf.addTeamMember(first.e.g,'investmentPartner');
  first.e.g.peDeals=[{id:'held',status:'active'}];
  const snapshot=JSON.parse(JSON.stringify(first.e.g));
  const before=[first.pf.teamSize(first.e.g),first.pf.slotCapacity(first.e.g),first.pf.attention(first.e.g),first.pf.availableSlots(first.e.g)];
  const second=boot(77),restored=new second.engineModule.TycoonEngine();restored.g=snapshot;restored.normalize();
  assert.deepEqual([second.modules.peFund.teamSize(restored.g),second.modules.peFund.slotCapacity(restored.g),second.modules.peFund.attention(restored.g),second.modules.peFund.availableSlots(restored.g)],before);
  restored.g.peFirm.funds[0]={size:'bad',terms:{fee:Infinity},deals:null};restored.normalize();
  for(const value of [second.modules.peFund.teamCapacity(restored.g.peFirm.funds[0]),second.modules.peFund.slotCapacity(restored.g,restored.g.peFirm.funds[0]),second.modules.peFund.attention(restored.g,0,restored.g.peFirm.funds[0])])assert.ok(Number.isFinite(value));
  const legacy=boot(9),old=new legacy.engineModule.TycoonEngine();delete old.g.peFirm;const cash=[old.g.companyCash,old.g.personalCash,old.g.week,JSON.stringify(old.g.stores)];old.normalize();
  assert.deepEqual([old.g.companyCash,old.g.personalCash,old.g.week,JSON.stringify(old.g.stores)],cash);

  const replay=()=>{const x=engineWithFund(13_200_000_000,.019,123);x.pf.addTeamMember(x.e.g,'investmentPartner');return JSON.parse(JSON.stringify({team:x.e.g.peFirm.team,capacity:x.pf.teamCapacity(x.fund),slots:x.pf.slotCapacity(x.e.g),attention:x.pf.attention(x.e.g,3),available:x.pf.availableSlots(x.e.g)}));};
  assert.deepEqual(replay(),replay());
}

{
  const {e,pf,fund}=engineWithFund(1);
  assert.equal(pf.holdingPeriodYears(e.g,fund),4);
  const second=pf.createFund(e.g,{size:1,terms:{fee:.02}});
  assert.equal(pf.holdingPeriodYears(e.g,second),3);
}
const source=fs.readFileSync('js/pe-fund.js','utf8');
for(const forbidden of ['Math.random()','Date.now()','randomUUID','performance.now()'])assert.ok(!source.includes(forbidden));
console.log('pe fund T9 team and slot tests passed');
