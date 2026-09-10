// PE mode T20 (docs/PE_MODE_TASKS.md): 通し検証（T15のやり直し）。
//
// T15は production path が存在しない状態で実行されたため、合成モデルによる計測になっていた。
// このスクリプトは **production の関数だけ** を呼んで100年（5,200週）を回す。具体的には:
//
//   - new TycoonEngine() / engine.configure() / engine.advanceWeek()   … 本番の週次エンジン
//   - engine.openMADealRoom / startMADueDiligence / advanceMADealRound / submitMAOffer
//     / closeMADeal(= completeTargetAcquisition)                        … 本番の入札・取得経路
//   - peFund.formableFundSize / createFund / canFormNextFund / fundDPI / slotCapacity
//     / ddSlotsRemaining / optimalHoldWeeks                             … 本番のファンド計算
//   - pePortfolioOperations.reformProcurement / setStaffing / renewProductMix
//     / consolidateSites                                                … 本番の経営レバー(T18)
//   - engine.exitPEPortfolioCompany                                     … 本番のExit・分配経路
//
// 案件供給(T16)・DD枠(T10)・人脈ノード生成(T19)・独占案件(T19)・週次のファンド評価(T17)は
// すべて advanceWeek の中で本番コードとして動く。このスクリプトが自前で持っているのは
// 「プレイヤーがどう判断するか」というポリシーだけで、状態を直接書き換えることはしない。
//
// 3つのスキルレベルは **同一のポリシー枠組み** を使い、判断の質（下の SKILLS の数値）だけが
// 異なる。T15で腕の序列が逆転したのは、下手だけがゲートを無視して強制再組成する別ポリシー
// だったためで、その構造上の欠陥をここで取り除いている。
//
// 使い方:
//   node scripts/pe-mode-100y-verification.js                 … 既定（3スキル×100年 + 分布 + 決定論）
//   node scripts/pe-mode-100y-verification.js --years=20      … 短縮実行（開発中の確認用）
//   node scripts/pe-mode-100y-verification.js --trials=60     … Fund I 分布の試行数
//   node scripts/pe-mode-100y-verification.js --skip-distribution --skip-determinism
//
// 100年×複数本はまとめて回すと長時間かかるため、部分実行して結果を貯める使い方もできる:
//   node scripts/pe-mode-100y-verification.js --part=skill --skill=expert
//   node scripts/pe-mode-100y-verification.js --part=distribution --from=0 --to=20
//   node scripts/pe-mode-100y-verification.js --part=determinism --run=1
//   node scripts/pe-mode-100y-verification.js --part=report
// 各実行の結果は --out（既定 .pe-t20-results.json）に貯まり、--part=report が最終集計を出す。
'use strict';

const path = require('node:path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'harness'));

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const YEARS = Math.max(1, Number(argOf('years', 100)));
const WEEKS = YEARS * 52;
const TRIALS = Math.max(1, Number(argOf('trials', 40)));
const SKIP_DISTRIBUTION = argv.includes('--skip-distribution');
const SKIP_DETERMINISM = argv.includes('--skip-determinism');
const PART = argOf('part', 'all');
// 途中結果の置き場は実行時の作業ファイルなので既定はtmp（リポジトリを汚さない）。
// スクリプト本体はリポジトリ内にある（T20の要件）。
const OUT = argOf('out', path.join(require('node:os').tmpdir(), 'pe-t20-results.json'));
const fs = require('node:fs');

// 部分実行の結果置き場（検証の途中結果。壊れていたら作り直す）。
function loadResults() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return { years: YEARS, skills: {}, distribution: [], determinism: {} }; }
}
function saveResults(r) { fs.writeFileSync(OUT, JSON.stringify(r, null, 2)); }

const 億 = 1e8, 兆 = 1e12;
// 救済導線1回ぶんの所要（設計書§10: 会社を作ってExitするのに4年）。
const FOUNDING_CYCLE_WEEKS = 208;
// 起業に振り向ける元手（個人資産に対する割合）。
const FOUNDING_STAKE_FRACTION = .10;
const finite = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const yen = v => Number.isFinite(v) ? (Math.abs(v) >= 兆 ? `${(v / 兆).toFixed(2)}兆円` : `${(v / 億).toFixed(1)}億円`) : String(v);
const pct = v => `${(v * 100).toFixed(1)}%`;

// 決定論的な乱数（既存エンジンが Math.random を使う箇所のための注入。PEモードのコードは
// これを消費しない）。
function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }

