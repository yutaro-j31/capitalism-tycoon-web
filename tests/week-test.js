const { loadGame, findStateIssues } = require('./harness');
const { engineModule } = loadGame(); const { TycoonEngine } = engineModule;
const e = new TycoonEngine();
let renderCount = 0, saveCount = 0, emitCount = 0, weekEmitCount = 0;
const baseSave = e.save.bind(e), baseEmit = e.emit.bind(e);
e.save = function(...a){ saveCount++; return baseSave(...a); };
e.emit = function(type='change', detail={}){ emitCount++; if (type === 'week') weekEmitCount++; return baseEmit(type, detail); };
e.addEventListener('change', () => renderCount++);
e.configure({ playerName:'Tester', companyName:'Baseline Co', difficulty:'normal', scenario:'free' });
const configureMetrics = { saveCount, emitCount, renderCount };
saveCount = emitCount = weekEmitCount = renderCount = 0;
const firstWeek = e.g.week; e.advanceWeek(false);
if (e.g.week !== firstWeek + 1) throw new Error(`week increment expected ${firstWeek+1}, got ${e.g.week}`);
const advanceWeekMetrics = { saveCount, emitCount, weekEmitCount, renderCount };
let maxHistory = e.g.history.length;
for (let i=1; i<52 && !e.g.gameOver; i++) { const w = e.g.week; e.advanceWeek(false); if (e.g.week !== w + 1) throw new Error(`week increment expected ${w+1}, got ${e.g.week}`); const issues = findStateIssues(e.g); if (issues.length) throw new Error(`week ${e.g.week}: ${issues.slice(0,10).join('\n')}`); JSON.stringify(e.g); maxHistory = Math.max(maxHistory, e.g.history.length); if (e.g.history.length > 1000) throw new Error('history grew unexpectedly'); }
console.log(JSON.stringify({ configure: configureMetrics, advanceWeekOneCall: advanceWeekMetrics, finalWeek: e.g.week, maxHistoryLength: maxHistory, gameOver: e.g.gameOver, gameOverReason: e.g.gameOverReason }, null, 2));
