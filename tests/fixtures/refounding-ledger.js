'use strict';
// #968 refounding after a company sale through production writers: the stock-split fixture's company, optionally
// holding a company-owned PE deal (the sold company's asset) and a personally owned one, then isCompanySold and
// foundNewCompanyAfterBuyout. Shared by the Node accounting test and the WebKit test.
const assert=require('node:assert/strict');
const {scenario,snapshot,economic}=require('./stock-split-atomicity');

const INVESTMENT=50_000_000,PERSONAL_CASH=200_000_000;
async function soldCompany({companyPE=false,personalPE=false}={}){
 const ctx=await scenario('own'),g=ctx.game.g;
 g.companyCash+=300_000_000;g.personalCash=PERSONAL_CASH+(personalPE?30_000_000:0);g.finance=ctx.modules.finance.defaultFinanceState(g);
 if(companyPE){
  // An already exited company deal (history only, settled before the sale) and an active one (part of the sold company).
  assert.equal(ctx.game.createPEDeal('ramen',20_000_000,'company'),true,'production company PE deal');
  assert.equal(ctx.game.exitPEDeal(g.peDeals.at(-1).id),true,'production PE exit');
  assert.equal(ctx.game.createPEDeal('ramen',100_000_000,'company'),true,'production company PE deal');
 }
 if(personalPE)assert.equal(ctx.game.createPEDeal('ramen',30_000_000,'personal'),true,'production personal PE deal');
 assert.equal(ctx.modules.finance.validate(snapshot(ctx.game)).ok,true,'sold company accounting valid');
 g.isCompanySold=true;assert.equal(ctx.game.save(),true);await ctx.backend.flush();
 return ctx;
}
const refound=(ctx,mode='store')=>ctx.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,mode)===true;
// The new company's book opens at the founder's contribution: cash = opening cash = opening equity = investment,
// validate passes at once, the founder's personal cash is debited exactly once, and no company PE deal of the sold
// company is carried (personal deals stay with the founder).
function expectRefounded(before,after,ctx){
 const f=after.finance;
 assert.equal(after.companyCash,INVESTMENT,'company cash is the contribution');
 assert.equal(f.openingCash,INVESTMENT,'opening cash is the contribution');assert.equal(f.openingEquity,INVESTMENT,'opening equity is the contribution');
 assert.equal(f.transactions.length,0,'the new company starts with an empty ledger');
 assert.equal(after.personalCash,before.personalCash-INVESTMENT,'personal cash debited exactly once');
 // The sold company's active company PE deals were part of its sale value (as subsidiaries in companyValue), so they
 // stay with it; exited company deals are history only and personal deals stay with the founder.
 const kept=d=>!(d.ownerAccount==='company'&&d.status==='active');
 assert.equal(after.peDeals.filter(d=>!kept(d)).length,0,'no active company PE deal of the sold company is carried');
 assert.equal(JSON.stringify(after.peDeals.map(d=>d.id)),JSON.stringify(before.peDeals.filter(kept).map(d=>d.id)),'personal deals and exited history are carried');
 assert.equal(ctx.modules.finance.validate(after).ok,true,'finance.validate right after refounding');
}
module.exports={INVESTMENT,soldCompany,refound,expectRefounded,snapshot,economic};