// ---------------------------------------------------------------------------------------------
// ポリシー枠組み（3スキル共通）。違うのは数値だけ。
// ---------------------------------------------------------------------------------------------
const SKILLS = {
  expert: {
    label: '上手',
    bidPremium: 1.00,          // 最低提示価格ちょうどで入れる（高値掴みをしない）
    ddScope: 'financial',      // 枠が許すかぎり深く見る
    procurement: 0.5,          // 副作用の出ない安全水準まで
    headcount: 1.0,            // 人は切らない（評判を守る）
    productMix: 1.0,           // トップラインに早く仕込む
    mixAtWeek: 26,             // 取得から半年で着手（Exitまでに効き切る）
    holdBonusWeeks: 0,         // 最適保有期間で売る
    foundingMOIC: 3.0          // 救済導線で起業した会社のExit倍率
  },
  average: {
    label: '普通',
    bidPremium: 1.08,
    ddScope: 'screening',
    procurement: 0.7,          // 少し削りすぎる
    headcount: 0.9,
    productMix: 0.5,
    mixAtWeek: 104,            // 着手が遅く、効き切る前にExitが来る
    holdBonusWeeks: 26,
    foundingMOIC: 2.2
  },
  novice: {
    label: '下手',
    bidPremium: 1.25,          // 競り上がって高く買う
    ddScope: 'screening',
    procurement: 1.0,          // 限界まで削り、1年後に客数を失う
    headcount: 0.6,            // 人を切り、評判も失う
    productMix: 0,             // トップラインに何も仕込まない
    mixAtWeek: null,
    holdBonusWeeks: -78,       // 育つ前に売る
    foundingMOIC: 1.4
  }
};

// ---------------------------------------------------------------------------------------------
// セットアップ: 投資部門を持ち、Exit実績1件でPEモードが解禁済みの会社から始める。
// （PE以前の創業フェーズはT20の計測対象ではないため、ここは production の recordExit で
//   実績だけを与えて始める。以降の進行はすべて本番の週次エンジンが動かす。）
// ---------------------------------------------------------------------------------------------
function setupFirm(handles) {
  const { engineModule, modules } = handles;
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PEパートナーズ', difficulty: 'normal' });
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  e.g.executives.CSO = { role: 'CSO', skill: 80 };
  e.g.executives.CFO = { role: 'CFO', skill: 80 };
  e.g.companyCash = 50_000_000_000;
  e.g.personalCash = 30_000_000_000;
  modules.peFund.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  return e;
}

