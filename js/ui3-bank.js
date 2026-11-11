// UI v3 bank screen — docs/ui-v3/README.md 5.5 (UI3-7), hub type.
//
// Card: debt, the next week's repayment (company) or the account's cash (personal), borrowing capacity. An
// account switch (company / personal) is view state. Rows: borrow, repay (the amount sheet of UI3-9a is their
// confirmation: it shows the balance after and the remaining capacity or cash, through setAmountContext's
// `preview`), interest rate and credit score, the loan list and the 13-week cash forecast (read-only sheets).
//
// Presentation only. Every control dispatches an existing `data-action`; nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.setAmountContext)throw new Error('js/ui3-shell.js (with the amount sheet) must be loaded before ui3-bank.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const state={account:'company'};
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=value=>`${(finite(value)*100).toFixed(1)}%`;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end" aria-hidden="true">${esc(end)}</span></button>`;
const plain=(title,note,end='')=>`<div class="u-row"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></div>`;

// The numbers of one account, read from the same engine calls the current bank screen uses.
function figures(ctx){
  const {g,engine}=ctx;
  if(state.account==='company'){
    const limit=finite(engine.companyCreditLimit?.()),debt=finite(g.companyDebt),cash=finite(g.companyCash);
    return {name:'会社',debt,limit,cash,capacity:Math.max(0,limit-debt),rate:finite(engine.companyBorrowRate?.()),extraLabel:'信用スコア',extra:`${finite(g.companyCredit).toFixed(0)}/100`};
  }
  const limit=finite(engine.personalCreditLimit?.()),debt=finite(g.personalDebt),cash=finite(g.personalCash);
  return {name:'個人',debt,limit,cash,capacity:Math.max(0,limit-debt),rate:finite(engine.personalBorrowRate?.()),extraLabel:'',extra:''};
}
function nextRepayment(ctx){
  try{
    const forecast=modules.finance?.buildStatements?.(ctx.g,'13')?.forecast;
    const first=forecast?.rows?.[0];
    return first?finite(first.debtRepayment)+finite(first.interest):0;
  }catch(error){return 0;}
}

function render(ctx){
  context=ctx;
  const {money}=ctx;
  const f=figures(ctx);
  const company=state.account==='company';
  const third=company?{label:'週の返済',value:money(nextRepayment(ctx))}:{label:'個人の現金',value:money(f.cash)};
  const seg=`<div class="u-seg" role="group" aria-label="口座" data-ui3-bank="account">`
    +`<button type="button" data-ui3-bank-account="company" aria-pressed="${company}">会社</button>`
    +`<button type="button" data-ui3-bank-account="personal" aria-pressed="${!company}">個人</button></div>`;
  const card=`<section class="u-card" aria-label="${f.name}の借入" data-ui3-bank="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>借入残高</span><b class="u-money">${esc(money(f.debt))}</b></div>`
    +`<div class="u-stat"><span>${third.label}</span><b class="u-money">${esc(third.value)}</b></div>`
    +`<div class="u-stat"><span>借入余力</span><b class="u-money">${esc(money(f.capacity))}</b></div>`
    +`</div></section>`;
  const action=name=>` data-action="${name}-${state.account}" data-ui3-bank-amount="${name}"`;
  const operations=row(action('borrow')+(f.capacity>=1?'':' disabled'),`${f.name}で借りる`,f.capacity>=1?`借入余力 ${money(f.capacity)}`:'借入余力がありません')
    +row(action('repay')+(f.debt>=1&&f.cash>=1?'':' disabled'),`${f.name}の借入を返す`,f.debt>=1?`借入残高 ${money(f.debt)}`:'借入はありません');
  const info=plain('金利',`${f.name}の借入`,percent(f.rate))+(f.extraLabel?plain(f.extraLabel,'',f.extra):'');
  const more=row(' data-ui3-bank="loans"','借入金の一覧',`${(ctx.g.finance?.loans||[]).length}件`)
    +row(' data-ui3-bank="forecast"','13週の資金繰り予測','週ごとの現金・入金・返済');
  return seg+card+`<h2 class="u-h2">操作</h2><div class="u-list" data-ui3-bank="operations">${operations}</div>`
    +`<h2 class="u-h2">${f.name}の条件</h2><div class="u-list" data-ui3-bank="terms">${info}</div>`
    +`<h2 class="u-h2">そのほか</h2><div class="u-list" data-ui3-bank="more">${more}</div>`;
}

