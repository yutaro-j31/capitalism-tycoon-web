'use strict';
function random(seed=7){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function prepare(m,account){
 const e=new m.engine.TycoonEngine();
 e.configure({playerName:'VC Fault Audit',companyName:'VC Audit Holdings',difficulty:'normal'});
 e.g.companyCash=2000000000;e.g.personalCash=2000000000;
 e.g.departments.investment={name:'Investment',established:true};
 e.g.finance=m.finance.defaultFinanceState(e.g);
 const target=e.g.startups.find(s=>s.alive&&!s.subsidiary&&s.activeFundingRound?.status!=='open'&&!s.ownedCompany&&!s.ownedPersonal);
 if(!target)throw new Error('fixture: initial VC target missing');
 const amount=Math.max(1,Number(target.minTicket)||0);
 if(!(amount>0&&Number.isFinite(amount)&&e.g[account==='company'?'companyCash':'personalCash']>amount))throw new Error('fixture: invalid ticket/cash');
 return {e,id:target.id,amount};
}
// Compare every persisted field after the same production constructor normalization.
function economic(g){const c=JSON.parse(JSON.stringify(g));delete c.saveSequence;delete c.lastSaveDate;return c;}
function fixture(m,account,variant='plain'){
 const p=prepare(m,account),s=p.e.g.startups.find(x=>x.id===p.id);
 if(variant==='dd')s.dueDiligence={discount:.15};
 if(variant==='cap'){s[account==='company'?'ownedCompany':'ownedPersonal']=account==='company'?.79:.48;s.dueDiligence={discount:.15};}
 return {...p,account,variant};
}
module.exports={random,prepare,economic,fixture};
