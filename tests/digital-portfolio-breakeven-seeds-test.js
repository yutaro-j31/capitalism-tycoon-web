'use strict';

// The retained-product (hold) digital portfolio reaches sustained full-company break-even.
// Measured over 8 seeds without a horizon cap, break-even lands at week 195-212, so the single
// seed the scale-up test used to check against week 208 flipped with any change in the random
// path (#731 moved the simulation onto the save-held stream). This checks the design property
// on four seeds fixed in advance, with the horizon set from that measured spread (max 212):
// every seed breaks even by week 220, without a game over, with the ledger valid throughout
// (run() validates the ledger at each checkpoint and at the end).

const assert=require('node:assert/strict');
const {SEED,run}=require('./digital-portfolio-scenario');

const SEEDS=[SEED,111,222,333];
const HORIZON=220;

const rows=SEEDS.map(seed=>{
  const hold=run('hold',HORIZON,seed);
  assert.equal(hold.final.gameOver,false,`seed ${seed}: the hold route survives`);
  assert.ok(hold.fullCompanyBreakEvenWeek!==null&&hold.fullCompanyBreakEvenWeek<=HORIZON,
    `seed ${seed}: the hold portfolio reaches sustained full-company break-even by week ${HORIZON}: ${JSON.stringify({breakEven:hold.fullCompanyBreakEvenWeek,cumulativeOperatingProfit:hold.cumulativeOperatingProfit,final:hold.final})}`);
  return {seed,breakEvenWeek:hold.fullCompanyBreakEvenWeek};
});

console.log(JSON.stringify(rows));
console.log('digital portfolio break-even across seeds passed');
