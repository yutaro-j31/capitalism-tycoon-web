'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
class Engine{constructor(g){this.g=g;}normalize(){}}
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null}},context={globalThis:null,console,setTimeout,queueMicrotask};context.globalThis=context;context.__capitalismTycoonModules=modules;vm.runInNewContext(fs.readFileSync('js/deterministic-economic-foundation.js','utf8'),context);
const mod=modules.deterministicEconomicFoundation,base={week:1,companyName:'Test Holdings',ticker:'TEST',configured:true,selectedTab:'home',economy:1,season:1,policyRate:.005,inflation:1,exchangeRate:1,realEstateCycle:1,macroCrisis:null};
const a=JSON.parse(JSON.stringify(base)),b=JSON.parse(JSON.stringify(base));for(let week=1;week<=520;week++){a.week=week;b.week=week;assert.deepStrictEqual(JSON.parse(JSON.stringify(mod.step(a))),JSON.parse(JSON.stringify(mod.step(b))));const indicators=a.economicFoundation.indicators;for(const value of [a.economy,a.policyRate,a.inflation,a.exchangeRate,a.realEstateCycle,indicators.commodityIndex,indicators.stress])assert(Number.isFinite(Number(value)));assert(a.policyRate>=0&&a.policyRate<=.2);assert(indicators.stress>=0&&indicators.stress<=1);}
assert.deepStrictEqual(JSON.parse(JSON.stringify(a.economicFoundation)),JSON.parse(JSON.stringify(b.economicFoundation)));assert.strictEqual(a.economicFoundation.history.length,260);const snapshot=JSON.stringify(a);mod.step(a);assert.strictEqual(JSON.stringify(a),snapshot);
const roundTrip=JSON.parse(JSON.stringify(a));mod.ensure(roundTrip);assert.deepStrictEqual(JSON.parse(JSON.stringify(roundTrip.economicFoundation)),JSON.parse(JSON.stringify(a.economicFoundation)));assert(mod.renderSection({g:{...a,configured:true,selectedTab:'home'}}).includes('経済・市場環境'));
const legacy={...JSON.parse(JSON.stringify(base)),week:8,macroCrisis:{kind:'景気後退',weeks:2,salesMultiplier:.8,costMultiplier:1.1}};mod.step(legacy);assert.strictEqual(legacy.macroCrisis.weeks,1);legacy.week=9;mod.step(legacy);assert.strictEqual(legacy.macroCrisis,null);
const source=fs.readFileSync('js/deterministic-economic-foundation.js','utf8');assert(!source.includes('Math.random'));assert(!source.includes('Date.now'));assert(source.includes('lastProcessedWeek'));assert(source.includes('HISTORY_LIMIT'));
console.log('deterministic-economic-foundation tests passed');

// The home-card UI must use the deterministic enhancer registry rather than a
// self-triggering MutationObserver -> microtask -> DOM replacement loop.
{
  const calls=[];
  let replacementCount=0,outerHTMLValue='same';
  const existing={get outerHTML(){return outerHTMLValue;},set outerHTML(value){replacementCount+=1;outerHTMLValue=value;}};
  const screen={querySelector(selector){return selector==='[data-economic-foundation]'?existing:null;},insertAdjacentHTML(position,html){calls.push({position,html});}};
  const registry={definitions:[],registerUIEnhancer(definition){this.definitions.push(definition);return definition;}};
  class UIEngine extends Engine{}
  const uiState={week:1,companyName:'Test Holdings',ticker:'TEST',configured:true,selectedTab:'home',economicFoundation:{seed:1,lastProcessedWeek:1,phase:'安定',indicators:{week:1,phase:'安定',cycle:0,stress:0,economy:1,policyRate:.01,inflationRate:.02,exchangeRate:1,commodityIndex:1},history:[]}};
  const uiEngine={g:uiState};
  const uiModules={engine:{TycoonEngine:UIEngine},playerEngineBridge:{getEngine:()=>uiEngine},uiEnhancerRegistry:registry};
  const document={querySelector(selector){return selector==='[data-screen="home"]'?screen:null;}};
  const uiContext={globalThis:null,console,document};uiContext.globalThis=uiContext;uiContext.__capitalismTycoonModules=uiModules;
  vm.runInNewContext(fs.readFileSync('js/deterministic-economic-foundation.js','utf8'),uiContext);
  assert.equal(registry.definitions.length,1,'economic foundation UI must register exactly one enhancer');
  assert.equal(registry.definitions[0].id,'deterministic-economic-foundation');
  const mod=uiModules.deterministicEconomicFoundation;
  const html=mod.renderSection(uiEngine);
  outerHTMLValue=html;replacementCount=0;
  assert.equal(registry.definitions[0].enhance(),false,'unchanged economic foundation markup must be idempotent');
  assert.equal(replacementCount,0,'idempotent enhance must not assign outerHTML');
  outerHTMLValue='<section data-economic-foundation>stale</section>';replacementCount=0;
  assert.equal(registry.definitions[0].enhance(),true,'changed economic foundation markup must reconcile');
  assert.equal(replacementCount,1,'changed markup must be replaced exactly once');
  assert.equal(existing.outerHTML,html);
  const source=fs.readFileSync('js/deterministic-economic-foundation.js','utf8');
  assert(!source.includes('MutationObserver'),'economic foundation UI must not use MutationObserver');
  assert(!source.includes('queueMicrotask'),'economic foundation UI must not use queueMicrotask scheduling');
}

