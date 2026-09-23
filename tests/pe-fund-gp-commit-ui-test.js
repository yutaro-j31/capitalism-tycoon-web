'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'GP Commit UI',companyName:'GP Commit Partners',difficulty:'normal'});
modules.peFund.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
modules.peFund.recordExit(engine.g,{exitType:'buyout',realizedAmount:220_000_000,investedAmount:8_000_000,foundedWeek:200,exitedWeek:252,profitableWeekStreak:260,employeeCount:40});
engine.g.personalCash=30_000_000_000;
engine.g.selectedTab='pe-portfolio';

const max=engine.formablePEFund();
assert.equal(max.ok,true);
const chosen=max.maxGpCommit*.35;
const before=JSON.stringify(engine.g);
const model=modules.peUIAdapter.getPEUIData({gpCommit:chosen});
assert.equal(JSON.stringify(engine.g),before,'adapter formation preview is read-only');
assert.equal(model.dashboard.formation.available,true);
assert.equal(model.dashboard.formation.ok,true);
assert.ok(Math.abs(model.dashboard.formation.selectedGpCommit-chosen)<1e-6);
assert.ok(Math.abs(model.dashboard.formation.size/max.maxSize-.35)<1e-9);
assert.match(model.dashboard.formation.lps.map(row=>row.name).join('|'),/地方銀行・事業会社/,'fundraising book exposes promise-bearing LP');
assert.equal(model.dashboard.formation.lps.find(row=>row.id==='regionalBankCorporate').promiseAccepted,false);

const listeners=new Map();
const screen={innerHTML:'',classList:{add(){},remove(){}}};
const input={value:String(chosen),matches(q){return q==='[data-pe-gp-commit]';},closest(){return null;}};
const document={
  addEventListener(type,cb){listeners.set(type,cb);},
  querySelector(q){return q==='[data-pe-gp-commit]'?input:null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
uiContext.CapitalismTycoonPEUI.render();
assert.match(screen.innerHTML,/data-pe-fund-formation/);
assert.match(screen.innerHTML,/data-pe-gp-commit/);
assert.match(screen.innerHTML,/Fund Iを組成/);
assert.match(screen.innerHTML,/data-pe-fundraising-book/);
assert.match(screen.innerHTML,/LP Commitment & Terms/);
assert.match(screen.innerHTML,/Management Fee/);
assert.match(screen.innerHTML,/Carry/);
assert.match(screen.innerHTML,/Hurdle/);
assert.match(screen.innerHTML,/data-pe-fundraising-lp="regionalBankCorporate"/);
assert.match(screen.innerHTML,/data-pe-promise-toggle="regionalBankCorporate"/);

const change=listeners.get('change'),click=listeners.get('click');
assert.equal(typeof change,'function');
assert.equal(typeof click,'function');
input.value=String(chosen);
change({target:input});
assert.match(screen.innerHTML,/この出資額でのFund規模/);
const promiseInput={checked:true,dataset:{pePromiseToggle:'regionalBankCorporate'},matches(q){return q==='[data-pe-promise-toggle]';},closest(){return null;}};
change({target:promiseInput});
assert.match(screen.innerHTML,/data-pe-promise-toggle="regionalBankCorporate" checked/,'promise choice rerenders as selected');

const button={closest(q){return q==='[data-pe-form-fund]'?this:null;},matches(){return false;}};
const personalBefore=engine.g.personalCash;
click({target:button,preventDefault(){}});
assert.equal(engine.g.peFirm.funds.length,1);
const created=engine.g.peFirm.funds[0];
assert.ok(Math.abs(created.gpCommit-chosen)<1e-6);
assert.ok(Math.abs(engine.g.personalCash-(personalBefore-chosen))<1e-6);
assert.equal(created.lps.find(row=>row.lpTypeID==='regionalBankCorporate').promiseAccepted,true,'D UI promise choice reaches production fund state');
assert.match(screen.innerHTML,/Fund 1/);

const source=fs.readFileSync('js/pe-ui.js','utf8');
assert.match(fs.readFileSync('css/d-ui-pe.css','utf8'),/\.pe-fundraising-promise\{[^}]*min-height:44px/,'promise toggle keeps an iPhone-safe tap target');
assert.match(fs.readFileSync('css/d-ui-pe.css','utf8'),/\.pe-fundraising-lps\{grid-template-columns:1fr\}/,'fundraising LP cards stack on mobile');
assert.doesNotMatch(source,/Math\.random|Date\.now|randomUUID/);
console.log('PE custom GP commit D UI tests passed');
