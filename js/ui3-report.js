// UI v3 report screen — docs/ui-v3/README.md 5.5 (UI3-7), hub type, read only.
//
// Card: sales, net income and ending cash for the chosen period (chips: this week / 13 weeks / quarter / year /
// 52 weeks; view state kept here). Rows open read-only sheets with the statement lines the current screen shows:
// profit and loss, balance sheet, cash flow, ratios, working capital, dividend capacity and the weekly history.
// The chart and the accounting glossary stay on the current screen ("ほかの詳細（現行の画面）").
//
// Presentation only. It reads the statements through modules.finance.buildStatements, exactly as the current
// screen does; there is no control here that changes the game.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-report.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const PERIODS=Object.freeze([['week','今週'],['13','13週'],['quarter','四半期'],['year','年度'],['52','52週']]);
const state={period:'13'};
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;
function signed(value,money){
  const amount=finite(value);
  return amount>0?`+${money(amount)}`:amount<0?`−${money(-amount)}`:money(0);
}
const direction=value=>finite(value)>0?' u-up':finite(value)<0?' u-down':'';
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end" aria-hidden="true">${esc(end)}</span></button>`;
const line=(label,value)=>`<div class="u-row"><span><b>${esc(label)}</b></span><span class="u-end u-money">${esc(value)}</span></div>`;

function statements(g){
  try{return modules.finance.buildStatements(g,state.period);}catch(error){return null;}
}

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const chips=`<nav class="u-chips" aria-label="期間" data-ui3-report="periods">${PERIODS.map(([id,label])=>`<button type="button" class="u-chip" data-ui3-report-period="${id}" aria-pressed="${id===state.period}">${label}</button>`).join('')}</nav>`;
  const fs=g.lastReport?statements(g):null;
  const card=fs?`<section class="u-card" aria-label="決算の要約" data-ui3-report="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>売上</span><b class="u-money">${esc(money(finite(fs.profitAndLoss.revenue)))}</b></div>`
    +`<div class="u-stat"><span>利益</span><b class="u-money${direction(fs.profitAndLoss.netIncome)}">${esc(signed(fs.profitAndLoss.netIncome,money))}</b></div>`
    +`<div class="u-stat"><span>現金</span><b class="u-money">${esc(money(finite(fs.cashFlow.endingCash)))}</b></div>`
    +`</div></section>`
    :'<div class="u-h2" data-ui3-report="none">1週進めると決算が作成されます。</div>';
  const items=fs?[['pl','損益計算書','売上から当期純利益まで'],['bs','貸借対照表','資産・負債・純資産'],['cf','キャッシュフロー計算書','営業・投資・財務'],['ratios','財務指標','利益率・安全性'],['wc','運転資本','売掛金・買掛金・CCC'],['dividend','配当可能額','理論上・安全額'],['history','週次履歴','直近30週']]
    .map(([id,title,note])=>row(` data-ui3-report-sheet="${id}"`,title,note)).join(''):'';
  const more=row(' data-ui3-current="report"','ほかの詳細（現行の画面）','チャート、会計用語、13週の資金繰り予測');
  return chips+card+(items?`<h2 class="u-h2">決算の内訳</h2><div class="u-list" data-ui3-report="statements">${items}</div>`:'')
    +`<h2 class="u-h2">そのほか</h2><div class="u-list">${more}</div>`;
}

