// Phase 6A compatibility: balance parent-company IPO proceeds in equity.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before parent-ipo-equity-compat.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.__parentIPOFinanceInstalled)throw new Error('save-v9.js must record parent IPO financing before parent-ipo-equity-compat.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before parent-ipo-equity-compat.js.');
const TycoonEngine=modules.engine.TycoonEngine;
if(TycoonEngine.prototype.__parentIPOEquityBalanceInstalled)throw new Error('parent IPO equity compatibility is already installed.');
const baseExecuteIPO=TycoonEngine.prototype.executeIPO;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
TycoonEngine.prototype.executeIPO=function(market='東証グロース',sellShares=100000){
 if(this.g.publicCompany||this.ipoMissingReasons().length)return baseExecuteIPO.call(this,market,sellShares);
 const multiple=market==='東証プライム'?1.25:market==='東証スタンダード'?1.1:1;
 const companyRaise=Math.max(100,this.companyValue()*multiple/Math.max(1,this.g.sharesOut))*200000*.955;
 const operationID=`parent-ipo-${this.g.week}`;
 const ledger=modules.finance.ensureFinance(this.g);
 const exists=(ledger.transactions||[]).some(row=>row.operationID===operationID||row.idempotencyKey===operationID);
 if(!exists)ledger.balances.capitalSurplus=finite(ledger.balances.capitalSurplus)+companyRaise;
 const result=baseExecuteIPO.call(this,market,sellShares);
 if(result===false&&!exists)ledger.balances.capitalSurplus=Math.max(0,finite(ledger.balances.capitalSurplus)-companyRaise);
 return result;
};
TycoonEngine.prototype.__parentIPOEquityBalanceInstalled=true;
modules.engine.__parentIPOEquityBalanceInstalled=true;
})();