// ---- amount sheet context (README 5.7) ----------------------------------------------------------
function describeAmount(kind){
  const {money}=context;
  const f=figures(context);
  const wallet=state.account;
  if(kind==='borrow'){
    return {unit:'円',wallet,direction:'receive',max:f.capacity,
      note:`借入余力 ${money(f.capacity)}（金利 ${percent(f.rate)}）`,
      preview:value=>[{label:'借入後の残高',value:money(f.debt+value)},{label:'残りの借入余力',value:money(Math.max(0,f.capacity-value)),tone:value>f.capacity?'down':undefined}]};
  }
  const repayable=Math.max(0,Math.min(f.debt,f.cash));
  return {unit:'円',wallet,direction:'spend',max:repayable,
    note:`返済できる額 ${money(repayable)}`,
    preview:value=>{const paid=Math.min(value,f.debt);return [{label:'返済後の残高',value:money(f.debt-paid)},{label:`実行後の${f.name}の現金`,value:money(f.cash-paid),tone:f.cash-paid<0?'down':undefined}];}};
}

// ---- sheets ------------------------------------------------------------------------------------
function show(parts){const root=modalRoot();if(root)root.innerHTML=modules.ui3.sheet(parts);}
function loansSheet(){
  const {g,money}=context;
  const loans=g.finance?.loans||[];
  const rows=loans.map(loan=>plain(String(loan.loanID),`金利 ${percent(loan.interestRate)} · 次回 第${loan.nextPaymentWeek}週 · ${loan.status}`,money(finite(loan.outstandingPrincipal)))).join('');
  show({eyebrow:'会社',title:'借入金の一覧',subtitle:`${loans.length}件`,body:`<span hidden data-ui3-bank-sheet></span>${rows?`<div class="u-list" data-ui3-bank="loan-rows">${rows}</div>`:'<div class="u-h2">会社借入はありません。</div>'}`,
    actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'});
}
function forecastSheet(){
  const {g,money}=context;
  let forecast=null;
  try{forecast=modules.finance?.buildStatements?.(g,'13')?.forecast;}catch(error){forecast=null;}
  const rows=(forecast?.rows||[]).map(item=>plain(`第${item.week}週`,`入金 ${money(finite(item.expectedOperatingReceipts))} / 返済 ${money(finite(item.debtRepayment)+finite(item.interest))}`,money(finite(item.endingCash)))).join('');
  const warnings=(forecast?.warnings||[]).map(text=>`<div class="u-h2" data-ui3-bank="warning">${esc(text)}</div>`).join('');
  show({eyebrow:'会社',title:'13週の資金繰り予測',subtitle:'週末の現金の見込み',body:`<span hidden data-ui3-bank-sheet></span>${warnings}${rows?`<div class="u-list" data-ui3-bank="forecast-rows">${rows}</div>`:'<div class="u-h2">予測を作れません。</div>'}`,
    actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'});
}

// ---- events ------------------------------------------------------------------------------------
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const amount=target.closest('[data-ui3-bank-amount]');
  if(amount&&!amount.disabled){modules.ui3.setAmountContext(describeAmount(amount.dataset.ui3BankAmount));return;}
  const account=target.closest('[data-ui3-bank-account]');
  if(account){state.account=account.dataset.ui3BankAccount;const open=globalThis.document.querySelector('[data-ui3-all-screens] [data-action="tab"][data-tab="bank"]');open?.click();return;}
  const control=target.closest('[data-ui3-bank]');
  if(!control||control.disabled)return;
  if(control.dataset.ui3Bank==='loans')loansSheet();
  else if(control.dataset.ui3Bank==='forecast')forecastSheet();
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('bank',{render});
})();
