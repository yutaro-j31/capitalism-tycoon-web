'use strict';
const assert=require('node:assert/strict');const{loadGame}=require('./harness');
function lcg(seed=9){let s=seed>>>0;return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/2**32);}
function game(seed=9){const x=loadGame({random:lcg(seed)}),e=x.ctx.__ct_engine;e.g.personalCash=2e9;e.g.companyCash=2e9;e.g.finance=x.modules.finance.defaultFinanceState(e.g);return{x,e};}
function acquire(owner='personal',seed=9){const{x,e}=game(seed);if(owner==='company')e.g.departments.investment={name:'投資部'};const pc=e.g.personalCash,cc=e.g.companyCash,tx=e.g.finance.transactions.length;assert.equal(e.createPEDeal('テック',100e6,owner),true);return{x,e,d:e.g.peDeals.at(-1),pc,cc,tx};}
const stakeMatches=(d,s)=>assert.ok(Math.abs(s.valuation*s.ownership-d.currentValuation)<.01,'stake value equals total valuation times ownership');
// Legacy API defaults to personal and separates cash/accounts.
{const{e,d,pc,cc}=acquire();assert.equal(d.ownerAccount,'personal');assert.equal(e.g.personalCash,pc-100e6);assert.equal(e.g.companyCash,cc);assert.equal(e.g.subsidiaries.length,0);}
// Company gate is atomic; personal acquisition does not require the department.
{const{e}=game(),before=JSON.stringify(e.g);assert.equal(e.createPEDeal('テック',100e6,'company'),false);assert.equal(JSON.stringify(e.g),before);assert.equal(e.createPEDeal('テック',100e6),true);}
// Company acquisition accounting, deterministic linkage, valuation equation and net-worth separation.
{const{e,d,pc,cc,tx}=acquire('company');const s=e.g.subsidiaries[0];assert.equal(e.g.personalCash,pc);assert.equal(e.g.companyCash,cc-100e6);assert.equal(e.g.finance.transactions.length,tx+1);assert.equal(e.g.finance.transactions.at(-1).category,'acquisition');assert.equal(s.id,`pe-subsidiary-${d.id}`);assert.equal(s.source,'pe');assert.equal(s.valuationManagedBy,'pe');stakeMatches(d,s);const personal=e.personalNetWorth();d.currentValuation+=50e6;e.syncPESubsidiary(d);assert.equal(e.personalNetWorth(),personal);stakeMatches(d,s);const withSub=e.companyValue();e.g.subsidiaries=[];assert.ok(Math.abs(withSub-e.companyValue()-d.currentValuation)<.01,'company value includes PE stake exactly once');}
// P3-4 FC-G30-01 (partial): one PE legal stake has one subsidiary projection across
// direct sync, installed weekly sync and fresh storage hydration. This tests identity
// reuse, not caller closure, a second economic asset, or ownership authority.
{
 const {e,d}=acquire('company',181),id=`pe-subsidiary-${d.id}`;
 const count=e.g.subsidiaries.length,companyCash=e.g.companyCash,personalCash=e.g.personalCash;
 const transactions=e.g.finance.transactions.length,initialValue=e.companyValue();
 for(let i=0;i<2;i++){
  const sub=e.syncPESubsidiary(d);
  assert.equal(sub.id,id);assert.equal(sub.peDealID,d.id);
  assert.equal(e.g.subsidiaries.length,count,'direct re-sync never appends the same stake');
  assert.equal(e.companyValue(),initialValue,'direct re-sync never creates a second asset');
 }
 assert.equal(e.g.companyCash,companyCash);assert.equal(e.g.personalCash,personalCash);
 assert.equal(e.g.finance.transactions.length,transactions,'mirror-only sync posts no ledger receipt');
 e.updatePersonalExpandedWeekly();
 const weeklyValue=e.companyValue();e.syncPESubsidiary(d);
 assert.equal(e.g.subsidiaries.filter(x=>x.id===id).length,1,'weekly then direct sync preserves identity');
 assert.equal(e.companyValue(),weeklyValue,'weekly mirror is counted once');
 assert.equal(e.save(),true);
 const loaded=e.constructor.load(),deal=loaded.g.peDeals.find(x=>x.id===d.id);
 assert.ok(deal,'original PE legal stake survives reload');
 assert.equal(loaded.g.subsidiaries.filter(x=>x.id===id).length,1,'one mirror survives reload');
 // Save/load normalization can change the pre-sync mirror's valuation; the sync must
 // replace that *one* stake, not add a second copy or change unrelated company value.
 const priorSub=loaded.g.subsidiaries.find(x=>x.id===id);
 const priorStake=priorSub.valuation*priorSub.ownership;
 const reloadedValue=loaded.companyValue(),reloadedCash=loaded.g.companyCash;
 const reloadedPersonalCash=loaded.g.personalCash,reloadedTx=loaded.g.finance.transactions.length;
 const expectedStake=deal.currentValuation;
 assert.equal(priorSub.valuation,deal.currentValuation/deal.ownershipRatio,'reload does not round the PE projection valuation');
 assert.equal(priorSub.ownership,deal.ownershipRatio,'reload does not round the PE projection ownership');
 assert.equal(priorStake,expectedStake,'reload preserves the legal PE stake value before re-sync');
 assert.equal(reloadedValue,weeklyValue,'reload cannot fabricate or lose company value through mirror normalization');
 loaded.syncPESubsidiary(deal);
 const currentSub=loaded.g.subsidiaries.find(x=>x.id===id);
 assert.equal(loaded.g.subsidiaries.filter(x=>x.id===id).length,1,'rehydrated direct sync reuses mirror');
 assert.ok(Math.abs(currentSub.valuation*currentSub.ownership-expectedStake)<.01,'rehydrated mirror equals one legal PE stake');
 assert.ok(Math.abs((loaded.companyValue()-reloadedValue)-(expectedStake-priorStake))<.01,'rehydrated sync replaces only the previous stake value');
 assert.equal(loaded.companyValue(),reloadedValue,'re-sync is valuation-idempotent after reload');
 assert.equal(loaded.g.companyCash,reloadedCash,'rehydrated mirror sync does not move company cash');
 assert.equal(loaded.g.personalCash,reloadedPersonalCash,'rehydrated mirror sync does not move personal cash');
 assert.equal(loaded.g.finance.transactions.length,reloadedTx,'rehydrated mirror sync posts no ledger event');
}
{
 const {e,d}=acquire('personal',182),before=JSON.stringify(e.g);
 assert.equal(e.syncPESubsidiary(d),null,'personal PE stake cannot create a company subsidiary mirror');
 assert.equal(JSON.stringify(e.g),before,'rejected personal mirror sync leaves all state unchanged');
}
// Transfer is fair-value, atomic and commits exactly once.
{const{x,e,d}=acquire();const price=x.modules.economicOperation.ceilYen(d.currentValuation),pc=e.g.personalCash,cc=e.g.companyCash,pl=e.g.peRealizedPL,tx=e.g.finance.transactions.length;let saves=0,events=[];e.save=()=>{saves++;return true;};e.emit=type=>{events.push(type||'change');};assert.equal(e.transferPEDealToCompany(d.id),true);assert.equal(saves,1);assert.deepEqual(events,['notify','change']);assert.equal(e.g.personalCash,pc+price);assert.equal(e.g.companyCash,cc-price);assert.equal(e.g.peRealizedPL,pl+price-100e6);assert.equal(d.ownerAccount,'company');assert.equal(d.ownerCostBasis,price);assert.equal(e.g.subsidiaries[0].carryingBookValue,price);assert.equal(e.g.finance.transactions.length,tx+1);const snapshot=JSON.stringify(e.g);assert.equal(e.transferPEDealToCompany(d.id),false);assert.equal(JSON.stringify(e.g),snapshot);}
{const{e,d}=acquire();e.g.companyCash=d.currentValuation-1;const before=JSON.stringify(e.g);assert.equal(e.transferPEDealToCompany(d.id),false);assert.equal(JSON.stringify(e.g),before);}
// P3-4 FC-G30-01 (partial): personal -> company transfer, installed weekly update,
// save/reload and company EXIT form one legal-stake lifecycle. Individual writer
// atomicity is covered elsewhere; this checks cross-route mirror identity and
// prevents a transferred personal stake from reappearing as a second company asset.
{
 const {x,e,d}=acquire('personal',193),dealID=d.id,id=`pe-subsidiary-${dealID}`;
 const transferPrice=x.modules.economicOperation.ceilYen(d.currentValuation);
 const companyBefore=e.g.companyCash,personalBefore=e.g.personalCash;
 assert.equal(e.transferPEDealToCompany(dealID),true);
 assert.equal(e.g.companyCash,companyBefore-transferPrice);
 assert.equal(e.g.personalCash,personalBefore+transferPrice);
 assert.equal(e.g.subsidiaries.filter(s=>s.id===id).length,1,'transfer creates one mirror');
 e.updatePersonalExpandedWeekly();
 assert.equal(e.g.subsidiaries.filter(s=>s.id===id).length,1,'weekly update reuses transferred mirror');
 assert.equal(e.save(),true);
 const loaded=e.constructor.load(),deal=loaded.g.peDeals.find(s=>s.id===dealID);
 assert.ok(deal);assert.equal(deal.ownerAccount,'company');
 assert.equal(loaded.g.peDeals.filter(s=>s.id===dealID).length,1,'one legal PE deal after reload');
 const mirror=loaded.g.subsidiaries.find(s=>s.id===id);
 assert.ok(mirror);assert.equal(loaded.g.subsidiaries.filter(s=>s.id===id).length,1);
 const beforeValue=loaded.companyValue(),beforeStake=mirror.valuation*mirror.ownership;
 const beforeCash=loaded.g.companyCash,beforePersonal=loaded.g.personalCash;
 const beforeLedger=loaded.g.finance.transactions.length;
 loaded.syncPESubsidiary(deal);
 assert.equal(loaded.g.subsidiaries.filter(s=>s.id===id).length,1,'reload sync cannot duplicate transfer');
 assert.ok(Math.abs((loaded.companyValue()-beforeValue)-(deal.currentValuation-beforeStake))<.01,'reload sync replaces one stake');
 assert.equal(loaded.g.companyCash,beforeCash);assert.equal(loaded.g.personalCash,beforePersonal);
 assert.equal(loaded.g.finance.transactions.length,beforeLedger,'projection alone posts no sale or acquisition');
 assert.equal(loaded.exitPEDeal(dealID),true);
 assert.equal(loaded.g.peDeals.find(s=>s.id===dealID).status,'exited');
 assert.equal(loaded.g.subsidiaries.filter(s=>s.id===id).length,0,'EXIT removes transferred mirror');
 assert.equal(loaded.g.personalCash,beforePersonal,'company EXIT cannot credit founder cash');
 assert.equal(loaded.g.finance.transactions.length,beforeLedger+1,'one EXIT ledger receipt');
 const fresh=loaded.constructor.load();
 assert.equal(fresh.g.peDeals.find(s=>s.id===dealID).status,'exited','EXIT persists after reload');
 assert.equal(fresh.g.subsidiaries.filter(s=>s.id===id).length,0,'EXIT mirror cannot resurrect');
 assert.equal(fresh.g.companyCash,loaded.g.companyCash);
 assert.equal(fresh.g.personalCash,loaded.g.personalCash);
}

