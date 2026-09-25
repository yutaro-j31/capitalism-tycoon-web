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

// Canonical normalization boundary (#732). The base configure/advanceWeek only normalize outside a
// transaction, but module wrappers always run them inside one, so continuous play never normalized
// while a reload did: the two produced different state shapes and futures. Normalization here must
// run after the whole wrapper chain (a mid-chain normalize would rebuild g.businesses under
// industry-specific-events' temporary modifiers and leak them), so this wraps configure/advanceWeek
// last: on DOMContentLoaded, after the PE modules' own DOMContentLoaded wrappers (their scripts, and
// so their listeners, come earlier). The committed transaction's save and emit are held until then.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const proto=modules?.engine?.TycoonEngine?.prototype;
if(!proto||proto.__canonicalNormalizeBoundary)return;
function boundary(name){
  const base=proto[name];
  const wrapped=function(...args){
    if(this._canonicalBoundaryCommits||this.inTransaction?.())return base.apply(this,args);
    const commits=this._canonicalBoundaryCommits=[];
    const flush=()=>{this.save();for(const [eventType,detail] of commits)this.emit(eventType,detail);};
    let result;
    try{result=base.apply(this,args);}
    catch(error){this._canonicalBoundaryCommits=null;if(commits.length)flush();throw error;}
    this._canonicalBoundaryCommits=null;
    if(!commits.length)return result;
    if(this.g?.configured)this.normalizeInPlace();
    flush();
    return result;
  };
  Object.defineProperty(wrapped,'__canonicalNormalizeBoundary',{value:true});
  proto[name]=wrapped;
}
function install(){
  if(proto.__canonicalNormalizeBoundary)return;
  boundary('configure');
  boundary('advanceWeek');
  Object.defineProperty(proto,'__canonicalNormalizeBoundary',{value:true});
}
if(typeof document!=='undefined'&&document.readyState==='loading'&&typeof document.addEventListener==='function')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
