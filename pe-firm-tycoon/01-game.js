'use strict';
const SAVE_KEY='pe_firm_tycoon_v1';
const names=['Northstar Logistics','Aster Foods','Kizuna Software','BluePeak Clinics','Helios Components','Marble Retail','Zenith Testing','Harbor Services','Crest Packaging','Nova Learning','Lumen Security','Oakline Industrial','Mira Consumer','Atlas Mobility','Sora Dataworks','Vertex Maintenance','Orion Medtech','Summit Facilities'];
const sectors=['物流','食品','SaaS','ヘルスケア','製造','小売','検査','B2Bサービス','包装','教育','セキュリティ','産業機器','消費財','モビリティ','データ','メンテナンス','医療機器','施設管理'];
const dealTypes={
  lbo:{label:'LBO',m:0,r:0,g:0,q:0,hold:0},
  ptp:{label:'Public-to-Private',m:1.0,r:.08,g:.005,q:.02,hold:0},
  mbo:{label:'MBO',m:-.2,r:-.05,g:.005,q:.08,hold:0},
  carve:{label:'カーブアウト',m:-.7,r:.12,g:.03,q:-.03,hold:0},
  secondary:{label:'Secondary',m:-.5,r:-.07,g:.01,q:.05,hold:4}
};
const officeDefs={1:{name:'Boutique Office',seats:6,annual:0.20,nextCost:1.5},2:{name:'Midtown Office',seats:10,annual:0.40,nextCost:3.0},3:{name:'Institutional HQ',seats:16,annual:0.70,nextCost:null}};
const salaryAnnual={partner:.45,vp:.22,associate:.11};
let memorySave=null;

function baseLPs(){return [
  {id:'LP1',name:'Sakura Pension',type:'年金',weight:.30,commitments:{}},
  {id:'LP2',name:'Horizon Insurance',type:'保険',weight:.27,commitments:{}},
  {id:'LP3',name:'Northbridge Endowment',type:'大学基金',weight:.23,commitments:{}},
  {id:'LP4',name:'Atlas Family Office',type:'FO',weight:.20,commitments:{}}
]}
function fundTemplate(id,name,kind,vintage,committed,ageQ=0){return {id,name,kind,vintage,committed,called:0,cash:0,invested:0,distributions:0,nav:0,feeRate:.02,carryRate:.20,hurdleRate:.08,gpCommitRate:kind==='continuation'?.01:.02,gpCommitAmount:committed*(kind==='continuation'?.01:.02),gpCalled:0,gpDistributions:0,carryPaid:0,ageQ,status:'Investing',cashflows:[],inceptionTurn:1,feesPaid:0,expensesPaid:0,navLoan:0,navLoanRate:0,navLoanInterest:0,strategy:'small',investmentPeriodQ:20,termQ:40,termExtensionQ:0,netIRRHistory:[]}}
function assignCommitments(state,fund){
  const ext=fund.committed-fund.gpCommitAmount;
  state.lps.forEach(lp=>{lp.commitments[fund.id]={commitment:ext*lp.weight,called:0,distributed:0}});
}
function freshState(){
  const state={version:2,seed:937241,rngState:937241,year:1,quarter:1,turn:1,gpCash:4.0,reputation:50,lpTrust:62,totalCarry:0,flagshipCount:1,continuationCount:0,lps:baseLPs(),funds:[],pipeline:[],portfolio:[],icQueue:[],exits:[],org:{partner:2,vp:1,associate:2,officeLevel:1},log:[{t:'Y1 Q1',m:'<b>Fund I</b> を100億円でクローズ。GP Commit 2%、Hurdle 8%、Carry 20%。'}]};
  const f=fundTemplate('F1','Fund I','flagship',1,100,0);state.funds.push(f);assignCommitments(state,f);return state;
}
function migrate(old){
  if(!old||old.version>=2)return old;
  const ns=freshState();ns.rngState=old.rngState||ns.rngState;ns.year=old.year||1;ns.quarter=old.quarter||1;ns.turn=old.turn||1;ns.gpCash=old.gpCash??4;ns.reputation=old.reputation??50;ns.lpTrust=old.lpTrust??62;ns.totalCarry=old.totalCarry||0;ns.log=old.log||ns.log;ns.exits=old.exits||[];
  const of=old.fund||{};const f=ns.funds[0];Object.assign(f,{committed:of.committed||100,called:of.called||0,invested:of.invested||0,distributions:of.distributions||0,ageQ:of.ageQ||0,vintage:of.vintage||1});f.gpCommitAmount=f.committed*.02;f.gpCalled=Math.min(f.gpCommitAmount,f.called*.02);f.cash=Math.max(0,f.called-f.invested);f.cashflows=f.called?[{turn:1,amount:-f.called}]:[];if(f.distributions)f.cashflows.push({turn:ns.turn,amount:f.distributions});
  assignCommitments(ns,f);const extCalled=Math.max(0,f.called-f.gpCalled);ns.lps.forEach(lp=>{const c=lp.commitments[f.id];c.called=extCalled*lp.weight;c.distributed=Math.max(0,f.distributions-f.gpDistributions)*lp.weight});
  ns.portfolio=(old.portfolio||[]).map(p=>({...p,fundId:'F1',ownershipPct:1,totalEquity:p.investedEquity||p.equity||1,coInvestPct:0,dealType:p.dealType||'lbo',holdingQ:p.holdingQ||0,initiatives:p.initiatives||{},notes:p.notes||[],fcfCum:p.fcfCum||0}));
  ns.pipeline=old.pipeline||[];return ns;
}

