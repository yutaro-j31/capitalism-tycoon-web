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
const hasBusinessImprovement=g=>arr(g?.businesses).some(b=>{const base=arr(MASTER.businesses).find(x=>x&&x.id===b?.id)||{};return nf(b?.quality)>nf(base.quality)||nf(b?.brand)>nf(base.brand)||nf(b?.efficiency)>nf(base.efficiency)||nf(b?.dx)>nf(base.dx)||nf(b?.price,nf(base.price))!==nf(base.price);});
const hasFinanceImprovement=g=>arr(g?.finance?.transactions).some(t=>t&&['investBusiness','workforceInvest','productAction','overseasAction'].includes(t.sourceType));
const hasStoreWorkforceImprovement=g=>arr(g?.workforceTeams).some(t=>{if(!t||!t.storeID||t.status==='removed'||t.status==='closed')return false;const headcount=nf(t.headcount),baseHeadcount=Number.isFinite(Number(t.baseHeadcount))?nf(t.baseHeadcount):headcount;const activeAddedCohort=arr(t.storePayrollCohorts).some(c=>c&&c.status==='active'&&nf(c.headcount)>0);return headcount>baseHeadcount||nf(t.onboardingHeadcount)>0||nf(t.trainingLevel)>0||activeAddedCohort;});
const hasCorporateWorkforceImprovement=g=>arr(g?.workforceTeams).some(t=>t&&!t.storeID&&t.status!=='removed'&&nf(t.headcount)>0&&Boolean(t.departmentID?(g?.departments||{})[t.departmentID]:g?.hasHeadOffice));
const hasTrainingImprovement=g=>arr(g?.workforceTrainings).some(t=>t&&t.status!=='cancelled');
const hasImprovement=g=>hasBusinessImprovement(g)||hasFinanceImprovement(g)||hasStoreWorkforceImprovement(g)||hasCorporateWorkforceImprovement(g)||hasTrainingImprovement(g)||arr(g?.rdProjects).some(p=>p&&nf(p.progress)>0)||arr(g?.productVentures).some(p=>p&&['released','scaling'].includes(p.status));
const cashRunwayWeeks=g=>{const last=g?.lastReport||reports(g).slice(-1)[0]||{};const fixed=Math.max(1,nf(last.fixedCosts,nf(last.expenses)*0.35)+nf(g?.finance?.lastStatements?.profitAndLoss?.rent)+nf(g?.finance?.lastStatements?.profitAndLoss?.payroll));return nf(g?.companyCash)/fixed;};
const hasOrganization=g=>Boolean(g?.hasHeadOffice)||Object.keys(obj(g?.departments)).length>0||arr(g?.workforceTeams).some(t=>!t?.storeID&&nf(t?.headcount)>0)||arr(g?.workforceProjects).some(p=>p&&p.status&&p.status!=='cancelled');
const advanced=g=>Boolean(g?.publicCompany)||arr(g?.maSubsidiaries).length>0||arr(g?.subsidiaries).length>0||arr(g?.overseasSubsidiaries).length>0||nf(g?.totalAcquisitions)>0;
// unit_economics と weekly_recap は「店舗が開いてから経過した週数」ではなく「ゲーム開始からの
// 絶対週数・累計レポート数」で完了判定していた。出店には3〜8週の準備期間があり、first_store
// 自身のCTA（PR #478の「開業準備中・あとN週」）に従って週送りするだけで、店舗が一度も稼働
// していないのに次の条件が先に満たされてしまう。実測（第1〜4週、ramen出店）:
//
//   週3 準備中 reports=2  weekly_recap=✓（店舗は影も形も稼働していない。前週比較する中身が無い）
//   週4 開店   unit_economics/weekly_recapが同時に✓（supply設定は出店の瞬間に自動生成されるため、
//              プレイヤーが供給・価格画面を一度も見ないうちに完了扱いになる）
//
// 完了条件を「店舗が実際に開店してから経過した週数」基準に変え、各ステップが異なる週で
// 完了するようにする。first_store（openStores>=1）は変更しない。
//
// first_weekはあえて変更していない。その条件（week>1||reports.length>0）は「週送りボタンを
// 押したかどうか」を見ているだけで、準備期間中に押しても実際に押した事実に変わりはなく、
// 虚偽の完了ではない。またSTEPSの並び順でfirst_week（index3）はunit_economics（index2）より
// 後ろにあるため、店舗が開くまではfirst_storeが、開いた直後はunit_economicsがcurrentを占有し、
// first_weekが単独でcurrentとして表示されることは元々ない（この並び順自体は変更しない）。
//
// unit_economics の完了条件からは hasInventory/hasSupplyPlan 等の供給シグナルを外している。
// これらは market.js/supply.js/workforce.js の TARGET_BUSINESS_IDS（現状 ramen のみ）に
// しか存在せず、cafe 等29業種を最初の店舗にすると店舗が正常に稼働していても永久に
// unit_economics が完了しなかった（実測で確認）。また、対象業種（ramen）についても
// この供給シグナルは店舗が開いた瞬間（weeksSinceFirstOpen=0の週）に自動生成されており、
// weeksSinceFirstOpen>=1のゲートが成立する時点では既に必ず真になっている。つまり非対象
// 業種を詰ませるだけで、対象業種側に追加の意味のあるゲートを提供していなかった。
// 削除しても対象業種側の挙動は変わらない。
const firstOpenWeek=g=>{
  // 実際のゲームでは openStore() が openingWeek を必ず設定するが、手組みのstateや
  // 想定外の旧セーブでは status='open' なのに openingWeek が欠落している可能性がある。
  // buildは読み取り専用でgに書き戻せないため、フォールバックは「現在週」のような
  // 呼び出しごとに動く値にしてはいけない（weeksSinceFirstOpenが常に0に固定され、
  // 永久に完了しない詰み状態になる）。固定の起点（週1、＝ずっと前から開いていた扱い）に
  // することで、g.weekが進むにつれて自然にweeksSinceFirstOpenも進む。
  const weeks=arr(g?.stores).filter(s=>s).map(s=>{
    const raw=nf(s.openingWeek,NaN);
    if(Number.isFinite(raw)&&raw>0)return raw;
    return s.status==='open'?1:0;
  }).filter(w=>w>0);
  return weeks.length?Math.min(...weeks):null;
};
const weeksSinceFirstOpen=g=>{const openWeek=firstOpenWeek(g);return openWeek==null?-1:nf(g?.week)-openWeek;};
// dashboard ステップのCTA（「CEO Dashboardを見る」）は targetTab:'home' で、
// ホーム画面自体が既定タブのため、タップしても selectedTab が変化しない。完了条件が
// 「selectedTabがhomeでなくなること」等の他行動の副作用に頼っていたため、CTAをタップした
// だけでは永遠に完了せず、初心者が同じCTAを見続ける状態になっていた。
// CTAが実際にタップされたことを明示的に記録し、それ自体を完了条件に加える。
function acknowledgeDashboard(g){
  if(!g||typeof g!=='object')return g;
  if(!g.foundingTutorialProgress||typeof g.foundingTutorialProgress!=='object')g.foundingTutorialProgress={};
  g.foundingTutorialProgress.dashboardAcknowledged=true;
  return g;
}
const completed={
 dashboard:g=>Boolean(g?.configured)&&(Boolean(g?.foundingTutorialProgress?.dashboardAcknowledged)||(g?.selectedTab&&g.selectedTab!=='home')||openStores(g).length>0||nf(g?.week)>1||arr(g?.completedMissionIDs).length>0),
 first_store:g=>openStores(g).length>=1,
 unit_economics:g=>openStores(g).length>=1&&weeksSinceFirstOpen(g)>=1,
 first_week:g=>nf(g?.week)>1||reports(g).length>0,
 weekly_recap:g=>weeksSinceFirstOpen(g)>=2,
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
// first_store ステップは「最初の店舗を確認」という固定文言だった。実測すると、これは
// 2つの状況で誤った指示になっていた:
//
//   1. 店舗0件のプレイヤー（dashboardステップを終えた直後）に対して
//      「最初の店舗を確認 / 客数、単価、原価、キャパシティを確認します」と表示される。
//      確認すべき店舗がまだ存在しない。初回出店のCTAとして機能していなかった。
//   2. 出店した直後の3〜8週（status='preparing'）も同じ文言が出続ける。
//      プレイヤーは正しく行動したのに承認されず、まだ発生していない客数を確認しろと言われる。
//
// 完了条件（openStores>=1）は変更しない。進行到達性に影響を出さず、文言だけを状態に合わせる。
const preparingStores=g=>arr(g?.stores).filter(s=>s&&s.status==='preparing');
function firstStoreVariant(step,g){
  if(openStores(g).length>0)return step;
  const preparing=preparingStores(g);
  if(preparing.length>0){
    const weeks=Math.max(0,Math.ceil(Math.min(...preparing.map(s=>nf(s.openingWeek)))-nf(g?.week)));
    return Object.freeze({...step,
      title:weeks>0?`開業準備中・あと${weeks}週`:'まもなく開店',
      buttonLabel:'準備中の店舗を見る',
      description:'出店は完了しました。開店までは売上が立たないので、週を進めて開店を待ちます。',
      points:Object.freeze(['開店までの週数は初期費用が大きい業種ほど長くなります。','準備中も家賃と人件費は発生しません。売上が立つのは開店後です。'])});
  }
  return Object.freeze({...step,
    title:'最初の店舗を出す',
    buttonLabel:'出店できる場所を見る',
    description:'地図でテナントを選び、業種を決めて出店します。出店前に週次収支の試算を確認できます。',
    points:Object.freeze(['初期費用は店舗設備と保証金の合計です。','出店してから開店までは数週間かかります。'])});
}
function build(g){const done=STEPS.map(s=>Boolean(completed[s.id]?.(g)));const completedCount=done.filter(Boolean).length;const complete=completedCount===STEPS.length;const isAdvanced=advanced(g);const displayMode=complete?'complete':isAdvanced?'summary':'guide';const firstOpen=done.findIndex(v=>!v);const currentIndex=firstOpen<0?STEPS.length-1:firstOpen;const steps=STEPS.map((base,i)=>{const s=base.id==='first_store'?firstStoreVariant(base,g):base;const state=done[i]?'completed':displayMode==='summary'?'unavailable':i===currentIndex?'current':i<currentIndex?'blocked':'upcoming';return Object.freeze({...s,state,completed:done[i],current:displayMode==='guide'&&i===currentIndex&&!done[i],upcoming:displayMode==='guide'&&i>currentIndex&&!done[i]});});const currentStep=displayMode==='guide'?(steps[currentIndex]||steps[steps.length-1]):null;return Object.freeze({steps:Object.freeze(steps),completedCount,total:STEPS.length,progressLabel:`${completedCount}/${STEPS.length}`,complete,current:currentStep,displayMode,roleNote:'創業ガイドは固定順の学習用、Executive Secretaryは毎週の危険・機会の優先順位です。'});}
exports.STEPS=STEPS;exports.build=build;exports.acknowledgeDashboard=acknowledgeDashboard;exports._internals=Object.freeze({cashRunwayWeeks,hasImprovement,hasBusinessImprovement,hasStoreWorkforceImprovement,hasCorporateWorkforceImprovement,hasTrainingImprovement,hasOrganization,advanced});
})(__modules.foundingTutorial={});
})();
