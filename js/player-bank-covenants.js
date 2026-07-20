// Phase 8B-3: bank covenants and capital-structure discipline.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-bank-covenants.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-bank-covenants.js.');
if(!modules.playerDebtService?.__installed)throw new Error('player-debt-service.js must be loaded before player-bank-covenants.js.');
if(modules.playerBankCovenants)throw new Error('player bank covenant module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
const baseWeeklyRate=EngineClass.prototype.companyWeeklyBorrowRate;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
function defaults(){return{maxDebtToCash:3,minInterestCoverage:1.25,breachWeeks:0,healthyWeeks:0,status:'compliant',rateSurcharge:0,lastCheckedWeek:-1,history:[]};}
function normalize(state){
 const finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={});
 const raw=finance.bankCovenants&&typeof finance.bankCovenants==='object'?finance.bankCovenants:{};
 const c=finance.bankCovenants={...defaults(),...raw};
 c.maxDebtToCash=clamp(c.maxDebtToCash,1,8);c.minInterestCoverage=clamp(c.minInterestCoverage,.5,4);
 c.breachWeeks=Math.max(0,Math.floor(finite(c.breachWeeks)));c.healthyWeeks=Math.max(0,Math.floor(finite(c.healthyWeeks)));
 c.rateSurcharge=clamp(c.rateSurcharge,0,.04);c.lastCheckedWeek=Math.floor(finite(c.lastCheckedWeek,-1));
 c.history=Array.isArray(c.history)?c.history.slice(-52):[];
 if(!['compliant','warning','breach'].includes(c.status))c.status='compliant';
 return c;
}
function metrics(state){
 const debt=Math.max(0,finite(state.companyDebt));const cash=Math.max(1_000_000,finite(state.companyCash));
 const report=state.lastReport&&typeof state.lastReport==='object'?state.lastReport:{};
 const interest=Math.max(0,finite(report.interest));
 const operating=Math.max(0,finite(report.operatingProfit,finite(report.profit)+interest));
 return{debt,cash,debtToCash:debt/cash,interestCoverage:interest>0?operating/interest:99};
}
function evaluate(instance){
 const state=instance.g||instance;const c=normalize(state);const week=Math.floor(finite(state.week));
 if(c.lastCheckedWeek===week)return c;
 const m=metrics(state);const materialDebt=m.debt>=20_000_000;
 const breached=materialDebt&&(m.debtToCash>c.maxDebtToCash||m.interestCoverage<c.minInterestCoverage);
 if(breached){c.breachWeeks++;c.healthyWeeks=0;c.status=c.breachWeeks>=2?'breach':'warning';c.rateSurcharge=clamp(c.breachWeeks*.0025,0,.02);state.companyCredit=clamp(finite(state.companyCredit,60)-(c.status==='breach'?2:1),0,100);}
 else{c.healthyWeeks++;c.breachWeeks=Math.max(0,c.breachWeeks-1);c.rateSurcharge=clamp(c.rateSurcharge-.00125,0,.02);c.status=c.breachWeeks>0?'warning':'compliant';}
 c.lastCheckedWeek=week;c.history.push({week,status:c.status,debtToCash:Math.round(m.debtToCash*100)/100,interestCoverage:Math.round(m.interestCoverage*100)/100,rateSurcharge:c.rateSurcharge});c.history=c.history.slice(-52);
 if(breached&&Array.isArray(state.news))state.news.unshift({week,title:'銀行コベナンツ警戒',body:`財務制限条項が${c.status==='breach'?'抵触':'警戒水準'}です。借入金利と信用力に影響します。`});
 return c;
}
EngineClass.prototype.companyWeeklyBorrowRate=function(){const base=baseWeeklyRate.call(this);return clamp(base+normalize(this.g).rateSurcharge,.005,.18);};
EngineClass.prototype.advanceWeek=function(...args){const result=baseAdvanceWeek.apply(this,args);if(result!==false)evaluate(this);return result;};
EngineClass.prototype.__playerBankCovenantsInstalled=true;
modules.playerBankCovenants=Object.freeze({defaults,normalize,metrics,evaluate,__installed:true});
})();