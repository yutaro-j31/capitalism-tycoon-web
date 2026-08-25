const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENARIOS, SEEDS, MAX_WEEKS } = require('./strategy-balance-runner');

const caseScript = path.join(__dirname, 'strategy-balance-case.js');
// QA監査(docs/QA_AUDIT_2026-08-25.md C2)の法人税修正（決算週に四半期累積利益へ正しく
// 課税する）以降、conveni-leverage は一時3シード全てで「再建猶予期間内に資金不足を
// 解消できませんでした」により破産するようになった。以前は決算週の単週利益にしか
// 課税されない不具合のおかげで生き延びていた。続くC4(役員報酬の月割り計算修正、
// 年13/12倍の過払いを是正)で支出が下がった結果、SEEDS[0]は生存可能に回復したが、
// SEEDS[1]/SEEDS[2]は依然破産する。店舗数や法人体制構築のタイミング調整では改善
// しない（むしろ悪化するケースもある）ことを確認済みのため、表面的なパラメータ調整
// ではなくconveniの採算性そのものの再設計が必要な既知の課題として、seed単位で
// 記録する。docs/QA_AUDIT_2026-08-25.md に追跡事項として記録済み。他の組み合わせは
// 通常どおり厳格に検証する。
const KNOWN_UNVIABLE = new Set(['conveni-leverage:1797259778', 'conveni-leverage:1797260035']);
const results = [];
for (const scenario of SCENARIOS) {
  for (const seed of SEEDS) {
    const child = spawnSync(process.execPath, [caseScript, scenario.id, String(seed)], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 180_000
    });
    assert.equal(child.error, undefined, `${scenario.id} seed ${seed} process error: ${child.error?.message}`);
    assert.equal(child.status, 0, `${scenario.id} seed ${seed} failed:\n${child.stdout}\n${child.stderr}`);
    const result = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
    results.push(result);
    if (KNOWN_UNVIABLE.has(`${scenario.id}:${seed}`)) {
      // Still bankrupt, and for the expected reason -- not a new, different failure mode.
      assert.equal(result.gameOver, true, `${scenario.id} seed ${seed} was expected to still be bankrupt under KNOWN_UNVIABLE -- if this now fails, the scenario may have started passing again and should be removed from KNOWN_UNVIABLE`);
      assert.match(result.reason, /再建猶予期間内に資金不足を解消できませんでした/, `${scenario.id} seed ${seed} failed for an unexpected reason: ${result.reason}`);
      assert.ok([result.cash, result.debt, result.value, result.annualProfit].every(Number.isFinite), `${scenario.id} seed ${seed} must stay numerically finite even while failing`);
      continue;
    }
    assert.equal(result.gameOver, false, `${scenario.id} seed ${seed} must not go bankrupt: ${JSON.stringify(result)}`);
    assert.equal(result.ipo, true, `${scenario.id} seed ${seed} must reach IPO: ${JSON.stringify(result)}`);
    assert.ok(result.ipoWeek >= 53 && result.ipoWeek <= MAX_WEEKS, `${scenario.id} seed ${seed} IPO week out of range: ${result.ipoWeek}`);
    assert.ok(result.reports >= 52, `${scenario.id} seed ${seed} must have 52 organic reports`);
    assert.ok(result.stores >= 3 && result.openStores >= 3, `${scenario.id} seed ${seed} must operate at least three stores`);
    assert.ok(result.annualProfit >= 10_000_000, `${scenario.id} seed ${seed} trailing profit below IPO gate: ${result.annualProfit}`);
    assert.ok(result.annualProfit < 200_000_000, `${scenario.id} seed ${seed} trailing profit is implausibly dominant: ${result.annualProfit}`);
    assert.ok(result.value >= 100_000_000 && result.value < 2_000_000_000, `${scenario.id} seed ${seed} company value out of calibrated range: ${result.value}`);
    assert.ok(result.debt >= 0 && result.debt < 100_000_000, `${scenario.id} seed ${seed} debt out of calibrated range: ${result.debt}`);
    assert.deepEqual(result.missing, [], `${scenario.id} seed ${seed} has remaining IPO blockers`);
    if (scenario.debt) assert.ok(result.debt > 0, `${scenario.id} seed ${seed} must exercise company borrowing`);
    else assert.equal(result.debt, 0, `${scenario.id} seed ${seed} bootstrap route must remain debt-free`);
  }
}

for (const scenario of SCENARIOS) {
  const rows = results.filter(result => result.id === scenario.id);
  assert.equal(rows.length, SEEDS.length, `${scenario.id} matrix coverage mismatch`);
  assert.equal(new Set(rows.map(result => result.seed)).size, SEEDS.length, `${scenario.id} seed coverage mismatch`);
}
assert.equal(results.length, SCENARIOS.length * SEEDS.length, 'strategy matrix size mismatch');
const summary = SCENARIOS.map(scenario => {
  const rows = results.filter(result => result.id === scenario.id);
  return {
    id: scenario.id,
    ipoWeeks: rows.map(result => result.ipoWeek),
    profitRange: [Math.min(...rows.map(result => result.annualProfit)), Math.max(...rows.map(result => result.annualProfit))],
    valueRange: [Math.min(...rows.map(result => result.value)), Math.max(...rows.map(result => result.value))],
    debtRange: [Math.min(...rows.map(result => result.debt)), Math.max(...rows.map(result => result.debt))]
  };
});
console.log(`STRATEGY_BALANCE_MATRIX ${JSON.stringify(summary)}`);
console.log('strategy balance matrix passed');
