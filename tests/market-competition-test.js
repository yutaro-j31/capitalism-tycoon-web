const assert = require('node:assert');
const { loadGame } = require('./harness');
const { modules } = loadGame({ random: () => 0.5 });
const e = new modules.engine.TycoonEngine();
const b = e.business('ramen');
e.g.competitors = [
  {id:'same-area-other-business',name:'カフェ競合',businessID:'cafe',areaID:'kanto',stores:9,quality:80,brand:80},
  {id:'same-business-other-area',name:'関西ラーメン',businessID:'ramen',areaID:'kansai',stores:9,quality:80,brand:80},
  {id:'same-business-same-area',name:'東京ラーメン',businessID:'ramen',areaID:'kanto',stores:2,quality:40,brand:40}
];
let offers = modules.market.competitorOffers(e.g,b,'tokyo');
assert.deepStrictEqual(offers.map(o=>o.id), ['same-business-same-area']);
e.g.competitors = [];
offers = modules.market.competitorOffers(e.g,b,'tokyo');
assert.strictEqual(offers.length, 1);
assert(offers[0].id.includes('market-average'));
let calls = 0;
const oldRandom = Math.random;
Math.random = () => { calls++; return 0.5; };
modules.market.competitorOffers(e.g,b,'tokyo');
Math.random = oldRandom;
assert.strictEqual(calls, 0, 'competitor filtering is deterministic');
