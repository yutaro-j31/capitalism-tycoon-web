// Public play-launcher compatibility bridge for legacy module aliases.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)return;
if(!modules.playerDebtService&&modules.playerDebtRefinancing?.__installed){
  modules.playerDebtService=Object.freeze({__installed:true,compatibilityAlias:true});
}
const Engine=modules.engine.TycoonEngine;
const activism=modules.shareholderActivism;
if(activism?.processWeek&&!Engine.prototype.__shareholderActivismFinalWeeklyHook){
  const baseAdvanceWeek=Engine.prototype.advanceWeek;
  Engine.prototype.advanceWeek=function(){
    const result=baseAdvanceWeek.apply(this,arguments);
    if(result!==false){
      const week=Math.max(0,Math.floor(Number(this.g?.week)||0));
      if(this.g&&this.g.shareholderActivismLastProcessedWeek!==week){
        activism.processWeek(this);
        this.g.shareholderActivismLastProcessedWeek=week;
      }
    }
    return result;
  };
  Object.defineProperty(Engine.prototype,'__shareholderActivismFinalWeeklyHook',{value:true});
}
modules.playRuntimeCompat=Object.freeze({
  debtServiceAliasReady:Boolean(modules.playerDebtService?.__installed),
  shareholderActivismWeeklyHookReady:Boolean(activism?.processWeek&&Engine.prototype.__shareholderActivismFinalWeeklyHook),
  __installed:true
});
})();
