'use strict';

// #816: the global ranking score must read the company's cash and its M&A subsidiaries from the fields the
// game keeps. It read cash and subsidiaries, which the game never sets, so in a real game the score stayed 0
// and the rank only drifted between 368th and 383rd whatever the company did.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const lcg = s => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const loaded = loadGame({ headless: true, random: lcg(0x816001) });
const mod = loaded.modules.globalCompanyRankingGoals;
const engine = new loaded.engineModule.TycoonEngine();
engine.configure({ playerName: 'Rank', companyName: 'ランキング商事', difficulty: 'normal', scenario: 'free' });
const g = engine.g;

// 1. A real game scores its company cash (and not the founder's personal cash).
g.maSubsidiaries = [];
const base = mod.companyScore(g);
assert.ok(base > 0, `a real game with ${g.companyCash} company cash scores above 0 (score ${base})`);
g.personalCash += 1e12;
assert.equal(mod.companyScore(g), base, 'personal cash is not company value');
g.personalCash -= 1e12;
const cashBefore = g.companyCash;
g.companyCash = cashBefore * 1000;
assert.ok(mod.companyScore(g) > base, 'more company cash raises the score');
g.companyCash = cashBefore;

// 2. Active M&A subsidiaries count; sold or other non-active ones do not.
g.maSubsidiaries = [{ id: 'sub-a', status: 'active' }, { id: 'sub-b', status: 'active' }, { id: 'sub-c', status: 'sold' }];
assert.equal(mod.companyScore(g), base + 2 * 45, 'two active M&A subsidiaries add 45 points each; a sold one adds none');
g.maSubsidiaries = [];

// 3. Owner decision (#816): prestige is a recorded reward and does not feed the score (it made top25 cascade
//    to top1 within two weeks), and the base is 1600, so a 1500-point company is not 1st in any week.
{
  const before = mod.companyScore(g);
  g.globalRanking = { ...(g.globalRanking || {}), prestige: 185 };
  assert.equal(mod.companyScore(g), before, 'prestige does not change the score');
  assert.equal(mod.RANK_BASE, 1600);
  const week = g.week;
  for (let w = 1; w <= 104; w++) { g.week = w; assert.ok(mod.rankFor(g, 1500) > 1, `week ${w}: a 1500-point company is not 1st`); assert.equal(mod.rankFor(g, 1630), 1, `week ${w}: 1630 points is 1st`); }
  g.week = week;
}

// 4. Through normal weekly progression the recorded score is the real one, not 0.
for (let i = 0; i < 4; i++) engine.advanceWeek(false);
assert.ok(g.globalRanking.score > 0, `the weekly ranking records a real score (${g.globalRanking.score})`);
assert.equal(g.globalRanking.score, g.globalRanking.history.at(-1).score);

console.log(`global company ranking score inputs tests passed (week ${g.week}, score ${g.globalRanking.score}, rank ${g.globalRanking.currentRank})`);
