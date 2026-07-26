// Script boundary: js/subsidiary-ipo-preparation.js (classic JavaScript)
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine must be loaded before subsidiary-ipo-preparation.js.');
if(!modules?.finance?.event)throw new Error('Capitalism Tycoon finance must be loaded before subsidiary-ipo-preparation.js.');
if(modules.subsidiaryIPOPreparation)throw new Error('Capitalism Tycoon subsidiaryIPOPreparation module is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const VERSION=1,HISTORY_LIMIT=60;
const STAGES=Object.freeze([
  Object.freeze({id:'audit',label:'監査・内部統制',weeks:4,cost:5_000_000}),
  Object.freeze({id:'underwriter',label:'主幹事選定',weeks:4,cost:8_000_000}),
  Object.freeze({id:'review',label:'上場審査',weeks:8,cost:12_000_000}),
  Object.freeze({id:'ready',label:'公開価格決定',weeks:0,cost:0})
]);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
function ensure(state){
  if(!state||typeof state!=='object')return state;
  state.subsidiaryIPOPreparationVersion=Math.max(VERSION,integer(state.subsidiaryIPOPreparationVersion));
  state.subsidiaryIPOPreparationHistory=Array.isArray(state.subsidiaryIPOPreparationHistory)?state.subsidiaryIPOPreparationHistory.filter(Boolean).slice(0,HISTORY_LIMIT):[];
  state.subsidiaries=Array.isArray(state.subsidiaries)?state.subsidiaries.filter(Boolean):[];
  for(const sub of state.subsidiaries){
    const prep=sub.ipoPreparation;
    if(!prep||typeof prep!=='object')continue;
    prep.stageIndex=clamp(integer(prep.stageIndex),0,STAGES.length-1);
    prep.startedWeek=Math.max(1,integer(prep.startedWeek,integer(state.week,1)));
    prep.stageStartedWeek=Math.max(prep.startedWeek,integer(prep.stageStartedWeek,prep.startedWeek));
    prep.totalCost=Math.max(0,finite(prep.totalCost));
    prep.completed=Boolean(prep.completed||prep.stageIndex===STAGES.length-1);
  }
  return state;
}
function subFor(state,id){return (state?.subsidiaries||[]).find(s=>String(s?.id)===String(id))||null;}
function stageFor(sub){const prep=sub?.ipoPreparation;if(!prep)return null;return STAGES[clamp(integer(prep.stageIndex),0,STAGES.length-1)]||STAGES[0];}
function eligible(sub){return Boolean(sub&&!sub.publicCompany&&String(sub.status||'active')==='active'&&finite(sub.valuation)>=250_000_000&&finite(sub.ownership)>=.5);}
function history(state,type,sub,extra={}){const row={week:integer(state?.week,1),type,subsidiaryID:String(sub?.id||''),subsidiaryName:String(sub?.name||'子会社'),...extra};state.subsidiaryIPOPreparationHistory.unshift(row);state.subsidiaryIPOPreparationHistory=state.subsidiaryIPOPreparationHistory.slice(0,HISTORY_LIMIT);return row;}
function snapshot(state,id){ensure(state);const sub=subFor(state,id);if(!sub)return null;const prep=sub.ipoPreparation||null,stage=stageFor(sub),elapsed=stage?Math.max(0,integer(state.week,1)-integer(prep.stageStartedWeek)):0,remaining=stage?Math.max(0,stage.weeks-elapsed):0;return Object.freeze({id:String(sub.id),name:String(sub.name||'子会社'),eligible:eligible(sub),publicCompany:Boolean(sub.publicCompany),valuation:Math.max(0,finite(sub.valuation)),ownership:clamp(sub.ownership,0,1),started:Boolean(prep),stageIndex:prep?integer(prep.stageIndex):null,stageID:stage?.id||null,stageLabel:stage?.label||null,stageCost:stage?.cost||0,stageWeeks:stage?.weeks||0,elapsedWeeks:elapsed,remainingWeeks:remaining,canAdvance:Boolean(prep&&!prep.completed&&remaining===0),ready:Boolean(prep?.completed||stage?.id==='ready'),totalCost:Math.max(0,finite(prep?.totalCost))});}
function install(){
  const proto=EngineClass.prototype;if(proto.__subsidiaryIPOPreparationInstalled)return true;
  const baseNormalize=proto.normalize,baseIPO=proto.ipoSubsidiary;
  proto.normalize=function(){baseNormalize.call(this);ensure(this.g);};
  proto.subsidiaryIPOPreparationSnapshot=function(id){return snapshot(this.g,id);};
  proto.startSubsidiaryIPOPreparation=function(id){
    const execute=()=>{ensure(this.g);const sub=subFor(this.g,id);if(!eligible(sub))return this.fail?.('IPO準備には評価額2.5億円以上・持分50%以上の未上場子会社が必要です。')??false;if(sub.ipoPreparation)return this.fail?.('IPO準備はすでに開始されています。')??false;const stage=STAGES[0];if(finite(this.g.companyCash)<stage.cost)return this.fail?.('IPO準備費用が不足しています。')??false;this.g.companyCash-=stage.cost;sub.ipoPreparation={version:VERSION,stageIndex:0,startedWeek:integer(this.g.week,1),stageStartedWeek:integer(this.g.week,1),totalCost:stage.cost,completed:false};finance.event(this.g,'professionalServices',stage.cost,{cashEffect:-stage.cost,profitEffect:-stage.cost,sourceType:'startSubsidiaryIPOPreparation',sourceID:String(id),operationID:`startSubsidiaryIPOPreparation-${id}-${this.g.week}`,description:`${sub.name} IPO監査・内部統制費用`});history(this.g,'started',sub,{stageID:stage.id,cost:stage.cost});this.notify?.(`${sub.name}のIPO準備を開始しました。まず監査・内部統制を4週間進めます。`,'success');return true;};return typeof this.runTransaction==='function'?this.runTransaction(execute,'change',{source:'startSubsidiaryIPOPreparation'}):execute();
  };
  proto.advanceSubsidiaryIPOPreparation=function(id){
    const execute=()=>{ensure(this.g);const sub=subFor(this.g,id),current=stageFor(sub),prep=sub?.ipoPreparation;if(!sub||!prep||prep.completed)return this.fail?.('進行中のIPO準備がありません。')??false;const elapsed=integer(this.g.week,1)-integer(prep.stageStartedWeek);if(elapsed<current.weeks)return this.fail?.(`${current.label}の完了まであと${current.weeks-elapsed}週です。`)??false;const nextIndex=prep.stageIndex+1,next=STAGES[nextIndex];if(!next)return false;if(finite(this.g.companyCash)<next.cost)return this.fail?.('次工程のIPO準備費用が不足しています。')??false;if(next.cost>0){this.g.companyCash-=next.cost;finance.event(this.g,'professionalServices',next.cost,{cashEffect:-next.cost,profitEffect:-next.cost,sourceType:'advanceSubsidiaryIPOPreparation',sourceID:`${id}-${next.id}`,operationID:`advanceSubsidiaryIPOPreparation-${id}-${next.id}-${this.g.week}`,description:`${sub.name} IPO ${next.label}費用`});}prep.stageIndex=nextIndex;prep.stageStartedWeek=integer(this.g.week,1);prep.totalCost=Math.max(0,finite(prep.totalCost))+next.cost;prep.completed=next.id==='ready';history(this.g,prep.completed?'ready':'advanced',sub,{stageID:next.id,cost:next.cost});this.notify?.(prep.completed?`${sub.name}のIPO準備が完了しました。公開価格を決定して上場できます。`:`${sub.name}のIPO準備を「${next.label}」へ進めました。`,'success');return true;};return typeof this.runTransaction==='function'?this.runTransaction(execute,'change',{source:'advanceSubsidiaryIPOPreparation'}):execute();
  };
  proto.executePreparedSubsidiaryIPO=function(id){const sub=subFor(this.g,id),view=snapshot(this.g,id);if(!sub||!view?.ready)return this.fail?.('IPO準備が完了していません。')??false;const result=baseIPO.call(this,id);if(result){sub.ipoPreparation.completed=true;sub.ipoPreparation.listedWeek=integer(this.g.week,1);history(this.g,'listed',sub,{ticker:sub.ticker||'',totalCost:sub.ipoPreparation.totalCost});}return result;};
  Object.defineProperty(proto,'__subsidiaryIPOPreparationInstalled',{value:true});return true;
}
install();
modules.subsidiaryIPOPreparation=Object.freeze({VERSION,HISTORY_LIMIT,STAGES,ensure,eligible,stageFor,snapshot,install,__installed:true});
})();