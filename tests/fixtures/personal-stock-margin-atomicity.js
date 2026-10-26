'use strict';
const assert=require('node:assert/strict');
const {scenario:stockScenario,snapshot,economic}=require('./stock-split-atomicity');
// Each 20,000-share lot starts at 100 with 1m issued, avg cost 1,000.
// 1.2% impact -> 98.8 close, 99.4 execution, 1,988,000 gross,
// 0.1% fee -> 1,986,012 cash per lot. These pins never use writer outputs.
const SETTLEMENT=Object.freeze({raised:3972024,realizedPL:-36027976,priceAfter:98.8,marketCapAfter:98800000});
async function fixture(variant){
 const s=await stockScenario('own'),g=s.game.g;
 for(const id of ['CPTY','EXT']){const stock=s.game.stock(id);stock.price=100;stock.previous=100;stock.marketCap=100*stock.issuedShares;}
 g.stockPrice=100;g.personalCash=0;g.personalDebt=200000;
 g.personalMarginLoan={productID:'standard',balance:variant==='interest'?1000000:10000000,interestPaid:0,interestCapitalized:0,liquidatedCount:0};
 assert.equal(s.game.save(),true);await s.backend.flush();
 return {...s,variant,margin:s.modules.personalStockMargin};
}
function invoke(s){return s.variant==='liquidate'?s.margin.liquidate(s.game):s.margin.processWeek(s.game);}
module.exports={fixture,invoke,snapshot,economic,SETTLEMENT};
