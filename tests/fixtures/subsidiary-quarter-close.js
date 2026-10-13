'use strict';
// #971 fixture: a VC subsidiary (investStartup -> makeSubsidiary) or an M&A subsidiary (the full deal-room flow
// open -> round -> due diligence -> offer -> financing -> board approval -> close) built with production writers
// only, then advanced with the production week to the eve of the first quarter close (week 12).
// The only hand-set inputs are a cash buffer and the investment department unlock.
const assert=require('node:assert/strict');
const {loadGame}=require('../harness');
const {indexedDBFor}=require('./pe-fund-acquisition-faults');

const QUARTER_EVE=12,LISTED_EVE=25;
const snapshot=game=>JSON.parse(JSON.stringify(game.g));
function economic(state){const copy=JSON.parse(JSON.stringify(state));delete copy.lastSaveDate;delete copy.saveSequence;return copy;}
function lcg(seed=971){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

function boot(){
 const durable=new Map(),control={attempts:[]},host={draws:0},random=lcg();
 const s=loadGame({headless:true,random:()=>{host.draws++;return random();},indexedDB:indexedDBFor(durable,control)});
 return {...s,backend:s.modules.saveStorageIDB,key:s.engineModule.SAVE_KEY,durable,control,host};
}
function advance(game){const result=game.advanceWeek(false);if(result===false)throw new Error(`week ${game.g.week+1} did not commit`);return result;}

// largest: the most valuable startup, big enough for the production subsidiary IPO route.
function vcSubsidiary(game,largest=false){
 const g=game.g,ranked=g.startups.filter(s=>s.alive).sort((a,b)=>a.valuation-b.valuation),startup=largest?ranked.at(-1):ranked[0];
 for(let n=0;n<20;n++){
  const s=g.startups.find(x=>x.id===startup.id);if(s.ownedCompany>=.69)break;
  const stake=Math.min(.35,.7-s.ownedCompany);
  assert.equal(game.investStartup(s.id,Math.max(s.minTicket,Math.ceil(stake*s.valuation/(1-stake))),'company'),true,'production investStartup');
 }
 assert.equal(game.makeSubsidiary(startup.id),true,'production makeSubsidiary');
 return g.subsidiaries.at(-1).id;
}
function maSubsidiary(game){
 const g=game.g;
 assert.ok(game.generateMATargets(true),'production M&A targets');
 const target=[...g.acquisitionTargets].filter(x=>x.friendly!==false).sort((a,b)=>a.valuation-b.valuation)[0];
 assert.equal(game.openMADealRoom(target.id),true,'open deal room');
 const room=()=>g.maDealRooms.find(x=>x.targetID===target.id)||g.maDealRooms.at(-1);
 const id=room().id;game.advanceMADealRound(id);
 assert.equal(game.startMADueDiligence(id,'financial'),true,'financial due diligence');
 for(let i=0;i<4&&room().activeDiligence;i++)advance(game);
 if(room().status==='ready')game.advanceMADealRound(id);
 const quote=game.calculateMAAcquisitionPrice(g.acquisitionTargets.find(x=>x.id===target.id),'friendly');
 assert.equal(game.submitMAOffer(id,{method:'friendly',offerPrice:Math.ceil(quote.minimumPrice*1.15)}),true,'offer');
 for(let i=0;i<4&&room().status!=='accepted';i++){advance(game);if(room().status==='countered')game.acceptMACounterOffer(id);}
 assert.equal(room().status,'accepted','offer accepted');
 assert.ok(game.maAcquisitionFinancingPresets(id).filter(x=>x.available).some(preset=>game.selectMAAcquisitionFinancing(id,preset)),'production financing');
 assert.equal(game.approveMAClosing(id),true,'board approval');
 assert.equal(game.closeMADeal(id),true,'close deal');
 return g.maSubsidiaries.at(-1).id;
}

// A live production game holding one subsidiary of the given kind, at the requested week.
function liveGame(kind,week=QUARTER_EVE,{largest=false}={}){
 const ctx=boot(),game=new ctx.engineModule.TycoonEngine();
 game.configure({playerName:'T',companyName:'Quarter971',difficulty:'normal',scenario:'free',simulationSeed:971});
 game.g.companyCash=3_000_000_000;game.g.departments.investment=true;
 game.g.finance=ctx.modules.finance.defaultFinanceState(game.g);
 assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true,'opening accounting valid');
 const subsidiaryID=kind==='vc'?vcSubsidiary(game,largest):maSubsidiary(game);
 assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true,`${kind} subsidiary accounting valid`);
 while(game.g.week<week)advance(game);
 return {...ctx,game,kind,subsidiaryID};
}

