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
function boundary(name,finish,weekTransaction=false){
  const base=proto[name];
  // advanceWeek runs the whole wrapper chain inside one outer 'week' transaction opened here, so
  // every wrapper's mutation and the final weekly finalization commit or roll back together (#776).
  const nestedWeekDetail=function(result){const detail=this._nestedWeekDetail;this._nestedWeekDetail=null;return typeof detail==='function'?detail(result):(detail||{summary:null});};
  const wrapped=function(...args){
    if(this._canonicalBoundaryCommits||this.inTransaction?.())return base.apply(this,args);
    const commits=this._canonicalBoundaryCommits=[];
    const flush=()=>{this.save();for(const [eventType,detail] of commits)this.emit(eventType,detail);};
    let result;
    this._nestedWeekDetail=null;
    try{result=weekTransaction?this.runTransaction(()=>base.apply(this,args),'week',nestedWeekDetail.bind(this)):base.apply(this,args);}
    catch(error){this._canonicalBoundaryCommits=null;this._nestedWeekDetail=null;if(commits.length)flush();throw error;}
    this._canonicalBoundaryCommits=null;
    if(!commits.length)return result;
    if(this.g?.configured&&finish)finish.call(this);
    flush();
    return result;
  };
  Object.defineProperty(wrapped,'__canonicalNormalizeBoundary',{value:true});
  proto[name]=wrapped;
}
function finalizeWeekBoundary(){
  const g=this.g;if(!g?.configured)return;
  const finance=modules.finance;
  if(!g.isCompanySold){
    // Phase 1: every base/module mutation has finished.
    finance?.rebuildSnapshotForWeek?.(g,g.week);

    // Phase 2: liquidity crisis reads the final post-mutation cash figure.
    const crisis=modules.playerCrisis?.finalizeWeek?.(g)||modules.playerCrisis?.evaluate?.(g)||null;

    // Phase 3: this validation result is authoritative for the committed week.
    if(!g.skipWeeklyValidation){
      finance?.validate?.(g);
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
      // Finalization itself may add crisis news after inner wrappers already built newNews.
      // Put the final state news first, but retain summary-only rows such as ordinary turnaround
      // progress reports that deliberately do not enter the persistent news feed.
      const finalNews=Array.isArray(g.news)?g.news.slice(0,5):[];
      const summaryOnly=Array.isArray(g.lastWeeklySummary.newNews)?g.lastWeeklySummary.newNews:[];
      g.lastWeeklySummary.newNews=[
        ...finalNews,
        ...summaryOnly.filter(row=>!finalNews.some(item=>String(item)===String(row)))
      ].slice(0,5);
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
if(typeof document!=='undefined'&&document.readyState==='loading'&&typeof document.addEventListener==='function')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
