'use strict';
// #975 group-restructuring disposals through production writers: a VC subsidiary (investStartup -> makeSubsidiary),
// a listed subsidiary taken private (IPO -> lockup -> tender offer -> squeeze-out) and two wholly owned
// subsidiaries for a merge. Shared by the Node accounting test, the save-atomicity test and the WebKit test.
const assert=require('node:assert/strict');
const {boot,advance,liveGame,listedGame,snapshot,economic}=require('./subsidiary-quarter-close');

const DISPOSAL_WEEK=14,FRACTION=0.37;
const subOf=(state,id)=>state.subsidiaries.find(x=>String(x.id)===String(id));
const validate=ctx=>ctx.modules.finance.validate(snapshot(ctx.game));
const subsidiaryAssets=(ctx,state=snapshot(ctx.game))=>ctx.modules.finance.buildStatements(state).balanceSheet.assets.subsidiariesAndAffiliates;
// Liquidation needs four deterministic signals; these are operating inputs (not balance-sheet values).
function distress(sub){Object.assign(sub,{growth:.01,risk:.6,weeklyProfit:-1000,lossMakingWeeks:30,valuation:Math.round(sub.carryingBookValue*.3)});}
// An older save whose IPO removed a fractional book (main before #966): the IPO ledger row and the parent's book
// both carry the same fraction, exactly as the old ipoSubsidiary wrote them, so accounting is valid before disposal.
function legacyFractionalIPO(state,id,fraction=FRACTION){
 const row=state.finance.transactions.find(t=>t.sourceType==='ipoSubsidiary'&&String(t.sourceID)===String(id));
 assert.ok(row,'production IPO ledger row');row.assetEffect-=fraction;row.profitEffect-=fraction;subOf(state,id).carryingBookValue-=fraction;
}
// A private (delisted, wholly owned) subsidiary that came from a listing; `fraction` emulates an older save.
function privateGame(fraction=0){
 const c=listedGame(17),g=c.game.g,id=c.subsidiaryID;
 if(fraction)legacyFractionalIPO(g,id,fraction);
 assert.equal(validate(c).ok,true,'listed accounting valid');
 while(g.week<subOf(g,id).ipoOfferTerms.lockupUntilWeek)advance(c.game);
 assert.equal(c.game.launchListedSubsidiaryTenderOffer(id),true,'production tender offer');
 assert.equal(c.game.squeezeOutListedSubsidiary(id),true,'production squeeze-out');
 assert.equal(subOf(g,id).publicCompany,false,'taken private');assert.equal(subOf(g,id).ownership,1);
 assert.equal(validate(c).ok,true,'private accounting valid');
 return c;
}
// A second production VC subsidiary next to liveGame's first; the merge needs both wholly owned. Ownership is an
// operating field (the parent's book does not depend on it), so raising it to 1 is setup, not a balance-sheet edit.
function mergeGame(){
 const c=liveGame('vc',3),game=c.game,g=game.g;
 const startup=g.startups.filter(s=>s.alive&&!s.subsidiary).sort((a,b)=>a.valuation-b.valuation)[0];
 for(let n=0;n<20;n++){const s=g.startups.find(x=>x.id===startup.id);if(s.ownedCompany>=.69)break;const stake=Math.min(.35,.7-s.ownedCompany);
  assert.equal(game.investStartup(s.id,Math.max(s.minTicket,Math.ceil(stake*s.valuation/(1-stake))),'company'),true,'production investStartup');}
 assert.equal(game.makeSubsidiary(startup.id),true,'second production makeSubsidiary');
 for(const s of g.subsidiaries)Object.assign(s,{ownership:1,domain:'saas'});
 assert.equal(validate(c).ok,true,'two subsidiaries accounting valid');
 return {...c,ids:g.subsidiaries.map(s=>s.id)};
}
let vcEveState=null;
function vcState(){return vcEveState||(vcEveState=JSON.stringify(liveGame('vc',DISPOSAL_WEEK).game.g));}
async function vcEve(){
 const ctx=boot();await ctx.backend.hydrate();
 const game=new ctx.engineModule.TycoonEngine(JSON.parse(vcState()));
 assert.equal(game.g.week,DISPOSAL_WEEK);assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true,'reloaded accounting valid');
 assert.equal(game.save(),true);await ctx.backend.flush();
 return {...ctx,game,subsidiaryID:game.g.subsidiaries.at(-1).id};
}
// The disposal left the parent: no book in the balance sheet, the ledger removed exactly the pre-disposal book.
function expectDisposed(before,after,ctx,{status,id=ctx.subsidiaryID}){
 const sub=subOf(after,id),pre=subOf(before,id),rows=after.finance.transactions.slice(before.finance.transactions.length);
 assert.equal(sub.status,status);assert.equal(sub.ownership,0);assert.equal(sub.carryingBookValue,0);
 assert.equal(ctx.modules.finance.validate(after).ok,true,`finance.validate right after the ${status} disposal`);
 const disposal=rows.filter(t=>t.category==='assetSale');assert.equal(disposal.length,1,'one disposal ledger row');
 assert.equal(-disposal[0].assetEffect,pre.carryingBookValue,'ledger removes the exact pre-disposal book');
 assert.equal(after.companyCash,before.companyCash+disposal[0].cashEffect,'cash moves by exactly the ledger cash effect');
}
module.exports={DISPOSAL_WEEK,FRACTION,subOf,validate,subsidiaryAssets,distress,legacyFractionalIPO,privateGame,mergeGame,vcState,vcEve,expectDisposed,boot,advance,liveGame,snapshot,economic};
