const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readIndex, extractScripts, createBrowserContext } = require('./harness');
const html = readIndex();
let code = extractScripts(html).map(s => s.code).join('\n');
code = code.replace('const engine = TycoonEngine.load();', 'const engine = globalThis.__ct_engine = TycoonEngine.load();');
code = code.replace('function render() {', 'function render() { globalThis.__ct_render_called = (globalThis.__ct_render_called||0)+1;');
code = code.replace('render();\n\n})(__modules.engine', 'globalThis.__ct_render = render; globalThis.__ct_renderExecutiveSecretary = renderExecutiveSecretary; render();\n\n})(__modules.engine');
const ctx = createBrowserContext({ random: () => 0.42 });
vm.runInContext(code, ctx, { filename: 'executive-secretary-purity.html' });
const { engine, finance } = ctx.__capitalismTycoonModules;
const state = engine.createInitialState({ configured: true });
state.configured = true;
state.week = 12;
state.selectedTab = 'home';
state.companyCash = 900000;
state.companyDebt = 12000000;
state.lastReport = { expenses: 800000, profit: -250000, sales: 500000 };
state.stores = [{ id: 's1', name: '渋谷店', status: 'open', lastProfit: -50000, inventory: 0, weeklyDemand: 20 }];
state.finance = finance.defaultFinanceState(state);
state.finance.loans.push({ id: 'loan-1', status: 'active', nextPaymentWeek: 14, interestRate: .13, outstandingPrincipal: 12000000 });
state.finance.transactions.push({ transactionID: 't1', week: 11, category: 'revenue', cashEffect: 1000 });
state.finance.weeklySnapshots.push({ week: 11, openingCash: 1000, endingCash: 2000 });
state.news = ['既存ニュース'];
ctx.__ct_engine.g = state;
function snapshot(label) {
  return {
    label,
    json: JSON.stringify(ctx.__ct_engine.g),
    transactions: JSON.stringify(ctx.__ct_engine.g.finance.transactions),
    weeklySnapshots: JSON.stringify(ctx.__ct_engine.g.finance.weeklySnapshots),
    loans: JSON.stringify(ctx.__ct_engine.g.finance.loans),
    companyCash: ctx.__ct_engine.g.companyCash,
    companyDebt: ctx.__ct_engine.g.companyDebt,
    news: JSON.stringify(ctx.__ct_engine.g.news),
    selectedTab: ctx.__ct_engine.g.selectedTab,
    localStorage: JSON.stringify([...ctx.__localStorageData.entries()]),
    SAVE_KEY: engine.SAVE_KEY,
    saveVersion: ctx.__ct_engine.g.saveVersion
  };
}
const beforeCompanyValue = snapshot('before companyValue');
ctx.__ct_engine.companyValue();
assert.deepEqual(snapshot('after companyValue'), { ...beforeCompanyValue, label: 'after companyValue' }, 'companyValue must not mutate state or storage');
const beforeIpo = snapshot('before ipo');
ctx.__ct_engine.ipoMissingReasons();
assert.deepEqual(snapshot('after ipo'), { ...beforeIpo, label: 'after ipo' }, 'ipoMissingReasons must not mutate state or storage');
const beforeGenerate = snapshot('before generate');
ctx.__capitalismTycoonModules.executiveSecretary.generateTasks(ctx.__ct_engine.g, { companyValue: 123456789, ipoReady: false });
assert.deepEqual(snapshot('after generate'), { ...beforeGenerate, label: 'after generate' }, 'task generation must not mutate save state, finance state, selected tab, or localStorage');
const beforeRender = snapshot('before render');
const htmlOut = ctx.__ct_renderExecutiveSecretary();
assert.match(htmlOut, /経営秘書・今週の優先タスク/);
assert.deepEqual(snapshot('after render'), { ...beforeRender, label: 'after render' }, 'secretary rendering must not mutate save state, finance state, selected tab, or localStorage');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(ctx.__ct_engine.g.saveVersion, 9);
console.log('executive secretary purity tests passed');
