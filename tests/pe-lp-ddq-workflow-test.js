'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'LP DDQ Test',companyName:'LP DDQ Co',difficulty:'normal'});
const pf=modules.peFund;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
engine.g.selectedTab='pe-portfolio';

const cashBefore={companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,funds:engine.g.peFirm.funds.length};
let saves=0,emits=0;
engine.save=()=>{saves+=1;return true;};
engine.emit=()=>{emits+=1;};

// Baseline path remains bounded and resolves positively for the existing first outreach.
assert.equal(engine.solicitPELP('wealthyFamilyOffice'),true,'meetable LP solicitation starts');
assert.equal(saves,1,'solicitation saves once');
assert.equal(emits,2,'solicitation emits notify plus the normal change event');
let row=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
assert.equal(row.outreach.status,'ddq');
const wait=row.outreach.responseWeek-row.outreach.requestedWeek;
assert(wait>=pf.LP_DDQ_MIN_WEEKS&&wait<=pf.LP_DDQ_MAX_WEEKS,'DDQ response is bounded to 2-4 weeks');
assert.equal(pf.processLPOutreachWeek(engine.g,row.outreach.responseWeek-1),0,'DDQ cannot resolve early');
assert.equal(pf.processLPOutreachWeek(engine.g,row.outreach.responseWeek),1,'DDQ resolves exactly by the promised response week');
row=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
assert.equal(row.outreach.status,'positive');
assert(engine.g.news.some(line=>line.includes('DDQ通過の回答が届きました')),'positive response is surfaced in game news');
assert.equal(pf.processLPOutreachWeek(engine.g,row.outreach.responseWeek+1),0,'resolved DDQ is idempotent');
assert.equal(engine.solicitPELP('wealthyFamilyOffice'),false,'completed LP cannot be duplicated');

// Lift the track record only to unlock a wider set of LPs; outcome selection itself is deterministic.
engine.g.peFirm.trackRecord.score=40;

// Deterministic decline path: no permanent dead-end, but a visible 13-week cooldown.
let result=pf.solicitLP(engine.g,'formerColleague',4);
assert.equal(result.ok,true);
assert.equal(pf.lpDDQOutcome(result.outreach),'declined','chosen deterministic request week produces decline');
assert.equal(pf.processLPOutreachWeek(engine.g,result.outreach.responseWeek),1);
let declined=pf.lpOutreachRows(engine.g).find(x=>x.id==='formerColleague').outreach;
assert.equal(declined.status,'declined');
assert.equal(declined.retryWeek,declined.respondedWeek+pf.LP_DDQ_RETRY_WEEKS);
assert(engine.g.news.some(line=>line.includes('今回は見送りとの回答が届きました')),'decline is surfaced in game news');
assert.equal(pf.solicitLP(engine.g,'formerColleague',declined.retryWeek-1).reason,'cooldown','retry is blocked until cooldown expires');

// Deterministic additional-question path: player responds, then final answer arrives one week later.
result=pf.solicitLP(engine.g,'regionalBankCorporate',6);
assert.equal(result.ok,true);
assert.equal(pf.lpDDQOutcome(result.outreach),'questions','chosen deterministic request week produces additional questions');
assert.equal(pf.processLPOutreachWeek(engine.g,result.outreach.responseWeek),1);
let questions=pf.lpOutreachRows(engine.g).find(x=>x.id==='regionalBankCorporate').outreach;
assert.equal(questions.status,'questions');
assert(engine.g.news.some(line=>line.includes('DDQの追加質問が届きました')),'additional questions are surfaced in game news');

