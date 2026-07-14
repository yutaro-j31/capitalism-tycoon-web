const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame(); const e=new engineModule.TycoonEngine(); e.g.configured=true; const f=modules.finance; const opening=e.g.companyCash;
f.event(e.g,'revenue',1000,{cashEffect:1000,profitEffect:1000,sourceType:'b2c-store',operationID:'wc-b2c'}); e.g.companyCash+=1000;
f.event(e.g,'revenue',1000,{cashEffect:700,profitEffect:1000,receivableAmount:300,settlementType:'invoice',paymentTermsWeeks:4,sourceType:'corporate-contract',operationID:'wc-b2b'}); e.g.companyCash+=700;
f.event(e.g,'accountsReceivableCollection',300,{cashEffect:300,profitEffect:0,sourceType:'ar-collection',operationID:'wc-ar'}); e.g.companyCash+=300;
f.event(e.g,'taxExpense',120,{cashEffect:0,profitEffect:-120,sourceType:'tax',operationID:'wc-tax-exp'});
f.event(e.g,'taxPayment',50,{cashEffect:-50,profitEffect:0,sourceType:'tax',operationID:'wc-tax-pay'}); e.g.companyCash-=50;
f.rebuildDirtySnapshots(e.g); const st=f.buildStatements(e.g,'52'); if(st.workingCapital.accruedTaxes!==70) throw new Error('accrued tax mismatch'); if(st.cashFlow.accountsReceivableChange!==0) throw new Error('AR net change mismatch'); if(st.cashFlow.accruedTaxesChange!==70) throw new Error('tax WC change mismatch'); if(e.g.companyCash!==opening+1950) throw new Error('companyCash mismatch'); if(!f.validate(e.g).ok) throw new Error(f.validate(e.g).errors.join('\n'));
console.log('finance working capital integration checks passed');
