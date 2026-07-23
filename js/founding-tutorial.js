// Script boundary: js/founding-tutorial.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before founding-tutorial.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.foundingTutorial)throw new Error('Capitalism Tycoon foundingTutorial module is already registered.');
(function(exports){
const MASTER=__modules.data?.MASTER||{};
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'?v:{};
const openStores=g=>arr(g?.stores).filter(s=>s&&s.status==='open');
const reports=g=>arr(g?.reports).filter(r=>r&&Number.isFinite(Number(r.week))).slice().sort((a,b)=>nf(a.week)-nf(b.week));
const hasInventory=g=>{const inventory=obj(g?.inventoryByStoreID);return Object.values(inventory).some(store=>Object.values(obj(store?.inventoryByBusinessID||store)).some(v=>nf(v)>0));};
const hasSupplyPlan=g=>Object.keys(obj(g?.supplySettingsByStoreID)).length>0||arr(g?.purchaseOrders).some(o=>o&&o.orderStatus!=='cancelled');
const hasBusinessImprovement=g=>arr(g?.businesses).some(b=>{const base=arr(MASTER.businesses).find(x=>x&&x.id===b?.id)||{};return nf(b?.quality)>nf(base.quality)||nf(b?.brand)>nf(base.brand)||nf(b?.efficiency)>nf(base.efficiency)||nf(b?.dx)>nf(base.dx)||nf(b?.price,nf(base.price))!==nf(base.price);});
const hasFinanceImprovement=g=>arr(g?.finance?.transactions).some(t=>t&&['investBusiness','workforceInvest','productAction','overseasAction'].includes(t.sourceType));
const hasStoreWorkforceImprovement=g=>arr(g?.workforceTeams).some(t=>{if(!t||!t.storeID||t.status==='removed'||t.status==='closed')return false;const headcount=nf(t.headcount),baseHeadcount=Number.isFinite(Number(t.baseHeadcount))?nf(t.baseHeadcount):headcount;const activeAddedCohort=arr(t.storePayrollCohorts).some(c=>c&&c.status==='active'&&nf(c.headcount)>0);return headcount>baseHeadcount||nf(t.onboardingHeadcount)>0||nf(t.trainingLevel)>0||activeAddedCohort;});
const hasCorporateWorkforceImprovement=g=>arr(g?.workforceTeams).some(t=>t&&!t.storeID&&t.status!=='removed'&&nf(t.headcount)>0&&Boolean(t.departmentID?(g?.departments||{})[t.departmentID]:g?.hasHeadOffice));
const hasTrainingImprovement=g=>arr(g?.workforceTrainings).some(t=>t&&t.status!=='cancelled');
const hasImprovement=g=>hasBusinessImprovement(g)||hasFinanceImprovement(g)||hasStoreWorkforceImprovement(g)||hasCorporateWorkforceImprovement(g)||hasTrainingImprovement(g)||arr(g?.rdProjects).some(p=>p&&nf(p.progress)>0)||arr(g?.productVentures).some(p=>p&&['released','scaling'].includes(p.status));
const cashRunwayWeeks=g=>{const last=g?.lastReport||reports(g).slice(-1)[0]||{};const fixed=Math.max(1,nf(last.fixedCosts,nf(last.expenses)*0.35)+nf(g?.finance?.lastStatements?.profitAndLoss?.rent)+nf(g?.finance?.lastStatements?.profitAndLoss?.payroll));return nf(g?.companyCash)/fixed;};
const hasOrganization=g=>Boolean(g?.hasHeadOffice)||Object.keys(obj(g?.departments)).length>0||arr(g?.workforceTeams).some(t=>!t?.storeID&&nf(t?.headcount)>0)||arr(g?.workforceProjects).some(p=>p&&p.status&&p.status!=='cancelled');
const advanced=g=>Boolean(g?.publicCompany)||arr(g?.maSubsidiaries).length>0||arr(g?.subsidiaries).length>0||arr(g?.overseasSubsidiaries).length>0||nf(g?.totalAcquisitions)>0;
const completed={
 dashboard:g=>Boolean(g?.configured)&&((g?.selectedTab&&g.selectedTab!=='home')||openStores(g).length>0||nf(g?.week)>1||arr(g?.completedMissionIDs).length>0),
 first_store:g=>openStores(g).length>=1,
 unit_economics:g=>openStores(g).length>=1&&(hasInventory(g)||hasSupplyPlan(g)||arr(g?.supplyResultsByStoreID).length>0||Object.keys(obj(g?.supplyResultsByStoreID)).length>0),
 first_week:g=>nf(g?.week)>1||reports(g).length>0,
 weekly_recap:g=>reports(g).length>=2,
 first_improvement:g=>hasImprovement(g),
 cash_runway:g=>reports(g).length>=3&&cashRunwayWeeks(g)>=4,
 growth_step:g=>openStores(g).length>=2||hasOrganization(g)||advanced(g)||arr(g?.completedMissionIDs).includes('mission_two_stores'),
 organization:g=>hasOrganization(g)||advanced(g),
 graduation:g=>(hasOrganization(g)||advanced(g))&&reports(g).length>=3&&(openStores(g).length>=2||nf(g?.companyCash)>=7000000)&&nf(g?.companyCash)>=7000000
};
const STEPS=Object.freeze([
 {id:'dashboard',order:1,title:'会社の現在地を確認',targetTab:'home',targetSelector:'[data-ceo-dashboard="1"]',buttonLabel:'CEO Dashboardを見る',description:'まず現金・売上・利益・企業価値の位置を見ます。',points:['現金：今すぐ支払いに使える資金','利益：売上から費用を差し引いた残り','Executive Secretaryは危険や機会の優先順位を示します。']},
 {id:'first_store',order:2,title:'最初の店舗を確認',targetTab:'map',targetSelector:'.tenant-card,.store-card,[data-action="open-store"]',buttonLabel:'店舗画面へ',description:'客数、単価、原価、キャパシティを確認します。',points:['売上は客数×単価で増減します。','キャパシティは設備や人員で対応できる上限です。']},
 {id:'unit_economics',order:3,title:'価格・商品・供給を確認',targetTab:'strategy',targetSelector:'.supply-store-card,[data-action="supply-policy"]',buttonLabel:'供給を確認',description:'欠品のまま週を進めないよう、商品と仕入れを確認します。',points:['粗利は売上から直接原価を引いた利益です。','在庫を持ちすぎると現金が商品に固定されます。']},
 {id:'first_week',order:4,title:'最初の週を進める',targetTab:'home',targetSelector:'.week-controls [data-action="advance-week"]',buttonLabel:'週送りボタンへ',description:'1週進めると売上、費用、在庫、疲労、競合が変化します。',points:['創業ガイドは週送りを自動実行しません。','週送り前に現金と欠品リスクを確認しましょう。']},
 {id:'weekly_recap',order:5,title:'週間インパクトを読む',targetTab:'home',targetSelector:'[data-ceo-dashboard-card="weekly-impact"]',buttonLabel:'週間インパクトへ',description:'売上、利益、現金、企業価値の前週差を確認します。',points:['初週は比較対象がないため、次週から差分が読みやすくなります。','数字が変わった理由はニュースと決算で確認します。']},
 {id:'first_improvement',order:6,title:'最初の改善を行う',targetTab:'business',targetSelector:'[data-action="business-invest"],[data-action="business-price"]',buttonLabel:'改善候補へ',description:'価格、品質、広告、人材などから小さな改善を選びます。',points:['改善は自動実行されません。','履歴がない場合は、状態変化や複数週の実績から進行を判定します。']},
 {id:'cash_runway',order:7,title:'黒字と現金余力を確認',targetTab:'report',targetSelector:'.finance-table,.forecast',buttonLabel:'決算を見る',description:'利益と現金は別物です。固定費に対する余力を見ます。',points:['固定費は売上がなくても発生する費用です。','黒字でも投資や返済で現金不足になることがあります。']},
 {id:'growth_step',order:8,title:'2店舗目か次の成長段階へ',targetTab:'map',targetSelector:'[data-action="open-store"],.milestone-road',buttonLabel:'成長候補へ',description:'出店前に現金、能力、人材、供給を確認します。',points:['出店は売上機会と固定費の両方を増やします。','組織機能の解放でも次段階へ進めます。']},
 {id:'organization',order:9,title:'組織経営へ移行',targetTab:'office',targetSelector:'.office-grid,.workforce-card,[data-action="contract-office"]',buttonLabel:'本社・組織へ',description:'本社、部門、人材、疲労、プロジェクトを確認します。',points:['個人商店から、役割分担する会社へ移ります。','Executive Secretaryは以後も毎週の優先課題を案内します。']},
 {id:'graduation',order:10,title:'創業チュートリアル完了',targetTab:'missions',targetSelector:'.mission,.milestone-road',buttonLabel:'成長ロードマップへ',description:'複数週の実績と成長基盤を確認できました。',points:['今後はExecutive Secretaryで現在の優先課題を確認します。','中期目標は店舗網、組織、商品開発、IPO準備です。']}
].map(Object.freeze));
function build(g){const done=STEPS.map(s=>Boolean(completed[s.id]?.(g)));const completedCount=done.filter(Boolean).length;const complete=completedCount===STEPS.length;const isAdvanced=advanced(g);const displayMode=complete?'complete':isAdvanced?'summary':'guide';const firstOpen=done.findIndex(v=>!v);const currentIndex=firstOpen<0?STEPS.length-1:firstOpen;const steps=STEPS.map((s,i)=>{const state=done[i]?'completed':displayMode==='summary'?'unavailable':i===currentIndex?'current':i<currentIndex?'blocked':'upcoming';return Object.freeze({...s,state,completed:done[i],current:displayMode==='guide'&&i===currentIndex&&!done[i],upcoming:displayMode==='guide'&&i>currentIndex&&!done[i]});});const currentStep=displayMode==='guide'?(steps[currentIndex]||steps[steps.length-1]):null;return Object.freeze({steps:Object.freeze(steps),completedCount,total:STEPS.length,progressLabel:`${completedCount}/${STEPS.length}`,complete,current:currentStep,displayMode,roleNote:'創業ガイドは固定順の学習用、Executive Secretaryは毎週の危険・機会の優先順位です。'});}
exports.STEPS=STEPS;exports.build=build;exports._internals=Object.freeze({cashRunwayWeeks,hasImprovement,hasBusinessImprovement,hasStoreWorkforceImprovement,hasCorporateWorkforceImprovement,hasTrainingImprovement,hasOrganization,advanced});
})(__modules.foundingTutorial={});
})();
