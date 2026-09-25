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

// Canonical normalization at founding (#732). The base configure only normalizes outside a
// transaction, but module wrappers always run it inside one, so a new company started with a state
// no reload would produce. This wraps configure last (on DOMContentLoaded, after the PE modules' own
// DOMContentLoaded wrappers, whose scripts and so listeners come earlier), normalizes once after the
// whole wrapper chain, then performs the committed transaction's save and emit. The weekly advance is
// not normalized here: each week's processing itself keeps the state canonical, which
// tests/reload-canonical-state-test.js asserts (normalize is a no-op at a week boundary).
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
    if(this.g?.configured)this.normalize();
    flush();
    return result;
  };
  Object.defineProperty(wrapped,'__canonicalNormalizeBoundary',{value:true});
  proto[name]=wrapped;
}
function install(){
  if(proto.__canonicalNormalizeBoundary)return;
  boundary('configure');
  Object.defineProperty(proto,'__canonicalNormalizeBoundary',{value:true});
}
if(typeof document!=='undefined'&&document.readyState==='loading'&&typeof document.addEventListener==='function')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
