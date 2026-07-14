const { loadGame, findStateIssues } = require('./harness');
const { engineModule } = loadGame(); const { TycoonEngine } = engineModule;
const e = new TycoonEngine();
e.configure({ playerName:'Tester', companyName:'Long Run Co', difficulty:'normal', scenario:'free' });
const injection = 1_000_000_000; e.g.companyCash += injection; e.g.personalCash += injection;
for (let i=0; i<520; i++) { const w = e.g.week; e.advanceWeek(false); if (e.g.week !== w + 1) throw new Error(`week increment expected ${w+1}, got ${e.g.week}`); const issues = findStateIssues(e.g); if (issues.length) throw new Error(`week ${e.g.week}: ${issues.slice(0,10).join('\n')}`); JSON.stringify(e.g); }
console.log(`long-run stability passed with one-time company/personal injection of ${injection} yen at start; this is not a balance test`);
