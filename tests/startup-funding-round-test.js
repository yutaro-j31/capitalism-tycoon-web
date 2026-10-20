'use strict';
const assert=require('node:assert/strict');const{loadGame}=require('./harness');
function setup(){const loaded=loadGame({headless:true});const e=new loaded.engineModule.TycoonEngine();e.g.configured=true;e.g.companyCash=500e6;e.g.personalCash=500e6;e.g.departments.investment={level:1};delete e.g.finance;e.normalize();const s=e.g.startups[0];s.stage='Series A';s.valuation=300e6;s.ownedCompany=.12;s.ownedPersonal=.05;s.runwayWeeks=7;s.fundingOpen=true;e.g.startupFundingHistory[s.id]=[];return{loaded,e,s};}
function open(x){assert.equal(x.e.openStartupFundingRound(x.s),true);return x.e.getStartupFundingRoundPlan(x.s.id);}
function reload(x){x.e.save();const raw=x.loaded.ctx.__localStorageData.get(x.loaded.engineModule.SAVE_KEY);assert.ok(raw);const loaded=loadGame({localStorageInitial:{[x.loaded.engineModule.SAVE_KEY]:raw}});return{loaded,e:loaded.ctx.__ct_engine,s:loaded.ctx.__ct_engine.g.startups.find(row=>row.id===x.s.id)};}
{
 const x=setup(),p=open(x);assert.equal(p.round,'Series B');assert.equal(p.preMoneyValuation,300e6);assert.equal(p.targetRaise,60e6);assert.equal(p.postMoneyValuation,360e6);assert.equal(p.company.proRataRequired,7.2e6);assert.equal(p.personal.proRataRequired,3e6);assert.equal(x.e.openStartupFundingRound(x.s),false);
 const snap=JSON.stringify(x.e.g),cash=x.e.g.companyCash,news=x.e.g.news.length;let saves=0;const events=[];x.e.save=()=>saves++;x.e.emit=(type='change')=>events.push(type);for(const v of[NaN,Infinity,0,-1,'1',null,7.2e6+1])assert.equal(x.e.participateStartupFundingRound(x.s.id,v,'company'),false);assert.equal(JSON.stringify(x.e.g),snap);assert.equal(x.e.g.companyCash,cash);assert.equal(x.e.g.news.length,news);assert.equal(saves,0);assert.deepEqual(events,[]);
}
{
 const x=setup(),p=open(x),personal=x.e.g.personalCash,company=x.e.g.companyCash,basis=x.s.totalInvestedCompany,news=x.e.g.news.length;let saves=0;const events=[];x.e.save=()=>saves++;x.e.emit=(type='change')=>events.push(type);
 assert.equal(x.e.participateStartupFundingRound(x.s.id,p.company.proRataRequired/2,'company'),true);assert.equal(x.e.participateStartupFundingRound(x.s.id,p.company.proRataRequired/2,'company'),true);assert.equal(x.e.g.personalCash,personal);assert.equal(x.e.g.companyCash,company-p.company.proRataRequired);assert.equal(x.s.totalInvestedCompany,basis+p.company.proRataRequired);assert.equal(saves,2);assert.equal(events.filter(type=>type==='notify').length,2);assert.equal(events.filter(type=>type==='change').length,2);assert.equal(x.e.g.news.length,news+2);x.e.g.week=p.closesWeek;assert.equal(x.e.closeStartupFundingRound(x.s),true);assert.ok(Math.abs(x.s.ownedCompany-.12)<1e-12);assert.ok(Math.abs(x.s.ownedPersonal-.05*300/360)<1e-12);const after=x.s.ownedPersonal;assert.equal(x.e.closeStartupFundingRound(x.s),false);assert.equal(x.s.ownedPersonal,after);assert.equal(x.s.valuation,360e6);assert.equal(x.s.runwayWeeks,56);assert.equal(x.loaded.modules.finance.validate(x.e.g).ok,true);
}
{
 const x=setup(),p=open(x),company=x.e.g.companyCash,worth=x.e.personalNetWorth();assert.equal(x.e.participateStartupFundingRound(x.s.id,p.personal.proRataRequired/2,'personal'),true);assert.equal(x.e.g.companyCash,company);assert.equal(x.s.totalInvestedCompany,0);assert.equal(x.s.totalInvestedPersonal,p.personal.proRataRequired/2);x.e.g.week=p.closesWeek;x.e.closeStartupFundingRound(x.s);assert.ok(x.s.ownedPersonal>.05*300/360&&x.s.ownedPersonal<.05);assert.ok(x.e.personalNetWorth()>worth-p.personal.proRataRequired/2);
}
{
 const x=setup();x.s.ownedPersonal=0;let random=0;const old=Math.random;Math.random=()=>{random++;return .5};open(x);Math.random=old;assert.equal(random,0);x.s.activeFundingRound={status:'open',targetRaise:NaN};assert.equal(x.e.getStartupFundingRoundPlan(x.s.id),null);x.e.updateStartups();assert.ok(x.e.getStartupFundingRoundPlan(x.s.id));
}
{
 const x=setup();open(x);x.e.g.companyCash=1;const before=JSON.stringify(x.e.g);assert.equal(x.e.participateStartupFundingRound(x.s.id,100,'company'),false);assert.equal(JSON.stringify(x.e.g),before);x.s.alive=false;x.e.writeOffStartup(x.s,'test');assert.equal(x.s.activeFundingRound,null);assert.equal(x.e.listStartup({...x.s,alive:true,activeFundingRound:{status:'open'}}),false);
}
{
 const x=setup();x.s.ownedCompany=x.s.ownedPersonal=0;assert.equal(x.e.openStartupFundingRound(x.s),false);assert.equal(x.s.activeFundingRound,undefined);
}
{
 const x=setup();x.s.ownedCompany=.6;x.s.ownedPersonal=0;x.s.totalInvestedCompany=50e6;assert.equal(x.e.makeSubsidiary(x.s.id),true);x.s.fundingOpen=true;const subsidiary=x.e.g.subsidiaries.find(row=>row.startupID===x.s.id),ownership=subsidiary.ownership,before=JSON.stringify(x.e.g),companyCash=x.e.g.companyCash,personalCash=x.e.g.personalCash;assert.equal(x.e.openStartupFundingRound(x.s),false);assert.equal(x.s.activeFundingRound,undefined);assert.equal(subsidiary.ownership,ownership);assert.equal(x.e.g.companyCash,companyCash);assert.equal(x.e.g.personalCash,personalCash);assert.equal(JSON.stringify(x.e.g),before);
}
{
 let x=setup(),plan=open(x);const frozen={...x.s.activeFundingRound};x=reload(x);for(const key of['id','round','openedWeek','closesWeek','preMoneyValuation','targetRaise','postMoneyValuation','preRoundOwnedCompany','preRoundOwnedPersonal'])assert.equal(x.s.activeFundingRound[key],frozen[key],key);plan=x.e.getStartupFundingRoundPlan(x.s.id);const companyContribution=plan.company.proRataRequired,personalContribution=plan.personal.proRataRequired*.4;assert.equal(x.e.participateStartupFundingRound(x.s.id,companyContribution,'company'),true);assert.equal(x.e.participateStartupFundingRound(x.s.id,personalContribution,'personal'),true);const persisted={companyCash:x.e.g.companyCash,personalCash:x.e.g.personalCash,totalInvestedCompany:x.s.totalInvestedCompany,totalInvestedPersonal:x.s.totalInvestedPersonal};x=reload(x);plan=x.e.getStartupFundingRoundPlan(x.s.id);assert.equal(x.s.activeFundingRound.contributedCompany,companyContribution);assert.equal(x.s.activeFundingRound.contributedPersonal,personalContribution);assert.equal(plan.company.remaining,0);assert.ok(Math.abs(plan.personal.remaining-plan.personal.proRataRequired*.6)<1e-7);for(const[key,value]of Object.entries(persisted))assert.equal(key.startsWith('total')?x.s[key]:x.e.g[key],value,key);x.e.g.week=plan.closesWeek;assert.equal(x.e.closeStartupFundingRound(x.s),true);assert.ok(Math.abs(x.s.ownedCompany-frozen.preRoundOwnedCompany)<1e-12);const expectedPersonal=frozen.preRoundOwnedPersonal*frozen.preMoneyValuation/frozen.postMoneyValuation+personalContribution/frozen.postMoneyValuation;assert.ok(Math.abs(x.s.ownedPersonal-expectedPersonal)<1e-12);assert.equal(x.s.valuation,frozen.postMoneyValuation);assert.equal(x.s.activeFundingRound,null);const closedOwnership={company:x.s.ownedCompany,personal:x.s.ownedPersonal};x=reload(x);assert.equal(x.e.closeStartupFundingRound(x.s),false);assert.deepEqual({company:x.s.ownedCompany,personal:x.s.ownedPersonal},closedOwnership);assert.equal(x.s.activeFundingRound,null);assert.equal(x.e.g.saveVersion,9);
}
{
 const x=setup();x.s.ownedCompany=0;x.s.ownedPersonal=.0500009;x.s.totalInvestedPersonal=10e6;x.s.activeFundingRound=null;const cash=x.e.g.personalCash,preStake=x.s.valuation*x.s.ownedPersonal,preWorth=x.e.personalNetWorth();assert.equal(preWorth,cash+preStake);x.e.listStartup(x.s);const holding=x.e.g.personalStocks[x.s.ipoStockID],stock=x.e.stock(x.s.ipoStockID),postStake=holding.qty*stock.price;assert.equal(holding.qty,Math.floor(.0500009*1e6));assert.equal(x.s.ownedPersonal,0);assert.ok(Math.abs(x.e.personalNetWorth()-(cash+postStake))<1e-7);assert.ok(Math.abs((x.e.personalNetWorth()-preWorth)-(postStake-preStake))<1e-7);
}
// Codex P2 on #1029: every receipt the payment-evidence check needs must survive the 24-row
// history cap, and receipt IDs must stay unique, for any state the public writer can produce.
{
 const x=setup(),p=open(x),step=100_000;let accepted=0;
 for(let i=0;i<25;i++)if(x.e.participateStartupFundingRound(x.s.id,step,'personal'))accepted++;
 assert.ok(accepted<25,'the writer must stop before a receipt would fall out of the capped history');
 assert.equal(x.s.activeFundingRound.contributedPersonal,accepted*step);
 const ids=x.e.g.startupFundingHistory[x.s.id].map(row=>row.id);assert.equal(new Set(ids).size,ids.length,'receipt IDs are unique');
 assert.equal(x.e.hasStartupFundingRoundPaymentEvidence(x.s.id,'personal'),true,'all paid installments remain provable');
 x.e.g.week=p.closesWeek;assert.equal(x.e.closeStartupFundingRound(x.s),true,'a round funded through the public writer can close');
}
{
 const x=setup();x.e.g.startupFundingHistory[x.s.id]=Array.from({length:24},(_,i)=>({id:`old-round-${i}`,eventType:'closed',stage:'Seed',closedWeek:1}));
 const p=open(x);
 assert.equal(x.e.participateStartupFundingRound(x.s.id,100_000,'personal'),true);
 assert.equal(x.e.participateStartupFundingRound(x.s.id,100_000,'personal'),true,'second installment in the same week');
 const ids=x.e.g.startupFundingHistory[x.s.id].map(row=>row.id);assert.equal(new Set(ids).size,ids.length,'full prior history must not reuse receipt IDs');
 assert.equal(x.e.hasStartupFundingRoundPaymentEvidence(x.s.id,'personal'),true);
 x.e.g.week=p.closesWeek;assert.equal(x.e.closeStartupFundingRound(x.s),true);
}
{
 // A round opened before this fix keeps legacy history-length suffixes; new receipts must not collide.
 const x=setup(),p=open(x),r=x.s.activeFundingRound;
 assert.equal(x.e.participateStartupFundingRound(x.s.id,100_000,'personal'),true);
 const first=x.e.g.startupFundingHistory[x.s.id][0];first.id=`${r.id}-personal-${x.e.g.week}-0`;
 const legacy={...first,id:`${r.id}-personal-${x.e.g.week}-2`};x.e.g.startupFundingHistory[x.s.id].unshift(legacy);
 r.contributedPersonal+=legacy.amount;x.s.totalInvestedPersonal+=legacy.amount;
 assert.equal(x.e.participateStartupFundingRound(x.s.id,100_000,'personal'),true);
 const ids=x.e.g.startupFundingHistory[x.s.id].map(row=>row.id);assert.equal(new Set(ids).size,ids.length,'no collision with legacy receipt IDs');
 assert.equal(x.e.hasStartupFundingRoundPaymentEvidence(x.s.id,'personal'),true);
}
// Owner decision 2026-10-20 (#1029, option a): a legacy save whose pre-fix writer already pushed
// receipts out of the 24-row history is held fail-closed. Nothing is converted, refunded or
// rewritten, the cause is identifiable, and the hold survives save/reload.
{
 const x=setup(),p=open(x),r=x.s.activeFundingRound,step=100_000,cash0=x.e.g.personalCash,basis0=finite0(x.s.totalInvestedPersonal);
 function finite0(v){return Number.isFinite(v)?v:0;}
 // Exact pre-fix writer effects: charge, accumulate, receipt suffix = history length, cap at 24.
 const legacyPay=()=>{x.e.g.personalCash-=step;r.contributedPersonal+=step;x.s.totalInvestedPersonal=finite0(x.s.totalInvestedPersonal)+step;const h=x.e.g.startupFundingHistory[x.s.id];h.unshift({id:`${r.id}-personal-${x.e.g.week}-${h.length}`,eventType:'participated',stage:p.round,week:x.e.g.week,account:'personal',amount:step,preMoneyValuation:p.preMoneyValuation,targetRaise:p.targetRaise,postMoneyValuation:p.postMoneyValuation});x.e.g.startupFundingHistory[x.s.id]=h.slice(0,24);};
 for(let i=0;i<25;i++)legacyPay();
 assert.equal(r.contributedPersonal,25*step);assert.equal(x.e.g.personalCash,cash0-25*step);assert.equal(x.s.totalInvestedPersonal,basis0+25*step);
 assert.equal(x.e.hasStartupFundingRoundPaymentEvidence(x.s.id,'personal'),false,'truncated receipts cannot prove the pending amount');
 const hold=x.e.getStartupFundingRoundHold(x.s.id);
 assert.equal(hold.code,'PAYMENT_HISTORY_TRUNCATED');assert.equal(hold.accounts.length,1);
 assert.equal(hold.accounts[0].account,'personal');assert.equal(hold.accounts[0].pending,25*step);
 const visible=x.e.g.startupFundingHistory[x.s.id].filter(row=>row.eventType==='participated').reduce((t,row)=>t+row.amount,0);
 assert.equal(hold.accounts[0].retainedPaid,visible,'every retained receipt row counts, including reused legacy IDs');
 assert.ok(hold.accounts[0].duplicateReceiptIDs>0,'reused legacy receipt IDs are reported');
 assert.equal(hold.accounts[0].unproven,25*step-visible);
 const before=JSON.stringify(x.e.g);
 assert.equal(x.e.participateStartupFundingRound(x.s.id,step,'personal'),false,'a full round refuses further installments');
 assert.equal(JSON.stringify(x.e.g),before,'refused installment changes nothing');
 x.e.g.week=p.closesWeek;
 const keep=()=>JSON.stringify({s:x.e.g.startups.find(row=>row.id===x.s.id),h:x.e.g.startupFundingHistory[x.s.id],personal:x.e.g.personalCash,company:x.e.g.companyCash});
 const held=keep();
 assert.equal(x.e.closeStartupFundingRound(x.s),false,'unproven round is not closed');
 x.e.updateStartups();x.e.updateStartups();
 assert.equal(keep(),held,'held round keeps cash, contribution, cost basis, stake and history unchanged');
 assert.ok(x.s.activeFundingRound&&x.s.activeFundingRound.contributedPersonal===25*step,'subscription is neither converted nor refunded');
 const y=reload(x);
 assert.equal(y.s.activeFundingRound.contributedPersonal,25*step);
 assert.equal(y.e.getStartupFundingRoundHold(y.s.id).code,'PAYMENT_HISTORY_TRUNCATED','hold survives save/reload');
}
// A fully evidenced round has no hold.
{
 const x=setup(),p=open(x);assert.equal(x.e.getStartupFundingRoundHold(x.s.id),null);
 assert.equal(x.e.participateStartupFundingRound(x.s.id,p.personal.proRataRequired/2,'personal'),true);
 assert.equal(x.e.getStartupFundingRoundHold(x.s.id),null);
 // A mismatch without the truncation signature is reported as such.
 x.s.activeFundingRound.contributedPersonal+=1;x.s.totalInvestedPersonal+=1;
 assert.equal(x.e.getStartupFundingRoundHold(x.s.id).code,'PAYMENT_EVIDENCE_MISMATCH');
}
// Codex P1 on #1029: a round whose contribution fields are unreadable is kept (not discarded) while a
// paid receipt exists. Codex P2: the hold is rendered even though no round plan can be built.
{
 const x=setup(),p=open(x);assert.equal(x.e.participateStartupFundingRound(x.s.id,100_000,'personal'),true);
 delete x.s.activeFundingRound.contributedPersonal;delete x.s.activeFundingRound.contributedCompany;
 assert.equal(x.e.getStartupFundingRoundPlan(x.s.id),null);
 const before=JSON.stringify(x.e.g.startups.find(row=>row.id===x.s.id));
 x.e.updateStartups();
 assert.equal(JSON.stringify(x.e.g.startups.find(row=>row.id===x.s.id)),before,'round with a paid receipt is preserved unchanged');
 assert.equal(x.e.getStartupFundingRoundHold(x.s.id).code,'ROUND_STRUCTURE_INVALID');
 for(const bad of ['100000',NaN]){const y=setup();open(y);y.s.activeFundingRound.contributedCompany=bad;y.e.updateStartups();assert.ok(y.s.activeFundingRound,'unreadable contribution keeps the round');}
 x.e.g.selectedTab='venture';x.e.save();const raw=x.loaded.ctx.__localStorageData.get(x.loaded.engineModule.SAVE_KEY);
 const ui=loadGame({localStorageInitial:{[x.loaded.engineModule.SAVE_KEY]:raw}});
 assert.match(String(ui.ctx.document.getElementById('app').innerHTML),/data-startup-funding-round-hold="ROUND_STRUCTURE_INVALID"/,'hold notice renders without a round plan');
}
console.log('startup funding round tests passed');