// ---------------------------------------------------------------------------------------------
// 1週ぶんのプレイヤー判断。3スキルとも同じ手順を踏み、SKILLSの数値だけが違う。
// ---------------------------------------------------------------------------------------------
// policy はポリシー側の作業メモ（救済導線の経過週など）。production の state には書かない。
function playWeek(handles, e, skill, policy = {}) {
  const { modules } = handles;
  const pf = modules.peFund, ds = modules.peDealSupply, ops = modules.pePortfolioOperations, pa = modules.peAcquisition;
  const g = e.g;

  // (1) ファンド組成: T21-2 の production アクション engine.formPEFund() をそのまま呼ぶ。
  //     解禁判定・次号ゲート(canFormNextFund)・GP出資額・個人資産の充足判定はすべてその中。
  //     どのスキルも同じアクション・同じゲートを通る。組める条件が揃っていれば常に組むので、
  //     前号が投資期間中でも2本目を持てる（設計書§12「同時運用は自然に2本で頭打ち」の確認）。
  const funds = g.peFirm.funds;
  const latest = funds[funds.length - 1] || null;
  if (e.formablePEFund().ok) e.formPEFund();

  // (1b) 救済導線（設計書§10「2号を組めない年は起業に戻って会社を作りExitする（4年）」）。
  //      起業パートそのもの（店舗経営→売却）はPEモードの外にあり、このスクリプトは店舗を
  //      持たないPEファームを回しているため、ここでは「4年かけて会社を作りExitした」ことだけを
  //      production の recordExit() で記録する。金額はスキル別のMOICで、元手は個人資産から出す。
  //      ＝ 起業パートの結果を模した**ポリシー側のモデル**であり、起業パートの実測ではない。
  const blocked = !funds.length ? false : !pf.canFormNextFund(g) && !funds.some(f => f.status === 'investing');
  if (blocked && !policy.rescueStartedWeek) policy.rescueStartedWeek = g.week;
  if (!blocked) policy.rescueStartedWeek = 0;
  if (blocked && g.week - policy.rescueStartedWeek >= FOUNDING_CYCLE_WEEKS) {
    const invested = Math.max(100_000_000, finite(g.personalCash) * FOUNDING_STAKE_FRACTION);
    if (finite(g.personalCash) >= invested) {
      const realized = invested * skill.foundingMOIC;
      g.personalCash = finite(g.personalCash) - invested + realized;
        pf.recordExit(g, { exitType: 'buyout', realizedAmount: realized, investedAmount: invested, foundedWeek: g.week - FOUNDING_CYCLE_WEEKS, exitedWeek: g.week, profitableWeekStreak: 208, employeeCount: 40 });
    }
    policy.rescueStartedWeek = g.week;
  }
  const fund = funds.filter(f => f.status === 'investing').slice(-1)[0] || null;

  // (2) 案件を開く: 板に出ているPE案件のうち、まだ触っていないものを1件だけ開く。
  //     スロットとDD枠が空いていなければ何もしない（本番の制約をそのまま尊重する）。
  if (fund && pf.activeDealCount(fund) < pf.slotCapacity(fund) && pf.ddSlotsRemaining(g, g.week) > 0) {
    const open = (g.acquisitionTargets || []).filter(t => ds.isPETarget(t) && !t.activeDealID && t.dealStatus !== 'acquired');
    const candidate = open[0] || null;
    if (candidate) {
      const price = e.calculateMAAcquisitionPrice(candidate, 'friendly').minimumPrice * skill.bidPremium;
      // 買えない案件は開かない（本番の取得判定をそのまま先に使う）。
      const feasible = pa.evaluateFundPurchase(g, { fundID: fund.id, useCoinvest: true }, price);
      if (feasible.ok) e.openMADealRoom(candidate.id);
    }
  }

  // (3) 進行中の案件を1段ずつ進める: DD → 最終入札 → オファー → クロージング。
  for (const deal of (g.maDealRooms || [])) {
    const target = (g.acquisitionTargets || []).find(t => t.id === deal.targetID);
    if (!ds.isPETarget(target)) continue;
    if (deal.status === 'screening' || deal.status === 'indication') {
      if (fund && pf.ddSlotsRemaining(g, g.week) > 0) {
        if (!e.startMADueDiligence(deal.id, skill.ddScope, fund.id) && deal.status === 'screening') e.advanceMADealRound(deal.id);
      }
    } else if (deal.status === 'ready') {
      e.setPEDealCoinvest(deal.id, true); // 規模を取る（Fund I規模では25%上限が先に効くため）
      const price = Math.ceil(e.calculateMAAcquisitionPrice(target, 'friendly').minimumPrice * skill.bidPremium);
      if (!e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price, acceptSellerTerm: true })) e.advanceMADealRound(deal.id);
    } else if (deal.status === 'final_bid') {
      const price = Math.ceil(e.calculateMAAcquisitionPrice(target, 'friendly').minimumPrice * skill.bidPremium);
      e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price, acceptSellerTerm: true });
    } else if (deal.status === 'accepted') {
      e.closeMADeal(deal.id);
    }
  }

  // (4) 保有中の経営（T18の6レバー）と (5) Exit判断。
  for (let i = 0; i < g.peFirm.funds.length; i++) {
    const f = g.peFirm.funds[i];
    for (const deal of (f.deals || [])) {
      if (deal.status !== 'active' || !deal.portfolioCompany) continue;
      const held = g.week - deal.acquiredWeek;
      const pc = deal.portfolioCompany;
      // コスト側は取得直後に。約束がある案件では人員削減が本番側で拒否される（それでよい）。
      if (held === 4) {
        ops.reformProcurement(g, f.id, deal.id, skill.procurement);
        if (skill.headcount < 1) ops.setStaffing(g, f.id, deal.id, { headcountRatio: skill.headcount });
      }
      // トップライン側は仕込みの早さがそのまま腕になる。
      if (skill.mixAtWeek !== null && held === skill.mixAtWeek) ops.renewProductMix(g, f.id, deal.id, skill.productMix);
      // 稼いだcashは品質と出店に回す（3スキル共通のルール）。
      if (held % 26 === 0 && pc.cash > 0) ops.investQuality(g, f.id, deal.id, pc.cash * .3);
      if (held % 52 === 0) ops.expandPortfolioStore(g, f.id, deal.id);
      // Exit: 最適保有期間（T9）を基準に、腕の差ぶんだけ前後する。
      const hold = Math.max(26, pf.optimalHoldWeeks(i) + skill.holdBonusWeeks);
      if (held >= hold) e.exitPEPortfolioCompany(f.id, deal.id, { method: 'sale' });
    }
  }

  // (6) 人脈を育てる: 週次アクション枠(2回)を、信頼度の低い相手から順に使う。
  const nodes = [...(g.peNetwork?.nodes || [])].sort((a, b) => a.trust - b.trust);
  for (const node of nodes) {
    if (modules.peNetwork.weeklyActionsRemaining(g, g.week) <= 0) break;
    e.contactPENetworkNode(node.id);
  }
}

