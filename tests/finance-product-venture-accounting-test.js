const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame({random:()=>0.5});
const e=new engineModule.TycoonEngine(); e.g.configured=true; e.g.companyCash=500_000_000; e.g.finance=modules.finance.defaultFinanceState(e.g); e.g.departments.product={name:'商品開発部'};
const opening=e.g.companyCash; if(!e.launchProduct('app','acct-app')) throw new Error('launchProduct failed'); let st=modules.finance.buildStatements(e.g,'52'); if(e.g.companyCash!==opening-6_500_000) throw new Error('launch cash mismatch'); if(st.profitAndLoss.researchAndDevelopment<6_500_000) throw new Error('R&D missing'); if(st.balanceSheet.assets.otherFixedAssets!==0) throw new Error('product should not be fixed asset'); if(!modules.finance.validate(e.g).ok) throw new Error(modules.finance.validate(e.g).errors.join('\n'));
// investedCost is a purely informational running total for the player-facing UI (累計投資額
// stat) -- it does NOT feed into any finance.event() accounting, because productVentures' R&D
// spend is expensed as incurred (assetEffect:0 throughout, matching launchProduct/productAction/
// roadmap/patent), leaving no capitalized book value to net against on a later sale.
const p=e.g.productVentures[0]; if(p.investedCost!==6_500_000) throw new Error(`launch should seed investedCost with the development cost, got ${p.investedCost}`);
if(!e.productAction(p.id,'development',1_000_000)) throw new Error('productAction failed'); st=modules.finance.buildStatements(e.g,'52'); if(st.balanceSheet.assets.otherFixedAssets!==0) throw new Error('product action created asset'); if(!modules.finance.validate(e.g).ok) throw new Error(modules.finance.validate(e.g).errors.join('\n'));
if(p.investedCost!==7_500_000) throw new Error(`productAction should accumulate into investedCost, got ${p.investedCost}`);
p.valuation=20_000_000; if(!e.sellProduct(p.id)) throw new Error('sellProduct failed'); st=modules.finance.buildStatements(e.g,'52'); if(st.cashFlow.investingCashFlow<=0) throw new Error('product sale investing CF missing');
// Since R&D was expensed as incurred (no carrying book value survives to net against), the sale
// price is the entire gain -- this must stay in lockstep with cashEffect or the balance sheet
// (built from live game state, not accumulated assetEffect deltas) goes out of balance.
if(st.profitAndLoss.otherNonOperating!==20_000_000) throw new Error(`product sale gain should equal the full sale price (no capitalized product asset to net against): got ${st.profitAndLoss.otherNonOperating}`);
if(!modules.finance.validate(e.g).ok) throw new Error(modules.finance.validate(e.g).errors.join('\n'));
console.log('finance product venture accounting checks passed');
