'use strict';

// T25-2 (docs/PE_MODE_TASKS.md): 週次で追記され続けるログ配列の上限.
// `startupFundingHistory` は書き込み側の1箇所だけ slice が漏れていて100年セーブが4.6MB肥大した。
// 同じ形の3件（shareholderEventLog / mediaActionLog / industryAwards）に上限を入れ、
// (1) 週次normalizeで必ず切り詰まること (2) 全書き込み経路にも slice があること を固定する。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 固定値のrandomはUUID由来のIDを衝突させる（CLAUDE.md の既知の落とし穴）ので決定論的なLCGを使う。
function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
const main = loadGame({ random: makeRandom(17), isolatedLegacyIndex: true });
const { engineModule } = main;
const CAPS = engineModule.LOG_ARRAY_CAPS;

// 1. 上限表が3件を網羅していて、値が正の整数であること。
{
  assert.ok(CAPS && typeof CAPS === 'object', 'LOG_ARRAY_CAPS が公開されている');
  for (const key of ['shareholderEventLog', 'mediaActionLog', 'industryAwards']) {
    assert.ok(Number.isInteger(CAPS[key]) && CAPS[key] > 0, `${key} に上限がある`);
  }
  assert.equal(Object.isFrozen(CAPS), true, '上限表は凍結されている');
}

// 2. 週次normalizeで、どの配列も上限まで切り詰められる（新しい順＝先頭を残す）。
{
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'x', companyName: 'y', difficulty: 'normal' });
  for (const [key, cap] of Object.entries(CAPS)) {
    // 上限の3倍を積む。先頭が最新（unshiftで積まれる）という前提に合わせて 0 が最新。
    e.g[key] = Array.from({ length: cap * 3 }, (_, i) => (key === 'industryAwards' ? { id: `a-${i}`, week: i, title: `t${i}`, kind: 'k' } : `line-${i}`));
    const newest = e.g[key][0];
    e.normalize();
    assert.equal(e.g[key].length, cap, `${key} は normalize で上限まで切り詰められる`);
    assert.deepEqual(JSON.parse(JSON.stringify(e.g[key][0])), JSON.parse(JSON.stringify(newest)), `${key} は新しい順に残す`);
  }
}

// 3. 週を進めるだけでも切り詰まる（normalize が週次で通ることの確認）。
{
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'x', companyName: 'y', difficulty: 'normal' });
  for (const [key, cap] of Object.entries(CAPS)) {
    e.g[key] = Array.from({ length: cap + 50 }, (_, i) => (key === 'industryAwards' ? { id: `a-${i}`, week: i, title: 't', kind: 'k' } : `line-${i}`));
  }
  e.advanceWeek(false);
  for (const [key, cap] of Object.entries(CAPS)) {
    assert.ok(e.g[key].length <= cap, `${key} は週送りで上限内に収まる（実測 ${e.g[key].length}）`);
  }
}

// 4. 旧セーブ（上限超過のまま保存されたもの）を読み込んでも上限内に収まる。
{
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'x', companyName: 'y', difficulty: 'normal' });
  e.g.shareholderEventLog = Array.from({ length: 5000 }, (_, i) => `old-${i}`);
  const saved = JSON.parse(JSON.stringify(e.g));
  const loaded = new engineModule.TycoonEngine(saved);
  assert.ok(loaded.g.shareholderEventLog.length <= CAPS.shareholderEventLog, '旧セーブは読み込み時に切り詰められる');
  assert.equal(loaded.g.shareholderEventLog[0], 'old-0', '最新側が残る');
}

// 5. 全書き込み経路に slice があること（構造テスト）。
//    `startupFundingHistory` の事故は「複数ある書き込みのうち1箇所だけ漏れていた」ことが原因
//    だったので、unshift している行には必ず同じ行に slice があることをソースで固定する。
{
  const root = path.join(__dirname, '..');
  const targets = { shareholderEventLog: ['js/expansion.js'], mediaActionLog: ['js/completion.js'], industryAwards: ['js/parity.js'] };
  for (const [key, files] of Object.entries(targets)) {
    let writeSites = 0;
    for (const file of files) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      for (const line of src.split('\n')) {
        if (!line.includes(`${key}.unshift(`)) continue;
        writeSites++;
        assert.ok(line.includes(`${key}=`) && line.includes('.slice(0,'), `${file} の ${key} への書き込みには slice が必要: ${line.trim().slice(0, 120)}`);
      }
    }
    assert.ok(writeSites > 0, `${key} の書き込み経路が見つかる`);
  }
}

// 6. 上限は「1箇所が出どころ」であること（書き込み側がハードコードした数字を持たない）。
{
  const root = path.join(__dirname, '..');
  for (const file of ['js/expansion.js', 'js/completion.js', 'js/parity.js']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(src.includes('LOG_ARRAY_CAPS'), `${file} は js/engine.js の上限表を参照する`);
  }
}

console.log('log array caps tests passed');
