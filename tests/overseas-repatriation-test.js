'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');

function setup(){
  const {ctx,modules}=loadGame({random:()=>0.5});
  const e=ctx.__ct_engine;
  e.configure({playerName:'Overseas Test',companyName:'Global Test Co',difficulty:'normal'});
  e.g.hasHeadOffice=true;
  e.g.executives.CEO={name:'Test CEO',salary:0};
  e.g.companyCash=500_000_000;
  e.g.exchangeRate=1;
  delete e.g.finance;
  modules.finance.ensureFinance(e.g);
  const ramen=e.business('ramen');
  ramen.demand=10_000;ramen.price=2_000;ramen.unitCost=100;ramen.fixedCost=10_000;
  assert.equal(e.openOverseas('singapore','ramen'),true);
  const x=e.g.overseasSubsidiaries.at(-1);
  x.status='active';x.openingWeek=e.g.week;
  return {e,modules,x};
}

// Old saves normalize without inventing historical overseas cash.
{
  const {e,x}=setup();
  const saveVersion=e.g.saveVersion;
  delete x.localCashForeign;delete x.localCashBookJPY;delete x.totalRepatriatedJPY;delete x.lastRepatriationWeek;delete x.lastFxRate;
  e.normalize();
  const normalized=e.g.overseasSubsidiaries.at(-1);
  assert.equal(normalized.localCashForeign,0);
  assert.equal(normalized.localCashBookJPY,0);
  assert.equal(normalized.totalRepatriatedJPY,0);
  assert.equal(e.g.saveVersion,saveVersion,'save version is unchanged');
}

// Positive overseas earnings stay abroad and the canonical ledger offsets parent cash.
{
  const {e,modules,x}=setup();
  const cashBefore=e.g.companyCash;
  assert.notEqual(e.advanceWeek(false),false);
  const live=e.g.overseasSubsidiaries.find(y=>y.id===x.id);
  assert(live.localCashBookJPY>0,'positive foreign profit becomes local retained cash');
  assert(live.localCashForeign>0,'foreign-currency units are accumulated');
  const rows=e.g.finance.transactions.filter(t=>t.week===e.g.week);
  const overseasRows=rows.filter(t=>['weekly-overseasRevenue','weekly-overseasCost','weekly-overseasRetainedCash'].includes(t.sourceType));
  assert.equal(overseasRows.length,3,'weekly ledger records revenue, cost and retained-cash transfer');
  const overseasCashEffect=overseasRows.reduce((a,t)=>a+t.cashEffect,0);
  assert.ok(Math.abs(overseasCashEffect)<1,'positive overseas earnings do not auto-sweep into parent cash');
  const retained=overseasRows.find(t=>t.sourceType==='weekly-overseasRetainedCash');
  assert.equal(retained.profitEffect,0,'retention is a balance-sheet transfer, not a second expense');
  assert(e.g.companyCash<cashBefore,'normal parent costs still move parent cash independently');
  assert.equal(modules.finance.validate(e.g).ok,true,'retained foreign cash keeps BS/PL/CF consistent');
}

// Overseas losses still hit parent cash and do not consume ring-fenced retained cash.
{
  const {e,x}=setup();
  const ramen=e.business('ramen');
  ramen.demand=1;ramen.price=1;ramen.unitCost=100;ramen.fixedCost=1_000_000;
  const cashBefore=e.g.companyCash;
  assert.notEqual(e.advanceWeek(false),false);
  const live=e.g.overseasSubsidiaries.find(y=>y.id===x.id);
  assert.equal(live.localCashBookJPY,0);
  assert.equal(live.localCashForeign,0);
  const rows=e.g.finance.transactions.filter(t=>t.week===e.g.week&&['weekly-overseasRevenue','weekly-overseasCost','weekly-overseasRetainedCash'].includes(t.sourceType));
  assert.equal(rows.some(t=>t.sourceType==='weekly-overseasRetainedCash'),false,'loss week creates no retained-cash transfer');
  assert(rows.reduce((a,t)=>a+t.cashEffect,0)<0,'foreign operating loss reduces parent cash');
  assert(e.g.companyCash<cashBefore);
}

// Repatriation converts at the current FX rate and realizes FX gain/loss exactly once.
{
  const {e,modules,x}=setup();
  e.advanceWeek(false);
  const live=e.g.overseasSubsidiaries.find(y=>y.id===x.id);
  const bookBefore=live.localCashBookJPY,foreignBefore=live.localCashForeign;
  assert(bookBefore>0&&foreignBefore>0);
  e.g.exchangeRate=1.2;
  const preview=e.overseasRepatriationPreview(live.id,.5);
  assert.equal(preview.ok,true);
  assert(preview.fxGainLoss>0,'stronger FX produces a realized gain versus historical book value');
  const cashBefore=e.g.companyCash;
  assert.equal(e.repatriateOverseas(live.id,.5),true);
  assert.ok(Math.abs(e.g.companyCash-(cashBefore+preview.proceedsJPY))<1e-6);
  assert.ok(Math.abs(live.localCashBookJPY-(bookBefore-preview.bookAmount))<1e-6);
  assert.ok(Math.abs(live.localCashForeign-(foreignBefore-preview.foreignAmount))<1e-9);
  const txn=e.g.finance.transactions.filter(t=>t.sourceType==='overseasRepatriation').at(-1);
  assert(txn);assert.equal(txn.category,'investmentSale');
  assert.ok(Math.abs(txn.cashEffect-preview.proceedsJPY)<.01);
  assert.ok(Math.abs(txn.profitEffect-preview.fxGainLoss)<.01);
  assert.equal(modules.finance.validate(e.g).ok,true,'repatriation and FX realization preserve accounting invariants');
  const count=e.g.finance.transactions.filter(t=>t.sourceType==='overseasRepatriation').length;
  assert.equal(e.repatriateOverseas(live.id,0),false,'invalid fraction is rejected');
  assert.equal(e.g.finance.transactions.filter(t=>t.sourceType==='overseasRepatriation').length,count,'rejected repatriation posts nothing');
}

// FX downside is visible before execution and records a realized loss on repatriation.
{
  const {e,x}=setup();e.advanceWeek(false);
  const live=e.g.overseasSubsidiaries.find(y=>y.id===x.id);
  e.g.exchangeRate=.7;
  const preview=e.overseasRepatriationPreview(live.id,1);
  assert.equal(preview.ok,true);assert(preview.fxGainLoss<0);
  assert.equal(e.repatriateOverseas(live.id,1),true);
  const txn=e.g.finance.transactions.filter(t=>t.sourceType==='overseasRepatriation').at(-1);
  assert(txn.profitEffect<0);
  assert.equal(live.localCashForeign,0);assert.equal(live.localCashBookJPY,0);
}

// UI + deterministic action path.
{
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(app,/現地留保（簿価）/);
  assert.match(app,/現在円換算/);
  assert.match(app,/overseas-repatriate/);
  assert.match(app,/25%送金/);assert.match(app,/50%送金/);assert.match(app,/全額送金/);
  const engine=fs.readFileSync('js/engine.js','utf8');
  const start=engine.indexOf('  overseasFxRate(countryID)');
  const end=engine.indexOf('  openOverseas(countryID,businessID)',start);
  const block=engine.slice(start,end);
  assert.doesNotMatch(block,/Math\.random\(|Date\.now\(|randomUUID\(|uuid\(/,'repatriation path consumes no RNG/time/UUID');
}

console.log('overseas repatriation minimum-core tests passed');