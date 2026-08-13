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
// Load the additive founding-route layer late, after the core engine, market, finance,
// UI registry and player-engine bridge exist. This intentionally avoids rebundling the
// legacy synchronous script graph in this feature.
if(typeof document!=='undefined'&&!document.querySelector('link[data-founding-routes-style]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='./css/founding-routes-integration.css';link.dataset.foundingRoutesStyle='1';document.head.appendChild(link);
}
if(typeof document!=='undefined'&&!modules.foundingRoutesIntegration&&!document.querySelector('script[data-founding-routes-loader]')){
  const script=document.createElement('script');
  script.src='./js/founding-routes-integration.js';
  script.async=false;
  script.dataset.foundingRoutesLoader='1';
  document.head.appendChild(script);
}
})();
