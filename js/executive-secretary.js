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
  const rows=[],week=nf(g?.week,1),cash=nf(g?.companyCash),report=g?.lastReport||{},expenses=Math.max(0,nf(report.expenses)),profit=nf(report.profit),stores=arr(g?.stores),openStores=stores.filter(s=>s&&s.status==='open'),companyValue=Math.max(1,nf(helpers.companyValue, nf(g?.companyValue,0))),debt=nf(g?.companyDebt);
  const fixed=Math.max(expenses,openStores.reduce((a,s)=>a+Math.max(0,nf(s.rent)+nf(s.weeklyRent)+nf(s.payroll)+nf(s.fixedCost)),0),debt*.006,1_000_000);
  if(cash<0)rows.push(task('finance_cash_negative','critical','現金残高がマイナスです','会社現金が0円を下回っています。','放置すると資金ショートや倒産判定につながります。','bank','銀行','[data-screen="bank"],.screen'));
  else if(cash<fixed*2)rows.push(task('finance_cash_runway','critical','現金残高が固定費2週分を下回っています',`推定固定費 ${Math.round(fixed).toLocaleString('ja-JP')}円/週に対し現金余力が薄い状態です。`,'急な返済・仕入れ・赤字で資金ショートします。','bank','銀行','[data-screen="bank"],.screen'));
  if(profit<0&&cash<Math.abs(profit)*6)rows.push(task('finance_loss_runway','high','赤字が現金余力を削っています',`直近利益が ${Math.round(profit).toLocaleString('ja-JP')}円で、赤字継続時の余裕が短くなっています。`,'数週間で借入やコスト削減が必要になります。','report','決算','[data-screen="report"],.screen'));
  const loans=arr(g?.finance?.loans).filter(l=>l&&l.status==='active');
  const soon=loans.map(l=>({l,due:nf(l.nextPaymentWeek||l.maturityWeek||l.dueWeek,Infinity)-week})).filter(x=>x.due<=3).sort((a,b)=>a.due-b.due||String(a.l.loanID||a.l.id).localeCompare(String(b.l.loanID||b.l.id),'en'))[0];
  if(soon)rows.push(task('finance_debt_due','critical',`返済期限まであと${Math.max(0,soon.due)}週です`,'借入の次回返済または満期が近づいています。','現金不足時は延滞・信用低下・財務制限条項リスクが高まります。','bank','銀行','[data-screen="bank"],.screen'));
  if(loans.some(l=>nf(l.interestRate)>.12))rows.push(task('finance_high_interest','high','高金利借入があります','年率12%を超える借入が資金繰りを圧迫しています。','利益率が改善しても利息負担で成長投資が遅れます。','bank','銀行','[data-screen="bank"],.screen'));
  if(debt>companyValue*.55)rows.push(task('finance_debt_heavy','high','企業価値に対して負債が重いです','借入残高が企業価値の55%を超えています。','信用力低下や追加調達条件の悪化につながります。','bank','銀行','[data-screen="bank"],.screen'));
  const stockout=openStores.find(s=>nf(s.stockoutWeeks||s.stockoutRisk||s.inventoryShortage)>0||nf(s.inventory)<Math.max(1,nf(s.weeklyDemand))*0.5);
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
  if(g?.crisis?.active||g?.playerCrisis?.active||cash<0)rows.push(task('crisis_active','critical','経営危機への対応が必要です','危機状態または資金ショートが検出されています。','再建計画・債権者対応を遅らせると倒産に近づきます。','strategy','戦略','[data-player-crisis-ui],.screen'));
  if(openStores.length>=1&&cash>Math.max(10_000_000,fixed*8))rows.push(task('growth_expansion_capacity','opportunity','新店舗を出店できます','既存店舗と現金余力があり、出店候補を検討できます。','収益源を増やせますが、固定費も増えるため候補確認が必要です。','map','出店','.screen'));
  return sortTasks(stableDedupe(rows)).slice(0,5);
}
exports.LEVEL_RANK=Object.freeze(LEVEL_RANK);exports.generateTasks=generateTasks;exports.sortTasks=sortTasks;exports.stableDedupe=stableDedupe;
})(__modules.executiveSecretary={});
})();
