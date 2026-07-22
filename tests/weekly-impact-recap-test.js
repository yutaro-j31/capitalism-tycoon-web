const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { modules } = loadGame({ random: () => 0.42 });
const dashboard = modules.ceoDashboard;
function state(){return {week:3,companyCash:12_500_000,reports:[{week:1,sales:1_000_000,profit:100_000,companyCash:10_000_000,companyValue:20_000_000},{week:2,sales:1_500_000,profit:-50_000,companyCash:12_500_000,companyValue:19_000_000}],companyValueHistory:[20_000_000,19_000_000],news:['第2週：在庫改善','第2週：競合反応'],lastReport:{week:2,sales:1_500_000,profit:-50_000}};}
const before=JSON.stringify(state());
const a=dashboard.weeklyImpact(state(),{companyValue:19_000_000});
const b=dashboard.weeklyImpact(state(),{companyValue:19_000_000});
assert.deepEqual(a,b,'weekly impact must be deterministic');
assert.equal(JSON.stringify(state()),before,'weekly impact must not mutate save JSON');
assert.equal(a.week,2);assert.equal(a.hasPrevious,true);assert.equal(a.metrics.find(x=>x.id==='sales').delta,500_000);assert.equal(a.metrics.find(x=>x.id==='profit').delta,-150_000);assert.equal(a.metrics.find(x=>x.id==='cash').delta,2_500_000);assert.equal(a.metrics.find(x=>x.id==='value').delta,-1_000_000);assert.equal(a.news.length,2);
const app = require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
assert.match(app,/weekly-impact-grid/,'weekly impact render markup exists');assert.match(app,/aria-label="週送り後の変化"/,'weekly impact modal is labelled');assert.match(app,/次の優先タスクを見る/,'weekly impact connects back to CEO dashboard');assert.doesNotMatch(app,/localStorage\.setItem\([^)]*weekly-impact/,'weekly recap must not add localStorage keys');
const css = require('node:fs').readFileSync(require('node:path').join(__dirname,'../css/app.css'),'utf8');
assert.match(css,/weekly-impact-card/,'weekly impact cards are styled');assert.match(css,/min-height:44px/,'weekly impact touch target is at least 44px');assert.match(css,/env\(safe-area-inset-bottom\)/,'weekly impact respects safe area in modal');
console.log('weekly impact recap model/render/navigation/purity/deterministic/accessibility/iphone/save/finance/value/week integration tests passed');
