'use strict';
// SPIKE-2 standalone operating-week projection on the vNext core journal.
// Cash-settled revenue, purchased materials expensed immediately, and payroll only.
// NOT an inventory, corporate-tax, depreciation, receivable or production implementation.
const core = require('./core.cjs');
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function entity(value, state, label) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value) || !state.entities.includes(value)) throw Error('invalid-'+label);
  return value;
}
function storeId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value))throw Error('invalid-store-id');
  return value;
}
function amount(value,label) {
  if (!Number.isSafeInteger(value) || value<0)throw Error('invalid-'+label);
  return value;
}
function signed(number,label) {
  if (number>MAX || number< -MAX)throw Error('overflow-'+label);
  return Number(number);
}
function clone(value) {return JSON.parse(JSON.stringify(value));}
function operationId(company,store,week) {
  if (!Number.isSafeInteger(week) || week<1 || week>1000000)throw Error('invalid-week');
  const result=`store-${company}-${store}-w${week}`;
  if (result.length>40)throw Error('operation-id-too-long');
  return result;
}
function planStoreWeek(previous, command) {
  try {
    core.validateState(previous);
    if (!command || command.type!=='settle-store-week')throw Error('unsupported-store-operation');
    const company=entity(command.company,previous,'company');
    const customer=entity(command.customer,previous,'customer');
    const supplier=entity(command.supplier,previous,'supplier');
    const employee=entity(command.employee,previous,'employee');
    if(new Set([company,customer,supplier,employee]).size!==4)throw Error('parties-must-be-distinct');
    const store=storeId(command.storeId);
    const id=operationId(company,store,command.week);
    const sales=amount(command.salesMinor,'sales');
    const materials=amount(command.materialsMinor,'materials');
    const wages=amount(command.wagesMinor,'wages');
    if (sales+materials+wages===0)throw Error('empty-week');
    const profit=signed(BigInt(sales)-BigInt(materials)-BigInt(wages),'profit');
    const postings=[];
    function post(account,deltaMinor){postings.push({account,deltaMinor});}
    if(sales>0) {
      post(`${customer}:cash`,-sales);
      post(`${customer}:expense:${store}-purchases`,sales);
      post(`${company}:cash`,sales);
      post(`${company}:revenue:${store}`,-sales);
    }
    if(materials>0) {
      post(`${company}:cash`,-materials);
      post(`${company}:expense:${store}-materials`,materials);
      post(`${supplier}:cash`,materials);
      post(`${supplier}:revenue:${store}-materials`,-materials);
    }
    if(wages>0) {
      post(`${company}:cash`,-wages);
      post(`${company}:expense:${store}-wages`,wages);
      post(`${employee}:cash`,wages);
      post(`${employee}:revenue:${store}-wages`,-wages);
    }
    const planned=core.planOperation(previous,{id,type:'journal',postings});
    if(!planned.ok)throw Error(planned.reason);
    const state=planned.state;
    const projection=storeSnapshot(state,company,store);
    if(projection.revenueMinor<sales || projection.materialsMinor<materials || projection.wagesMinor<wages)throw Error('store-projection-mismatch');
    return {ok:true,state,receipt:planned.receipt,weekly:{company,storeId:store,week:command.week,salesMinor:sales,materialsMinor:materials,wagesMinor:wages,profitMinor:profit}};
  }catch(e){return {ok:false,state:previous,reason:e instanceof Error?e.message:'invalid-store-week'};}
}
function admitStoreWeek(previous,command,persist) {
  const proposed=planStoreWeek(previous,command);
  if(!proposed.ok)return proposed;
  if(typeof persist!=='function')return {ok:false,state:previous,reason:'persistence-required'};
  try{
    if(persist(clone(proposed.state))!==true)return {ok:false,state:previous,reason:'persistence-rejected'};
    return proposed;
  }catch(_){return {ok:false,state:previous,reason:'persistence-threw'};}
}
function storeSnapshot(state,company,store) {
  core.validateState(state);
  entity(company,state,'company');storeId(store);
  const prefix=`store-${company}-${store}-w`;
  let revenue=0n,materials=0n,wages=0n,deltaCash=0n,weeks=0;
  for(const entry of state.journal){
    if(entry.type!=='journal'||!entry.operationId.startsWith(prefix))continue;
    if(!/^\d+$/.test(entry.operationId.slice(prefix.length)))throw Error('invalid-store-receipt');
    weeks++;
    for(const p of entry.postings){
      const amt=BigInt(p.deltaMinor);
      if(p.account===`${company}:revenue:${store}`)revenue-=amt;
      if(p.account===`${company}:expense:${store}-materials`)materials+=amt;
      if(p.account===`${company}:expense:${store}-wages`)wages+=amt;
      if(p.account===`${company}:cash`)deltaCash+=amt;
    }
  }
  if(revenue-materials-wages!==deltaCash)throw Error('store-profit-cash-mismatch');
  return {company,storeId:store,weeks,revenueMinor:signed(revenue,'revenue'),materialsMinor:signed(materials,'materials'),wagesMinor:signed(wages,'wages'),profitMinor:signed(deltaCash,'profit'),companyCashDeltaMinor:signed(deltaCash,'cash')};
}
module.exports={planStoreWeek,admitStoreWeek,storeSnapshot};
