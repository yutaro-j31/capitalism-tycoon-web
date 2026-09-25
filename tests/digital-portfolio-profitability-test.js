'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {makeRandom,run}=require('./digital-portfolio-scenario');

const hold=run('hold');
const exit=run('exit');

assert.ok(hold.secondProductWeek<208,'hold route scales before the end of four years');
assert.equal(hold.exitProceeds,0,'hold route retains the first product');
assert.ok(hold.equityFunding>=0&&hold.borrowing>0,'hold route uses player-accessible financing only');
assert.ok(hold.equityRefreshCount<=2,'hold route does not rely on unlimited equity refreshes');
assert.ok(hold.marketingDepartmentWeek!==null,'retained-product portfolio reaches the marketing growth stage');
assert.ok(hold.final.productCount>=2&&hold.final.companyCash>0,'retained-product portfolio survives');
// Sustained full-company break-even is asserted across seeds in
// digital-portfolio-breakeven-seeds-test.js (#731): it lands around week 195-212, so one seed's
// result flips with any change in the random path.
assert.ok(exit.exitProceeds>0,'exit route retains its short-term funding advantage');
assert.ok(exit.final.companyCash>0&&!exit.final.gameOver,'exit route remains viable');
assert.notEqual(hold.final.valuation,exit.final.valuation,'hold and exit preserve a real ownership/value trade-off');

// A short deterministic replay protects the production path without doubling the expensive 208-week test.
const replay=run('hold',78);
for(const week of[26,52,78])assert.deepEqual(replay.snapshots[week],hold.snapshots[week],`deterministic checkpoint ${week}`);
assert.equal(replay.hqWeek,hold.hqWeek);
if(hold.secondProductWeek<=78)assert.equal(replay.secondProductWeek,hold.secondProductWeek);

// Global department master changes are intentional and bounded; setup costs remain unchanged.
const data=loadGame({random:makeRandom(),headless:true}).modules.data;
const dept=id=>data.MASTER.departments.find(row=>row.id===id);
assert.equal(dept('product').setupCost,1_800_000);assert.equal(dept('product').weeklyCost,75_000);
assert.equal(dept('marketing').setupCost,1_600_000);assert.equal(dept('marketing').weeklyCost,70_000);
assert.equal(dept('dx').setupCost,2_200_000);assert.equal(dept('dx').weeklyCost,90_000);

console.log(JSON.stringify({hold,exit},null,2));
console.log('digital business scale-up production playability checks passed');
