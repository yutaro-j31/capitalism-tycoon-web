'use strict';
const assert=require('node:assert/strict');const{loadGame}=require('./harness');
function setup(){const loaded=loadGame({headless:true});const e=new loaded.engineModule.TycoonEngine();e.g.configured=true;e.g.companyCash=500e6;e.g.personalCash=500e6;e.g.departments.investment={level:1};delete e.g.finance;e.normalize();const s=e.g.startups[0];s.stage='Series A';s.valuation=300e6;s.ownedCompany=.12;s.ownedPersonal=.05;s.runwayWeeks=7;s.fundingOpen=true;e.g.startupFundingHistory[s.id]=[];return{loaded,e,s};}
function open(x){assert.equal(x.e.openStartupFundingRound(x.s),true);return x.e.getStartupFundingRoundPlan(x.s.id);}
{
 const x=setup(),p=open(x);assert.equal(p.round,'Series B');assert.equal(p.preMoneyValuation,300e6);assert.equal(p.targetRaise,60e6);assert.equal(p.postMoneyValuation,360e6);assert.equal(p.company.proRataRequired,7.2e6);assert.equal(p.personal.proRataRequired,3e6);assert.equal(x.e.openStartupFundingRound(x.s),false);
 const snap=JSON.stringify(x.e.g),cash=x.e.g.companyCash;for(const v of[NaN,Infinity,0,-1,'1',null,7.2e6+1])assert.equal(x.e.participateStartupFundingRound(x.s.id,v,'company'),false);assert.equal(JSON.stringify(x.e.g),snap);assert.equal(x.e.g.companyCash,cash);
}
{
 const x=setup(),p=open(x),personal=x.e.g.personalCash,company=x.e.g.companyCash,basis=x.s.totalInvestedCompany;let saves=0,emits=0;x.e.save=()=>saves++;x.e.emit=()=>emits++;
 assert.equal(x.e.participateStartupFundingRound(x.s.id,p.company.proRataRequired/2,'company'),true);assert.equal(x.e.participateStartupFundingRound(x.s.id,p.company.proRataRequired/2,'company'),true);assert.equal(x.e.g.personalCash,personal);assert.equal(x.e.g.companyCash,company-p.company.proRataRequired);assert.equal(x.s.totalInvestedCompany,basis+p.company.proRataRequired);assert.equal(saves,2);assert.equal(emits,2);x.e.g.week=p.closesWeek;assert.equal(x.e.closeStartupFundingRound(x.s),true);assert.ok(Math.abs(x.s.ownedCompany-.12)<1e-12);assert.ok(Math.abs(x.s.ownedPersonal-.05*300/360)<1e-12);const after=x.s.ownedPersonal;assert.equal(x.e.closeStartupFundingRound(x.s),false);assert.equal(x.s.ownedPersonal,after);assert.equal(x.s.valuation,360e6);assert.equal(x.s.runwayWeeks,56);assert.equal(x.loaded.modules.finance.validate(x.e.g).ok,true);
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
console.log('startup funding round tests passed');
