const fs = require('node:fs'); const path = require('node:path');
const { loadGame, findStateIssues } = require('./harness');
const { engineModule } = loadGame();
const { SAVE_KEY, createInitialState, TycoonEngine } = engineModule;
if (SAVE_KEY !== 'capitalism_tycoon_web_v1') throw new Error(`SAVE_KEY changed: ${SAVE_KEY}`);
for (const s of ['SAVE_KEY','createInitialState','TycoonEngine','normalize','advanceWeek','save','load','exportSave','importSave','configure']) {
  const ok = s === 'TycoonEngine' ? typeof TycoonEngine === 'function' : s === 'createInitialState' ? typeof createInitialState === 'function' : s === 'SAVE_KEY' ? typeof SAVE_KEY === 'string' : typeof TycoonEngine.prototype[s] === 'function' || typeof TycoonEngine[s] === 'function';
  if (!ok) throw new Error(`missing required symbol definition: ${s}`);
}
const state = createInitialState({ playerName:'Tester', companyName:'Baseline Co', configured:true });
for (const k of ['week','month','companyCash','personalCash']) if (!Number.isFinite(state[k])) throw new Error(`${k} not finite`);
for (const k of ['stores','businesses','market','news','history','reports']) if (!Array.isArray(state[k])) throw new Error(`${k} not array`);
if (!state.settings || typeof state.settings !== 'object') throw new Error('settings missing');
if (!('selectedTab' in state)) throw new Error('selectedTab missing');
JSON.stringify(state);
const e = new TycoonEngine(state); e.g.companyStocks.stock_1 = { qty: 3, avg: 1000 }; e.g.settings.reducedMotion = true;
const before = JSON.parse(JSON.stringify(e.g));
const e2 = new TycoonEngine(JSON.parse(JSON.stringify(e.g))); e2.normalize(); const after = JSON.parse(JSON.stringify(e2.g));
for (const k of ['week','companyName','playerName','companyCash','personalCash']) if (before[k] !== after[k]) throw new Error(`${k} not preserved`);
if (before.stores.length !== after.stores.length) throw new Error('stores length not preserved');
if (after.companyStocks.stock_1.qty !== 3) throw new Error('stock qty not preserved');
if (after.settings.reducedMotion !== true) throw new Error('settings not preserved');
const issues = findStateIssues(after).filter(x => !/stockPrice: suspicious ratio/.test(x)); if (issues.length) throw new Error(issues.slice(0,20).join('\n'));
const fixturePath = path.join(__dirname, 'fixtures', 'legacy-minimal-v1.json'); const fixtureRaw = fs.readFileSync(fixturePath, 'utf8'); const fixture = JSON.parse(fixtureRaw);
const legacy = new TycoonEngine(JSON.parse(fixtureRaw)); legacy.normalize();
for (const k of ['stores','businesses','market','news','history','reports']) if (!Array.isArray(legacy.g[k])) throw new Error(`legacy ${k} not array`);
if (!legacy.g.settings || !legacy.g.lastSaveDate) throw new Error('legacy top-level defaults not filled');
JSON.stringify(legacy.g); if (fs.readFileSync(fixturePath, 'utf8') !== fixtureRaw) throw new Error('fixture mutated');
console.log('save compatibility checks passed');
