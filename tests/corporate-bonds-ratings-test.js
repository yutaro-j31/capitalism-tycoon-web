'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
class Engine{constructor(g){this.g=g;}normalize(){}}
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null},deterministicEconomicFoundation:{ensure:s=>s},bankLoansCovenants:{}},context={globalThis:null,console};context.globalThis=context;context.__capitalismTycoonModules=modules;vm.runInNewContext(fs.readFileSync('js/corporate-bonds-ratings.js','utf8'),context);
const mod=modules.corporateBondsRatings,state={week:10,cash:10000000,totalAssets:30000000,personalCash:500000,cumulativeProfit:3000000,bankDebt:1000000,economicFoundation:{indicators:{policyRate:1.5,stress:.2}}};
assert.strictEqual(mod.MODE,0);assert(['A','BBB','BB','B'].includes(mod.quote(state).rating));const before=JSON.stringify(state);assert.strictEqual(mod.issue(state),false);assert.strictEqual(mod.service(state),false);assert.strictEqual(JSON.stringify(state),before);
const engine=new Engine(state);assert.strictEqual(engine.issueCorporateBond(5000000,104),false);assert.strictEqual(JSON.stringify(state),before);
const legacy={configured:true,selectedTab:'finance',bondFinancing:{bonds:[{id:'legacy-bond',balance:500000,coupon:.05,maturityWeek:5,status:'active'}],history:[]}};const html=mod.renderSection({g:legacy});assert(html.includes('現在利用できません'));assert(!html.includes('data-bond-issue'));assert(html.includes('legacy-bond')===false);assert.strictEqual(mod.service(legacy),false);assert.strictEqual(legacy.bondFinancing.bonds[0].balance,500000);
const source=fs.readFileSync('js/corporate-bonds-ratings.js','utf8');assert(!source.includes('Math.random'));assert(!source.includes('Date.now'));console.log('corporate-bonds-ratings Mode 0 tests passed');
