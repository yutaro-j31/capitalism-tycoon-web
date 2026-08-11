// Script boundary: js/board-governance-resolution.js (classic JavaScript)
(function () {
  'use strict';

  const modules = globalThis.__capitalismTycoonModules;

  if (!modules?.engine?.TycoonEngine) {
    throw new Error(
      'Capitalism Tycoon engine must be loaded before board-governance-resolution.js.'
    );
  }

  if (!modules?.playerEngineBridge?.getEngine) {
    throw new Error(
      'Capitalism Tycoon playerEngineBridge must be loaded before board-governance-resolution.js.'
    );
  }

  if (modules.boardGovernanceResolution) {
    throw new Error(
      'Capitalism Tycoon boardGovernanceResolution module is already registered.'
    );
  }

  const EngineClass = modules.engine.TycoonEngine;
  const bridge = modules.playerEngineBridge;

  const VERSION = 1;
  const HISTORY_LIMIT = 120;
  const DEFAULT_GOVERNANCE_QUALITY = 50;
  const GROWTH_INVESTMENT_THRESHOLD = 2 / 3;

  const MEMBER_TEMPLATES = Object.freeze([
    Object.freeze({
      id: 'board-ceo',
      name: '代表取締役CEO',
      role: 'CEO',
      independent: false,
      riskTolerance: 0.72,
      growthPreference: 0.78,
      financialDiscipline: 0.52
    }),
    Object.freeze({
      id: 'board-cfo',
      name: '取締役CFO',
      role: 'CFO',
      independent: false,
      riskTolerance: 0.44,
      growthPreference: 0.46,
      financialDiscipline: 0.82
    }),
    Object.freeze({
      id: 'board-independent-1',
      name: '社外取締役',
      role: 'Independent',
      independent: true,
      riskTolerance: 0.38,
      growthPreference: 0.50,
      financialDiscipline: 0.76
    })
  ]);

  const finite = (value, fallback = 0) =>
    Number.isFinite(Number(value)) ? Number(value) : fallback;

  const integer = (value, fallback = 0) =>
    Math.max(0, Math.floor(finite(value, fallback)));

  const clamp = (value, min = 0, max = 1) =>
    Math.max(min, Math.min(max, finite(value, min)));

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[char]
    );

  const yen = value =>
    `${Math.round(finite(value)).toLocaleString('ja-JP')}円`;

  function hashString(value) {
    let hash = 2166136261;

    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function normalizeMember(member, fallback) {
    const source = member && typeof member === 'object' ? member : {};
    const template = fallback || MEMBER_TEMPLATES[0];

    return {
      id:
        typeof source.id === 'string' && source.id
          ? source.id
          : template.id,
      name:
        typeof source.name === 'string' && source.name
          ? source.name
          : template.name,
      role:
        typeof source.role === 'string' && source.role
          ? source.role
          : template.role,
      independent:
        typeof source.independent === 'boolean'
          ? source.independent
          : Boolean(template.independent),
      riskTolerance: clamp(source.riskTolerance, 0, 1),
      growthPreference: clamp(source.growthPreference, 0, 1),
      financialDiscipline: clamp(source.financialDiscipline, 0, 1)
    };
  }

  function normalizeResolution(resolution) {
    if (!resolution || typeof resolution !== 'object') {
      return null;
    }

    const status = ['approved', 'rejected'].includes(resolution.status)
      ? resolution.status
      : 'rejected';

    return {
      id: String(resolution.id || ''),
      operationID: String(resolution.operationID || ''),
      week: integer(resolution.week, 1),
      type: 'growth-investment',
      amount: Math.max(0, finite(resolution.amount)),
      status,
      requiredApprovalRatio: clamp(resolution.requiredApprovalRatio, 0, 1),
      votesFor: integer(resolution.votesFor),
      votesAgainst: integer(resolution.votesAgainst),
      abstentions: integer(resolution.abstentions),
      memberVotes: Array.isArray(resolution.memberVotes)
        ? resolution.memberVotes
            .filter(Boolean)
            .slice(0, 20)
            .map(vote => ({
              memberID: String(vote.memberID || ''),
              vote: ['for', 'against', 'abstain'].includes(vote.vote)
                ? vote.vote
                : 'abstain',
              score: finite(vote.score),
              reason: String(vote.reason || '')
            }))
        : [],
      governanceQualityBefore: clamp(resolution.governanceQualityBefore, 0, 100),
      governanceQualityAfter: clamp(resolution.governanceQualityAfter, 0, 100),
      companyCashSnapshot: finite(resolution.companyCashSnapshot),
      companyValueSnapshot: finite(resolution.companyValueSnapshot),
      companyDebtSnapshot: finite(resolution.companyDebtSnapshot)
    };
  }

  function ensure(state) {
    if (!state || typeof state !== 'object') {
      return state;
    }

    const current =
      state.boardGovernance && typeof state.boardGovernance === 'object'
        ? state.boardGovernance
        : {};

    const sourceMembers = Array.isArray(current.members)
      ? current.members
      : [];

    current.version = VERSION;
    current.members = MEMBER_TEMPLATES.map((template, index) =>
      normalizeMember(sourceMembers[index], template)
    );
    current.committees = Array.isArray(current.committees)
      ? current.committees.filter(Boolean).slice(0, 20)
      : [];
    current.resolutions = Array.isArray(current.resolutions)
      ? current.resolutions.map(normalizeResolution).filter(Boolean).slice(-HISTORY_LIMIT)
      : [];
    current.governanceQuality = Number.isFinite(Number(current.governanceQuality))
      ? clamp(current.governanceQuality, 0, 100)
      : DEFAULT_GOVERNANCE_QUALITY;
    current.lastResolutionWeek = Number.isFinite(Number(current.lastResolutionWeek))
      ? integer(current.lastResolutionWeek)
      : null;
    current.nextResolutionID = Math.max(1, integer(current.nextResolutionID, 1));

    state.boardGovernance = current;
    return state;
  }

  function companyValue(state) {
    const explicit = finite(state?.companyValue);
    if (explicit > 0) return explicit;

    const assets = Math.max(
      0,
      finite(state?.companyAssets),
      finite(state?.totalAssets),
      finite(state?.finance?.balanceSheet?.assets)
    );
    const cash = Math.max(0, finite(state?.companyCash));
    const debt = Math.max(
      0,
      finite(state?.companyDebt),
      finite(state?.finance?.balanceSheet?.liabilities)
    );
    return Math.max(1, assets + cash - debt);
  }

  function weeklyProfit(state) {
    const reports = Array.isArray(state?.reports) ? state.reports : [];
    return finite(
      state?.lastReport?.profit,
      finite(reports.length ? reports[reports.length - 1]?.profit : undefined, finite(state?.weeklyProfit))
    );
  }

  function growthSignal(state) {
    const direct = finite(state?.growthRate, finite(state?.companyGrowthRate, NaN));
    if (Number.isFinite(direct)) return clamp(direct, -1, 1);

    const reports = Array.isArray(state?.reports) ? state.reports : [];
    if (reports.length >= 2) {
      const latest = finite(reports[reports.length - 1]?.revenue);
      const previous = finite(reports[reports.length - 2]?.revenue);
      if (previous > 0) return clamp((latest - previous) / previous, -1, 1);
    }
    return 0;
  }

  function buildProposal(state, amount) {
    ensure(state);
    return Object.freeze({
      type: 'growth-investment',
      amount: Math.max(0, Math.round(finite(amount))),
      week: Math.max(1, integer(state.week, 1)),
      requiredApprovalRatio: GROWTH_INVESTMENT_THRESHOLD,
      companyCash: finite(state.companyCash),
      companyDebt: Math.max(0, finite(state.companyDebt)),
      companyValue: companyValue(state),
      weeklyProfit: weeklyProfit(state),
      growthSignal: growthSignal(state)
    });
  }

  function voteScore(member, proposal, resolutionID) {
    const valueRatio = proposal.companyValue > 0 ? proposal.amount / proposal.companyValue : 1;
    const cashRatio = proposal.companyCash > 0
      ? proposal.amount / proposal.companyCash
      : proposal.amount > 0 ? 2 : 0;
    const debtRatio = proposal.companyValue > 0
      ? proposal.companyDebt / proposal.companyValue
      : 1;
    const profitCoverage = proposal.amount > 0
      ? proposal.weeklyProfit * 52 / proposal.amount
      : 0;

    const base =
      member.growthPreference * 0.34 +
      member.riskTolerance * 0.20 +
      member.financialDiscipline * 0.16 +
      clamp(proposal.growthSignal * 0.5 + 0.5) * 0.18 +
      clamp(profitCoverage * 0.25 + 0.5) * 0.12;
    const riskPenalty =
      clamp(valueRatio / 0.35) * 0.20 +
      clamp(cashRatio / 1.25) * 0.22 +
      clamp(debtRatio / 0.80) * 0.15;
    const independentPenalty = member.independent && valueRatio > 0.20 ? 0.08 : 0;
    const deterministicAdjustment =
      ((hashString(`${member.id}|${proposal.week}|${resolutionID}|${proposal.amount}`) % 2001) - 1000) /
      100000;

    return base - riskPenalty - independentPenalty + deterministicAdjustment;
  }

  function voteReason(score) {
    if (score >= 0.58) return '成長性と財務余力を評価';
    if (score >= 0.48) return '条件付きで投資妥当と判断';
    if (score <= 0.34) return '財務負担または投資規模を懸念';
    return 'リスクと期待収益の均衡を慎重評価';
  }

  function evaluateProposal(state, amount) {
    ensure(state);
    const proposal = buildProposal(state, amount);
    const resolutionID = `board-resolution-${state.boardGovernance.nextResolutionID}`;
    const memberVotes = state.boardGovernance.members.map(member => {
      const score = voteScore(member, proposal, resolutionID);
      return Object.freeze({
        memberID: member.id,
        vote: score >= 0.48 ? 'for' : score <= 0.40 ? 'against' : 'abstain',
        score,
        reason: voteReason(score)
      });
    });
    const votesFor = memberVotes.filter(item => item.vote === 'for').length;
    const votesAgainst = memberVotes.filter(item => item.vote === 'against').length;
    const abstentions = memberVotes.filter(item => item.vote === 'abstain').length;
    const totalVotingMembers = Math.max(1, memberVotes.length);
    const approvalRatio = votesFor / totalVotingMembers;

    return Object.freeze({
      resolutionID,
      proposal,
      memberVotes: Object.freeze(memberVotes),
      votesFor,
      votesAgainst,
      abstentions,
      approvalRatio,
      approved:
        proposal.amount > 0 &&
        approvalRatio + Number.EPSILON >= proposal.requiredApprovalRatio
    });
  }

  function submitResolution(state, amount) {
    ensure(state);
    const evaluation = evaluateProposal(state, amount);
    const board = state.boardGovernance;
    const week = evaluation.proposal.week;

    if (evaluation.proposal.amount <= 0) {
      return Object.freeze({ ok: false, reason: 'invalid-amount', resolution: null });
    }

    const operationID = `board-growth-investment-${week}-${evaluation.proposal.amount}`;
    if (board.resolutions.some(resolution => resolution.operationID === operationID)) {
      return Object.freeze({ ok: false, reason: 'duplicate-resolution', resolution: null });
    }

    const qualityBefore = clamp(board.governanceQuality, 0, 100);
    const qualityDelta = evaluation.approved
      ? evaluation.votesAgainst === 0 && evaluation.abstentions === 0 ? 1 : 0.5
      : evaluation.votesFor > 0 ? 0.25 : 0;
    const qualityAfter = clamp(qualityBefore + qualityDelta, 0, 100);
    const resolution = normalizeResolution({
      id: evaluation.resolutionID,
      operationID,
      week,
      type: 'growth-investment',
      amount: evaluation.proposal.amount,
      status: evaluation.approved ? 'approved' : 'rejected',
      requiredApprovalRatio: evaluation.proposal.requiredApprovalRatio,
      votesFor: evaluation.votesFor,
      votesAgainst: evaluation.votesAgainst,
      abstentions: evaluation.abstentions,
      memberVotes: evaluation.memberVotes,
      governanceQualityBefore: qualityBefore,
      governanceQualityAfter: qualityAfter,
      companyCashSnapshot: evaluation.proposal.companyCash,
      companyValueSnapshot: evaluation.proposal.companyValue,
      companyDebtSnapshot: evaluation.proposal.companyDebt
    });

    board.resolutions.push(resolution);
    board.resolutions = board.resolutions.slice(-HISTORY_LIMIT);
    board.governanceQuality = qualityAfter;
    board.lastResolutionWeek = week;
    board.nextResolutionID += 1;

    return Object.freeze({ ok: true, reason: null, resolution: Object.freeze(resolution) });
  }

  function latestResolution(state) {
    ensure(state);
    const resolutions = state.boardGovernance.resolutions;
    return resolutions.length ? resolutions[resolutions.length - 1] : null;
  }

  function summarize(state) {
    ensure(state);
    const board = state.boardGovernance;
    const independentCount = board.members.filter(member => member.independent).length;
    return Object.freeze({
      members: board.members.length,
      independentCount,
      independentRatio: board.members.length ? independentCount / board.members.length : 0,
      governanceQuality: board.governanceQuality,
      resolutions: board.resolutions.length,
      latestResolution: latestResolution(state)
    });
  }

  function install() {
    const prototype = EngineClass.prototype;
    if (prototype.__boardGovernanceResolutionInstalled) return true;

    const baseNormalize = prototype.normalize;
    prototype.normalize = function () {
      if (typeof baseNormalize === 'function') baseNormalize.call(this);
      ensure(this.g);
    };

    prototype.submitGrowthInvestmentResolution = function (amount) {
      const operationID =
        `board-resolution-submit-${integer(this.g?.week, 1)}-${Math.max(0, Math.round(finite(amount)))}`;
      const work = () => {
        const result = submitResolution(this.g, amount);
        if (!result.ok) {
          const message = result.reason === 'duplicate-resolution'
            ? '同じ週・同じ金額の投資案件は既に決議済みです。'
            : '投資額を正しく入力してください。';
          return this.fail?.(message) ?? false;
        }
        const approved = result.resolution.status === 'approved';
        this.notify?.(
          approved
            ? '重要投資案件が取締役会で承認されました。'
            : '重要投資案件は取締役会で否決されました。',
          approved ? 'success' : 'warning'
        );
        return true;
      };
      return typeof this.runTransaction === 'function'
        ? this.runTransaction(work, 'change', {
            source: 'boardGovernanceResolution',
            operationID,
            cashEffect: 0,
            profitEffect: 0
          })
        : work();
    };

    Object.defineProperty(prototype, '__boardGovernanceResolutionInstalled', { value: true });
    return true;
  }

  function renderSection(instance = bridge.getEngine?.()) {
    if (!instance?.g?.configured || instance.g.selectedTab !== 'finance') return '';

    const summary = summarize(instance.g);
    const latest = summary.latestResolution;
    const latestHtml = latest
      ? `<article class="mini-card"><b>最新決議：${latest.status === 'approved' ? '承認' : '否決'}</b><p>${esc(yen(latest.amount))}・賛成 ${latest.votesFor}・反対 ${latest.votesAgainst}・棄権 ${latest.abstentions}</p></article>`
      : '<p class="muted">決議履歴はありません。</p>';

    return `<section class="card board-governance-resolution" data-board-governance-resolution><div class="card-head"><div><h2>取締役会・重要投資決議</h2><p>取締役 ${summary.members}名・社外比率 ${(summary.independentRatio * 100).toFixed(0)}%・統治品質 ${summary.governanceQuality.toFixed(0)}</p></div><span class="badge">BOARD</span></div><div class="card-body"><label for="board-growth-investment-amount">重要投資額</label><input id="board-growth-investment-amount" type="number" min="1" step="1000000" inputmode="numeric" value="10000000" style="min-height:44px"><button class="btn primary wide" type="button" data-board-resolution-submit style="min-height:44px">取締役会へ提出</button><p class="muted">重要投資案件は取締役3名の3分の2以上の賛成で承認されます。決議だけでは会社現金を移動しません。</p>${latestHtml}</div></section>`;
  }

  let bound = false;
  let queued = false;

  function inject() {
    queued = false;
    if (typeof document === 'undefined') return false;
    const screen = document.querySelector?.('[data-screen="finance"]');
    const html = renderSection();
    const existing = screen?.querySelector?.('[data-board-governance-resolution]');
    if (!screen || !html) {
      existing?.remove?.();
      return false;
    }
    if (existing) {
      if (existing.outerHTML === html) return false;
      existing.outerHTML = html;
    } else screen.insertAdjacentHTML?.('beforeend', html);
    return true;
  }

  function schedule() {
    inject();
  }

  function handleClick(event) {
    const button = event?.target?.closest?.('[data-board-resolution-submit]');
    if (!button || button.disabled) return false;
    const instance = bridge.getEngine?.();
    if (!instance) return false;
    const input = document.getElementById?.('board-growth-investment-amount');
    const amount = finite(input?.value);
    event.preventDefault?.();
    button.disabled = true;
    const result = instance.submitGrowthInvestmentResolution?.(amount);
    if (!result) button.disabled = false;
    schedule();
    return Boolean(result);
  }

  let registeredEnhancerDefinition = null;
  function registerEnhancer(definition) {
    if (registeredEnhancerDefinition) return registeredEnhancerDefinition;
    registeredEnhancerDefinition = definition;
    const registry = modules.uiEnhancerRegistry;
    if (registry?.registerUIEnhancer) return registry.registerUIEnhancer(definition);
    const key = '__capitalismTycoonPendingUIEnhancers';
    const pending = Array.isArray(globalThis[key]) ? globalThis[key] : (globalThis[key] = []);
    pending.push(definition);
    return definition;
  }

  function installUI() {
    if (typeof document === 'undefined') return false;
    const root = document.getElementById?.('app');
    if (root && !bound) {
      root.addEventListener?.('click', handleClick);
      bound = true;
    }
    registerEnhancer({ id: 'board-governance-resolution', enhance: inject });
    schedule();
    return true;
  }

  install();
  installUI();

  modules.boardGovernanceResolution = Object.freeze({
    VERSION,
    HISTORY_LIMIT,
    GROWTH_INVESTMENT_THRESHOLD,
    MEMBER_TEMPLATES,
    ensure,
    buildProposal,
    voteScore,
    evaluateProposal,
    submitResolution,
    latestResolution,
    summarize,
    renderSection,
    install,
    installUI,
    inject,
    handleClick,
    __installed: true
  });
})();
