'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'LP DDQ Test',companyName:'LP DDQ Co',difficulty:'normal'});
const pf=modules.peFund;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
engine.g.selectedTab='pe-portfolio';

const cashBefore={companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,funds:engine.g.peFirm.funds.length};
let saves=0,emits=0;
engine.save=()=>{saves+=1;return true;};
engine.emit=()=>{emits+=1;};

assert.equal(engine.solicitPELP('wealthyFamilyOffice'),true,'meetable LP solicitation starts');
assert.equal(saves,1,'solicitation saves once');
assert.equal(emits,1,'solicitation emits once');
let row=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
assert.equal(row.outreach.status,'ddq');
const wait=row.outreach.responseWeek-row.outreach.requestedWeek;
assert(wait>=pf.LP_DDQ_MIN_WEEKS&&wait<=pf.LP_DDQ_MAX_WEEKS,'DDQ response is bounded to 2-4 weeks');
assert.deepEqual({companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,funds:engine.g.peFirm.funds.length},cashBefore,'solicitation never moves company/personal/fund cash');

assert.equal(pf.processLPOutreachWeek(engine.g,row.outreach.responseWeek-1),0,'DDQ cannot resolve early');
row=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
assert.equal(row.outreach.status,'ddq');

assert.equal(pf.processLPOutreachWeek(engine.g,row.outreach.responseWeek),1,'DDQ resolves exactly by the promised response week');
row=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
assert.equal(row.outreach.status,'positive');
assert.equal(row.outreach.respondedWeek,row.outreach.responseWeek);
assert.equal(pf.processLPOutreachWeek(engine.g,row.outreach.responseWeek+1),0,'resolved DDQ is idempotent');
assert.equal(engine.solicitPELP('wealthyFamilyOffice'),false,'completed LP cannot be duplicated');
assert.equal(engine.g.peFirm.lpOutreach.filter(x=>x.lpTypeID==='wealthyFamilyOffice').length,1,'one canonical outreach row per LP type');

assert.equal(engine.solicitPELP('regionalBankCorporate'),false,'locked LP cannot be solicited');
assert.equal(engine.g.peFirm.lpOutreach.some(x=>x.lpTypeID==='regionalBankCorporate'),false,'failed solicitation does not create state');

let model=modules.peUIAdapter.getPEUIData();
let relation=model.lpRelations.rows.find(x=>x.id==='wealthyFamilyOffice');
assert.equal(relation.status,'positive','adapter exposes resolved DDQ');
assert.equal(model.lpRelations.positive,1);

const listeners=new Map();
const screen={innerHTML:'',classList:{add(){},remove(){}}};
const document={
  addEventListener(type,cb){listeners.set(type,cb);},
  querySelector(){return null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
const click=listeners.get('click');
assert.equal(typeof click,'function');
const target={dataset:{peView:'network'},closest(q){return q==='[data-pe-view]'?this:null;},matches(){return false;}};
click({target,preventDefault(){}});
assert.match(screen.innerHTML,/data-pe-view-root="network"/,'network navigation renders LP relationship screen');
assert.match(screen.innerHTML,/DDQ通過/,'resolved LP response is visible in D UI');
assert.match(screen.innerHTML,/地方銀行・事業会社/,'locked LP remains visible for progression clarity');
assert.match(screen.innerHTML,/解禁条件: スコア30/,'locked LP shows the exact unlock requirement');

const source=fs.readFileSync('js/pe-fund.js','utf8');
assert.doesNotMatch(source,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'LP workflow adds no nondeterministic source');

console.log('PE LP DDQ workflow tests passed');