// Week-12 states are built once per kind; every fault case reloads that state into a fresh runtime.
const eve={};
function eveState(kind){return eve[kind]||(eve[kind]=JSON.stringify(liveGame(kind).game.g));}
async function quarterEve(kind){
 const ctx=boot();await ctx.backend.hydrate();
 const game=new ctx.engineModule.TycoonEngine(JSON.parse(eveState(kind)));
 assert.equal(game.g.week,QUARTER_EVE);assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true,'reloaded week-12 accounting valid');
 assert.equal(game.save(),true);await ctx.backend.flush();
 const subsidiaryID=(kind==='vc'?game.g.subsidiaries:game.g.maSubsidiaries).at(-1).id;
 return {...ctx,game,kind,subsidiaryID};
}
// A listed subsidiary through the production IPO route (preparation stages -> ipoSubsidiary), advanced to `week`.
function listedGame(week){
 const c=liveGame('vc',1,{largest:true}),g=c.game.g,sub=()=>g.subsidiaries.find(x=>x.id===c.subsidiaryID);
 assert.equal(c.game.startSubsidiaryIPOPreparation(c.subsidiaryID),true,'production IPO preparation');
 while(!sub().publicCompany&&g.week<40){
  advance(c.game);
  if(c.game.subsidiaryIPOPreparationSnapshot(c.subsidiaryID).canAdvance)c.game.advanceSubsidiaryIPOPreparation(c.subsidiaryID);
  if(c.game.subsidiaryIPOPreparationSnapshot(c.subsidiaryID).ready&&!sub().publicCompany)assert.equal(c.game.ipoSubsidiary(c.subsidiaryID),true,'production subsidiary IPO');
 }
 assert.equal(sub().publicCompany,true,'subsidiary listed through production writers');
 while(g.week<week)advance(c.game);
 return c;
}
let listedEveState=null;
function listedState(){return listedEveState||(listedEveState=JSON.stringify(listedGame(LISTED_EVE).game.g));}
async function listedEve(){
 const ctx=boot();await ctx.backend.hydrate();
 const game=new ctx.engineModule.TycoonEngine(JSON.parse(listedState()));
 assert.equal(game.g.week,LISTED_EVE);assert.equal(game.save(),true);await ctx.backend.flush();
 return {...ctx,game,kind:'listed',subsidiaryID:game.g.subsidiaries.find(x=>x.publicCompany).id};
}
const listedDividendRows=(state,id,week)=>(state.finance?.transactions||[]).filter(t=>t.sourceType==='listedSubsidiaryDividend'&&String(t.operationID).startsWith(`listedSubsidiaryDividend-${id}-`)&&(week==null||t.operationID===`listedSubsidiaryDividend-${id}-${week}`));
const subsidiaryOf=(state,kind,id)=>(kind==='vc'?state.subsidiaries:state.maSubsidiaries).find(x=>x.id===id);
// Any ledger row for a VC / M&A subsidiary quarterly dividend. The listed-subsidiary writer's own rows
// (listedSubsidiaryDividend) are a separate, legitimate writer and are excluded.
const dividendRows=state=>(state.finance?.transactions||[]).filter(t=>t.sourceType!=='listedSubsidiaryDividend'&&/subsidiaryDividend|subsDividend/i.test(String(t.sourceType||'')));

module.exports={QUARTER_EVE,LISTED_EVE,snapshot,economic,boot,advance,liveGame,quarterEve,eveState,listedGame,listedEve,listedState,listedDividendRows,subsidiaryOf,dividendRows};
