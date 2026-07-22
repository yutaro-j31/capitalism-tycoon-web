'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame } = require('./harness');
const files = ['player-debt-service.js','treasury-prepayment.js','shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js','capital-allocation-recovery-funding-reconciliation.js','capital-allocation-recovery-funding-outcome.js','capital-allocation-management-guide.js'];
function install(load){for(const file of files){const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});}return load;}
function game(modules){const {engine,finance}=modules,state=engine.createInitialState({configured:true});Object.assign(state,{week:27,publicCompany:true,selectedTab:'market',companyCash:10_000_000,companyDebt:300_000_000,companyCredit:100,sharesOut:1_000_000,founderShares:600_000,stockPrice:100,ticker:'CPTY'});state.market=state.market.filter(row=>row.id!=='CPTY');state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:27,price:100}]});Object.assign(state.properties[0],{owner:'company',value:1_000_000_000,price:1_000_000_000,purchasePrice:600_000_000,bookValue:600_000_000});state.finance=finance.defaultFinanceState(state);state.finance.capitalAllocationPolicy={id:'balanced',lastChangedWeek:-999,lastEvaluatedWeek:-1,executionScore:50,history:[]};finance.event(state,'revenue',100_000_000,{week:27,cashEffect:0,profitEffect:100_000_000,receivableAmount:100_000_000,sourceType:'sectionNavFixture',sourceID:'baseline',idempotencyKey:'section-nav-baseline',description:'売掛売上'});state.finance.loans=[{id:'test-loan',loanID:'test-loan',status:'active',principal:300_000_000,outstandingPrincipal:300_000_000,interestRate:.1,maturityWeek:104}];finance.rebuildSnapshotForWeek(state,27);return new engine.TycoonEngine(state);}
function rootWith(selectors){const nodes=new Map();const root={querySelector(selector){for(const part of selector.split(',').map(s=>s.trim())){if(nodes.has(part))return nodes.get(part);}return null;}};for(const selector of selectors){const node={selector,children:[],contains(other){return this.children.includes(other);},setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k]??null;},scrollIntoView(opts){this.scroll=opts;},focus(opts){this.focused=opts;}};nodes.set(selector,node);}return {root,nodes};}
const load=install(loadGame()),{modules,ctx}=load,mod=modules.capitalAllocationManagementGuide,engine=game(modules);modules.playerEngineBridge.bindEngine(engine);
assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(modules.engine.SAVE_VERSION,9);
const before=JSON.stringify(engine.g);
const fixture=rootWith(['[data-shareholder-returns-ui]','[data-capital-allocation-score-ui]','[data-capital-allocation-recovery-funding-options]','[data-capital-allocation-recovery-funding-reconciliation]','[data-capital-allocation-management-guide]']);
const sections=mod.navSections(fixture.root);
assert.equal(JSON.stringify(sections.map(row=>row.label)),JSON.stringify(['株主還元','資本配分スコア・方針','回復資金計画','実行後照合','経営判断ガイド']));
assert.equal(sections.filter(row=>row.recommended).length,1);
assert.equal(sections.find(row=>row.recommended).label,'実行後照合');
const html1=mod.renderNav(fixture.root),html2=mod.renderNav(fixture.root);
assert.equal(html1,html2,'same state and same cards must produce identical nav HTML');
assert.match(html1,/aria-label="市場画面セクションナビ"/);
assert.match(html1,/role="navigation"/);
assert.match(html1,/aria-current="true"/);
assert.doesNotMatch(html1,/市場概要/,'missing market overview card must not be listed');
assert.doesNotMatch(html1,/data-action=/);
assert.equal(JSON.stringify(engine.g),before,'section nav rendering must not mutate save state');
const target=fixture.nodes.get('[data-capital-allocation-recovery-funding-reconciliation]');
ctx.document.querySelector=selector=>fixture.root.querySelector(selector);
ctx.matchMedia=()=>({matches:true});
assert.equal(mod.focusTarget('[data-capital-allocation-recovery-funding-reconciliation]'),true);
assert.equal(target.tabindex,'-1');
assert.equal(JSON.stringify(target.scroll),JSON.stringify({block:'start',behavior:'auto'}));
assert.equal(JSON.stringify(target.focused),JSON.stringify({preventScroll:true}));
const css=fs.readFileSync(path.join(__dirname,'../css/app.css'),'utf8');
assert.match(css,/capital-allocation-section-nav/);
assert.match(css,/focus-visible/);
assert.match(css,/env\(safe-area-inset-left\)/);
assert.match(css,/min-height:44px/);
console.log('capital allocation section nav listing, recommendation, focus, save-purity, determinism, and mobile CSS tests passed');