const acqStages=[
  {key:'teaser',label:'Teaser'},{key:'nda',label:'NDA'},{key:'cim',label:'CIM'},{key:'first_bid',label:'1st Bid'},
  {key:'dd',label:'DD'},{key:'debt',label:'Debt'},{key:'ic',label:'IC'},{key:'final_bid',label:'Final Bid'},
  {key:'spa',label:'SPA'},{key:'closing',label:'Closing'}
];
const ddDefs={
  commercial:{label:'Commercial DD',cost:.05,weeks:2},qoe:{label:'Financial / QoE',cost:.06,weeks:2},
  legal:{label:'Legal / Tax DD',cost:.05,weeks:2},operational:{label:'Operational DD',cost:.04,weeks:2}
};
function legacyHidden(d){
  const q=Number.isFinite(Number(d.quality))?Number(d.quality):.55,r=Number.isFinite(Number(d.risk))?Number(d.risk):.5,e=Number(d.ebitda)||5;
  return {qoeAdj:(q-.58)*.12,customerConcentration:.18+r*.32,capexRisk:Math.min(.9,.2+r*.6),legalRisk:Math.min(.9,.12+r*.58),managementScore:Math.min(.95,.35+q*.55),commercialUpside:(q-.45)*.08,workingCapitalAdj:(.5-r)*e*.08};
}
function baseAcqProcess(d,turn=1){
  const h=d.hidden&&typeof d.hidden==='object'?d.hidden:legacyHidden(d);const guide=Math.max(3.5,Number(d.entryMultiple||8)+.65+Number(d.risk||.5)*.45);
  return {stage:'teaser',status:'live',startedTurn:turn,deadlineTurn:turn+3,weeks:0,costs:0,ndaSigned:false,cimReviewed:false,
    sellerGuidanceMultiple:guide,sellerFloorMultiple:Math.max(3.5,guide-.45),competition:Math.max(2,Math.min(6,2+Math.round((Number(d.quality)||.5)*2+(Number(d.risk)||.5)*2))),
    firstBidMultiple:null,firstBidStrategy:null,shortlisted:false,dd:{commercial:false,qoe:false,legal:false,operational:false},findings:[],adjustedEbitda:Number(d.ebitda)||5,
    lenderQuotes:[],selectedLender:null,icSubmitted:false,icApproved:false,icMaxBidMultiple:null,icTargetIRR:.20,icTargetMOIC:2.0,
    finalBidMultiple:null,finalBidStrategy:null,finalBidAccepted:false,spaStrategy:null,spaProtection:0,residualRisk:Number(d.risk)||.5,closingReady:false,lostReason:null,
    managementRolloverPct:.05,minimumCashPct:.015,transactionFeePct:.020,holdYears:5,exitMultipleDelta:-.5,underwritingFrozen:false,hidden:h};
}
function normalizeAcqProcess(d,p,turn=1){
  const b=baseAcqProcess(d,turn),x={...b,...(p&&typeof p==='object'?p:{})};
  if(!acqStages.some(z=>z.key===x.stage))x.stage='teaser';x.status=x.status==='lost'?'lost':'live';
  x.startedTurn=Math.max(1,Number(x.startedTurn)||turn);x.deadlineTurn=Math.max(x.startedTurn+1,Number(x.deadlineTurn)||x.startedTurn+3);x.weeks=Math.max(0,Number(x.weeks)||0);x.costs=Math.max(0,Number(x.costs)||0);
  x.sellerGuidanceMultiple=Math.max(3.5,Number(x.sellerGuidanceMultiple)||b.sellerGuidanceMultiple);x.sellerFloorMultiple=Math.max(3.5,Number(x.sellerFloorMultiple)||b.sellerFloorMultiple);x.competition=Math.max(1,Math.min(7,Number(x.competition)||b.competition));
  x.dd={...b.dd,...(x.dd&&typeof x.dd==='object'?x.dd:{})};x.findings=Array.isArray(x.findings)?x.findings:[];x.adjustedEbitda=Math.max(.01,Number(x.adjustedEbitda)||Number(d.ebitda)||5);x.lenderQuotes=Array.isArray(x.lenderQuotes)?x.lenderQuotes:[];x.selectedLender=x.selectedLender&&typeof x.selectedLender==='object'?x.selectedLender:null;x.hidden={...b.hidden,...(x.hidden&&typeof x.hidden==='object'?x.hidden:{})};
  x.icTargetIRR=Math.min(.5,Math.max(.08,Number(x.icTargetIRR)||.20));x.icTargetMOIC=Math.min(4,Math.max(1.1,Number(x.icTargetMOIC)||2));x.icMaxBidMultiple=Number.isFinite(Number(x.icMaxBidMultiple))?Number(x.icMaxBidMultiple):null;
  x.managementRolloverPct=Math.min(.25,Math.max(0,Number(x.managementRolloverPct)||b.managementRolloverPct));x.minimumCashPct=Math.min(.05,Math.max(0,Number(x.minimumCashPct)||b.minimumCashPct));x.transactionFeePct=Math.min(.06,Math.max(0,Number(x.transactionFeePct)||b.transactionFeePct));x.holdYears=Math.min(7,Math.max(3,Number(x.holdYears)||5));{const emd=Number(x.exitMultipleDelta);x.exitMultipleDelta=Number.isFinite(emd)?Math.min(1.5,Math.max(-2.5,emd)):-.5;}
  return x;
}