// Every company initiative payment gets its own deterministic finance sequence in the same week.
// Two distinct deals (not the same deal twice): a deal can have only one initiative in flight
// at a time once effects are delayed, so "two payments in the same week" now means two deals,
// which is exactly what the company concurrency cap (2) is meant to allow.
{const{x,e,d}=acquire('company',44),m=x.modules.peValueCreation,cost=m.initiativeCost(d);assert.equal(e.createPEDeal('テック2',100e6,'company'),true);const d2=e.g.peDeals.at(-1),cash=e.g.companyCash,tx=e.g.finance.transactions.length;e.applyPEInitiative(d.id,'cost-cut');e.applyPEInitiative(d2.id,'cost-cut');assert.equal(e.g.companyCash,cash-cost*2);assert.equal(e.g.finance.transactions.length,tx+2);assert.notEqual(e.g.finance.transactions.at(-1).transactionID,e.g.finance.transactions.at(-2).transactionID);assert.equal(x.modules.finance.validate(e.g).ok,true);stakeMatches(d,e.g.subsidiaries[0]);}
// Explicit success and failure both synchronize valuation.
{for(const wanted of [true,false]){const{x,e,d}=acquire('company',72);for(let i=0;i<500&&x.modules.peValueCreation.succeeds(e.g,d,'capex')!==wanted;i++)e.g.week++;assert.equal(x.modules.peValueCreation.succeeds(e.g,d,'capex'),wanted);e.applyPEInitiative(d.id,'capex');stakeMatches(d,e.g.subsidiaries[0]);}}
// Weekly PE valuation synchronizes; normal subsidiary updater neither changes it nor consumes its own random draws.
{const{e,d}=acquire('company',81),s=e.g.subsidiaries[0];e.updatePersonalExpandedWeekly();stakeMatches(d,s);const value=s.valuation;e.updateSubsidiaries();assert.equal(s.valuation,value);}
// Existing subsidiary IPO pipeline updates PE ownership, stake valuation and remaining basis and never rolls them back.
{const{e,d}=acquire('company',91);d.ownershipRatio=.70;d.currentValuation=350e6;d.ownerCostBasis=100e6;const s=e.syncPESubsidiary(d);s.ipoPreparation={stageIndex:3,completed:true,offerTermID:'balanced',totalCost:0};assert.equal(e.ipoSubsidiary(s.id),true);assert.equal(d.ownershipRatio,s.ownership);assert.equal(d.ownerCostBasis,s.carryingBookValue);stakeMatches(d,s);const post={ownership:d.ownershipRatio,basis:d.ownerCostBasis};e.updatePersonalExpandedWeekly();assert.equal(d.ownershipRatio,post.ownership);assert.equal(d.ownerCostBasis,post.basis);stakeMatches(d,s);s.ipoOfferTerms.lockupUntilWeek=e.g.week;e.sellSubsidiaryIPOStake(s.id,.10);assert.equal(d.ownershipRatio,s.ownership);assert.equal(d.ownerCostBasis,s.carryingBookValue);stakeMatches(d,s);}
// P3-4 FC-G30-01 (partial): IPO -> listed secondary sale -> reload -> direct
// PE projection sync must retain the reduced legal stake, not recreate sold equity.
// The existing IPO test covers in-memory reverse updates; this checks persistence.
{
 const {e,d}=acquire('company',197),id=`pe-subsidiary-${d.id}`;
 d.ownershipRatio=.70;d.currentValuation=350e6;d.ownerCostBasis=100e6;
 const sub=e.syncPESubsidiary(d);
 sub.ipoPreparation={stageIndex:3,completed:true,offerTermID:'balanced',totalCost:0};
 assert.equal(e.ipoSubsidiary(id),true);
 sub.ipoOfferTerms.lockupUntilWeek=e.g.week;
 const preSaleOwnership=d.ownershipRatio,preSaleBasis=d.ownerCostBasis;
 assert.equal(e.sellSubsidiaryIPOStake(id,.10),true);
 assert.ok(d.ownershipRatio<preSaleOwnership,'secondary sale reduces the legal PE stake');
 assert.ok(d.ownerCostBasis<preSaleBasis,'secondary sale reduces the PE cost basis');
 const expected={ownership:d.ownershipRatio,basis:d.ownerCostBasis,
  companyCash:e.g.companyCash,personalCash:e.g.personalCash,
  ledger:e.g.finance.transactions.length};
 assert.equal(e.save(),true);
 const loaded=e.constructor.load(),deal=loaded.g.peDeals.find(x=>x.id===d.id);
 const mirror=loaded.g.subsidiaries.find(x=>x.id===id);
 assert.ok(deal&&mirror,'listed PE stake and mirror survive reload');
 assert.equal(loaded.g.subsidiaries.filter(x=>x.id===id).length,1);
 assert.equal(deal.ownershipRatio,expected.ownership,'sold equity does not return');
 assert.equal(deal.ownerCostBasis,expected.basis,'sold basis does not return');
 assert.equal(mirror.ownership,expected.ownership);
 assert.equal(mirror.valuation*mirror.ownership,deal.currentValuation,
  'reload preserves the surviving legal stake without projection drift');
 assert.equal(loaded.g.companyCash,expected.companyCash);
 assert.equal(loaded.g.personalCash,expected.personalCash);
 assert.equal(loaded.g.finance.transactions.length,expected.ledger,'sale receipt is not duplicated');
 const valueBefore=loaded.companyValue(),stakeBefore=mirror.valuation*mirror.ownership;
 loaded.syncPESubsidiary(deal);
 assert.equal(loaded.g.subsidiaries.filter(x=>x.id===id).length,1,'forward sync reuses listed mirror');
 assert.equal(mirror.ownership,expected.ownership,'forward sync cannot restore sold shares');
 assert.ok(Math.abs((loaded.companyValue()-valueBefore)-(deal.currentValuation-stakeBefore))<.01,
  'forward sync replaces only the surviving stake value');
 assert.equal(loaded.companyValue(),valueBefore,'forward sync is valuation-idempotent after reload');
 assert.equal(loaded.g.companyCash,expected.companyCash);
 assert.equal(loaded.g.personalCash,expected.personalCash);
 assert.equal(loaded.g.finance.transactions.length,expected.ledger);
}

