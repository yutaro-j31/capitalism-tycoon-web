const fs=require('node:fs'); const path=require('node:path');
const { loadGame } = require('./harness');
const audit=fs.readFileSync(path.join(__dirname,'..','docs','FINANCE_ENGINE_AUDIT.md'),'utf8');
const jsFiles=fs.readdirSync(path.join(__dirname,'..','js')).filter(f=>f.endsWith('.js'));
const cashLines=[]; for(const f of jsFiles){const text=fs.readFileSync(path.join(__dirname,'..','js',f),'utf8').split(/\r?\n/); text.forEach((line,i)=>{if(/companyCash\s*(?:[+\-*/]?=)/.test(line)||/this\.g\.companyCash|g\.companyCash/.test(line))cashLines.push(`${f}:${i+1}`);});}
for(const key of ['refreshExecutives','productAction','sellProduct','buyProperty','sellProperty','buildOnLand','investBusiness','contractOffice','cancelOffice','borrow','repay','missionReward','closeStoreDeposit']) if(!audit.includes(key)) throw new Error(`audit missing ${key}`);
const { engineModule, modules }=loadGame(); const finance=modules.finance;
function assertValid(e,label){finance.rebuildDirtySnapshots(e.g);const st=finance.buildStatements(e.g,'52'),v=finance.validate(e.g);if(Math.abs(st.balanceSheet.balanceDifference)>0.1)throw new Error(`${label} balance`);if(!v.ok)throw new Error(`${label} ${v.errors.join('\n')}`);return st;}
function checkDelta(e,label,fn){const cash=e.g.companyCash,tx=e.g.finance.transactions.length;if(!fn())throw new Error(`${label} failed`);finance.rebuildDirtySnapshots(e.g);const rows=e.g.finance.transactions.slice(tx),cashEffect=rows.reduce((a,t)=>a+t.cashEffect,0),delta=e.g.companyCash-cash;if(Math.abs(cashEffect-delta)>10)throw new Error(`${label} cash/event mismatch ${delta} vs ${cashEffect}`);assertValid(e,label);}
const e=new engineModule.TycoonEngine(); e.g.configured=true; e.g.companyCash=1_000_000_000; e.g.finance=finance.defaultFinanceState(e.g);
checkDelta(e,'borrow',()=>e.borrow(1_000_000,'company'));
const tenant=e.g.tenants.find(t=>!t.occupiedBy&&t.businessID==='ramen'&&t.deposit>0); let storeID; checkDelta(e,'openStore',()=>{const ok=e.openStore({tenantID:tenant.id,businessID:'ramen',name:'coverage'}); storeID=e.g.stores[e.g.stores.length-1]?.id; return ok;});
checkDelta(e,'closeStore',()=>e.closeStore(storeID));
const office=e.g.rentalOffices.find(o=>!o.contracted); checkDelta(e,'contractOffice',()=>e.contractOffice(office.id)); e.g.departments={}; e.g.executives={}; checkDelta(e,'cancelOffice',()=>e.cancelOffice());
const land=e.g.properties.find(p=>p.kind==='土地'&&!p.owner); checkDelta(e,'buyProperty',()=>e.buyProperty(land.id,'company')); checkDelta(e,'buildOnLand',()=>e.buildOnLand(land.id,'本社ビル')); checkDelta(e,'sellProperty',()=>e.sellProperty(land.id));
console.log(`finance cash mutation coverage checks passed (${cashLines.length} companyCash references scanned)`);
