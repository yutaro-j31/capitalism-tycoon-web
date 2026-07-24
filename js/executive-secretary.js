// Script boundary: js/executive-secretary.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before executive-secretary.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.executiveSecretary)throw new Error('Capitalism Tycoon executiveSecretary module is already registered.');
(function(exports){
const LEVEL_RANK={critical:0,high:1,medium:2,opportunity:3};
const LEVEL_LABEL={critical:'最優先',high:'重要',medium:'改善',opportunity:'機会'};
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];
function task(id,priority,title,reason,risk,targetTab,targetLabel,focus){return Object.freeze({id,priority,priorityLabel:LEVEL_LABEL[priority]||priority,title,reason,risk,targetTab,targetLabel,focus});}
function stableDedupe(rows){const seen=new Set(),out=[];for(const row of rows){const key=`${row.id}:${row.targetTab}`;if(seen.has(key))continue;seen.add(key);out.push(row);}return out;}
function sortTasks(rows){return rows.slice().sort((a,b)=>(LEVEL_RANK[a.priority]??9)-(LEVEL_RANK[b.priority]??9)||String(a.id).localeCompare(String(b.id),'en'));}
function generateTasks(g,helpers={}){
  const rows=[],week=nf(g?.week,1),cash=nf(g?.companyCash),report=g?.lastReport||{},expenses=Math.max(0,nf(report.expenses)),profit=nf(report.profit),stores=arr(g?.stores),openStores=stores.filter(s=>s&&s.status==='open'),companyValue=Math.max(1,nf(helpers.companyValue,nf(g?.companyValue,0))),debt=nf(g?.companyDebt);
  const fixed=Math.max(expenses,openStores.reduce((a,s)=>a+Math.max(0,nf(s.rent)+nf(s.weeklyRent)+nf(s.payroll)+nf(s.fixedCost)),0),debt*.006,1_000_000);
  if(cash<0)rows.push(task('finance_cash_negative','critical','現金残高がマイナスです','会社現金が0円を下回っています。','放置すると資金ショートや倒産判定につながります。','bank','銀行','[data-screen="bank"],.screen'));
  else if(cash<fixed*2)rows.push(task('finance_cash_runway','critical','現金残高が固定費2週分を下回っています',`推定固定費 ${Math.round(fixed).toLocaleString('ja-JP')}円/週に対し現金余力が薄い状態です。`,'急な返済・仕入れ・赤字で資金ショートします。','bank','銀行','[data-screen="bank"],.screen'));
  if(profit<0&&cash<Math.abs(profit)*6)rows.push(task('finance_loss_runway','high','赤字が現金余力を削っています',`直近利益が ${Math.round(profit).toLocaleString('ja-JP')}円で、赤字継続時の余裕が短くなっています。`,'数週間で借入やコスト削減が必要になります。','report','決算','[data-screen="report"],.screen'));
  const loans=arr(g?.finance?.loans).filter(l=>l&&l.status==='active');
  const soon=loans.map(l=>({l,due:nf(l.nextPaymentWeek||l.maturityWeek||l.dueWeek,Infinity)-week})).filter(x=>x.due<=3).sort((a,b)=>a.due-b.due||String(a.l.loanID||a.l.id).localeCompare(String(b.l.loanID||b.l.id),'en'))[0];
  if(soon)rows.push(task('finance_debt_due','critical',`返済期限まであと${Math.max(0,soon.due)}週です`,'借入の次回返済または満期が近づいています。','現金不足時は延滞・信用低下・財務制限条項リスクが高まります。','bank','銀行','[data-screen="bank"],.screen'));
  if(loans.some(l=>nf(l.interestRate)>.12))rows.push(task('finance_high_interest','high','高金利借入があります','年率12%を超える借入が資金繰りを圧迫しています。','利益率が改善しても利息負担で成長投資が遅れます。','bank','銀行','[data-screen="bank"],.screen'));
  if(debt>companyValue*.55)rows.push(task('finance_debt_heavy','high','企業価値に対して負債が重いです','借入残高が企業価値の55%を超えています。','信用力低下や追加調達条件の悪化につながります。','bank','銀行','[data-screen="bank"],.screen'));
  const stockout=openStores.find(s=>nf(s.stockoutWeeks||s.stockoutRisk||s.inventoryShortage)>0||nf(s.inventory)<Math.max(1,nf(s.weeklyDemand))*.5);
  if(stockout)rows.push(task('supply_stockout','high','在庫切れリスクが高まっています',`${stockout.name||'店舗'}の在庫または供給指標が不足しています。`,'販売機会損失と顧客満足低下が発生します。','business','事業','[data-supply-store-card],.supply-store-card,.screen'));
  const overstock=openStores.find(s=>nf(s.inventory)>Math.max(20,nf(s.weeklyDemand)*6));
  if(overstock)rows.push(task('supply_overstock','medium','過剰在庫を確認してください',`${overstock.name||'店舗'}の在庫が需要に対して多くなっています。`,'廃棄・保管負担で利益率が悪化します。','business','事業','[data-supply-store-card],.supply-store-card,.screen'));
  const lossStore=openStores.filter(s=>nf(s.lastProfit)<0).sort((a,b)=>nf(a.lastProfit)-nf(b.lastProfit))[0];
  if(lossStore)rows.push(task('store_loss','high','赤字店舗があります',`${lossStore.name||'店舗'}の直近利益が赤字です。`,'放置すると固定費負担が続き、閉店候補になります。','business','事業','.market-store-card,.screen'));
  if(nf(g?.overtimeRisk)>.65||nf(g?.employeeSatisfaction,100)<40)rows.push(task('workforce_fatigue','high','従業員疲労が危険水準です','残業リスクまたは社員満足度が悪化しています。','離職・生産性低下・店舗品質低下が発生します。','office','本社','[data-workforce-ui],.workforce-card,.screen'));
  if(arr(g?.keyPersonnel).some(p=>nf(p.retentionRisk)>.65))rows.push(task('workforce_retention','high','重要社員の離職リスクがあります','キーパーソンの離職リスクが高まっています。','退職すると部門能力や成長速度が低下します。','office','本社','[data-workforce-ui],.workforce-card,.screen'));
  if(arr(g?.productVentures).some(p=>p&&p.status==='completed'))rows.push(task('growth_product_ready','medium','商品開発が完了しています','完成済みプロダクトがあります。','投入・改善を確認すると収益機会を取り込めます。','business','事業','.screen'));
  if(nf(g?.competitorOwnedRatio)>.15||arr(g?.competitorEventLog).length)rows.push(task('growth_competitor_alert','medium','競合の動きを確認してください','競合イベントまたは株式保有圧力が検出されています。','市場シェア低下や買収圧力の早期発見につながります。','rivals','競合','.competitor-card,.screen'));
  if(!g?.publicCompany&&helpers.ipoReady)rows.push(task('growth_ipo_ready','opportunity','IPO条件を達成しています','上場に必要な条件を満たしています。','資金調達と株式市場機能を解放できます。','office','本社','.screen'));
  for(const sub of arr(g?.maSubsidiaries).filter(s=>s&&s.status==='active')){
    if(sub.pmiStatus==='planning')rows.push(task(`ma_pmi_planning_${sub.id}`,'high',`買収した${sub.name||'子会社'}のPMI方針が未決定です`,'買収後統合の方針が未選択で、シナジー実現が始まっていません。','方針決定が遅れると統合混乱と機会損失が続きます。','ma','M&A',`[data-ma-subsidiary="${sub.id}"]`));
    if(sub.pmiStatus==='stalled')rows.push(task(`ma_pmi_stalled_${sub.id}`,'critical',`${sub.name||'子会社'}の買収後統合が停滞しています`,'PMI health低下により統合が停滞しています。','追加支援なしでは混乱コストとシナジー未実現が続きます。','ma','M&A',`[data-ma-subsidiary="${sub.id}"]`));
  }
  if(g?.crisis?.active||g?.playerCrisis?.active||cash<0)rows.push(task('crisis_active','critical','経営危機への対応が必要です','危機状態または資金ショートが検出されています。','再建計画・債権者対応を遅らせると倒産に近づきます。','strategy','戦略','[data-player-crisis-ui],.screen'));
  if(openStores.length>=1&&cash>Math.max(10_000_000,fixed*8))rows.push(task('growth_expansion_capacity','opportunity','新店舗を出店できます','既存店舗と現金余力があり、出店候補を検討できます。','収益源を増やせますが、固定費も増えるため候補確認が必要です。','map','出店','.screen'));
  for(const deal of arr(g?.maDealRooms)){
    if(!deal||['acquired','withdrawn','expired','lost'].includes(deal.status))continue;
    const target=arr(g?.acquisitionTargets).find(t=>t&&t.id===deal.targetID)||{};
    const name=target.name||deal.targetID||'候補企業';
    const focus=`[data-ma-deal-room="${deal.id}"]`;
    const approvalFocus=`${focus} [data-ma-board-approve]`;
    const closingFocus=`${focus} [data-action="ma-close-deal"]`;
    if(deal.activeDiligence?.status==='completed')rows.push(task(`ma_dd_completed_${deal.id}`,'high',`${name}のデューデリジェンスが完了しました`,'調査結果と企業価値ブリッジを確認できます。','提示価格と撤退判断を更新してください。','ma','M&A',focus));
    if(deal.status==='countered')rows.push(task(`ma_counter_${deal.id}`,'high',`${name}からカウンターオファーが届いています`,'売り手が修正条件を提示しています。','期限前に受諾・再提示・撤退を選んでください。','ma','M&A',focus));
    if(deal.competingBid?.status==='active')rows.push(task(`ma_competing_bid_${deal.id}`,'critical',`${name}の買収案件に競合入札が入りました`,'競合買い手が売り手に条件を提示しています。','価格・方法・スピードの見直しが必要です。','ma','M&A',focus));
    if(deal.status==='accepted'){const ba=globalThis.__capitalismTycoonModules?.maBoardApproval,memo=ba?.buildMemo?.(g,deal,{engine:helpers.engine,companyValue:helpers.companyValue,borrowRate:helpers.borrowRate,creditLimit:helpers.creditLimit,maPortfolio:helpers.maPortfolio}),valid=ba?.validateApproval?.(g,deal,memo)?.valid,near=(memo&&Math.min(memo.weeksRemaining??99,(memo.approvalExpiresWeek??99)-nf(g?.week,1))<=1),severity=near?'critical':'high';if(deal.acceptedTerms?.method!=='shareSwap'&&!deal.acquisitionFinancingPlan)rows.push(task(`ma_financing_${deal.id}`,'high',`${name}の買収資金調達案が未決定です`,'手元現金・借入・公募増資の組み合わせを取締役会前に決める必要があります。','未選択のままでは承認と最終契約に進めません。','ma','M&A',`${focus} [data-ma-financing]`));else if(!valid&&memo?.blockers?.some?.(b=>b.id==='funding-plan-invalid'))rows.push(task(`ma_financing_invalid_${deal.id}`,'critical',`${name}の買収資金調達能力が不足しています`,'選択済み資金調達案が最新の信用・流動性条件を満たしていません。','条件を見直さないとクロージングできません。','ma','M&A',`${focus} [data-ma-financing]`));else rows.push(valid?task(`ma_accepted_${deal.id}`,severity,`${name}の最終契約が承認済みです`,'取締役会承認済みです。最終契約で既存の買収会計とPMIへ接続します。','期限前に条件不一致・資金不足がないか確認してください。','ma','M&A',closingFocus):task(`ma_board_${deal.id}`,severity,`${name}の取締役会承認が必要です`,'売り手受諾後も取締役会承認まではクロージングできません。','価格・方法・現金余力・DD・PMI余力を確認してください。','ma','M&A',approvalFocus));}
    if(nf(deal.deadlineWeek)-nf(g?.week)<=2)rows.push(task(`ma_deadline_${deal.id}`,'high',`${name}のM&A期限が近づいています`,'案件期限まで残り2週以内です。','未成立のまま期限を迎えると失効または競合敗北になります。','ma','M&A',focus));
  }
  return sortTasks(stableDedupe(rows)).slice(0,5);
}
exports.LEVEL_RANK=Object.freeze(LEVEL_RANK);exports.generateTasks=generateTasks;exports.sortTasks=sortTasks;exports.stableDedupe=stableDedupe;
})(__modules.executiveSecretary={});
if(!__modules.ceoDashboard){
(function(exports){
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];
const ratio=(v,max)=>max>0?Math.max(0,Math.min(1,nf(v)/max)):0;
const pct=v=>`${Math.round(Math.max(0,Math.min(1,nf(v)))*100)}%`;
const openStores=g=>arr(g?.stores).filter(s=>s&&s.status==='open');
function companyJourney(g,helpers={}){const defs=arr(helpers.missions),done=new Set(arr(g?.completedMissionIDs)),active=new Set(arr(g?.activeMissionIDs));const total=defs.length||Math.max(1,done.size+active.size);const completed=defs.length?defs.filter(m=>done.has(m.id)).length:done.size;const next=defs.find(m=>active.has(m.id)&&!done.has(m.id))||defs.find(m=>!done.has(m.id))||null;return Object.freeze({completed,total,rate:ratio(completed,total),rateLabel:pct(ratio(completed,total)),nextGoal:next?.title||'自由成長フェーズ',remaining:Math.max(0,total-completed)});}
function financialSummary(g,helpers={}){const r=g?.lastReport||{},snap=arr(g?.finance?.weeklySnapshots).slice().sort((a,b)=>nf(b.week)-nf(a.week))[0]||{};const sales=nf(r.sales,nf(snap.revenue)),operatingProfit=nf(r.operatingProfit,nf(r.profit,nf(snap.operatingProfit))),netIncome=nf(r.netIncome,nf(r.profit,nf(snap.netIncome))),cash=nf(g?.companyCash),fcf=nf(snap.freeCashFlow,nf(r.cashFlow,nf(r.profit))),equity=Math.max(1,nf(g?.finance?.balances?.equity,nf(helpers.companyValue)-nf(g?.companyDebt)));const invested=Math.max(1,equity+nf(g?.companyDebt)-cash);return Object.freeze({sales,operatingProfit,netIncome,cash,fcf,roe:netIncome/equity,roic:operatingProfit/invested});}
function capitalAllocation(g,helpers={}){const score=nf(g?.finance?.capitalAllocationPolicy?.executionScore,nf(helpers.capitalScore));return Object.freeze({score,dividend:nf(g?.dividendPerShare)*Math.max(0,nf(g?.sharesOut)-nf(g?.treasuryBuybackShares)),buyback:nf(g?.finance?.balances?.treasuryStock),investment:arr(g?.productVentures).filter(x=>x&&x.status==='developing').length+arr(g?.startups).filter(x=>nf(x?.ownedCompany)>0).length,debtRepayment:arr(g?.finance?.loans).filter(l=>l&&l.status==='active').reduce((a,l)=>a+nf(l.scheduledPrincipalPayment,nf(l.weeklyPrincipalPayment)),0)});}
function risks(g,helpers={}){const week=nf(g?.week,1),cash=nf(g?.companyCash),profit=nf(g?.lastReport?.profit),rows=[];const add=(id,label,detail,sev)=>rows.push({id,label,detail,severity:sev});if(cash<0)add('cash-short','資金ショート','会社現金がマイナスです。',0);else if(cash<Math.max(1000000,Math.abs(profit)*4))add('cash-runway','資金ショート予兆','現金余力が薄い状態です。',1);const loan=arr(g?.finance?.loans).filter(l=>l&&l.status==='active').map(l=>({l,due:nf(l.nextPaymentWeek||l.maturityWeek||l.dueWeek,Infinity)-week})).sort((a,b)=>a.due-b.due)[0];if(loan&&loan.due<=4)add('debt-due','借入期限',`返済・満期まであと${Math.max(0,loan.due)}週です。`,loan.due<=1?0:1);if(profit<0)add('loss','赤字','直近期が赤字です。',1);if(nf(g?.employeeSatisfaction,100)<40||nf(g?.overtimeRisk)>0.65)add('workforce','従業員','満足度または疲労が悪化しています。',2);const stock=openStores(g).find(s=>nf(s.inventory)<Math.max(1,nf(s.weeklyDemand))*0.5||nf(s.stockoutWeeks)>0);if(stock)add('inventory','在庫',`${stock.name||'店舗'}の在庫不足リスクがあります。`,2);return Object.freeze(rows.sort((a,b)=>a.severity-b.severity||a.id.localeCompare(b.id,'en')));}
function growth(g,helpers={}){const rows=[];if(openStores(g).length>=1&&nf(g?.companyCash)>10000000)rows.push({id:'store',label:'新店舗候補',targetTab:'map'});if(!g?.publicCompany&&arr(helpers.ipoMissingReasons).length===0)rows.push({id:'ipo',label:'IPO条件',targetTab:'office'});if(arr(g?.acquisitionTargets).length)rows.push({id:'ma',label:'M&A候補',targetTab:'ma'});if(arr(g?.productVentures).some(p=>p&&p.status!=='released'))rows.push({id:'product',label:'商品開発',targetTab:'business'});if(arr(g?.overseasSubsidiaries).length||g?.departments?.overseas)rows.push({id:'overseas',label:'海外展開',targetTab:'overseas'});return Object.freeze(rows);}


function safeNumber(v,f=0){const n=nf(v,f);return n>=0?n:f;}
function safeHealth(v){return Math.max(0,Math.min(100,Math.round(nf(v,100))));}
function maGovernance(g,helpers={}){const summary=helpers.maPortfolio;if(!summary)return Object.freeze({available:false,activeDeals:0,diligenceDeals:0,negotiatingDeals:0,acceptedDeals:0,subsidiaries:0,planningSubsidiaries:0,integratingSubsidiaries:0,completedSubsidiaries:0,portfolioHealth:100,criticalSubsidiaries:0,watchSubsidiaries:0,totalAcquisitionPrice:0,identifiableNetAssetsBookValue:0,goodwillBookValue:0,weeklyRealizedSynergy:0,nextAction:Object.freeze({id:'source-deals',label:'買収候補探索',targetTab:'ma',priority:6})});const next=summary.nextAction?Object.freeze({id:String(summary.nextAction.id||'review-deals'),label:String(summary.nextAction.label||'案件確認'),targetTab:String(summary.nextAction.targetTab||'ma'),priority:nf(summary.nextAction.priority,9)}):Object.freeze({id:'review-deals',label:'案件確認',targetTab:'ma',priority:5});return Object.freeze({available:true,activeDeals:safeNumber(summary.activeDeals),diligenceDeals:safeNumber(summary.diligenceDeals),negotiatingDeals:safeNumber(summary.negotiatingDeals),acceptedDeals:safeNumber(summary.acceptedDeals),subsidiaries:safeNumber(summary.subsidiaries),planningSubsidiaries:safeNumber(summary.planningSubsidiaries),integratingSubsidiaries:safeNumber(summary.integratingSubsidiaries),completedSubsidiaries:safeNumber(summary.completedSubsidiaries),portfolioHealth:safeHealth(summary.portfolioHealth),criticalSubsidiaries:safeNumber(summary.criticalSubsidiaries),watchSubsidiaries:safeNumber(summary.watchSubsidiaries),totalAcquisitionPrice:safeNumber(summary.totalAcquisitionPrice),identifiableNetAssetsBookValue:safeNumber(summary.identifiableNetAssetsBookValue),goodwillBookValue:safeNumber(summary.goodwillBookValue),weeklyRealizedSynergy:safeNumber(summary.weeklyRealizedSynergy),nextAction:next});}

function deltaLabel(v,formatter){const n=nf(v);if(n===0)return formatter?'変化なし':'0';const sign=n>0?'+':'−';const abs=Math.abs(n);return `${sign}${formatter?formatter(abs):Math.round(abs).toLocaleString('ja-JP')}`;}
function latestTwoReports(g){return arr(g?.reports).filter(r=>r&&Number.isFinite(Number(r.week))).slice().sort((a,b)=>nf(b.week)-nf(a.week)).slice(0,2);}
function cashFromSnapshot(g,week){const snap=arr(g?.finance?.weeklySnapshots).find(s=>s&&nf(s.week)===nf(week));if(!snap)return null;const cash=Number.isFinite(Number(snap.actualCompanyCash))?nf(snap.actualCompanyCash):(Number.isFinite(Number(snap.endingCash))?nf(snap.endingCash):null);return cash;}
function metric(id,label,value,delta,hasDelta,positiveTone='good',negativeTone='warn'){return Object.freeze({id,label,value,delta:hasDelta?delta:0,hasDelta:!!hasDelta,tone:!hasDelta?'neutral':delta>0?positiveTone:delta<0?negativeTone:'neutral'});}
function weeklyImpact(g,helpers={}){
  const reports=latestTwoReports(g),latest=reports[0]||g?.lastReport||{},previous=reports[1]||{},hasPrevious=reports.length>1;
  const week=nf(latest.week,nf(g?.week,1)),prevWeek=nf(previous.week,week-1);
  const latestCash=cashFromSnapshot(g,week),previousCash=hasPrevious?cashFromSnapshot(g,prevWeek):null;
  const history=arr(g?.companyValueHistory).map(n=>nf(n,NaN)).filter(Number.isFinite);
  const hasValueDelta=history.length>1;
  const companyValue=history.length?history[history.length-1]:nf(helpers.companyValue);
  const metrics=[
    metric('sales','売上',nf(latest.sales),nf(latest.sales)-nf(previous.sales),hasPrevious,'good','warn'),
    metric('profit','利益',nf(latest.profit,nf(latest.netIncome)),nf(latest.profit,nf(latest.netIncome))-nf(previous.profit,nf(previous.netIncome)),hasPrevious,'good','danger'),
    metric('cash','会社現金',latestCash===null?nf(g?.companyCash):latestCash,latestCash===null||previousCash===null?0:latestCash-previousCash,hasPrevious&&latestCash!==null&&previousCash!==null,'good','warn'),
    metric('value','企業価値',companyValue,hasValueDelta?history[history.length-1]-history[history.length-2]:0,hasValueDelta,'good','warn')
  ];
  const highlights=[];
  if(hasPrevious){for(const m of metrics){if(m.hasDelta&&m.delta!==0)highlights.push({id:m.id,label:m.label,delta:m.delta,tone:m.tone});}if(!highlights.length)highlights.push({id:'no-change',label:'主要指標',delta:0,tone:'neutral'});}
  return Object.freeze({week,metrics:Object.freeze(metrics),highlights:Object.freeze(highlights.slice(0,4).map(Object.freeze)),news:Object.freeze(arr(g?.news).slice(0,4)),hasPrevious});
}
function build(g,helpers={}){const stores=openStores(g);return Object.freeze({overview:Object.freeze({companyName:g?.companyName||'会社',years:Math.max(0,Math.floor((nf(g?.week,1)-1)/52)),cash:nf(g?.companyCash),companyValue:nf(helpers.companyValue),debt:nf(g?.companyDebt),stores:stores.length,employees:nf(g?.employeeCount,arr(g?.workforceTeams).reduce((a,t)=>a+nf(t?.headcount),0)),credit:nf(g?.companyCredit),ipo:g?.publicCompany?`上場 ${g?.ticker||''}`:'未上場'}),journey:companyJourney(g,helpers),finance:financialSummary(g,helpers),allocation:capitalAllocation(g,helpers),risks:risks(g,helpers),growth:growth(g,helpers),ma:maGovernance(g,helpers)});}
exports.build=build;exports.companyJourney=companyJourney;exports.financialSummary=financialSummary;exports.capitalAllocation=capitalAllocation;exports.risks=risks;exports.growth=growth;exports.maGovernance=maGovernance;exports.weeklyImpact=weeklyImpact;exports.deltaLabel=deltaLabel;
})(__modules.ceoDashboard={});
}
})();