// Personal and company EXIT route cash/accounting separately and company EXIT removes subsidiary value.
{const{e,d}=acquire(),p=e.g.personalCash,c=e.g.companyCash;assert.equal(e.exitPEDeal(d.id),true);assert.ok(e.g.personalCash>p);assert.equal(e.g.companyCash,c);}
{const{x,e,d}=acquire('company',55);d.improvementScore=100;e.syncPESubsidiary(d);const p=e.g.personalCash,c=e.g.companyCash,basis=d.ownerCostBasis,expected=x.modules.peValueCreation.exitValue(d),tx=e.g.finance.transactions.length;assert.equal(e.exitPEDeal(d.id),true);assert.equal(e.g.personalCash,p);assert.equal(e.g.companyCash,c+expected);assert.equal(e.g.subsidiaries.length,0);assert.equal(d.status,'exited');assert.equal(e.g.finance.transactions.length,tx+1);const ev=e.g.finance.transactions.at(-1);assert.equal(ev.assetEffect,-basis);assert.equal(ev.profitEffect,expected-basis);assert.equal(x.modules.finance.validate(e.g).ok,true);}
// #410 premium boundaries remain unchanged for either owner.
{const{x}=game(),m=x.modules.peValueCreation,d={currentValuation:1000};for(const[score,mult]of[[0,1],[20,1],[60,1.25],[100,1.5]]){d.improvementScore=score;assert.equal(m.exitMultiplier(d),mult);}}
// Old saves become personal without RNG, while current owner persists through save/reload.
{const{e,d}=acquire();delete d.ownerAccount;e.normalize();assert.equal(d.ownerAccount,'personal');e.save();assert.equal(e.constructor.load().g.peDeals[0].ownerAccount,'personal');assert.equal(e.g.saveVersion,9);}
{const{e}=acquire('company');e.save();assert.equal(e.constructor.load().g.peDeals[0].ownerAccount,'company');}
// Initiative outcome remains deterministic for identical state.
{const a=acquire('company',123),b=acquire('company',123);assert.equal(a.x.modules.peValueCreation.outcomeRoll(a.e.g,a.d,'sales'),b.x.modules.peValueCreation.outcomeRoll(b.e.g,b.d,'sales'));}
console.log('PE dual ownership, transaction, IPO synchronization, accounting, valuation and save tests passed');
