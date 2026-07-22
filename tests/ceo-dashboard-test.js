const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { ROOT, readIndex, loadGame } = require('./harness');
const code = fs.readFileSync(path.join(ROOT, 'js/ceo-dashboard.js'), 'utf8');
const executiveCode = fs.readFileSync(path.join(ROOT, 'js/executive-secretary.js'), 'utf8');
function standalone(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(code,context);return context.globalThis.__capitalismTycoonModules.ceoDashboard;}
function embedded(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(executiveCode,context);return context.globalThis.__capitalismTycoonModules.ceoDashboard;}
function state(){return {companyName:'テスト商事',week:105,companyCash:9000000,companyDebt:4000000,companyCredit:82,publicCompany:false,sharesOut:1000000,treasuryBuybackShares:0,completedMissionIDs:['m1'],activeMissionIDs:['m2'],lastReport:{sales:12000000,operatingProfit:2000000,profit:1500000,netIncome:1500000},stores:[{status:'open',name:'渋谷店',inventory:3,weeklyDemand:20}],employeeSatisfaction:35,overtimeRisk:.2,finance:{balances:{equity:20000000,treasuryStock:1000000},capitalAllocationPolicy:{executionScore:72},loans:[{status:'active',nextPaymentWeek:107,scheduledPrincipalPayment:250000}]},workforceTeams:[{headcount:12}],productVentures:[{status:'developing'}],acquisitionTargets:[{id:'a'}],departments:{overseas:true}};}
const helpers={companyValue:30000000,ipoMissingReasons:[],missions:[{id:'m1',title:'創業'},{id:'m2',title:'上場準備'}]};
const dashboard=standalone();
const before=JSON.stringify(state());const a=dashboard.build(state(),helpers);const b=dashboard.build(state(),helpers);
assert.deepEqual(a,b,'dashboard model must be deterministic');
assert.equal(JSON.stringify(state()),before,'dashboard model must not mutate save JSON');
assert.equal(JSON.stringify(embedded().build(state(),helpers)),JSON.stringify(a),'browser-embedded dashboard must match standalone model across VM realms');
assert.equal(a.overview.companyName,'テスト商事');assert.equal(a.overview.years,2);assert.equal(a.journey.rateLabel,'50%');assert.equal(a.journey.nextGoal,'上場準備');assert.ok(a.risks.map(x=>x.id).includes('debt-due'));assert.ok(a.growth.map(x=>x.id).includes('ipo'));
const { ctx } = loadGame({ random: () => 0.42 });
const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
assert.match(appCode,/data-ceo-dashboard="1"/,'home renders CEO dashboard markup');
for (const id of ['overview','priority','journey','finance','allocation','risk','growth']) assert.match(appCode,new RegExp(`fold\\('${id}'`),`${id} card renders`);
assert.match(appCode,/aria-labelledby="ceo-dashboard-title"/,'dashboard has ARIA label');
assert.match(appCode,/すべて見る/,'secretary navigation is available');
assert.equal(ctx.__localStorageHistory.setItem.length,0,'loading dashboard must not write localStorage before user action');
const index=readIndex();assert.doesNotMatch(index,/js\/ceo-dashboard\.js/,'dashboard must not be loaded twice');assert.match(index,/js\/executive-secretary\.js/,'browser integration script is registered');
const css=fs.readFileSync(path.join(ROOT,'css/app.css'),'utf8');
assert.match(css,/env\(safe-area-inset-bottom\)/,'iPhone safe area is supported');
assert.match(css,/min-height:44px|44px/,'44px tap target support exists');
assert.match(css,/prefers-reduced-motion:reduce/,'reduced motion is supported');
assert.match(css,/:focus-visible/,'focus-visible is supported');
const forbidden=/SAVE_KEY|saveVersion|localStorage\.setItem|Math\.random|advanceWeek|companyCash\s*[+\-*/]?=/;
assert.ok(!forbidden.test(code)&&!forbidden.test(executiveCode),'dashboard model stays read-only and avoids forbidden mutations');
console.log('ceo dashboard model/render/navigation/purity/accessibility/iphone/deterministic/save/finance/value/integration tests passed');