// T26-3: 指標を2つに分ける。旧 totalAssets はファンドの現金と投下額を丸ごと足していたため、
// LPと共同投資家の持分を控除しておらず、プレイヤーの純資産ではなく運用資産(AUM)寄りだった
// （Codex GAME-REAUDIT-006）。設計書§12の「100年後の総資産が兆のオーダー」は
// **プレイヤー帰属純資産**で判定する。
function fundNAV(f) {
  return Math.max(0, Number(f.cash) || 0)
    + (f.deals || []).reduce((s, d) => s + (d.status === 'active' ? Math.max(0, Number(d.investedAmount) || 0) + Math.max(0, Number(d.portfolioCompany?.cash) || 0) : 0), 0);
}
// プレイヤーに帰属する純資産: 個人資産 + 会社資産 + ファンドNAVのうちGP出資持分だけ。
function playerNetWorth(handles, g) {
  const pf = handles.modules.peFund;
  const funds = g.peFirm?.funds || [];
  const gpPart = funds.reduce((sum, f) => sum + fundNAV(f) * pf.gpShareOfFund(f), 0);
  return (Number(g.personalCash) || 0) + (Number(g.companyCash) || 0) + gpPart;
}
// 運用資産(AUM): ファンド規模の合計 + 共同投資の拠出累計。プレイヤーのものではないが規模の指標。
function assetsUnderManagement(g) {
  const funds = g.peFirm?.funds || [];
  return funds.reduce((sum, f) => sum + Math.max(0, Number(f.size) || 0), 0)
    + Math.max(0, Number(g.peFirm?.coinvestContributed) || 0);
}
function scanNonFinite(value, pathStr = '$', out = [], seen = new Set()) {
  if (out.length >= 20) return out;
  if (typeof value === 'number') { if (!Number.isFinite(value)) out.push(`${pathStr}=${value}`); return out; }
  if (!value || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  for (const key of Object.keys(value)) scanNonFinite(value[key], `${pathStr}.${key}`, out, seen);
  return out;
}

// ---------------------------------------------------------------------------------------------
// 1本の通し実行。
// ---------------------------------------------------------------------------------------------
function runOnce({ seed, skillID, weeks, sampleEvery = 520 }) {
  const handles = loadGame({ random: makeRandom(seed), isolatedLegacyIndex: true });
  const skill = SKILLS[skillID];
  const e = setupFirm(handles);
  const samples = [];
  const policy = { rescueStartedWeek: 0 };
  let peakFundSize = 0;
  let maxConcurrentFunds = 0;   // 同時に走っているファンド数（設計書§12「2本で頭打ち」の確認）
  let maxInvestingFunds = 0;
  for (let w = 0; w < weeks; w++) {
    e.advanceWeek(false);            // ← production の週次エンジン
    playWeek(handles, e, skill, policy); // ← プレイヤーの判断だけ
    for (const f of e.g.peFirm.funds) peakFundSize = Math.max(peakFundSize, Number(f.size) || 0);
    maxConcurrentFunds = Math.max(maxConcurrentFunds, e.g.peFirm.funds.filter(f => f.status !== 'closed').length);
    maxInvestingFunds = Math.max(maxInvestingFunds, e.g.peFirm.funds.filter(f => f.status === 'investing').length);
    if ((w + 1) % sampleEvery === 0) samples.push({ week: e.g.week, assets: playerNetWorth(handles, e.g), aum: assetsUnderManagement(e.g) });
  }
  const g = e.g;
  const funds = g.peFirm.funds;
  const save = JSON.stringify(g);
  // 決定論の比較からは lastSaveDate（保存した実時刻。既存エンジンが常に書く表示用フィールドで
  // シミュレーションには一切使われない）を除く。これだけは実行ごとに必ず変わる。
  const comparable = JSON.stringify(g, (k, v) => (k === 'lastSaveDate' ? null : v));
  return {
    skillID, seed,
    week: g.week,
    fundCount: funds.length,
    reachedFundII: funds.length >= 2,
    fundIDPI: funds[0] ? handles.modules.peFund.fundDPI(funds[0]) : 0,
    fundIHalved: funds[0] ? handles.modules.peFund.fundDPI(funds[0]) < 0.6 : false,
    peakFundSize,
    hitCeiling: peakFundSize >= handles.modules.peFund.MAX_FUND_SIZE - 1,
    // T22: 実際に頭打ちになる規模は「市場が吸収できる規模」(marketAbsorbableFundSize)。
    // MAX_FUND_SIZE(5兆) は指数爆発を止める絶対上限として残っているが、年4件×設計書§15の
    // 帯では、その手前のこの規模で先に頭打ちになる。
    absorbableCeiling: handles.modules.peFund.marketAbsorbableFundSize(),
    plateauedAtAbsorbable: peakFundSize >= handles.modules.peFund.marketAbsorbableFundSize() - 1,
    acquisitions: funds.reduce((n, f) => n + f.deals.filter(d => d.portfolioCompany).length, 0),
    maxConcurrentFunds,
    maxInvestingFunds,
    // 救済導線（起業に戻ってExit）を使った回数。初期セットアップで与える1件を除く。
    rescueExits: Math.max(0, (g.peFirm.trackRecord.exits || []).filter(x => x.exitType !== 'fund').length - 1),
    exits: funds.reduce((n, f) => n + f.deals.filter(d => d.status === 'exited').length, 0),
    monopolyDeals: (g.maDealHistory || []).length,
    networkNodes: (g.peNetwork?.nodes || []).length,
    personalCash: g.personalCash,
    companyCash: g.companyCash,
    playerNetWorth: playerNetWorth(handles, g),
    aum: assetsUnderManagement(g),
    coinvestContributed: Math.max(0, Number(g.peFirm?.coinvestContributed) || 0),
    coinvestCapital: Math.max(0, Number(g.peFirm?.coinvestCapital) || 0),
    managementFeePaid: (g.peFirm?.funds || []).reduce((s, f) => s + (Number(f.managementFeePaid) || 0), 0),
    teamPayrollPaid: (g.peFirm?.funds || []).reduce((s, f) => s + (Number(f.teamPayrollPaid) || 0), 0),
    samples,
    saveBytes: Buffer.byteLength(save, 'utf8'),
    nonFinite: scanNonFinite(g),
    saveHash: require('node:crypto').createHash('sha256').update(comparable).digest('hex')
  };
}

// ---------------------------------------------------------------------------------------------
// 部分実行（1回の実行が長くなりすぎないように分割する）。結果はOUTに貯まる。
// ---------------------------------------------------------------------------------------------
function runSkillPart(skillID) {
  const results = loadResults();
  const started = Date.now();
  const seed = Number(argOf('seed', 12345));
  const r = runOnce({ seed, skillID, weeks: WEEKS });
  results.years = YEARS;
  // 別seedの実行は上書きせず、seed付きの名前で並べて残す（同じ腕でも運で結果が変わることの確認用）。
  results.skills[seed === 12345 ? skillID : `${skillID}@${seed}`] = { ...r, seconds: (Date.now() - started) / 1000 };
  saveResults(results);
  console.log(`${SKILLS[skillID].label}: ファンド${r.fundCount}本 / 同時最大${r.maxConcurrentFunds ?? "-"}本(投資中${r.maxInvestingFunds ?? "-"}本) / 救済${r.rescueExits ?? "-"}回 / 取得${r.acquisitions}件 / Exit${r.exits}件 / 最大ファンド${yen(r.peakFundSize)} / 天井${r.hitCeiling ? '到達' : '未到達'} / 純資産${yen(r.playerNetWorth)} / AUM${yen(r.aum)} / Fund I DPI ${r.fundIDPI.toFixed(2)} / セーブ${(r.saveBytes / 1024 / 1024).toFixed(2)}MB / NaN・Inf ${r.nonFinite.length}件 / ${((Date.now() - started) / 1000).toFixed(0)}秒`);
}
function runDistributionPart(from, to) {
  const results = loadResults();
  for (let i = from; i < to; i++) {
    const r = runOnce({ seed: 1000 + i * 7, skillID: 'average', weeks: 520, sampleEvery: 520 });
    results.distribution = results.distribution.filter(x => x.index !== i);
    results.distribution.push({ index: i, fundCount: r.fundCount, fundIDPI: r.fundIDPI, fundIHalved: r.fundIHalved, reachedFundII: r.reachedFundII });
    saveResults(results);
    console.log(`trial ${i}: ファンド${r.fundCount}本 / Fund I DPI ${r.fundIDPI.toFixed(2)}${r.fundIHalved ? ' (半減)' : ''}${r.reachedFundII ? ' / Fund II到達' : ''}`);
  }
}
function runDeterminismPart(run) {
  const results = loadResults();
  const r = runOnce({ seed: 999, skillID: 'expert', weeks: WEEKS });
  results.determinism[`run${run}`] = { saveHash: r.saveHash, playerNetWorth: r.playerNetWorth, week: r.week };
  saveResults(results);
  console.log(`determinism run${run}: sha256=${r.saveHash.slice(0, 32)} / 純資産${yen(r.playerNetWorth)} / AUM${yen(r.aum)}`);
}
// 部分実行を並列に回した場合、結果ファイルは複数になる。--inputs で並べて統合する。
function mergeResults() {
  const inputs = argOf('inputs', '');
  const files = inputs ? inputs.split(',').map(f => f.trim()).filter(Boolean) : [OUT];
  const merged = { years: YEARS, skills: {}, distribution: [], determinism: {} };
  for (const file of files) {
    let part;
    try { part = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    merged.years = part.years || merged.years;
    Object.assign(merged.skills, part.skills || {});
    Object.assign(merged.determinism, part.determinism || {});
    for (const d of part.distribution || []) if (!merged.distribution.some(x => x.index === d.index)) merged.distribution.push(d);
  }
  return merged;
}
function report() {
  const results = mergeResults();
  console.log(`# PE mode T20 通し検証 (production path) — ${results.years || YEARS}年`);
  console.log('本スクリプトは production の週次エンジン(advanceWeek)と本番の入札・取得・経営・Exit経路のみを呼ぶ。\n');
  const runs = results.skills;
  const ids = ['expert', 'average', 'novice'].filter(id => runs[id]);
  // 吸収上限は結果ファイルに無いこともある（この欄が追加される前の実行）。その場合は
  // production の値をその場で読み直す。
  let absorbable = ids.length ? runs[ids[0]].absorbableCeiling : NaN;
  if (!Number.isFinite(absorbable)) {
    try { absorbable = loadGame({ random: () => 0.5, isolatedLegacyIndex: true }).modules.peFund.marketAbsorbableFundSize(); } catch { absorbable = NaN; }
  }
  const plateaued = r => Number.isFinite(absorbable) && r.peakFundSize >= absorbable - 1;
  console.log('## A. 腕による差（同一ポリシー枠組み・判断の質だけが違う）');
  for (const id of ids) {
    const r = runs[id];
    console.log(`- ${SKILLS[id].label}: ファンド${r.fundCount}本 / 同時最大${r.maxConcurrentFunds ?? "-"}本(投資中${r.maxInvestingFunds ?? "-"}本) / 救済${r.rescueExits ?? "-"}回 / 取得${r.acquisitions}件 / Exit${r.exits}件 / 人脈${r.networkNodes} / 最大ファンド${yen(r.peakFundSize)} / 吸収上限${plateaued(r) ? '到達（頭打ち）' : '未到達'} / 絶対上限${r.hitCeiling ? '到達' : '未到達'} / 純資産${yen(r.playerNetWorth)} / AUM${yen(r.aum)} / 個人資産${yen(r.personalCash)} / Fund I DPI ${r.fundIDPI.toFixed(2)}`);
  }
  if (ids.length === 3) {
    const ok = runs.expert.playerNetWorth >= runs.average.playerNetWorth && runs.average.playerNetWorth >= runs.novice.playerNetWorth;
    console.log(`- 腕の序列: ${ok ? 'OK（上手 ≥ 普通 ≥ 下手）' : 'NG（逆転あり）'}`);
    console.log(`- 下手の天井到達: ${runs.novice.hitCeiling ? 'NG（到達してしまった）' : 'OK（未到達）'}`);
  }
  for (const id of ids) {
    const s2 = runs[id].samples || [];
    const deltas = [];
    for (let i = 1; i < s2.length; i++) deltas.push(s2[i].assets - s2[i - 1].assets);
    const late = deltas.slice(Math.floor(deltas.length / 2));
    if (late.length >= 2) {
      const mean = late.reduce((a, b) => a + b, 0) / late.length;
      const growth = late[0] !== 0 ? late[late.length - 1] / late[0] : NaN;
      console.log(`- ${SKILLS[id].label} 後半の10年ごとの純資産増分: 平均${yen(mean)} / 末期÷初期 ${Number.isFinite(growth) ? growth.toFixed(2) : 'n/a'}（1に近いほど線形）`);
    }
  }
  const dist = results.distribution || [];
  if (dist.length) {
    const valid = dist.filter(d => d.fundCount >= 1);
    console.log(`\n## B. Fund I の結果分布（${valid.length}シード × 10年、ポリシーは「普通」）`);
    console.log(`- Fund I 半減(DPI<0.6)発生率: ${pct(valid.filter(d => d.fundIHalved).length / Math.max(1, valid.length))}（期待値 0〜1%）`);
    console.log(`- Fund II 到達率: ${pct(valid.filter(d => d.reachedFundII).length / Math.max(1, valid.length))}（期待値 約85%）`);
    const dpis = valid.map(d => d.fundIDPI).sort((a, b) => a - b);
    if (dpis.length) console.log(`- Fund I DPI: 中央値 ${dpis[Math.floor(dpis.length / 2)].toFixed(2)} / 最小 ${dpis[0].toFixed(2)} / 最大 ${dpis[dpis.length - 1].toFixed(2)}`);
  }
  const det = results.determinism || {};
  if (det.run1 && det.run2) {
    console.log('\n## C. 決定論（同一seedの通し実行×2回）');
    console.log(`- セーブのSHA-256一致: ${det.run1.saveHash === det.run2.saveHash ? 'OK' : 'NG'}`);
    console.log(`  run1=${det.run1.saveHash.slice(0, 16)} / run2=${det.run2.saveHash.slice(0, 16)}`);
  }
  if (ids.length) {
    console.log('\n## D. 絶対条件');
    const maxSave = Math.max(...ids.map(id => runs[id].saveBytes));
    const nonFinite = ids.flatMap(id => runs[id].nonFinite || []);
    console.log(`- セーブサイズ最大: ${(maxSave / 1024 / 1024).toFixed(2)}MB（上限5.00MB）: ${maxSave < 5 * 1024 * 1024 ? 'OK' : 'NG'}`);
    console.log(`- NaN / Infinity: ${nonFinite.length}件 ${nonFinite.length ? `例: ${nonFinite.slice(0, 5).join(', ')}` : ''}`);
    let hardCap = NaN;
    try { hardCap = loadGame({ random: () => 0.5, isolatedLegacyIndex: true }).modules.peFund.MAX_FUND_SIZE; } catch { hardCap = NaN; }
    console.log(`- ファンド1本の規模: 最大${yen(Math.max(...ids.map(id => runs[id].peakFundSize)))} / 市場が吸収できる上限${Number.isFinite(absorbable) ? yen(absorbable) : 'n/a'} / 絶対上限${Number.isFinite(hardCap) ? yen(hardCap) : 'n/a'}`);
  }
}

function handlesForCap(){try{return loadGame({random:()=>0.5,isolatedLegacyIndex:true}).modules.peFund.MAX_FUND_SIZE;}catch{return NaN;}}
function main() {
  if (PART === 'skill') return runSkillPart(argOf('skill', 'expert'));
  if (PART === 'distribution') return runDistributionPart(Number(argOf('from', 0)), Number(argOf('to', TRIALS)));
  if (PART === 'determinism') return runDeterminismPart(argOf('run', '1'));
  if (PART === 'report') return report();
  const started = Date.now();
  console.log(`# PE mode T20 通し検証 (production path) — ${YEARS}年 = ${WEEKS}週`);
  console.log(`実行日時基準の乱数は使用しない（seed固定・決定論）。\n`);

  // --- A. 3スキルレベルの通し実行 -------------------------------------------------------------
  console.log('## A. 腕による差（同一ポリシー枠組み・判断の質だけが違う）');
  const runs = {};
  for (const skillID of ['expert', 'average', 'novice']) {
    const r = runOnce({ seed: 12345, skillID, weeks: WEEKS });
    runs[skillID] = r;
    console.log(`- ${SKILLS[skillID].label}: ファンド${r.fundCount}本 / 同時最大${r.maxConcurrentFunds}本(投資中${r.maxInvestingFunds}本) / 救済${r.rescueExits}回 / 取得${r.acquisitions}件 / Exit${r.exits}件 / 人脈${r.networkNodes} / 最大ファンド${yen(r.peakFundSize)} / 天井${r.hitCeiling ? '到達' : '未到達'} / 純資産${yen(r.playerNetWorth)} / AUM${yen(r.aum)} / Fund I DPI ${r.fundIDPI.toFixed(2)} / セーブ${(r.saveBytes / 1024 / 1024).toFixed(2)}MB / NaN・Inf ${r.nonFinite.length}件`);
  }
  const orderOK = runs.expert.playerNetWorth >= runs.average.playerNetWorth && runs.average.playerNetWorth >= runs.novice.playerNetWorth;
  console.log(`- 腕の序列: ${orderOK ? 'OK（上手 ≥ 普通 ≥ 下手）' : 'NG（逆転あり）'}`);
  console.log(`- 下手の天井到達: ${runs.novice.hitCeiling ? 'NG（到達してしまった）' : 'OK（未到達）'}`);

  // 天井到達後の総資産推移が線形か（1兆円超のサンプル区間の増分のばらつきで見る）。
  for (const skillID of Object.keys(runs)) {
    const s = runs[skillID].samples;
    const deltas = [];
    for (let i = 1; i < s.length; i++) deltas.push(s[i].assets - s[i - 1].assets);
    const late = deltas.slice(Math.floor(deltas.length / 2));
    if (late.length >= 2) {
      const mean = late.reduce((a, b) => a + b, 0) / late.length;
      const growth = late.length >= 2 && late[0] !== 0 ? late[late.length - 1] / late[0] : NaN;
      console.log(`- ${SKILLS[skillID].label} 後半の10年ごとの純資産増分: 平均${yen(mean)} / 末期÷初期 ${Number.isFinite(growth) ? growth.toFixed(2) : 'n/a'}（1に近いほど線形・指数爆発なし）`);
    }
  }

  // --- B. Fund I の結果分布 -------------------------------------------------------------------
  if (!SKIP_DISTRIBUTION) {
    console.log(`\n## B. Fund I の結果分布（${TRIALS}シード × 10年、ポリシーは「普通」）`);
    let halved = 0, reachedII = 0, valid = 0;
    for (let i = 0; i < TRIALS; i++) {
      const r = runOnce({ seed: 1000 + i * 7, skillID: 'average', weeks: 520, sampleEvery: 520 });
      if (r.fundCount >= 1) { valid++; if (r.fundIHalved) halved++; if (r.reachedFundII) reachedII++; }
    }
    console.log(`- 有効試行: ${valid}/${TRIALS}`);
    console.log(`- Fund I 半減(DPI<0.6)発生率: ${pct(halved / Math.max(1, valid))}（期待値 0〜1%）`);
    console.log(`- Fund II 到達率: ${pct(reachedII / Math.max(1, valid))}（期待値 約85%）`);
  }

  // --- C. 決定論 -------------------------------------------------------------------------------
  if (!SKIP_DETERMINISM) {
    console.log('\n## C. 決定論（同一seedの通し実行×2回）');
    const a = runOnce({ seed: 999, skillID: 'expert', weeks: WEEKS });
    const b = runOnce({ seed: 999, skillID: 'expert', weeks: WEEKS });
    console.log(`- セーブのSHA-256一致: ${a.saveHash === b.saveHash ? 'OK' : 'NG'}`);
    console.log(`  run1=${a.saveHash.slice(0, 16)} / run2=${b.saveHash.slice(0, 16)}`);
  }

  // --- D. 絶対条件 -----------------------------------------------------------------------------
  console.log('\n## D. 絶対条件');
  const maxSave = Math.max(...Object.values(runs).map(r => r.saveBytes));
  const nonFinite = Object.values(runs).flatMap(r => r.nonFinite);
  console.log(`- セーブサイズ最大: ${(maxSave / 1024 / 1024).toFixed(2)}MB（上限5.00MB）: ${maxSave < 5 * 1024 * 1024 ? 'OK' : 'NG'}`);
  console.log(`- NaN / Infinity: ${nonFinite.length}件 ${nonFinite.length ? `例: ${nonFinite.slice(0, 5).join(', ')}` : ''}`);
  console.log(`- ファンド1本の上限: 最大${yen(Math.max(...Object.values(runs).map(r => r.peakFundSize)))}（絶対上限${yen(handlesForCap())}）`);
  console.log(`\n所要 ${((Date.now() - started) / 1000).toFixed(0)}秒`);
}

if (require.main === module) main();
module.exports = { SKILLS, setupFirm, playWeek, runOnce, playerNetWorth, assetsUnderManagement };