/* ===== v6 state bootstrap: 22-system private-capital simulator ===== */
const v6StrategyDefs={
  small:{name:'Small Buyout',reqAUM:0,reqRep:0,cost:0,fee:.020,desc:'Founder-led / lower mid-market control buyouts.'},
  mid:{name:'Mid-Market Buyout',reqAUM:140,reqRep:55,cost:.6,fee:.018,desc:'Larger auctions, deeper financing markets, bigger teams.'},
  growth:{name:'Growth Equity',reqAUM:180,reqRep:60,cost:.8,fee:.020,desc:'Minority / growth underwriting and higher revenue growth.'},
  infra:{name:'Infrastructure',reqAUM:260,reqRep:65,cost:1.2,fee:.015,desc:'Long-duration contracted cash flows and lower leverage risk.'},
  credit:{name:'Private Credit',reqAUM:320,reqRep:67,cost:1.0,fee:.0125,desc:'Direct lending, NAV finance and sponsor-backed credit.'},
  secondaries:{name:'Secondaries',reqAUM:420,reqRep:70,cost:1.4,fee:.0125,desc:'LP-led and GP-led liquidity solutions.'},
  realestate:{name:'Real Estate',reqAUM:520,reqRep:72,cost:1.6,fee:.015,desc:'Real assets and property operating platforms.'}
};
const v6ThesisDefs=[
  {id:'TH1',name:'人手不足 × B2B Services',sectors:['B2Bサービス','施設管理','メンテナンス','検査'],desc:'Fragmented service sectors, labor productivity and buy-and-build.'},
  {id:'TH2',name:'Digital Mission-Critical',sectors:['SaaS','データ','セキュリティ'],desc:'Recurring revenue, pricing power and mission-critical software.'},
  {id:'TH3',name:'Healthcare Consolidation',sectors:['ヘルスケア','医療機器'],desc:'Defensive demand, clinical density and add-on consolidation.'},
  {id:'TH4',name:'Industrial Reshoring',sectors:['製造','産業機器','包装','物流'],desc:'Supply-chain resilience, automation and domestic capex.'},
  {id:'TH5',name:'Consumer Brand Platform',sectors:['消費財','食品','小売','教育'],desc:'Brand, channel expansion, procurement and pricing.'}
];
const v6CompetitorDefaults=[
  {id:'C1',name:'Titan Capital',aum:520,rep:78,performance:1.72,aggression:.55,certainty:.94,network:78,strategy:'Large Buyout'},
  {id:'C2',name:'Orion Partners',aum:330,rep:71,performance:1.58,aggression:.32,certainty:.91,network:70,strategy:'Mid-Market'},
  {id:'C3',name:'Northstar Equity',aum:210,rep:65,performance:1.46,aggression:.44,certainty:.86,network:64,strategy:'Buy & Build'},
  {id:'C4',name:'Harbor Ridge',aum:145,rep:59,performance:1.35,aggression:.22,certainty:.84,network:58,strategy:'Small Buyout'}
];
const v6BankerDefaults=[
  {id:'B1',name:'Apex Advisory',coverage:'Industrials / Services',relationship:54,lastMetTurn:0,dealFlow:78},
  {id:'B2',name:'Summit Securities',coverage:'Technology / Consumer',relationship:48,lastMetTurn:0,dealFlow:70},
  {id:'B3',name:'Koyo M&A Partners',coverage:'Healthcare / Mid-Market',relationship:51,lastMetTurn:0,dealFlow:66}
];
const v6LenderDefaults=[
  {id:'bank',name:'Senior Bank Club',relationship:56,lastMetTurn:0},
  {id:'club',name:'Institutional Club Loan',relationship:50,lastMetTurn:0},
  {id:'direct',name:'Direct Lending / Unitranche',relationship:47,lastMetTurn:0}
];
const v6CEOSeed=[
  {id:'CEO1',name:'R. Mori',archetype:'Growth Builder',growth:88,cost:55,ma:70,turnaround:54,ipo:76,comp:.16},
  {id:'CEO2',name:'K. Hayashi',archetype:'Turnaround Operator',growth:55,cost:91,ma:72,turnaround:93,ipo:52,comp:.14},
  {id:'CEO3',name:'M. Takeda',archetype:'Buy & Build CEO',growth:72,cost:70,ma:94,turnaround:68,ipo:61,comp:.18},
  {id:'CEO4',name:'S. Arai',archetype:'Public Markets CEO',growth:76,cost:62,ma:66,turnaround:58,ipo:95,comp:.20}
];
