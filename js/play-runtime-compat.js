// Public play-launcher compatibility bridge for legacy module aliases.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)return;
if(!modules.playerDebtService&&modules.playerDebtRefinancing?.__installed){
  modules.playerDebtService=Object.freeze({__installed:true,compatibilityAlias:true});
}
modules.playRuntimeCompat=Object.freeze({
  debtServiceAliasReady:Boolean(modules.playerDebtService?.__installed),
  __installed:true
});
})();

// Canonical state boundary (#732). The base configure only normalizes outside a transaction, but
// module wrappers always run it inside one, so a new company started with a state no reload would
// produce. This wraps configure and advanceWeek last (on DOMContentLoaded, after the PE modules' own
// DOMContentLoaded wrappers, whose scripts and so listeners come earlier), finishes the state after
// the whole wrapper chain, then performs the committed transaction's save and emit:
// - configure: one full normalize of the founding state.
// - advanceWeek: no full normalize (too costly every week); each week's processing keeps the state
//   canonical itself. The boundary opens the outermost 'week' transaction, so the whole wrapper
//   chain is atomic (#776). After every mutation wrapper and the delegated executive work, and still
//   inside that transaction, finalizeCommittedWeek() rebuilds the final accounting snapshot,
//   evaluates crisis state from final cash, validates the committed state, refreshes the weekly
//   summary and derives the competitor event log. tests/week-transaction-atomicity-test.js checks
//   that a failure anywhere in the week rolls back both the state and the save.
// tests/reload-canonical-state-test.js asserts normalize is a no-op at every week boundary.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const proto=modules?.engine?.TycoonEngine?.prototype;
if(!proto||proto.__canonicalNormalizeBoundary)return;
const FINANCE_VALIDATION_FAILED='finance-validation-failed';
const FINANCE_VALIDATOR_THREW='finance-validator-threw';
const STANDALONE_CLOSE_FAILED='standalone-accounting-close-failed';
const STANDALONE_CLOSE_THREW='standalone-accounting-close-threw';
const WEEK_EXECUTION_ORDER=Object.freeze([
  'weekly-production-wrappers',
  'delegated-executive-actions',
  'critical-money-finite-guard',
  'finance-snapshot-finalization',
  'standalone-accounting-close',
  'liquidity-crisis-finalization',
  'finance-validation',
  'supporting-invariant-validation',
  'weekly-summary-finalization',
  'transaction-commit',
  'persistence'
]);
function validationCause(error){return String(error?.message||error||'finance.validate threw');}
function validationReasons(result){return Array.isArray(result?.errors)&&result.errors.length?result.errors.map(String):['finance.validate returned a non-success result'];}
function financeValidationError(instance,code,reasons,cause,stage='finance-validation'){
  const g=instance.g,hash=modules.semanticHashV2?.semanticHashV2;
  const diagnostic=Object.freeze({
    code,
    stage:String(stage),
    week:Number(g?.week),
    cause:String(cause||reasons[0]),
    reasons:Object.freeze(reasons.slice()),
    seed:Number(g?.simulationRng?.seed),
    rngState:Number(g?.simulationRng?.state),
    rngDraws:Number(g?.simulationRng?.draws),
    preWeekSemanticHashV2:instance._preWeekSemanticHashV2||null,
    failureSemanticHashV2:typeof hash==='function'?hash(g):null
  });
  const error=new Error(`${code}: ${diagnostic.cause}`);
  error.name='FinanceValidationBoundaryError';error.code=code;error.stage=diagnostic.stage;error.financeValidation=diagnostic;
  return error;
}
function recordFinanceValidationFailure(instance,diagnostic){
  const previous=instance.financeValidationFailure;
  const occurrence=Object.freeze({...diagnostic,reasons:Object.freeze([...(diagnostic.reasons||[])])});
  instance.financeValidationFailure=Object.freeze({
    code:occurrence.code,
    stage:occurrence.stage,
    firstWeek:previous?.firstWeek??occurrence.week,
    latestWeek:occurrence.week,
    count:(previous?.count||0)+1,
    firstCause:previous?.firstCause??occurrence.cause,
    latestCause:occurrence.cause,
    firstFailure:previous?.firstFailure||occurrence,
    latestFailure:occurrence,
    seed:occurrence.seed,
    rngState:occurrence.rngState,
    rngDraws:occurrence.rngDraws,
    preWeekSemanticHashV2:occurrence.preWeekSemanticHashV2,
    failureSemanticHashV2:occurrence.failureSemanticHashV2
  });
}
function boundary(name,finish,weekTransaction=false){
  const base=proto[name];
  // advanceWeek runs the whole wrapper chain inside one outer 'week' transaction opened here, so
  // every wrapper's mutation and the final weekly finalization commit or roll back together (#776).
  const nestedWeekDetail=function(result){const detail=this._nestedWeekDetail;this._nestedWeekDetail=null;return typeof detail==='function'?detail(result):(detail||{summary:null});};
  const wrapped=function(...args){
    if(this._canonicalBoundaryCommits||this.inTransaction?.())return base.apply(this,args);
    const commits=this._canonicalBoundaryCommits=[];
    if(weekTransaction)this._preWeekSemanticHashV2=modules.semanticHashV2?.semanticHashV2?.(this.g)||null;
    this._weekNewsHead=Array.isArray(this.g?.news)&&this.g.news.length?this.g.news[0]:null;
    const flush=()=>{this.save();for(const [eventType,detail] of commits)this.emit(eventType,detail);};
    let result;
    this._nestedWeekDetail=null;
    try{result=weekTransaction?this.runTransaction(()=>base.apply(this,args),'week',nestedWeekDetail.bind(this)):base.apply(this,args);}
    catch(error){
      this._canonicalBoundaryCommits=null;this._nestedWeekDetail=null;
      if(error?.financeValidation)recordFinanceValidationFailure(this,error.financeValidation);
      else if(commits.length)flush();
      this._preWeekSemanticHashV2=null;
      throw error;
    }
    this._canonicalBoundaryCommits=null;
    this._preWeekSemanticHashV2=null;
    if(!commits.length)return result;
    if(this.g?.configured&&finish)finish.call(this);
    flush();
    return result;
  };
  Object.defineProperty(wrapped,'__canonicalNormalizeBoundary',{value:true});
  proto[name]=wrapped;
}
// News is prepended and capped at the end, so the items added during a week are the ones in front
// of the head the feed had when the week started.
function newsAddedThisWeek(g,headAtWeekStart){
  const news=Array.isArray(g.news)?g.news:[];
  if(headAtWeekStart===undefined)return news.slice(0,5);
  if(headAtWeekStart===null)return news.slice();
  const index=news.indexOf(headAtWeekStart);
  return index>=0?news.slice(0,index):news.slice(0,5);
}
function finalizeWeekBoundary(){
  const g=this.g;if(!g?.configured)return;
  const finance=modules.finance;
  if(!g.isCompanySold){
    // Phase 1: every base/module mutation has finished.
    finance?.rebuildSnapshotForWeek?.(g,g.week);

    // Phase 2 / P2-1: freeze the standalone accounting close before any post-close
    // subsystem reads the committed cash figure. A failed close aborts the outer week
    // transaction, so state, RNG, IDs and durable save bytes roll back together.
    if(typeof finance?.standaloneClose==='function'){
      let close;
      try{close=finance.standaloneClose(g,'52');}
      catch(error){throw financeValidationError(this,STANDALONE_CLOSE_THREW,[validationCause(error)],validationCause(error),'standalone-accounting-close');}
      if(close?.ok!==true)throw financeValidationError(this,STANDALONE_CLOSE_FAILED,validationReasons(close),validationReasons(close)[0],'standalone-accounting-close');
    }

    // Phase 2: liquidity crisis reads the final post-mutation cash figure.
    const crisis=modules.playerCrisis?.finalizeWeek?.(g)||modules.playerCrisis?.evaluate?.(g)||null;

    // Phase 3: this validation result is authoritative for the committed week.
    if(!g.skipWeeklyValidation){
      let financeResult;
      try{financeResult=finance?.validate?.(g);}
      catch(error){throw financeValidationError(this,FINANCE_VALIDATOR_THREW,[validationCause(error)],validationCause(error));}
      if(financeResult?.ok!==true)throw financeValidationError(this,FINANCE_VALIDATION_FAILED,validationReasons(financeResult),validationReasons(financeResult)[0]);
      modules.supply?.validate?.(g);
      modules.workforce?.validate?.(g);
      modules.competitor?.validate?.(g);
      modules.playerCrisis?.validate?.(g);
    }

    // The emitted summary must describe the final state, not the inner base-engine snapshot.
    if(g.lastWeeklySummary){
      g.lastWeeklySummary.companyCash=g.companyCash;
      g.lastWeeklySummary.companyValue=typeof this.companyValue==='function'?this.companyValue():g.lastWeeklySummary.companyValue;
      g.lastWeeklySummary.personalNetWorth=typeof this.personalNetWorth==='function'?this.personalNetWorth():g.lastWeeklySummary.personalNetWorth;
      if(crisis)g.lastWeeklySummary.crisis=crisis;
      // Finalization may add news (a crisis status change) after the inner wrappers built newNews.
      // Put only this week's additions that newNews lacks in front of it. Older news in g.news is
      // not this week's and stays out; summary-only rows such as ordinary turnaround progress
      // reports keep their place (#776).
      const built=Array.isArray(g.lastWeeklySummary.newNews)?g.lastWeeklySummary.newNews:[];
      const late=newsAddedThisWeek(g,this._weekNewsHead).filter(item=>!built.some(row=>String(row)===String(item)));
      g.lastWeeklySummary.newNews=[...late,...built].slice(0,5);
    }
  }
  modules.competitor?.syncEventLog?.(g);
}
function install(){
  if(proto.__canonicalNormalizeBoundary)return;
  boundary('configure',function(){this.normalize();});
  proto.finalizeCommittedWeek=finalizeWeekBoundary;
  boundary('advanceWeek',null,true);
  Object.defineProperty(proto,'__canonicalNormalizeBoundary',{value:true});
}
modules.financeValidationBoundary=Object.freeze({
  FAILURE_CODE:FINANCE_VALIDATION_FAILED,
  EXCEPTION_CODE:FINANCE_VALIDATOR_THREW,
  CLOSE_FAILURE_CODE:STANDALONE_CLOSE_FAILED,
  CLOSE_EXCEPTION_CODE:STANDALONE_CLOSE_THREW,
  WEEK_EXECUTION_ORDER
});
if(typeof document!=='undefined'&&document.readyState==='loading'&&typeof document.addEventListener==='function')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
