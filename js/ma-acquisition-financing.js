// Script boundary: js/ma-acquisition-financing.js (classic JavaScript)
'use strict';
(function (exports) {
  if (globalThis.__capitalismTycoonModules?.maAcquisitionFinancing?.__installed) {
    throw new Error('Capitalism Tycoon maAcquisitionFinancing module is already registered.');
  }
  const modules = globalThis.__capitalismTycoonModules || (globalThis.__capitalismTycoonModules = {});
  const finance = modules.finance;
  const nf = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const arr = value => Array.isArray(value) ? value : [];
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, nf(value, min)));
  const round = value => Math.round(nf(value));
  const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const TERMINAL_LOAN_STATUSES = new Set(['inactive', 'repaid', 'closed', 'paid', 'settled']);

  const PRESET_DEFINITIONS = Object.freeze({
    'cash-heavy': Object.freeze({ id: 'cash-heavy', label: '現金重視', ratios: Object.freeze({ cash: .75, term: .25, bridge: 0, equity: 0 }), priority: Object.freeze(['cash', 'term', 'equity', 'bridge']) }),
    balanced: Object.freeze({ id: 'balanced', label: 'バランス', ratios: Object.freeze({ cash: .4, term: .4, bridge: 0, equity: .2 }), priority: Object.freeze(['cash', 'term', 'equity', 'bridge']) }),
    leveraged: Object.freeze({ id: 'leveraged', label: 'レバレッジ', ratios: Object.freeze({ cash: .2, term: .6, bridge: .2, equity: 0 }), priority: Object.freeze(['term', 'bridge', 'cash', 'equity']) }),
    'low-dilution': Object.freeze({ id: 'low-dilution', label: '希薄化抑制', ratios: Object.freeze({ cash: .5, term: .5, bridge: 0, equity: 0 }), priority: Object.freeze(['cash', 'term', 'bridge', 'equity']) }),
    'liquidity-protected': Object.freeze({ id: 'liquidity-protected', label: '流動性維持', ratios: Object.freeze({ cash: 0, term: .55, bridge: 0, equity: .45 }), priority: Object.freeze(['term', 'equity', 'bridge', 'cash']) }),
    custom: Object.freeze({ id: 'custom', label: 'カスタム', ratios: Object.freeze({ cash: 0, term: 0, bridge: 0, equity: 0 }), priority: Object.freeze([]), custom: true })
  });
  const THRESHOLDS = Object.freeze({
    cashWeeks: 4, minWeeklyOutflow: 1_000_000, maxEquityDilution: .25,
    warnEquityDilution: .10, strongWarnEquityDilution: .20, maxBridgeShare: .30,
    termWeeks: 104, bridgeWeeks: 26, minTermWeeks: 52, maxTermWeeks: 156,
    minBridgeWeeks: 13, maxBridgeWeeks: 26, termFeeRate: .01,
    bridgeFeeRate: .015, equityFeeRate: .02, bridgeRatePremium: .03
  });

  function activeLoanWeeklyPayments(state) {
    return arr(state?.finance?.loans)
      .filter(loan => !TERMINAL_LOAN_STATUSES.has(String(loan?.status || 'active')))
      .reduce((sum, loan) => {
        const payment = [loan?.scheduledPrincipalPayment, loan?.weeklyPrincipalPayment, loan?.weeklyPayment, loan?.paymentPerWeek, loan?.minimumPayment]
          .map(value => Math.max(0, nf(value))).find(value => value > 0) || 0;
        return sum + payment;
      }, 0);
  }
  function openStoreFixedCosts(state) {
    return arr(state?.stores).filter(store => !store?.status || store.status === 'open').reduce((sum, store) => sum + Math.max(0,
      nf(store?.weeklyFixedCost, nf(store?.rent) + nf(store?.laborCost) + nf(store?.utilityCost))), 0);
  }
  function minimumCashBuffer(state) {
    const reports = arr(state?.reports);
    const last = reports[reports.length - 1] || state?.lastReport || {};
    const weeklyOutflow = Math.max(THRESHOLDS.minWeeklyOutflow, nf(last?.expenses), activeLoanWeeklyPayments(state), openStoreFixedCosts(state));
    return round(weeklyOutflow * THRESHOLDS.cashWeeks);
  }
  function termsKey(deal) {
    return modules.maBoardApproval?.buildTermsKey?.(deal) || [
      deal?.id, deal?.targetID, deal?.acceptedTerms?.method, deal?.acceptedTerms?.finalPrice,
      deal?.acceptedTerms?.acceptedWeek, deal?.acceptedTerms?.closingDeadlineWeek, deal?.acceptedTerms?.offerRound
    ].map(value => value ?? '').join('|');
  }
  function targetFor(state, deal) { return arr(state?.acquisitionTargets).find(target => target?.id === deal?.targetID) || null; }
  function companyValueOf(state, helpers = {}) {
    if (Number.isFinite(Number(helpers.companyValue))) return Math.max(1, nf(helpers.companyValue));
    if (helpers.engine && typeof helpers.engine.companyValue === 'function') return Math.max(1, nf(helpers.engine.companyValue()));
    return Math.max(1, nf(state?.companyValue, nf(state?.companyCash) - nf(state?.companyDebt)));
  }
  function helperBundle(engine) {
    return { engine, companyValue: engine?.companyValue?.(), borrowRate: engine?.companyBorrowRate?.(), creditLimit: engine?.companyCreditLimit?.() };
  }
  function currentBorrowRate(state, helpers = {}) {
    if (Number.isFinite(Number(helpers.borrowRate))) return clamp(helpers.borrowRate, .005, .18);
    if (helpers.engine && modules.playerDebtService?.negotiatedRate) return clamp(modules.playerDebtService.negotiatedRate(helpers.engine), .005, .18);
    if (helpers.engine && typeof helpers.engine.companyBorrowRate === 'function') return clamp(helpers.engine.companyBorrowRate(), .005, .18);
    return clamp(nf(state?.finance?.creditRating?.effectiveRate, .06), .005, .18);
  }
  function currentCreditGrade(state) {
    const grade = String(state?.finance?.creditRating?.grade || 'BBB');
    return ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'].includes(grade) ? grade : 'BBB';
  }
  function currentCovenantStatus(state) {
    const status = String(state?.finance?.bankCovenants?.status || 'compliant');
    return ['compliant', 'warning', 'breach'].includes(status) ? status : 'compliant';
  }
  function currentLiquidityStatus(state) {
    const status = String(state?.finance?.liquidityRunway?.status || 'stable');
    return ['stable', 'watch', 'critical'].includes(status) ? status : 'stable';
  }
  function currentConcentrationStatus(state) {
    const status = String(state?.finance?.fundingConcentration?.status || 'diversified');
    return ['diversified', 'watch', 'concentrated'].includes(status) ? status : 'diversified';
  }
  function estimatedFeeReserve(price) { return round(Math.max(0, nf(price)) * THRESHOLDS.equityFeeRate); }

  function buildCapacity(state, deal, helpers = {}) {
    const method = deal?.acceptedTerms?.method || deal?.currentOffer?.method || 'friendly';
    const price = Math.max(0, nf(deal?.acceptedTerms?.finalPrice, helpers.offerPrice || deal?.currentOffer?.offerPrice));
    const availableCash = Math.max(0, nf(state?.companyCash));
    const buffer = minimumCashBuffer(state);
    const estimatedFees = estimatedFeeReserve(price);
    const maximumCashContribution = Math.max(0, availableCash - buffer - estimatedFees);
    const companyValue = companyValueOf(state, helpers);
    const debtBefore = Math.max(0, nf(state?.companyDebt));
    const borrowRate = currentBorrowRate(state, helpers);
    const creditLimit = Number.isFinite(Number(helpers.creditLimit)) ? Math.max(0, nf(helpers.creditLimit))
      : Math.max(0, companyValue * (.15 + clamp(nf(state?.companyCredit, 60), 0, 100) / 250));
    const covenantStatus = currentCovenantStatus(state);
    const maximumAdditionalDebt = covenantStatus === 'breach' ? 0 : Math.max(0, creditLimit - debtBefore);
    const publicCompany = Boolean(state?.publicCompany);
    const stockPrice = Math.max(0, nf(state?.stockPrice));
    const sharesOut = Math.max(0, nf(state?.sharesOut));
    const maximumNewShares = publicCompany && stockPrice > 0 ? Math.floor(sharesOut * THRESHOLDS.maxEquityDilution / (1 - THRESHOLDS.maxEquityDilution)) : 0;
    const maximumEquityRaise = round(maximumNewShares * stockPrice);
    const maximumBridgeLoan = round(Math.min(maximumAdditionalDebt, price * THRESHOLDS.maxBridgeShare));
    const maximumTermLoan = round(maximumAdditionalDebt);
    const availableFunding = round(maximumCashContribution + maximumAdditionalDebt + maximumEquityRaise);
    const blockers = [], warnings = [];
    if (covenantStatus === 'breach') blockers.push('covenant-breach');
    if (availableCash < estimatedFees) blockers.push('fee-cash-shortfall');
    if (!publicCompany) warnings.push('not-public');
    return Object.freeze({
      available: method === 'shareSwap' || (blockers.length === 0 && availableFunding >= price),
      availableFunding, finalPrice: price, estimatedFees, transactionFees: estimatedFees,
      totalFundingRequired: price, totalCashRequirement: price + estimatedFees, availableCash,
      minimumCashBuffer: buffer, maximumCashContribution: round(maximumCashContribution),
      creditGrade: currentCreditGrade(state), borrowRate, covenantStatus, debtBefore,
      maximumAdditionalDebt: round(maximumAdditionalDebt), maximumTermLoan, maximumBridgeLoan,
      publicCompany, stockPrice, sharesOut, maximumEquityRaise, maximumNewShares,
      maximumDilution: THRESHOLDS.maxEquityDilution, liquidityStatus: currentLiquidityStatus(state),
      debtConcentrationStatus: currentConcentrationStatus(state),
      blockers: Object.freeze(blockers), warnings: Object.freeze(warnings)
    });
  }

  function feeFor(plan) {
    return round(nf(plan?.termLoanAmount) * THRESHOLDS.termFeeRate + nf(plan?.bridgeLoanAmount) * THRESHOLDS.bridgeFeeRate +
      nf(plan?.requestedEquityAmount, nf(plan?.equityRaiseAmount)) * THRESHOLDS.equityFeeRate);
  }
  function buildPlanKey(deal, plan) {
    return [deal?.id, termsKey(deal), nf(deal?.acceptedTerms?.finalPrice), nf(plan?.cashAmount), nf(plan?.termLoanAmount),
      nf(plan?.bridgeLoanAmount), nf(plan?.requestedEquityAmount, nf(plan?.equityRaiseAmount)),
      nf(plan?.termWeeks, THRESHOLDS.termWeeks), nf(plan?.bridgeWeeks, THRESHOLDS.bridgeWeeks), nf(plan?.selectedWeek)].join('|');
  }
  function allocatePreset(capacity, definition) {
    const need = capacity.totalFundingRequired;
    const amounts = {
      cash: Math.min(round(need * definition.ratios.cash), capacity.maximumCashContribution),
      term: Math.min(round(need * definition.ratios.term), capacity.maximumTermLoan),
      bridge: Math.min(round(need * definition.ratios.bridge), capacity.maximumBridgeLoan),
      equity: Math.min(round(need * definition.ratios.equity), capacity.maximumEquityRaise)
    };
    if (!capacity.publicCompany) amounts.equity = 0;
    let debtExcess = Math.max(0, amounts.term + amounts.bridge - capacity.maximumAdditionalDebt);
    if (debtExcess) { const bridgeCut = Math.min(debtExcess, amounts.bridge); amounts.bridge -= bridgeCut; debtExcess -= bridgeCut; amounts.term = Math.max(0, amounts.term - debtExcess); }
    let remaining = need - amounts.cash - amounts.term - amounts.bridge - amounts.equity;
    const room = source => source === 'cash' ? capacity.maximumCashContribution - amounts.cash
      : source === 'term' ? Math.min(capacity.maximumTermLoan - amounts.term, capacity.maximumAdditionalDebt - amounts.term - amounts.bridge)
      : source === 'bridge' ? Math.min(capacity.maximumBridgeLoan - amounts.bridge, capacity.maximumAdditionalDebt - amounts.term - amounts.bridge)
      : capacity.publicCompany ? capacity.maximumEquityRaise - amounts.equity : 0;
    for (const source of definition.priority) {
      if (remaining <= 0) break;
      const add = Math.max(0, Math.min(remaining, room(source)));
      amounts[source] += add;
      remaining -= add;
    }
    return { amounts, remaining: Math.max(0, remaining) };
  }
  function buildPlan(state, deal, input = {}, helpers = {}) {
    const capacity = buildCapacity(state, deal, helpers);
    const definition = PRESET_DEFINITIONS[String(input?.presetID || 'custom')] || PRESET_DEFINITIONS.custom;
    let cashAmount, termLoanAmount, bridgeLoanAmount, requestedEquityAmount;
    const unavailableReasons = [];
    if (definition.custom) {
      cashAmount = round(Math.max(0, nf(input.cashAmount)));
      termLoanAmount = round(Math.max(0, nf(input.termLoanAmount)));
      bridgeLoanAmount = round(Math.max(0, nf(input.bridgeLoanAmount)));
      requestedEquityAmount = round(Math.max(0, nf(input.requestedEquityAmount, nf(input.equityRaiseAmount))));
    } else {
      const allocation = allocatePreset(capacity, definition);
      ({ cash: cashAmount, term: termLoanAmount, bridge: bridgeLoanAmount, equity: requestedEquityAmount } = allocation.amounts);
      if (allocation.remaining > 0) unavailableReasons.push('funding-capacity-insufficient');
    }
    const plan = {
      status: 'selected', presetID: definition.id, available: unavailableReasons.length === 0,
      unavailableReasons, cashAmount, termLoanAmount, bridgeLoanAmount, requestedEquityAmount,
      equityRaiseAmount: requestedEquityAmount,
      totalSources: cashAmount + termLoanAmount + bridgeLoanAmount + requestedEquityAmount,
      fees: 0, selectedWeek: Math.floor(nf(input.selectedWeek, state?.week || 1)),
      termWeeks: Math.floor(clamp(nf(input.termWeeks, THRESHOLDS.termWeeks), THRESHOLDS.minTermWeeks, THRESHOLDS.maxTermWeeks)),
      bridgeWeeks: Math.floor(clamp(nf(input.bridgeWeeks, THRESHOLDS.bridgeWeeks), THRESHOLDS.minBridgeWeeks, THRESHOLDS.maxBridgeWeeks)),
      termsKey: termsKey(deal)
    };
    plan.fees = feeFor(plan);
    plan.planKey = buildPlanKey(deal, plan);
    return Object.freeze({ ...plan, unavailableReasons: Object.freeze([...unavailableReasons]) });
  }
  function buildPresets(state, deal, helpers = {}) {
    return Object.keys(PRESET_DEFINITIONS).filter(id => id !== 'custom').map(id => buildPlan(state, deal, { presetID: id }, helpers));
  }

  function evaluatePostDealRisk(state, plan, base, helpers = {}) {
    const shadowState = clone(state);
    shadowState.companyCash = base.postDealCash;
    shadowState.companyDebt = base.postDealDebt;
    const ledger = finance?.ensureFinance?.(shadowState);
    if (ledger) {
      for (const [kind, amount, weeks, rate] of [
        ['term', nf(plan?.termLoanAmount), nf(plan?.termWeeks, THRESHOLDS.termWeeks), base.borrowRate],
        ['bridge', nf(plan?.bridgeLoanAmount), nf(plan?.bridgeWeeks, THRESHOLDS.bridgeWeeks), base.borrowRate + THRESHOLDS.bridgeRatePremium]
      ]) if (amount > 0) ledger.loans.push({
        loanID: `ma-preview-${kind}-${plan?.planKey || 'plan'}`, principal: amount, outstandingPrincipal: amount,
        interestRate: rate, termWeeks: weeks, remainingWeeks: weeks, repaymentMethod: 'equal-principal',
        weeklyPrincipalPayment: round(amount / Math.max(1, weeks)), scheduledPrincipalPayment: round(amount / Math.max(1, weeks)),
        nextPaymentWeek: Math.floor(nf(shadowState.week, 1)) + 1, status: 'active',
        sourceType: kind === 'term' ? 'maAcquisitionTermLoan' : 'maAcquisitionBridgeLoan'
      });
    }
    shadowState.lastReport = { ...(shadowState.lastReport || {}), interest: Math.max(0, nf(shadowState.lastReport?.interest)) + base.weeklyInterest };
    const shadow = helpers.engine ? Object.create(helpers.engine) : { g: shadowState };
    shadow.g = shadowState; shadow.save = () => true; shadow.emit = () => {}; shadow.notify = () => {};
    let covenantStatus = currentCovenantStatus(shadowState), creditGrade = currentCreditGrade(shadowState);
    let liquidityStatus = currentLiquidityStatus(shadowState), debtConcentrationStatus = currentConcentrationStatus(shadowState);
    let cashRunwayWeeks = Math.floor(base.postDealCash / Math.max(1, minimumCashBuffer(shadowState) / THRESHOLDS.cashWeeks));
    let borrowRate = base.borrowRate;
    try {
      if (modules.playerBankCovenants?.evaluate) { if (shadowState.finance?.bankCovenants) shadowState.finance.bankCovenants.lastCheckedWeek = -1; covenantStatus = modules.playerBankCovenants.evaluate(shadow).status; }
      if (modules.playerCreditRating?.evaluate) { if (shadowState.finance?.creditRating) shadowState.finance.creditRating.lastCheckedWeek = -1; creditGrade = modules.playerCreditRating.evaluate(shadow).grade; }
      if (modules.playerLiquidityRunway?.evaluate) { if (shadowState.finance?.liquidityRunway) shadowState.finance.liquidityRunway.lastCheckedWeek = -1; const row = modules.playerLiquidityRunway.evaluate(shadow); liquidityStatus = row.status; cashRunwayWeeks = nf(row.runwayWeeks, cashRunwayWeeks); }
      if (modules.playerFundingConcentration?.evaluate) { if (shadowState.finance?.fundingConcentration) shadowState.finance.fundingConcentration.lastCheckedWeek = -1; debtConcentrationStatus = modules.playerFundingConcentration.evaluate(shadow).status; }
      if (modules.playerDebtService?.negotiatedRate && helpers.engine) borrowRate = clamp(modules.playerDebtService.negotiatedRate(shadow), .005, .18);
    } catch (_) {}
    return Object.freeze({ covenantStatus, creditGrade, liquidityStatus, debtConcentrationStatus, cashRunwayWeeks, borrowRate });
  }
  function previewPostDeal(state, deal, plan, helpers = {}) {
    const capacity = buildCapacity(state, deal, helpers);
    const selected = plan || deal?.acquisitionFinancingPlan || buildPlan(state, deal, { presetID: 'cash-heavy' }, helpers);
    const requestedEquityAmount = Math.max(0, nf(selected?.requestedEquityAmount, nf(selected?.equityRaiseAmount)));
    const newShares = requestedEquityAmount > 0 && capacity.publicCompany && capacity.stockPrice > 0 ? Math.ceil(requestedEquityAmount / capacity.stockPrice) : 0;
    const actualEquityProceeds = round(newShares * capacity.stockPrice);
    const term = Math.max(0, nf(selected?.termLoanAmount)), bridge = Math.max(0, nf(selected?.bridgeLoanAmount));
    const newDebt = term + bridge, baseBorrowRate = capacity.borrowRate;
    const weeklyInterest = round(term * baseBorrowRate / 52 + bridge * (baseBorrowRate + THRESHOLDS.bridgeRatePremium) / 52);
    const weeklyPrincipalPayment = round(term / Math.max(1, nf(selected?.termWeeks, THRESHOLDS.termWeeks)) + bridge / Math.max(1, nf(selected?.bridgeWeeks, THRESHOLDS.bridgeWeeks)));
    const finalPrice = Math.max(0, nf(deal?.acceptedTerms?.finalPrice)), fees = feeFor(selected);
    const postDealCash = round(nf(state?.companyCash) + newDebt + actualEquityProceeds - finalPrice - fees);
    const postDealDebt = round(nf(state?.companyDebt) + newDebt);
    const currentShares = Math.max(0, nf(state?.sharesOut)), projectedSharesAfter = currentShares + newShares;
    const dilution = projectedSharesAfter > 0 ? newShares / projectedSharesAfter : 0;
    const target = targetFor(state, deal), identifiableNetAssets = target ? Math.min(finalPrice, Math.max(0, nf(target?.valuation))) : 0;
    const goodwill = Math.max(0, finalPrice - identifiableNetAssets);
    const risk = evaluatePostDealRisk(state, selected, { postDealCash, postDealDebt, weeklyInterest, borrowRate: baseBorrowRate }, helpers);
    return Object.freeze({
      postDealCash, postDealDebt, newDebt: round(newDebt), requestedEquityAmount: round(requestedEquityAmount),
      actualEquityProceeds, newEquityAmount: actualEquityProceeds, newShares, projectedSharesAfter, dilution,
      borrowRate: risk.borrowRate, termLoanRate: baseBorrowRate, bridgeLoanRate: baseBorrowRate + THRESHOLDS.bridgeRatePremium,
      weeklyInterest, weeklyPrincipalPayment, covenantStatus: risk.covenantStatus, creditGrade: risk.creditGrade,
      liquidityStatus: risk.liquidityStatus, debtConcentrationStatus: risk.debtConcentrationStatus,
      cashRunwayWeeks: risk.cashRunwayWeeks, minimumCashBuffer: capacity.minimumCashBuffer,
      goodwill, identifiableNetAssets, fees, fundingGap: round(finalPrice - nf(selected?.totalSources)),
      closingFeasible: postDealCash >= 0 && risk.covenantStatus !== 'breach'
    });
  }
  function validatePlan(state, deal, plan, helpers = {}) {
    const capacity = buildCapacity(state, deal, helpers), errors = [], warnings = [];
    if (deal?.acceptedTerms?.method === 'shareSwap') return Object.freeze({ valid: true, errors: Object.freeze([]), warnings: Object.freeze([]), capacity, preview: null });
    if (!plan || typeof plan !== 'object') return Object.freeze({ valid: false, errors: Object.freeze(['funding-plan-missing']), warnings: Object.freeze([]), capacity, preview: null });
    for (const key of ['cashAmount', 'termLoanAmount', 'bridgeLoanAmount']) if (nf(plan[key], -1) < 0) errors.push('negative-amount');
    const requestedEquityAmount = nf(plan.requestedEquityAmount, nf(plan.equityRaiseAmount, -1));
    if (requestedEquityAmount < 0) errors.push('negative-amount');
    if (String(plan.termsKey || '') !== termsKey(deal)) errors.push('terms-key-mismatch');
    if (String(plan.planKey || '') !== buildPlanKey(deal, plan)) errors.push('plan-key-mismatch');
    if (nf(plan.totalSources) !== capacity.totalFundingRequired) errors.push('funding-total-mismatch');
    if (nf(plan.cashAmount) > capacity.maximumCashContribution) errors.push('cash-capacity-exceeded');
    const totalDebt = nf(plan.termLoanAmount) + nf(plan.bridgeLoanAmount);
    if (totalDebt > capacity.maximumAdditionalDebt) errors.push('debt-capacity-exceeded');
    if (nf(plan.termLoanAmount) > capacity.maximumTermLoan) errors.push('term-capacity-exceeded');
    if (nf(plan.bridgeLoanAmount) > capacity.maximumBridgeLoan) errors.push('bridge-capacity-exceeded');
    if (requestedEquityAmount > capacity.maximumEquityRaise) errors.push('equity-capacity-exceeded');
    if (requestedEquityAmount > 0 && (!capacity.publicCompany || capacity.stockPrice <= 0)) errors.push('equity-unavailable');
    if (plan.available === false) errors.push(...arr(plan.unavailableReasons));
    const preview = previewPostDeal(state, deal, plan, helpers);
    if (preview.dilution > THRESHOLDS.maxEquityDilution) errors.push('dilution-block');
    if (preview.covenantStatus === 'breach') errors.push('covenant-breach');
    if (preview.postDealCash < 0) errors.push('negative-post-cash');
    if (nf(plan.cashAmount) + preview.fees > capacity.availableCash) errors.push('fee-cash-shortfall');
    if (preview.dilution > THRESHOLDS.warnEquityDilution) warnings.push('dilution-warning');
    if (nf(plan.bridgeLoanAmount) > 0) warnings.push('bridge-refinancing-risk');
    if (preview.postDealCash < capacity.minimumCashBuffer) warnings.push('cash-buffer-warning');
    if (preview.debtConcentrationStatus === 'concentrated') warnings.push('funding-concentration-warning');
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze([...new Set(errors)]), warnings: Object.freeze([...new Set(warnings)]), capacity, preview });
  }

  function selectPlan(engine, dealID, input) {
    const deal = arr(engine?.g?.maDealRooms).find(row => row?.id === dealID);
    if (!deal || deal.status !== 'accepted') return engine?.fail?.('受諾済み案件だけ資金調達案を選択できます。') || false;
    if (deal.acceptedTerms?.method === 'shareSwap') return engine?.fail?.('株式交換では買い手側の資金調達は実行しません。') || false;
    const helpers = helperBundle(engine), plan = buildPlan(engine.g, deal, input, helpers), validation = validatePlan(engine.g, deal, plan, helpers);
    if (!validation.valid) return engine?.fail?.(`資金調達案が不正です: ${validation.errors.join(',')}`) || false;
    const same = deal.acquisitionFinancingPlan?.planKey === plan.planKey;
    deal.acquisitionFinancingPlan = clone(plan);
    if (deal.boardApproval && !same) deal.boardApproval = null;
    deal.history = arr(deal.history);
    const historyID = `ma-financing-${deal.id}-${plan.planKey}`;
    if (!same && !deal.history.some(row => row?.id === historyID)) {
      deal.history.push({ id: historyID, week: engine.g.week, type: 'financing_selected', message: '買収資金調達案を選択しました。', planKey: plan.planKey });
      deal.history = deal.history.slice(-100);
    }
    engine.save?.(); engine.emit?.(); return true;
  }
  function clearPlan(engine, dealID) {
    const deal = arr(engine?.g?.maDealRooms).find(row => row?.id === dealID);
    if (!deal || deal.status !== 'accepted') return engine?.fail?.('受諾済み案件だけ資金調達案を解除できます。') || false;
    if (!deal.acquisitionFinancingPlan && !deal.boardApproval) return true;
    deal.acquisitionFinancingPlan = null; deal.boardApproval = null; engine.save?.(); engine.emit?.(); return true;
  }
  function createLoan(state, deal, kind, amount, weeks, interestRate) {
    if (amount <= 0) return null;
    const ledger = finance.ensureFinance(state), loanID = `ma-${kind}-loan-${deal.id}`;
    if (ledger.loans.some(loan => loan?.loanID === loanID)) throw new Error(`duplicate-loan:${loanID}`);
    const weeklyPrincipalPayment = round(amount / Math.max(1, weeks));
    const sourceType = kind === 'term' ? 'maAcquisitionTermLoan' : 'maAcquisitionBridgeLoan';
    const loan = { loanID, id: loanID, sourceType, sourceID: deal.id, principal: amount, outstandingPrincipal: amount, interestRate,
      termWeeks: weeks, remainingWeeks: weeks, repaymentMethod: 'equal-principal', weeklyPrincipalPayment,
      scheduledPrincipalPayment: weeklyPrincipalPayment, nextPaymentWeek: Math.floor(nf(state.week, 1)) + 1, status: 'active' };
    ledger.loans.push(loan); state.companyCash = nf(state.companyCash) + amount; state.companyDebt = nf(state.companyDebt) + amount;
    const transaction = finance.event(state, 'debtBorrowing', amount, { cashEffect: amount, liabilityEffect: amount, sourceType, sourceID: deal.id,
      idempotencyKey: `ma-${kind}-borrow-${deal.id}`, operationID: `ma-${kind}-borrow-${deal.id}`,
      description: kind === 'term' ? 'M&A 買収タームローン' : 'M&A ブリッジローン' });
    if (!transaction) throw new Error(`duplicate-debt-transaction:${kind}`);
    return loan;
  }
  function executeFinancing(engine, deal, plan) {
    const state = engine.g, validation = validatePlan(state, deal, plan, helperBundle(engine));
    if (!validation.valid) throw new Error(`funding-plan-invalid:${validation.errors.join(',')}`);
    createLoan(state, deal, 'term', round(plan.termLoanAmount), Math.floor(nf(plan.termWeeks, THRESHOLDS.termWeeks)), validation.capacity.borrowRate);
    createLoan(state, deal, 'bridge', round(plan.bridgeLoanAmount), Math.floor(nf(plan.bridgeWeeks, THRESHOLDS.bridgeWeeks)), validation.capacity.borrowRate + THRESHOLDS.bridgeRatePremium);
    const requestedEquityAmount = round(nf(plan.requestedEquityAmount, nf(plan.equityRaiseAmount)));
    if (requestedEquityAmount > 0) {
      if (!state.publicCompany || nf(state.stockPrice) <= 0) throw new Error('equity-unavailable');
      const newShares = Math.ceil(requestedEquityAmount / Math.max(1, nf(state.stockPrice))), proceeds = round(newShares * Math.max(1, nf(state.stockPrice)));
      state.companyCash = nf(state.companyCash) + proceeds; state.sharesOut = nf(state.sharesOut) + newShares;
      if (typeof engine.updateOwnershipRatios === 'function') engine.updateOwnershipRatios();
      else { const eligible = Math.max(1, nf(state.sharesOut) - nf(state.treasuryBuybackShares)); state.founderOwnershipRatio = clamp(nf(state.founderShares) / eligible); state.externalShareholderRatio = clamp(1 - state.founderOwnershipRatio - nf(state.competitorOwnedRatio)); }
      finance.ensureFinance(state).balances.capitalSurplus = nf(finance.ensureFinance(state).balances.capitalSurplus) + proceeds;
      const transaction = finance.event(state, 'equityFinancing', proceeds, { cashEffect: proceeds, equityEffect: proceeds, sourceType: 'maPublicEquityRaise', sourceID: deal.id,
        idempotencyKey: `ma-equity-${deal.id}`, operationID: `ma-equity-${deal.id}`, description: 'M&A 公募増資' });
      if (!transaction) throw new Error('duplicate-equity-transaction');
    }
    const fees = validation.preview.fees;
    if (fees > 0) {
      if (nf(state.companyCash) < fees) throw new Error('fee-shortfall');
      state.companyCash = nf(state.companyCash) - fees;
      const transaction = finance.event(state, 'headOfficeExpense', fees, { cashEffect: -fees, profitEffect: -fees,
        sourceType: 'maAcquisitionFinancingFees', sourceID: deal.id, idempotencyKey: `ma-financing-fees-${deal.id}`,
        operationID: `ma-financing-fees-${deal.id}`, description: 'M&A 資金調達手数料' });
      if (!transaction) throw new Error('duplicate-fee-transaction');
    }
    return true;
  }
  function replaceState(target, source) { for (const key of Object.keys(target)) delete target[key]; Object.assign(target, source); }
  function restoreStorage(key, previous) {
    if (!key || typeof localStorage === 'undefined') return;
    if (previous === null || previous === undefined) localStorage.removeItem(key); else localStorage.setItem(key, previous);
  }
  function installMAAcquisitionFinancing(TycoonEngine) {
    if (!TycoonEngine) return;
    const proto = TycoonEngine.prototype, baseComplete = proto.completeTargetAcquisition;
    if (proto.__maAcquisitionFinancingInstalled && proto.__maAcquisitionFinancingWrapped) return;
    proto.maAcquisitionFinancingCapacity = function (dealID) { return buildCapacity(this.g, arr(this.g?.maDealRooms).find(row => row?.id === dealID), helperBundle(this)); };
    proto.maAcquisitionFinancingPresets = function (dealID) { return buildPresets(this.g, arr(this.g?.maDealRooms).find(row => row?.id === dealID), helperBundle(this)); };
    proto.selectMAAcquisitionFinancing = function (dealID, plan) { return selectPlan(this, dealID, plan); };
    proto.clearMAAcquisitionFinancing = function (dealID) { return clearPlan(this, dealID); };
    if (typeof baseComplete === 'function' && !proto.__maAcquisitionFinancingWrapped) {
      proto.completeTargetAcquisition = function (args = {}) {
        const liveState = this.g, liveDeal = arr(liveState?.maDealRooms).find(deal => deal?.id === args.dealID);
        if (liveDeal?.acceptedTerms?.method === 'shareSwap') return baseComplete.call(this, args);
        const plan = liveDeal?.acquisitionFinancingPlan;
        if (!plan) return this.fail?.('買収資金調達案が未選択です。') || false;
        if (liveDeal?.boardApproval?.financingPlanKey !== plan.planKey) return this.fail?.('資金調達条件変更のため再承認が必要です。') || false;
        const liveSnapshot = clone(liveState), storageKey = modules.engine?.SAVE_KEY;
        const storageBefore = storageKey && typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
        const shadowState = clone(liveState), shadow = Object.create(this);
        shadow.g = shadowState; shadow.save = () => true; shadow.emit = () => {}; shadow.notify = () => {};
        shadow.fail = message => { shadow.__maFailure = String(message || 'M&A closing failed'); return false; };
        const shadowDeal = arr(shadowState.maDealRooms).find(deal => deal?.id === args.dealID);
        const targetName = targetFor(shadowState, shadowDeal)?.name || shadowDeal?.targetID || '対象企業';
        try {
          executeFinancing(shadow, shadowDeal, shadowDeal.acquisitionFinancingPlan);
          if (!baseComplete.call(shadow, args)) throw new Error(shadow.__maFailure || 'acquisition-completion-failed');
          const validation = finance.validate(shadow.g);
          if (!validation?.ok) throw new Error(`finance-validation:${arr(validation?.errors).join('|')}`);
          const committed = clone(shadow.g); replaceState(liveState, committed);
          try {
            if (this.save?.() === false) throw new Error('save-failed');
            this.emit?.(); this.notify?.(`${targetName}の買収資金調達と最終契約を完了しました。`, 'success');
          } catch (error) { replaceState(liveState, liveSnapshot); restoreStorage(storageKey, storageBefore); throw error; }
          return true;
        } catch (_) { replaceState(liveState, liveSnapshot); restoreStorage(storageKey, storageBefore); return false; }
      };
      Object.defineProperty(proto, '__maAcquisitionFinancingWrapped', { value: true });
    }
    if (!proto.__maAcquisitionFinancingInstalled) Object.defineProperty(proto, '__maAcquisitionFinancingInstalled', { value: true });
  }
  Object.assign(exports, { buildCapacity, buildPlan, buildPresets, validatePlan, buildPlanKey, selectPlan, clearPlan,
    previewPostDeal, executeFinancing, installMAAcquisitionFinancing, minimumCashBuffer, PRESET_DEFINITIONS, THRESHOLDS, __installed: true });
  installMAAcquisitionFinancing(modules.engine?.TycoonEngine);
})(globalThis.__capitalismTycoonModules.maAcquisitionFinancing || (globalThis.__capitalismTycoonModules.maAcquisitionFinancing = {}));
