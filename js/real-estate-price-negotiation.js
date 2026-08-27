// 不動産の価格交渉（Coffee Inc 2化 item 3の残り）。既存の即時購入(engine.buyProperty)は
// そのまま残し、掲示価格より安く提示して交渉するという別の選択肢を追加するだけに留める。
// 新しい交渉AIは発明せず、他の不動産モジュール（real-estate-tenant-renewals.js /
// real-estate-property-disposals.js）と同じ「hash01() による決定論的な合意判定」の
// パターンをそのまま踏襲する。対象は g.properties（会社/個人共通の47都道府県カタログ）のみで、
// 別カタログである個人不動産（personalRealEstateHoldings, buyPersonalRealEstate）は対象外。
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before real-estate-price-negotiation.js.');
if(modules.realEstatePriceNegotiation)throw new Error('real-estate-price-negotiation.js already registered.');
const Engine=modules.engine.TycoonEngine,finance=modules.finance;
const OFFER_RATIOS=Object.freeze([.7,.8,.9,.95]);
const DECLINE_COOLDOWN_WEEKS=4;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,round=v=>Math.round(n(v)*100)/100;
function property(g,id){return(g.properties||[]).find(p=>p.id===id)||null;}
function hash01(id,w,s){let h=2166136261;for(const c of `${id}:${w}:${s}`){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967295;}
// 提示率(掲示価格に対する割合)が高いほど合意しやすい単純な線形式。.65未満はほぼ決裂、.95で
// 高確率合意という直感的なトレードオフのためだけの式で、他の判断要素は持ち込まない。
function acceptanceChance(offerRatio){return Math.max(.03,Math.min(.97,(offerRatio-.65)/.35));}

// negotiatePropertyPrice() を実行したときに何が起きるかを、実行前にUIへ提示するための
// 読み取り専用の試算。状態は一切変更しない。決裂直後のクールダウン中は空配列を返す
// （交渉できないことをUI側が示せるようにする）。
Engine.prototype.propertyPriceNegotiationOffers=function(id){
  const p=property(this.g,id);
  if(!p||p.owner)return [];
  const week=Math.floor(n(this.g.week,1));
  if(n(p.negotiationDeclinedUntilWeek)>week)return [];
  return OFFER_RATIOS.map(ratio=>Object.freeze({
    ratio,
    offerPrice:Math.round(n(p.price)*ratio),
    acceptanceChance:round(acceptanceChance(ratio))
  }));
};

Engine.prototype.negotiatePropertyPrice=function(id,owner,offerRatio){
  const p=property(this.g,id);
  if(!p||p.owner)return this.fail('この物件には交渉できません。');
  const week=Math.floor(n(this.g.week,1));
  if(n(p.negotiationDeclinedUntilWeek)>week)return this.fail('前回の交渉決裂から間もないため、まだ再交渉できません。');
  const offer=this.propertyPriceNegotiationOffers(id).find(x=>x.ratio===offerRatio);
  if(!offer)return this.fail('無効な提示額です。');
  const cashKey=owner==='company'?'companyCash':'personalCash';
  if(n(this.g[cashKey])<offer.offerPrice)return this.fail('購入資金が不足しています。');
  const accepted=hash01(id,week,`negotiate-${offerRatio}`)<offer.acceptanceChance;
  if(!accepted){
    p.negotiationDeclinedUntilWeek=week+DECLINE_COOLDOWN_WEEKS;
    this.notify(`${p.name}への価格交渉は決裂しました。${DECLINE_COOLDOWN_WEEKS}週間は再交渉できません。`,'warning');
    this.save();this.emit();
    return {accepted:false,offerPrice:offer.offerPrice};
  }
  this.g[cashKey]=round(n(this.g[cashKey])-offer.offerPrice);
  p.owner=owner;p.purchasePrice=offer.offerPrice;p.bookValue=offer.offerPrice;
  // finance.propertyBook()はp.realEstate.landBookValue/buildingBookValueが数値であれば
  // そちらを会社所有物件の簿価として優先する（p.purchasePriceは見ない）。交渉成立価格を
  // 反映しないと、掲示価格ベースの簿価のまま資産計上され、実際の支払額との差額分だけ
  // 貸借対照表が崩れる。既存の土地/建物比率を保ったまま、交渉成立価格に合わせて
  // 両方の簿価を按分し直す。
  const re=p.realEstate;
  if(re&&Number.isFinite(Number(re.landBookValue))&&Number.isFinite(Number(re.buildingBookValue))){
    const priorTotal=n(re.landBookValue)+n(re.buildingBookValue);
    const landRatio=priorTotal>0?n(re.landBookValue)/priorTotal:.5;
    re.landBookValue=round(offer.offerPrice*landRatio);
    re.buildingBookValue=round(offer.offerPrice-re.landBookValue);
    if(Number.isFinite(Number(re.buildingOriginalCost)))re.buildingOriginalCost=re.buildingBookValue;
  }
  if(owner==='company')finance.event(this.g,'assetPurchase',offer.offerPrice,{cashEffect:-offer.offerPrice,assetEffect:offer.offerPrice,sourceType:'negotiatePropertyPrice',sourceID:id,description:`${p.name} 不動産取得（価格交渉成立）`});
  this.notify(`${p.name}の価格交渉が成立し、${owner==='company'?'会社':'個人'}で取得しました。`,'success');
  this.save();this.emit();
  return {accepted:true,offerPrice:offer.offerPrice};
};

modules.realEstatePriceNegotiation=Object.freeze({OFFER_RATIOS,DECLINE_COOLDOWN_WEEKS,acceptanceChance,hash01,__installed:true});
})();
