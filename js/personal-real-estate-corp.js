// R4 final item "不動産法人". A real 資産管理法人 (asset-management corporation) exists so an
// individual's real-estate income accrues inside a company wrapper instead of their personal
// account -- profits stay inside the corp until deliberately withdrawn as a dividend, which is
// exactly the tax-deferral mechanic that makes such a corp worth founding in the first place.
//
// This is a THIRD cash silo, distinct from both personalCash and the player's main company
// (companyCash/g.properties/finance ledger). CLAUDE.md's "会社資産と個人資産の分離を維持"
// invariant is about those two; this corp is neither -- it is a personally-founded wrapper the
// player owns, so its cash and property values still belong to the player (personalNetWorth()
// includes both), but its cash never merges with personalCash except through one explicit
// dividend action, and it never touches companyCash or the finance ledger at all.
//
// Scope is deliberately narrow for a first version: only a holding on a plain long-term lease
// (no mortgage, no short-term letting, no in-progress redevelopment) can be contributed. Those
// three features are blocked on a corp-owned holding rather than taught to redirect their own
// cash flows too -- extending them is a natural follow-up, not required to make the corp real.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before personal-real-estate-corp.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before personal-real-estate-corp.js.');
if(modules.personalRealEstateCorp)throw new Error('Personal real estate corp is already registered.');
const Engine=modules.engine.TycoonEngine;

// Between the office-contract deposit and a department's setup cost -- founding a small
// holding corp is a bigger commitment than either alone.
const SETUP_COST=3_000_000;

const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const round=v=>Math.round(finite(v)*100)/100;

function ensure(state){
  if(!state.personalRealEstateCorp||typeof state.personalRealEstateCorp!=='object'){
    state.personalRealEstateCorp={established:false,cash:0,foundedWeek:0,contributedTotal:0,withdrawnTotal:0};
  }
  const corp=state.personalRealEstateCorp;
  corp.established=Boolean(corp.established);
  corp.cash=Math.max(0,finite(corp.cash));
  corp.foundedWeek=Math.max(0,Math.floor(finite(corp.foundedWeek)));
  corp.contributedTotal=Math.max(0,finite(corp.contributedTotal));
  corp.withdrawnTotal=Math.max(0,finite(corp.withdrawnTotal));
  return corp;
}

function holding(state,assetID){return (state.personalRealEstateHoldings||[]).find(x=>x.assetID===assetID&&x.status==='owned')||null;}

// Whether asset's income/expense should settle against the corp instead of personalCash.
function isCorpOwned(asset){return Boolean(asset&&asset.ownerCorp);}

function ownerAccountCash(state,asset){
  return isCorpOwned(asset)?ensure(state).cash:finite(state.personalCash);
}
// Adds amount to whichever account currently owns asset (rent, sale proceeds, ...). The
// personalCash branch deliberately stays unrounded, matching the exact arithmetic every
// existing personalCash+=noi call site already used before this module existed -- rounding it
// here would be a real precision regression against tests written against that arithmetic.
function creditOwnerAccount(state,asset,amount){
  if(isCorpOwned(asset)){const corp=ensure(state);corp.cash=round(corp.cash+finite(amount));}
  else state.personalCash=finite(state.personalCash)+finite(amount);
}
// Takes up to amount from whichever account currently owns asset, clamped to what is
// available there (matching the existing tax/expense clamp-to-cash behavior). Returns the
// amount actually taken. The personalCash branch rounds, matching personal-real-estate-
// taxes.js's own pre-existing rounded arithmetic at its one call site.
function debitOwnerAccount(state,asset,amount){
  const available=Math.max(0,ownerAccountCash(state,asset)),paid=Math.min(Math.max(0,finite(amount)),available);
  if(isCorpOwned(asset)){const corp=ensure(state);corp.cash=round(corp.cash-paid);}
  else state.personalCash=round(finite(state.personalCash)-paid);
  return paid;
}

Engine.prototype.establishPersonalRealEstateCorp=function(){
  const g=this.g,corp=ensure(g);
  if(corp.established)return this.fail('既に法人を設立しています。');
  if(finite(g.personalCash)<SETUP_COST)return this.fail('個人資金が不足しています。');
  g.personalCash=round(finite(g.personalCash)-SETUP_COST);
  corp.established=true;
  corp.foundedWeek=Math.floor(finite(g.week,1));
  this.notify(`資産管理法人を設立しました（設立費用${SETUP_COST.toLocaleString('ja-JP')}円）。`,'success');
  this.save();this.emit();
  return true;
};

Engine.prototype.contributePersonalRealEstateToCorp=function(assetID){
  const g=this.g,corp=ensure(g),x=holding(g,assetID);
  if(!corp.established)return this.fail('先に法人を設立してください。');
  if(!x||isCorpOwned(x))return this.fail('この物件は法人へ移せません。');
  if(this.getPersonalRealEstateMortgage?.(assetID)?.hasMortgage)return this.fail('担保融資が残っている物件は法人へ移せません。');
  if(modules.personalRealEstateShortTerm?.isShortTerm?.(x))return this.fail('短期賃貸中の物件は法人へ移せません。');
  if(modules.personalRealEstateRedevelopment?.inProgress?.(x))return this.fail('開発・再開発中の物件は法人へ移せません。');
  x.ownerCorp=true;
  corp.contributedTotal=round(corp.contributedTotal+Math.max(0,finite(x.currentValue)));
  this.notify(`${x.name}を法人へ移しました。以後の家賃・税金は法人の資金で精算されます。`,'success');
  this.save();this.emit();
  return true;
};

Engine.prototype.withdrawPersonalRealEstateFromCorp=function(assetID){
  const g=this.g,x=holding(g,assetID);
  if(!x||!isCorpOwned(x))return this.fail('この物件は法人所有ではありません。');
  x.ownerCorp=false;
  this.notify(`${x.name}を個人所有へ戻しました。法人内に残った現金は引き続き法人に留まります。`,'success');
  this.save();this.emit();
  return true;
};

Engine.prototype.withdrawPersonalRealEstateCorpDividend=function(amount){
  const g=this.g,corp=ensure(g),pay=Math.min(Math.max(0,finite(amount)),corp.cash);
  if(pay<=0)return false;
  corp.cash=round(corp.cash-pay);
  g.personalCash=round(finite(g.personalCash)+pay);
  corp.withdrawnTotal=round(corp.withdrawnTotal+pay);
  this.notify(`法人から${Math.round(pay).toLocaleString('ja-JP')}円を配当として受け取りました。`,'success');
  this.save();this.emit();
  return true;
};

Engine.prototype.getPersonalRealEstateCorp=function(){
  const corp=ensure(this.g);
  const holdings=(this.g.personalRealEstateHoldings||[]).filter(x=>x.status==='owned'&&isCorpOwned(x));
  return {...corp,holdingCount:holdings.length,holdingValue:holdings.reduce((a,x)=>a+Math.max(0,finite(x.currentValue)),0)};
};

const baseNormalize=Engine.prototype.normalize;
Engine.prototype.normalize=function(){const out=baseNormalize.call(this);ensure(this.g);return out;};

modules.personalRealEstateCorp=Object.freeze({SETUP_COST,ensure,isCorpOwned,ownerAccountCash,creditOwnerAccount,debitOwnerAccount,__installed:true});
})();
