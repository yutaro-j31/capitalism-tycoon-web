// R4 remaining item "開発・再開発". The company-side real-estate-redevelopment-projects.js
// already models 3 capex tiers (改装/用途転換/建替え) against g.properties, and its code even
// already branches cash/owner handling for a personal owner -- but there is no gameplay path
// that ever creates a personally-owned g.properties row. Personal real estate lives entirely
// in the separate g.personalRealEstateHoldings array/catalog (see docs/feature-requests.md's
// warning about conflating the two systems: "混同すると...空振りする"). This reuses the exact
// same cost/value/condition-gain/duration numbers as the company-side PROJECTS table, but
// points them at personalRealEstateHoldings's own fields (currentValue/bookValue/
// rentalOps.condition) instead of g.properties's, so a personal player gets the same capex
// tradeoff without ever touching g.properties or its 46 dependent modules.
//
// Funded from personalCash only, and never recorded to the company finance ledger -- matching
// every other personal-real-estate module (mortgage, taxes, short-term letting).
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before personal-real-estate-redevelopment.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before personal-real-estate-redevelopment.js.');
if(modules.personalRealEstateRedevelopment)throw new Error('Personal real estate redevelopment is already registered.');
const Engine=modules.engine.TycoonEngine;

const PROJECTS=Object.freeze({
  refresh:{id:'refresh',label:'改装',costRate:.04,valueRate:.07,conditionGain:12,durationWeeks:4},
  conversion:{id:'conversion',label:'用途転換',costRate:.12,valueRate:.22,conditionGain:22,durationWeeks:10},
  rebuild:{id:'rebuild',label:'建替え',costRate:.28,valueRate:.48,conditionGain:45,durationWeeks:20}
});

const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const ceilYen=v=>modules.economicOperation.ceilYen(finite(v));
const roundValue=v=>Math.round(finite(v)*100)/100; /* not-money: valuation estimate (currentValue), not a settlement */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,finite(v,a)));

function holding(state,assetID){return (state.personalRealEstateHoldings||[]).find(x=>x.assetID===assetID&&x.status==='owned')||null;}
function valueOf(x){return Math.max(1,finite(x.currentValue,finite(x.purchasePrice,1)));}
function inProgress(x){return Boolean(x&&x.redevelopmentProjectID);}

function quotesFor(x){
  if(!x||inProgress(x))return [];
  const value=valueOf(x);
  return Object.values(PROJECTS).map(p=>({...p,cost:ceilYen(value*p.costRate),valueGain:roundValue(value*p.valueRate),targetValue:roundValue(value*(1+p.valueRate))}));
}

Engine.prototype.getPersonalRealEstateRedevelopmentProjects=function(assetID){
  return quotesFor(holding(this.g,assetID));
};

Engine.prototype.startPersonalRealEstateRedevelopment=function(assetID,projectID){
  const g=this.g,x=holding(g,assetID),project=PROJECTS[projectID];
  if(!x||!project||inProgress(x))return this.fail('この物件は開発・再開発を開始できません。');
  if(x.ownerCorp)return this.fail('法人所有の物件は個人資金での開発・再開発を開始できません。');
  const quote=quotesFor(x).find(q=>q.id===projectID);
  if(!quote||finite(g.personalCash)<quote.cost)return this.fail('個人資金が不足しています。');
  g.personalCash=finite(g.personalCash)-quote.cost;
  const week=Math.floor(finite(g.week,1));
  x.redevelopmentProjectID=projectID;
  x.redevelopmentStartWeek=week;
  x.redevelopmentCompleteWeek=week+project.durationWeeks;
  x.redevelopmentCost=quote.cost;
  x.redevelopmentValueGain=quote.valueGain;
  x.redevelopmentSpentTotal=finite(x.redevelopmentSpentTotal)+quote.cost;
  this.notify(`${x.name}の${project.label}を開始しました（${Math.round(quote.cost).toLocaleString('ja-JP')}円 · ${project.durationWeeks}週後に完了）。`,'success');
  this.save();this.emit();
  return true;
};

// cancelPersonalRealEstateRedevelopment() を実行したときに何が起きるかを、実行前にUIへ提示
// するための読み取り専用の試算。状態は一切変更しない。start側で全額前払い済みのため、
// 中止しても返金は無く、進行中の完了時評価額増加分も失われる。
Engine.prototype.getPersonalRealEstateRedevelopmentCancelPlan=function(assetID){
  const x=holding(this.g,assetID);
  if(!inProgress(x))return null;
  const project=PROJECTS[x.redevelopmentProjectID];
  return Object.freeze({
    assetID,name:x.name||'',projectLabel:project?.label||'開発・再開発',
    weeksLeft:Math.max(0,finite(x.redevelopmentCompleteWeek)-finite(this.g.week)),
    forfeitedCost:finite(x.redevelopmentCost),forfeitedValueGain:finite(x.redevelopmentValueGain)
  });
};
Engine.prototype.cancelPersonalRealEstateRedevelopment=function(assetID){
  const x=holding(this.g,assetID);
  if(!inProgress(x))return false;
  x.redevelopmentProjectID='';x.redevelopmentStartWeek=0;x.redevelopmentCompleteWeek=0;x.redevelopmentCost=0;x.redevelopmentValueGain=0;
  this.save();this.emit();
  return true;
};

function complete(x){
  const project=PROJECTS[x.redevelopmentProjectID];
  if(!project)return null;
  const oldValue=valueOf(x),gain=Math.max(0,finite(x.redevelopmentValueGain)),cost=Math.max(0,finite(x.redevelopmentCost));
  x.currentValue=roundValue(oldValue+gain);
  // Book value is money: a step-up to the valuation is rounded up, a stored book value and the
  // paid cost are taken as is (YEN_CEILING_ROUNDING_CONTRACT §1.1).
  x.bookValue=Math.max(finite(x.bookValue,finite(x.purchasePrice,oldValue)),ceilYen(oldValue))+cost;
  if(x.rentalOps)x.rentalOps.condition=clamp(finite(x.rentalOps.condition,90)+project.conditionGain,0,100);
  x.redevelopmentCompletedTotal=Math.floor(finite(x.redevelopmentCompletedTotal))+1;
  const result={assetID:x.assetID,projectID:project.id,label:project.label,valueGain:gain,cost};
  x.redevelopmentProjectID='';x.redevelopmentStartWeek=0;x.redevelopmentCompleteWeek=0;x.redevelopmentCost=0;x.redevelopmentValueGain=0;
  return result;
}

// Called from the personal-property weekly loop in expansion.js -- same insertion point as
// personalRealEstateShortTerm.processWeek. A holding mid-project skips the normal
// lease/vacancy/short-term path for the caller to decide (redevelopment supersedes rental
// activity for the week, matching the company-side project blocking a fresh disposal).
function processWeek(engine,x){
  if(!inProgress(x))return null;
  const week=Math.floor(finite(engine.g.week,1));
  if(week<finite(x.redevelopmentCompleteWeek))return null;
  const result=complete(x);
  if(result)engine.notify(`${x.name}の${result.label}が完了しました（評価額+${Math.round(result.valueGain).toLocaleString('ja-JP')}円）。`,'success');
  return result;
}

modules.personalRealEstateRedevelopment=Object.freeze({PROJECTS,quotesFor,inProgress,complete,processWeek,__installed:true});
})();
