// Script boundary: js/ma-exit-readiness.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before ma-exit-readiness.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.maExitReadiness)throw new Error('Capitalism Tycoon maExitReadiness module is already registered.');
(function(exports){
const arr=v=>Array.isArray(v)?v:[];
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,nf(v,min)));
const ACTIVE_STATUS=new Set(['active','owned']);
const RECOMMENDATION_PRIORITY=Object.freeze({'stabilize-pmi':0,'complete-pmi':1,'prepare-ipo':2,'review-sale':3,hold:4});
function active(sub){return ACTIVE_STATUS.has(String(sub?.status||'active'));}
function stableID(sub,source){return `${source}:${String(sub?.id||sub?.startupID||sub?.name||'unknown')}`;}
function ownershipOf(sub){return clamp(nf(sub?.ownership,nf(sub?.ownershipRatio,1)),0,1);}
function goodwillOf(state,sub){const id=sub?.goodwillRecordID,record=id?arr(state?.goodwillRecords).find(row=>row?.id===id):null;if(record?.status==='disposed')return 0;return Math.max(0,nf(record?.carryingValue,record?nf(record?.goodwillBookValue,nf(record?.amount,0)):nf(sub?.goodwillBookValue,0)));}
function bookValueOf(state,sub,source){if(source==='ma')return Math.max(0,nf(sub?.identifiableNetAssetsBookValue))+goodwillOf(state,sub);return Math.max(0,nf(sub?.carryingBookValue,nf(sub?.investedCost,0)));}
function holdingWeeks(state,sub){const start=nf(sub?.acquiredWeek,nf(sub?.createdWeek,nf(sub?.foundedWeek,nf(sub?.investedWeek,nf(sub?.week,1)))));return Math.max(0,Math.floor(nf(state?.week,1)-start));}
function pmiRisk(sub){const status=String(sub?.pmiStatus||'completed'),health=nf(sub?.pmiHealth,100),friction=nf(sub?.pmiFriction);if(status==='stalled'||health<35||friction>=75)return 'critical';if(status!=='completed'&&(health<60||friction>=50))return 'watch';return 'stable';}
function recommendationFor(row){if(row.pmiRisk==='critical')return Object.freeze({id:'stabilize-pmi',label:'PMI立て直し',priority:0});if(row.source==='ma'&&row.pmiStatus!=='completed')return Object.freeze({id:'complete-pmi',label:'PMI完了を優先',priority:1});if(row.ipoEligible)return Object.freeze({id:'prepare-ipo',label:'子会社IPOを検討',priority:2});if(row.divestCandidate)return Object.freeze({id:'review-sale',label:'子会社売却を検討',priority:3});return Object.freeze({id:'hold',label:'保有継続',priority:4});}
function evaluate(state,sub,source){
  const ownership=ownershipOf(sub),valuation=Math.max(0,nf(sub?.valuation)),stakeValue=Math.round(valuation*ownership),bookValue=Math.round(bookValueOf(state,sub,source));
  const unrealizedGain=stakeValue-bookValue,unrealizedGainRate=bookValue>0?unrealizedGain/bookValue:null,weeklyProfit=nf(sub?.weeklyProfit,nf(sub?.standaloneWeeklyProfit)+nf(sub?.pmiWeeklySynergyProfit)-nf(sub?.pmiWeeklyDisruptionCost));
  const weeks=holdingWeeks(state,sub),pmiStatus=String(sub?.pmiStatus||'completed'),risk=source==='ma'?pmiRisk(sub):'stable';
  const blockers=[],warnings=[],positives=[];
  if(source==='ma'&&risk==='critical')blockers.push('pmi-critical');
  if(source==='ma'&&pmiStatus!=='completed')blockers.push('pmi-incomplete');
  if(valuation<=0)blockers.push('valuation-missing');
  if(ownership<=0)blockers.push('ownership-missing');
  if(weeklyProfit<=0)warnings.push('non-positive-profit');else positives.push('profitable');
  if(weeks<13)warnings.push('short-holding-period');
  if(unrealizedGain>0)positives.push('unrealized-gain');
  const ipoEligible=source==='venture'&&!sub?.publicCompany&&valuation>=250_000_000&&ownership>=.5&&weeklyProfit>0&&blockers.length===0;
  if(source==='venture'&&!sub?.publicCompany&&valuation<250_000_000)warnings.push('ipo-valuation-below-threshold');
  if(source==='venture'&&!sub?.publicCompany&&ownership<.5)warnings.push('ipo-ownership-below-threshold');
  const harvestCandidate=weeks>=52&&weeklyProfit>0&&unrealizedGainRate!==null&&unrealizedGainRate>=.75;
  const divestCandidate=!ipoEligible&&blockers.length===0&&(weeklyProfit<0||harvestCandidate);
  const row={
    id:stableID(sub,source),source,subsidiaryID:sub?.id||null,name:String(sub?.name||sub?.id||'名称未設定'),publicCompany:Boolean(sub?.publicCompany),ownership,valuation,stakeValue,bookValue,
    unrealizedGain,unrealizedGainRate,weeklyProfit,annualizedProfit:Math.round(weeklyProfit*52),holdingWeeks:weeks,pmiStatus,pmiRisk:risk,ipoEligible,divestCandidate,
    blockers:Object.freeze([...new Set(blockers)]),warnings:Object.freeze([...new Set(warnings)]),positives:Object.freeze([...new Set(positives)])
  };
  row.recommendation=recommendationFor(row);
  return Object.freeze(row);
}
function build(state){
  const rows=[];
  for(const sub of arr(state?.subsidiaries))if(active(sub))rows.push(evaluate(state,sub,'venture'));
  for(const sub of arr(state?.maSubsidiaries))if(active(sub))rows.push(evaluate(state,sub,'ma'));
  rows.sort((a,b)=>a.recommendation.priority-b.recommendation.priority||b.unrealizedGain-a.unrealizedGain||a.id.localeCompare(b.id));
  const model={
    subsidiaries:rows.length,ipoReady:rows.filter(row=>row.ipoEligible).length,divestCandidates:rows.filter(row=>row.divestCandidate).length,
    pmiBlocked:rows.filter(row=>row.source==='ma'&&row.pmiStatus!=='completed').length,criticalPMI:rows.filter(row=>row.pmiRisk==='critical').length,
    totalStakeValue:rows.reduce((sum,row)=>sum+row.stakeValue,0),totalBookValue:rows.reduce((sum,row)=>sum+row.bookValue,0),
    totalUnrealizedGain:rows.reduce((sum,row)=>sum+row.unrealizedGain,0),weeklyProfit:rows.reduce((sum,row)=>sum+row.weeklyProfit,0),
    rows:Object.freeze(rows)
  };
  model.nextAction=rows.length?Object.freeze({...rows[0].recommendation,subsidiaryID:rows[0].subsidiaryID,source:rows[0].source,name:rows[0].name}):Object.freeze({id:'none',label:'対象子会社なし',priority:5,subsidiaryID:null,source:null,name:''});
  return Object.freeze(model);
}
exports.build=build;exports.evaluate=evaluate;exports.pmiRisk=pmiRisk;exports.bookValueOf=bookValueOf;exports.RECOMMENDATION_PRIORITY=RECOMMENDATION_PRIORITY;
})(__modules.maExitReadiness={});
})();