engine.g.week=questions.respondedWeek;
const saveBeforeAnswer=saves,emitBeforeAnswer=emits;
assert.equal(engine.answerPELPQuestions('regionalBankCorporate'),true,'player can submit additional materials');
assert.equal(saves,saveBeforeAnswer+1,'answering questions saves once');
assert.equal(emits,emitBeforeAnswer+2,'answering questions emits notify plus state change');
let followup=pf.lpOutreachRows(engine.g).find(x=>x.id==='regionalBankCorporate').outreach;
assert.equal(followup.status,'followup');
assert.equal(followup.responseWeek,followup.answeredWeek+pf.LP_DDQ_FOLLOWUP_WEEKS);
assert.equal(pf.processLPOutreachWeek(engine.g,followup.responseWeek),1,'follow-up receives a bounded final answer');
let resolved=pf.lpOutreachRows(engine.g).find(x=>x.id==='regionalBankCorporate').outreach;
assert.equal(resolved.status,'positive','chosen follow-up resolves positively');
assert.equal(pf.processLPOutreachWeek(engine.g,followup.responseWeek+1),0,'follow-up resolution is idempotent');

assert.deepEqual({companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,funds:engine.g.peFirm.funds.length},cashBefore,'LP DDQ outcomes never move company/personal/fund cash');

// Adapter and D UI expose all response states and the actionable additional-question button.
let model=modules.peUIAdapter.getPEUIData();
assert.equal(model.lpRelations.positive,2);
assert.equal(model.lpRelations.rows.find(x=>x.id==='formerColleague').status,'declined');
assert.equal(model.lpRelations.rows.find(x=>x.id==='regionalBankCorporate').status,'positive');

const listeners=new Map();
const screen={innerHTML:'',classList:{add(){},remove(){}}};
const document={
  addEventListener(type,cb){listeners.set(type,cb);},
  querySelector(){return null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
const click=listeners.get('click');
assert.equal(typeof click,'function');
const navTarget={dataset:{peView:'network'},closest(q){return q==='[data-pe-view]'?this:null;},matches(){return false;}};
click({target:navTarget,preventDefault(){}});
assert.match(screen.innerHTML,/data-pe-view-root="network"/);
assert.match(screen.innerHTML,/今回は見送り/,'declined LP is visible');
assert.match(screen.innerHTML,/再打診まで/,'decline cooldown is visible');
assert.match(screen.innerHTML,/DDQ通過/,'positive LP response remains visible');
assert.match(screen.innerHTML,/地方銀行・事業会社/);

// Re-open a deterministic question state to verify the production UI action.
engine.g.peFirm.lpOutreach=engine.g.peFirm.lpOutreach.filter(x=>x.lpTypeID!=='regionalBankCorporate');
result=pf.solicitLP(engine.g,'regionalBankCorporate',6);
pf.processLPOutreachWeek(engine.g,result.outreach.responseWeek);
engine.g.week=result.outreach.responseWeek;
uiContext.CapitalismTycoonPEUI.render();
assert.match(screen.innerHTML,/追加質問あり/);
assert.match(screen.innerHTML,/data-pe-lp-answer="regionalBankCorporate"/);
const answerTarget={dataset:{peLpAnswer:'regionalBankCorporate'},closest(q){return q==='[data-pe-lp-answer]'?this:null;},matches(){return false;}};
click({target:answerTarget,preventDefault(){}});
assert.equal(pf.lpOutreachRows(engine.g).find(x=>x.id==='regionalBankCorporate').outreach.status,'followup','UI additional-material action reaches production state');
assert.match(screen.innerHTML,/追加資料審査中/);

// Cooldown expiry becomes a real retry path.
engine.g.week=declined.retryWeek;
assert.equal(engine.solicitPELP('formerColleague'),true,'declined LP can be re-solicited after cooldown');
assert.equal(pf.lpOutreachRows(engine.g).find(x=>x.id==='formerColleague').outreach.status,'ddq');
assert.equal(engine.g.peFirm.lpOutreach.filter(x=>x.lpTypeID==='formerColleague').length,1,'retry replaces the canonical row instead of duplicating it');

assert.equal(engine.solicitPELP('pensionFund'),false,'locked LP cannot be solicited');
assert.equal(engine.g.peFirm.lpOutreach.some(x=>x.lpTypeID==='pensionFund'),false,'failed solicitation does not create state');

const source=fs.readFileSync('js/pe-fund.js','utf8');
assert.doesNotMatch(source,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'LP workflow adds no nondeterministic source');

console.log('PE LP DDQ outcome workflow tests passed');
