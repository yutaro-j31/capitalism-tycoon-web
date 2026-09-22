'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'GP Commit UI',companyName:'GP Commit Partners',difficulty:'normal'});
modules.peFund.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
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

const change=listeners.get('change'),click=listeners.get('click');
assert.equal(typeof change,'function');
assert.equal(typeof click,'function');
input.value=String(chosen);
change({target:input});
assert.match(screen.innerHTML,/この出資額でのFund規模/);

const button={closest(q){return q==='[data-pe-form-fund]'?this:null;},matches(){return false;}};
const personalBefore=engine.g.personalCash;
click({target:button,preventDefault(){}});
assert.equal(engine.g.peFirm.funds.length,1);
const created=engine.g.peFirm.funds[0];
assert.ok(Math.abs(created.gpCommit-chosen)<1e-6);
assert.ok(Math.abs(engine.g.personalCash-(personalBefore-chosen))<1e-6);
assert.match(screen.innerHTML,/Fund 1/);

const source=fs.readFileSync('js/pe-ui.js','utf8');
assert.doesNotMatch(source,/Math\.random|Date\.now|randomUUID/);
console.log('PE custom GP commit D UI tests passed');
