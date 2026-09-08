'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame,ROOT}=require('./harness');
let seed=123456;function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/2**32;}
function fresh(){const loaded=loadGame({random:rng});const e=loaded.ctx.__ct_engine;e.g.configured=true;return {...loaded,e};}
const {e,engineModule,modules}=fresh();
assert.equal(engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(e.g.saveVersion,9);
assert.equal(e.g.companyCash,8_000_000);
assert.equal(e.digitalBusinessFoundingPlan('app').eligible,true);
assert.equal(Array.from(modules.data.PRODUCT_BLUEPRINTS,x=>x.id).join(','),'app,game,ec,ai,media');
const personal=e.g.personalCash;
assert.equal(e.foundDigitalBusiness('app','正式アプリ'),true);
assert.equal(e.g.companyCash,1_500_000);assert.equal(e.g.personalCash,personal);assert.equal(e.g.stores.length,0);
assert.equal(e.g.hasHeadOffice,false);assert.equal(Boolean(e.g.departments.product),false);assert.equal(e.g.productVentures.length,1);
const product=e.g.productVentures[0];assert.equal(product.blueprintID,'app');assert.notEqual(product.origin,'founderHome');
const statement=modules.finance.buildStatements(e.g,'52');assert.equal(statement.profitAndLoss.researchAndDevelopment,6_500_000);
assert.equal(e.foundDigitalBusiness('game'),false);assert.equal(e.launchProduct('game'),false);
e.save();const loaded=engineModule.TycoonEngine.load();assert.equal(loaded.g.saveVersion,9);assert.equal(loaded.g.productVentures[0].name,'正式アプリ');
const beforeHome=JSON.stringify({cash:e.g.companyCash,personal:e.g.personalCash,products:e.g.productVentures,slots:e.g.founderHomeUsedSlots});
assert.equal(e.launchFounderHomeProduct('reservationApp'),false);assert.equal(JSON.stringify({cash:e.g.companyCash,personal:e.g.personalCash,products:e.g.productVentures,slots:e.g.founderHomeUsedSlots}),beforeHome);
// The no-department base speed releases the first formal product on its blueprint schedule.
let releaseWeek=null;for(let i=0;i<12;i++){assert.equal(e.g.gameOver,false);e.advanceWeek(false);if(product.status==='released'&&releaseWeek===null)releaseWeek=e.g.week;}
assert.equal(product.status,'released');assert.equal(releaseWeek,13);assert(Number.isFinite(e.g.companyCash));
// Zero-store digital companies can scale through HQ + product department, then use normal launchProduct.
e.g.companyCash=100_000_000;const office=e.g.rentalOffices.reduce((a,b)=>a.deposit<b.deposit?a:b);assert.equal(e.contractOffice(office.id),true);assert.equal(e.establishDepartment('product'),true);assert.equal(e.launchProduct('game','第2プロダクト'),true);
// Existing founderHome products retain their origin and lifecycle behavior.
const legacy=fresh().e;legacy.g.productVentures=[{id:'legacy',blueprintID:'reservationApp',name:'旧製品',category:'SaaS',status:'developing',progress:98,weeksToLaunch:1,quality:25,brand:5,users:0,paidUsers:0,price:900,serverCost:10000,market:10000,risk:.1,valuation:450000,developmentCost:450000,investedCost:450000,revenue:0,cost:0,profit:0,origin:'founderHome'}];legacy.advanceWeek(false);assert.equal(legacy.g.productVentures[0].origin,'founderHome');assert.equal(legacy.g.productVentures[0].status,'released');
const app=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');assert(!app.includes("card('自宅から個人開発'"));assert(!app.includes("badge('自宅開発'"));assert(app.includes('IT・デジタル事業を創業'));assert(app.includes("PRODUCT_BLUEPRINTS.map"));assert(!app.includes('<option value="homeProduct">'));
assert(!app.includes('作業机 ${g.founderHomeUsedSlots}'));
assert.deepEqual(modules.expansion.FOUNDER_HOME_PRODUCTS.map(x=>x.id).includes('app'),false,'legacy templates are not formal blueprints');
console.log(JSON.stringify({releaseWeek,cashAtRelease:Math.round(e.g.companyCash),status:product.status,users:product.users,revenue:product.revenue,profit:product.profit,gameOver:e.g.gameOver}));
console.log('formal digital business founding tests passed');