function sheetParts(id){
  const {g,money}=context;
  const fs=statements(g);
  if(!fs)return null;
  const {profitAndLoss:pl,balanceSheet:bs,cashFlow:cf,workingCapital:wc,ratios:rat,dividendCapacity:div}=fs;
  const period=PERIODS.find(([value])=>value===state.period)?.[1]||'';
  const lines=pairs=>`<div class="u-list" data-ui3-report="lines">${pairs.map(([label,value])=>line(label,money(finite(value)))).join('')}</div>`;
  switch(id){
    case 'pl':return {title:'損益計算書',subtitle:period,body:lines([['売上高',pl.revenue],['売上原価',pl.costOfSales],['売上総利益',pl.grossProfit],['人件費',pl.payroll],['広告宣伝費',pl.advertising],['研究開発費',pl.researchAndDevelopment],['家賃',pl.rent],['維持費',pl.maintenance],['本社費',pl.headOfficeExpense],['その他営業費用',pl.otherOperating],['EBITDA',pl.ebitda],['減価償却費',pl.depreciation],['営業利益',pl.operatingIncome],['支払利息',pl.interestExpense],['税引前利益',pl.pretaxIncome],['法人税等',pl.taxExpense],['当期純利益',pl.netIncome]])};
    case 'bs':return {title:'貸借対照表',subtitle:'期末',body:lines([['現金及び預金',bs.assets.cashAndDeposits],['売掛金',bs.assets.accountsReceivable],['棚卸資産',bs.assets.inventory],['店舗設備',bs.assets.storeEquipment],['建物・土地',bs.assets.buildingsAndLand],['投資有価証券',bs.assets.investmentSecurities],['子会社・関連会社投資',bs.assets.subsidiariesAndAffiliates],['のれん',bs.assets.goodwill],['減価償却累計額',-finite(bs.assets.accumulatedDepreciation)],['総資産',bs.assets.totalAssets],['未払税金',bs.liabilities.accruedTaxes],['短期借入金',bs.liabilities.shortTermDebt],['総負債',bs.liabilities.totalLiabilities],['利益剰余金',bs.equity.retainedEarnings],['純資産',bs.equity.totalEquity]])};
    case 'cf':return {title:'キャッシュフロー計算書',subtitle:period,body:lines([['税引前利益',cf.pretaxIncome],['減価償却費',cf.depreciation],['利息支払',-finite(cf.interestPaid)],['法人税支払',-finite(cf.taxPaid)],['営業CF合計',cf.operatingCashFlow],['店舗・設備取得',cf.storeAndEquipmentAcquisition],['投資有価証券取得',cf.investmentSecuritiesPurchase],['投資CF合計',cf.investingCashFlow],['借入',cf.debtBorrowing],['借入返済',cf.debtRepayment],['配当',cf.dividend],['財務CF合計',cf.financingCashFlow],['現金増減額',cf.netCashChange],['現金期首残高',cf.openingCash],['現金期末残高',cf.endingCash]])};
    case 'ratios':return {title:'財務指標',subtitle:period,body:`<div class="u-list" data-ui3-report="lines">${[['売上総利益率',percent(rat.grossProfitMargin)],['EBITDAマージン',percent(rat.ebitdaMargin)],['営業利益率',percent(rat.operatingMargin)],['純利益率',percent(rat.netProfitMargin)],['ROA',percent(rat.roa)],['ROE',percent(rat.roe)],['自己資本比率',percent(rat.equityRatio)],['流動比率',percent(rat.currentRatio)],['D/Eレシオ',rat.deRatio===null||rat.deRatio===undefined?'—':Number(rat.deRatio).toFixed(2)],['インタレスト・カバレッジ',rat.interestCoverageRatio===null||rat.interestCoverageRatio===undefined?'—':Number(rat.interestCoverageRatio).toFixed(1)]].map(([label,value])=>line(label,value)).join('')}</div>`};
    case 'wc':return {title:'運転資本',subtitle:'期末',body:`<div class="u-list" data-ui3-report="lines">${[['売掛金',money(finite(wc.accountsReceivable))],['買掛金',money(finite(wc.accountsPayable))],['未払費用',money(finite(wc.accruedExpenses))],['未払税金',money(finite(wc.accruedTaxes))],['運転資本',money(finite(wc.workingCapital))],['CCC',`${wc.cashConversionCycleDays}日`]].map(([label,value])=>line(label,value)).join('')}</div>`};
    case 'dividend':return {title:'配当可能額',subtitle:period,body:lines([['理論上',div.theoreticalDistributable],['安全額',div.safeDistributable],['配当後現金',div.cashAfterDividend],['返済余力',div.repaymentCapacityAfterDividend]])};
    case 'history':{
      const history=(g.reports||[]).slice(-30).reverse().map(item=>`<div class="u-row"><span><b>第${esc(item.week)}週</b><small>売上 ${esc(money(finite(item.sales)))}</small></span><span class="u-end u-money${direction(item.profit)}">${esc(signed(item.profit,money))}</span></div>`).join('');
      return {title:'週次履歴',subtitle:'直近30週の利益',body:history?`<div class="u-list" data-ui3-report="lines">${history}</div>`:'<div class="u-h2">まだ履歴がありません。</div>'};
    }
    default:return null;
  }
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const period=target.closest('[data-ui3-report-period]');
  if(period){
    state.period=period.dataset.ui3ReportPeriod;
    globalThis.document.querySelector('[data-ui3-all-screens] [data-action="tab"][data-tab="report"]')?.click();
    return;
  }
  const open=target.closest('[data-ui3-report-sheet]');
  if(open){
    const parts=sheetParts(open.dataset.ui3ReportSheet);
    const root=modalRoot();
    if(parts&&root)root.innerHTML=modules.ui3.sheet({eyebrow:'決算',...parts,body:`<span hidden data-ui3-report-sheet-open></span>${parts.body}`,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'});
  }
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('report',{render});
})();
