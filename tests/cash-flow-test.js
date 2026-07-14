const { scenario } = require('./financial-statements-test');
const { loadGame } = require('./harness');
const { modules } = loadGame();
const finance=modules.finance, e=scenario();
for(const p of ['week','13','quarter','year','52']){const st=finance.buildStatements(e.g,p), cf=st.cashFlow; if(Math.abs(cf.openingCash+cf.netCashChange-cf.endingCash)>0.1) throw new Error(`${p} CF identity failed`);}
console.log('cash flow period checks passed');
