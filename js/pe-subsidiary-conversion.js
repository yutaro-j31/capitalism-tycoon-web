// Bridges a personally-held PE deal into the company's own subsidiary ledger: the player
// sells a PE holding to their own company at its current fair valuation, and the result is
// a normal entry in state.subsidiaries — the same array and field shape the existing
// subsidiary IPO pipeline (subsidiary-ipo-preparation.js, via engine.makeSubsidiary's
// shape) already reads. No PE-specific subsidiary structure and no separate IPO path are
// introduced; once converted, the existing startSubsidiaryIPOPreparation() just works.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before pe-subsidiary-conversion.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before pe-subsidiary-conversion.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before pe-subsidiary-conversion.js.');
if(modules.peSubsidiaryConversion)throw new Error('PE subsidiary conversion is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const finite=modules.engine.finite,clamp=modules.engine.clamp,yen=modules.engine.yen,pct=modules.engine.pct;

const CONVERTED_STATUS='convertedToSubsidiary';
const IPO_MIN_OWNERSHIP=.5;

function findActiveDeal(state,dealID){
  return (state?.peDeals||[]).find(row=>String(row.id)===String(dealID)&&row.status==='active')||null;
}

// Deterministic and derived only from the deal's own id: no RNG draw, so the same save
// plus the same action always yields the same subsidiary id and the same outcome.
function subsidiaryIDFor(deal){return `pe-sub-${deal.id}`;}

// The transfer price is the deal's own canonical fair valuation, exactly what the rest of
// the codebase already treats as this holding's worth (displayed in the PE card, used as
// the exitPEDeal base before any turnaround premium). The player cannot enter a price:
// this removes the company-cash -> personal-cash laundering path a free-text price would
// open (buy low personally, invoice the company high). The reconstruction EXIT premium
// from pe-value-creation.js (exitValue/exitMultiplier) intentionally does NOT apply here —
// that premium exists to reward a market cash-out; a sale to the player's own company is
// not a market transaction, so paying it out again here would double-reward the same
// turnaround (once via the boosted currentValuation from applyPEInitiative, again via the
// EXIT-only multiplier).
function priceOf(deal){return Math.max(0,Math.round(finite(deal?.currentValuation)));}

function alreadyConverted(state,deal){
  return Boolean((state?.subsidiaries||[]).some(row=>String(row?.id)===subsidiaryIDFor(deal)));
}

function preview(state,dealID){
  const deal=findActiveDeal(state,dealID);
  if(!deal)return null;
  const price=priceOf(deal),ownership=clamp(finite(deal.ownershipRatio),0,1),companyCash=finite(state.companyCash);
  const converted=alreadyConverted(state,deal);
  const ipoEligibleOwnership=ownership>=IPO_MIN_OWNERSHIP;
  const blockedReason=converted
    ?'すでに自社子会社化されています。'
    :companyCash<price?`会社資金が不足しています（あと${yen(price-companyCash)}必要）。`:'';
  return Object.freeze({
    dealID:String(deal.id),targetName:String(deal.targetName||''),
    price,ownership,companyCash,ipoEligibleOwnership,
    canExecute:!converted&&companyCash>=price,
    blockedReason,converted
  });
}

// All preconditions are checked before any mutation, and every mutation happens together
// in one synchronous pass with no intervening await — so there is no window in which only
// some of (personalCash, companyCash, finance ledger, peDeals, subsidiaries) has moved.
// Once the deal's status leaves 'active' the very first line's lookup fails on any repeat
// call, which is what makes a second click (double-tap or otherwise) a no-op rather than a
// second sale; the UI additionally stops rendering the deal at all once it converts.
function convert(engine,dealID){
  const state=engine.g;
  const deal=findActiveDeal(state,dealID);
  if(!deal)return engine.fail('対象のPE案件が見つかりません。');
  if(alreadyConverted(state,deal))return engine.fail('すでに自社子会社化されています。');
  const price=priceOf(deal);
  if(finite(state.companyCash)<price)return engine.fail(`自社買収には${yen(price)}の会社資金が必要です。`);

  const subID=subsidiaryIDFor(deal);
  const ownership=clamp(finite(deal.ownershipRatio),0,1);

  // Company side: cash out, an investment-in-subsidiary asset appears in its place, so
  // total company assets are unchanged (matches the acquisition accounting already used by
  // js/ma-deal-room.js's completeTargetAcquisition for the same 'acquisition' category).
  state.companyCash=finite(state.companyCash)-price;
  finance.event(state,'acquisition',price,{
    cashEffect:-price,assetEffect:price,
    sourceType:'peSubsidiaryConversion',sourceID:String(deal.id),
    operationID:`peSubsidiaryConversion-${deal.id}-${finite(state.week,1)}`,
    description:`${deal.targetName} 自社買収（PE案件より）`
  });

  // Personal side: a straight cash sale, outside the company ledger entirely. Never routed
  // through finance.event — that module tracks companyCash only, and personalCash is not
  // company revenue or profit.
  state.personalCash=finite(state.personalCash)+price;

  // Canonical subsidiary shape: the same fields engine.js's makeSubsidiary()/entityDefaults
  // ('subsidiary' kind) and the other state.subsidiaries producers (competitor-parity.js,
  // internal-venture-business.js) already use, so every downstream consumer — IPO
  // eligibility, listed-subsidiary controls, budget/KPI, integration synergy — works
  // unmodified. id/peDealID/source are added purely as provenance, matching the precedent
  // of startupID/internalVentureID/sourceCompetitorID on the other producers.
  state.subsidiaries.push({
    id:subID,peDealID:String(deal.id),name:deal.targetName,domain:deal.industry||'',industry:deal.industry||'',
    ownership,valuation:price,investedCost:price,carryingBookValue:price,
    weeklyProfit:0,growth:.02,risk:.15,publicCompany:false,status:'active',retainedEarnings:0,
    acquiredWeek:finite(state.week,1),subsidiaryCash:0,source:'peConversion'
  });

  // The PE deal is retired, not deleted: it disappears from every 'active'-filtered PE
  // consumer (app.js's card list, pe-value-creation.js's findDeal, expansion.js's
  // improvePEDeal/exitPEDeal) via the same status check they already perform, so none of
  // them need to learn about this new status value. Valuation now lives solely on the
  // subsidiary — the deal object itself is never read for value again, so nothing double-
  // counts it.
  deal.status=CONVERTED_STATUS;
  deal.convertedSubsidiaryID=subID;
  deal.convertedWeek=finite(state.week,1);

  engine.notify(
    ownership>=IPO_MIN_OWNERSHIP
      ?`${deal.targetName}を自社グループへ組み入れました。子会社IPO準備を開始できます。`
      :`${deal.targetName}を自社グループへ組み入れました（親会社持分${pct(ownership)}）。子会社IPOには持分50%以上が必要です。`,
    'success'
  );
  return true;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peSubsidiaryConversionInstalled)return true;
  proto.peSubsidiaryConversionPreview=function(dealID){return preview(this.g,dealID);};
  proto.sellPEDealToCompany=function(dealID){
    const work=()=>convert(this,dealID);
    return typeof this.runTransaction==='function'?this.runTransaction(work,'change',{source:'peSubsidiaryConversion'}):work();
  };
  Object.defineProperty(proto,'__peSubsidiaryConversionInstalled',{value:true});
  return true;
}

install();
modules.peSubsidiaryConversion=Object.freeze({
  CONVERTED_STATUS,IPO_MIN_OWNERSHIP,
  findActiveDeal,subsidiaryIDFor,priceOf,alreadyConverted,preview,convert,install,
  __installed:true
});
})();
