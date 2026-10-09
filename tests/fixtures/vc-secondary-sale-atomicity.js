'use strict';
const {random,economic,prepare}=require('./vc-initial-investment-atomicity');
function fixture(m,account,variant='mixed'){
 const f=prepare(m,account),e=f.e,s=e.g.startups.find(x=>x.id===f.id);
 const buy=side=>{if(e.investStartup(f.id,f.amount,side)!==true)throw new Error('secondary fixture purchase rejected');};
 buy(account);buy(account==='company'?'personal':'company');
 if(variant!=='plain'){
  s.dueDiligence={done:true,discount:.15};
  if(variant==='dd'){s[account==='company'?'ddNegotiatedOwnedCompany':'ddNegotiatedOwnedPersonal']=s[account==='company'?'ownedCompany':'ownedPersonal'];}
  else if(variant==='mixed'||variant==='profit')buy(account);
  else if(variant==='legacy'){delete s.ddNegotiatedOwnedCompany;delete s.ddNegotiatedOwnedPersonal;}
 }
 if(variant==='profit')s.valuation*=4;
 return {...f,account,variant};
}
function snapshot(g){return JSON.parse(JSON.stringify(g));}
module.exports={random,economic,fixture,snapshot};
