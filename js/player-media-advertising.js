// Script boundary: js/player-media-advertising.js (classic JavaScript)
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;if(!modules?.engine?.TycoonEngine||!modules.finance)throw new Error('engine.js and finance.js must load before player-media-advertising.js.');
const Engine=modules.engine.TycoonEngine,finance=modules.finance;
const MEDIA=Object.freeze({
 local:Object.freeze({name:'地域広告・チラシ',cost:500000,durationWeeks:4,target:'価格重視・日常利用',weights:Object.freeze({price:1,standard:.9,quality:.25,convenience:.45,brand:.2})}),
 web:Object.freeze({name:'検索・Web広告',cost:1000000,durationWeeks:6,target:'利便性重視・日常利用',weights:Object.freeze({price:.35,standard:.75,quality:.4,convenience:1,brand:.45})}),
 social:Object.freeze({name:'SNS広告',cost:1000000,durationWeeks:5,target:'ブランド・流行重視',weights:Object.freeze({price:.15,standard:.4,quality:.65,convenience:.35,brand:1})}),
 mass:Object.freeze({name:'マス広告・テレビ',cost:3000000,durationWeeks:8,target:'幅広い顧客（品質層寄り）',weights:Object.freeze({price:.42,standard:.58,quality:.7,convenience:.5,brand:.62})})
});
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function normalizeCampaign(row){if(!row||!MEDIA[row.mediaID])return null;const budget=finite(row.budget),startedWeek=Math.max(1,Math.floor(finite(row.startedWeek,1))),endsWeek=Math.max(startedWeek,Math.floor(finite(row.endsWeek,startedWeek)));if(!row.businessID||budget<=0)return null;return{id:String(row.id||`media-ad-${row.businessID}-${row.mediaID}-${startedWeek}`),businessID:String(row.businessID),mediaID:row.mediaID,budget,startedWeek,endsWeek};}
function ensure(state){state.mediaAdvertisingCampaigns=(Array.isArray(state.mediaAdvertisingCampaigns)?state.mediaAdvertisingCampaigns:[]).map(normalizeCampaign).filter(Boolean).slice(-80);return state.mediaAdvertisingCampaigns;}
function isActive(row,week){return finite(week)>row.startedWeek&&finite(week)<=row.endsWeek;}
function activeCampaigns(state,businessID){return ensure(state).filter(row=>(!businessID||row.businessID===businessID)&&isActive(row,state.week));}
function remainingWeeks(row,week){return Math.max(0,row.endsWeek-Math.max(finite(week),row.startedWeek));}
function utilityBoost(state,businessID,segmentID){let boost=0;for(const row of activeCampaigns(state,businessID)){const media=MEDIA[row.mediaID];const scale=Math.min(1.45,Math.log10(1+row.budget/100000)*.24);boost+=scale*finite(media.weights[segmentID]);}return Math.min(.65,boost);}
const baseNormalize=Engine.prototype.normalize;Engine.prototype.normalize=function(){const out=baseNormalize.call(this);ensure(this.g);return out;};
Engine.prototype.startMediaAdvertisingCampaign=function(businessID,mediaID,budget){const work=()=>{ensure(this.g);const business=this.business?.(businessID),media=MEDIA[mediaID];budget=Number(budget);if(!business||!media||!Number.isFinite(budget)||budget<media.cost||budget%10000!==0)return this.fail?.('事業・媒体・予算が不正です。')??false;if(this.g.mediaAdvertisingCampaigns.some(row=>row.businessID===businessID&&remainingWeeks(row,this.g.week)>0))return this.fail?.('この事業では広告キャンペーンを実施中です。')??false;if(finite(this.g.companyCash)<budget)return this.fail?.('会社資金が不足しています。')??false;const week=Math.max(1,Math.floor(finite(this.g.week,1))),id=`media-ad-${businessID}-${mediaID}-${week}`;this.g.companyCash-=budget;finance.event(this.g,'advertising',budget,{cashEffect:-budget,profitEffect:-budget,assetEffect:0,businessID,sourceType:'mediaAdvertisingCampaign',sourceID:id,operationID:id,idempotencyKey:id,description:`${business.name} ${media.name}`});this.g.mediaAdvertisingCampaigns.push({id,businessID,mediaID,budget,startedWeek:week,endsWeek:week+media.durationWeeks});this.notify?.(`${media.name}を開始しました。効果期間は${media.durationWeeks}週間です。`,'success');this.save?.();this.emit?.();return true;};return typeof this.runTransaction==='function'?this.runTransaction(work,'change',{source:'mediaAdvertisingCampaign'}):work();};
modules.playerMediaAdvertising=Object.freeze({MEDIA,ensure,isActive,activeCampaigns,remainingWeeks,utilityBoost,normalizeCampaign,__installed:true});
})();
