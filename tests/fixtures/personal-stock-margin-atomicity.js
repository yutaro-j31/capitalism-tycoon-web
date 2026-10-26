'use strict';
const assert=require('node:assert/strict');
const {scenario:stockScenario,snapshot,economic}=require('./stock-split-atomicity');
async function fixture(variant){
 const s=await stockScenario('own'),g=s.game.g;
 for(const id of ['CPTY','EXT']){const stock=s.game.stock(id);stock.price=100;stock.previous=100;stock.marketCap=100*stock.issuedShares;}
 g.stockPrice=100;g.personalCash=0;g.personalDebt=200000;
 g.personalMarginLoan={productID:'standard',balance:variant==='interest'?1000000:10000000,interestPaid:0,interestCapitalized:0,liquidatedCount:0};
 assert.equal(s.game.save(),true);await s.backend.flush();
 return {...s,variant,margin:s.modules.personalStockMargin};
}
function invoke(s){return s.variant==='liquidate'?s.margin.liquidate(s.game):s.margin.processWeek(s.game);}
module.exports={fixture,invoke,snapshot,economic};
