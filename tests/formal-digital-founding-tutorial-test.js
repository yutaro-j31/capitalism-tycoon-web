'use strict';
const assert=require('node:assert/strict');const {loadGame}=require('./harness');let seed=91;const random=()=>((seed=seed*1664525+1013904223>>>0)/2**32);
const {ctx,modules}=loadGame({random});const e=ctx.__ct_engine;e.g.configured=true;modules.foundingTutorial.acknowledgeDashboard(e.g);assert.equal(e.foundDigitalBusiness('app'),true);
let model=modules.foundingTutorial.build(e.g);assert.equal(model.steps.find(s=>s.id==='first_store').completed,true);assert.equal(model.current.id,'unit_economics');assert.equal(model.current.targetTab,'business');assert.notEqual(model.current.targetTab,'strategy');
e.advanceWeek(false);model=modules.foundingTutorial.build(e.g);assert.equal(model.steps.find(s=>s.id==='unit_economics').completed,true);assert.equal(model.current.id,'weekly_recap');assert.equal(e.g.stores.length,0);
e.advanceWeek(false);model=modules.foundingTutorial.build(e.g);assert.equal(model.steps.find(s=>s.id==='weekly_recap').completed,true);assert.equal(model.current.id,'first_improvement');assert.equal(model.current.targetTab,'business');
assert.equal(e.productAction(e.g.productVentures[0].id,'quality',100_000),true);model=modules.foundingTutorial.build(e.g);assert.equal(model.steps.find(s=>s.id==='first_improvement').completed,true);assert(model.steps.find(s=>s.id==='growth_step').title.includes('本社'));
console.log('formal digital founding tutorial sequence passed');
