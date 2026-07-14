// Script boundary: js/parity.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before parity.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.parity)throw new Error('Capitalism Tycoon parity module is already registered.');
(function(exports){
// Parity layer for Swift systems that were still missing from the first browser expansion:
// AI advisor, key personnel, earnings/shareholder reactions, competitor counterattacks and annual awards.
const pyNum=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const pyClamp=(v,min,max)=>Math.max(min,Math.min(max,pyNum(v,min)));
const pyRand=(min,max)=>min+Math.random()*(max-min);
const pyPick=a=>a[Math.floor(Math.random()*a.length)];
const pyUID=()=>globalThis.crypto?.randomUUID?.()??`p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const pyCopy=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const pySum=a=>a.reduce((x,y)=>x+pyNum(y),0);

const KEY_PERSON_ROLES={
  store_manager:'カリスマ店長',engineer:'天才エンジニア',finance:'財務の鬼',ma:'M&A担当',pr:'炎上対応広報',hr:'人事責任者',franchise:'FC本部長',product:'プロダクト責任者',sports:'スポーツGM'
};

function installParity(TycoonEngine){
  if(TycoonEngine.prototype.__parityInstalled)return;
  TycoonEngine.prototype.__parityInstalled=true;

  TycoonEngine.prototype.ensureParityDefaults=function(){
    const g=this.g,defaults={
      parityVersion:1,advisorDismissedActionIDs:[],advisorLastGeneratedWeek:0,advisorActionHistory:[],
      keyPersonnel:[],keyPersonnelEventLog:[],lastKeyPersonnelEventWeek:0,
      earningsGuidanceRevenue:0,earningsGuidanceProfit:0,lastEarningsAnnouncementWeek:0,activistPressure:0,earningsEventLog:[],
      competitorStates:[],competitorEventLog:[],lastCompetitorActionWeek:0,
      industryAwards:[],awardEventLog:[],lastAwardWeek:0,lastParityUpdateWeek:0
    };
    for(const [k,v] of Object.entries(defaults))if(g[k]===undefined||g[k]===null)g[k]=pyCopy(v);
    g.keyPersonnel=(g.keyPersonnel||[]).filter(Boolean).slice(0,20);
    g.advisorDismissedActionIDs=(g.advisorDismissedActionIDs||[]).slice(-100);
    g.advisorActionHistory=(g.advisorActionHistory||[]).slice(0,80);
    g.keyPersonnelEventLog=(g.keyPersonnelEventLog||[]).slice(0,80);
    g.earningsEventLog=(g.earningsEventLog||[]).slice(0,80);
    g.competitorEventLog=(g.competitorEventLog||[]).slice(0,80);
    g.awardEventLog=(g.awardEventLog||[]).slice(0,80);
    if(!g.earningsGuidanceRevenue&&g.lastReport)g.earningsGuidanceRevenue=Math.max(0,pyNum(g.lastReport.sales));
    if(!g.earningsGuidanceProfit&&g.lastReport)g.earningsGuidanceProfit=pyNum(g.lastReport.profit);
    return g;
  };

  const baseNormalize=TycoonEngine.prototype.normalize;
  TycoonEngine.prototype.normalize=function(){baseNormalize.call(this);this.ensureParityDefaults();};
  const baseConfigure=TycoonEngine.prototype.configure;
  TycoonEngine.prototype.configure=function(options={}){return this.runTransaction(()=>{const r=baseConfigure.call(this,options);this.ensureParityDefaults();return r;});};

  TycoonEngine.prototype.keyPersonRoleName=function(id){return KEY_PERSON_ROLES[id]||'キーパーソン';};
  TycoonEngine.prototype.generateKeyPersonCandidate=function(){
    const role=pyPick(Object.keys(KEY_PERSON_ROLES)),level=Math.floor(pyRand(1,4)),surname=pyPick(['佐伯','藤堂','桐生','三浦','望月','神谷','一ノ瀬','白石','黒田','水野','南','北条']);
    return {id:pyUID(),name:`${surname} ${this.keyPersonRoleName(role)}`,roleID:role,specialtyID:role,level,loyalty:pyRand(45,82),motivation:pyRand(55,90),salary:level*pyRand(3500000,7500000),growth:pyRand(.8,1.8),retentionRisk:pyRand(.08,.35),assignedAreaID:null,joinedWeek:this.g.week,traitIDs:['成長志向','現場感','数字に強い'].sort(()=>Math.random()-.5).slice(0,2)};
  };
  TycoonEngine.prototype.keyPersonEffectMultiplier=function(role,maxBonus=.10){const items=this.g.keyPersonnel.filter(x=>x.roleID===role);const raw=pySum(items.map(x=>(x.level*.012+pyClamp(x.motivation,0,100)/2500)*(pyClamp(x.loyalty,0,100)/100)));return 1+Math.min(maxBonus,raw);};
  TycoonEngine.prototype.hireKeyPerson=function(){
    this.ensureParityDefaults();if(!this.g.hasHeadOffice)return this.fail('本社オフィスが必要です。');if(this.g.keyPersonnel.length>=20)return this.fail('キーパーソンは最大20人です。');const c=this.generateKeyPersonCandidate(),cost=Math.max(500000,c.salary*.45);if(this.g.companyCash<cost)return this.fail('採用一時金が不足しています。');this.g.companyCash-=cost;this.g.keyPersonnel.push(c);const text=`キーパーソン「${c.name}」を採用しました。`;this.g.keyPersonnelEventLog.unshift(`第${this.g.week}週：${text}`);this.g.news.unshift(text);this.notify(text,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.trainKeyPerson=function(id){const p=this.g.keyPersonnel.find(x=>x.id===id);if(!p)return false;const cost=Math.max(800000,p.salary*.12);if(this.g.companyCash<cost)return this.fail('育成費が不足しています。');this.g.companyCash-=cost;p.motivation=pyClamp(p.motivation+8,0,100);p.loyalty=pyClamp(p.loyalty+4,0,100);if(Math.random()<.25)p.level=Math.min(10,p.level+1);p.retentionRisk=pyClamp(p.retentionRisk-.06,0,1);this.notify(`${p.name}を育成しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.retainKeyPerson=function(id){const p=this.g.keyPersonnel.find(x=>x.id===id);if(!p)return false;const cost=Math.max(1000000,p.salary*.30);if(this.g.companyCash<cost)return this.fail('引き止め費用が不足しています。');this.g.companyCash-=cost;p.loyalty=pyClamp(p.loyalty+14,0,100);p.retentionRisk=pyClamp(p.retentionRisk-.18,0,1);this.notify(`${p.name}の引き止め面談を行いました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.cashRunwayWeeks=function(){const r=this.g.lastReport,expenses=Math.max(1,Math.abs(pyNum(r?.expenses))),profit=pyNum(r?.profit);return profit>=0?52:pyClamp(this.g.companyCash/Math.max(1,Math.abs(profit)+expenses*.08),0,520);};
  TycoonEngine.prototype.generateAdvisorActions=function(){
    this.ensureParityDefaults();const g=this.g,dismissed=new Set(g.advisorDismissedActionIDs),rows=[];const add=(id,title,message,priority,category,label,tab,icon)=>{if(!dismissed.has(id))rows.push({id,title,message,priority,category,actionLabel:label,targetTab:tab,icon});};
    const open=g.stores.filter(x=>x.status==='open'),loss=open.filter(x=>pyNum(x.lastProfit)<0),r=g.lastReport,runway=this.cashRunwayWeeks();
    if(!open.length)add('first_store','最初の店舗候補を探す','マップから空きテナントを確認し、最初の収益源を作ります。',100,'出店','マップへ','map','🏪');
    if(g.companyCash<Math.max(1500000,pyNum(r?.expenses)*1.5)||runway<=8)add('cash_shortage','資金繰りを確認','現金余力が薄くなっています。借入枠、固定費、返済予定を確認してください。',95,'財務','銀行へ','bank','🏦');
    if(loss.length)add('loss_store','赤字店舗を点検',`赤字店舗が${loss.length}店あります。価格・広告・品質投資を見直してください。`,88,'店舗','事業へ','business','⚠️');
    if(g.employeeSatisfaction<45||pyNum(g.overtimeRisk)>.65)add('people_risk','社員不満をケア','満足度または残業リスクが悪化しています。社員の声と人員配置を確認してください。',84,'人材','オフィスへ','office','👥');
    const dev=g.productVentures.find(x=>x.status==='developing');if(dev)add(`product_dev_${dev.id}`,'プロダクト開発を確認',`${dev.name}の開発が進行中です。品質投資や開発部門の増員を検討してください。`,76,'プロダクト','事業へ','business','💻');
    if(g.companyDebt>Math.max(10000000,this.companyValue()*.45))add('debt_heavy','借入が重い','借入総額が大きく信用力に影響します。返済か借り換えを検討してください。',74,'銀行','銀行へ','bank','💳');
    if(g.publicCompany)add('earnings','次回決算を意識',`次回決算まであと${this.weeksUntilNextEarnings()}週。利益率とガイダンスを確認してください。`,70,'決算','市場へ','market','📊');
    if(g.keyPersonnel.some(x=>x.retentionRisk>.65))add('keyperson_risk','重要社員の離職リスク','キーパーソンの離職リスクが上昇しています。引き止め面談を検討してください。',86,'人材','オフィスへ','office','🧑‍💼');
    if(g.competitorEventLog[0])add('competitor_alert','競合の動きを確認',g.competitorEventLog[0],72,'競合','競合へ','rivals','⚔️');
    if(g.hasHeadOffice&&pyNum(r?.profit)>0&&g.companyCash>50000000&&g.keyPersonnel.length<3)add('hire_keyperson','キーパーソンを採用','重要社員を迎え、成長の土台を強化できます。',52,'人材','オフィスへ','office','⭐');
    return rows.sort((a,b)=>b.priority-a.priority).slice(0,5);
  };
  TycoonEngine.prototype.dismissAdvisorAction=function(id){if(!this.g.advisorDismissedActionIDs.includes(id))this.g.advisorDismissedActionIDs.push(id);this.g.advisorDismissedActionIDs=this.g.advisorDismissedActionIDs.slice(-100);this.save();this.emit();return true;};

  TycoonEngine.prototype.weeksUntilNextEarnings=function(){const elapsed=Math.max(0,this.g.week-pyNum(this.g.lastEarningsAnnouncementWeek));return Math.max(0,13-(elapsed%13));};
  TycoonEngine.prototype.runEarningsEventsIfNeeded=function(force=false){
    const g=this.g;if(!g.publicCompany&&!force)return false;if(!force&&g.week-pyNum(g.lastEarningsAnnouncementWeek)<13)return false;const sales=pyNum(g.lastReport?.sales),profit=pyNum(g.lastReport?.profit),guideSales=Math.max(1,pyNum(g.earningsGuidanceRevenue,sales)),guideProfit=pyNum(g.earningsGuidanceProfit,profit),salesSurprise=pyClamp((sales-guideSales)/Math.max(1,Math.abs(guideSales)),-.35,.35),profitSurprise=pyClamp((profit-guideProfit)/Math.max(1,Math.abs(guideProfit)+1000000),-.45,.45);let delta=salesSurprise*18+profitSurprise*24+(profit>=0?2:-5);if(g.companyDebt>this.companyValue()*.7)delta-=4;if(g.employeeSatisfaction<45)delta-=2;g.shareholderTrust=pyClamp(pyNum(g.shareholderTrust,50)+delta,0,100);g.activistPressure=pyClamp(pyNum(g.activistPressure)+(profit<0?7:-2)+(g.shareholderTrust<40?4:-1),0,100);g.lastEarningsAnnouncementWeek=g.week;g.earningsGuidanceRevenue=Math.max(0,sales*pyRand(.96,1.12)+g.stores.length*80000);g.earningsGuidanceProfit=Math.max(-1e9,profit*pyRand(.94,1.14));const title=profit>=0&&delta>=0?'好決算':profit<0?'赤字決算':'慎重な決算',text=`${title}：売上${Math.round(sales).toLocaleString()}円 / 利益${Math.round(profit).toLocaleString()}円。株主信頼${g.shareholderTrust.toFixed(0)}。`;g.earningsEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(text);const own=g.market.find(x=>x.id===g.ticker||x.name===g.companyName);if(own){const reaction=pyClamp(1+delta/650,.92,1.08);own.price=Math.max(1,own.price*reaction);own.marketCap=pyNum(own.issuedShares,g.sharesOut)*own.price;g.stockPrice=own.price;}return true;
  };

  TycoonEngine.prototype.seedCompetitorCounterStates=function(){if(this.g.competitorStates.length)return;this.g.competitorStates=this.g.competitors.slice(0,6).map(c=>({id:String(c.id),name:c.name,industryID:c.businessID,regionID:c.areaID||null,strength:pyClamp(c.stores*8+c.brand+c.quality,10,100),cash:c.cash,aggression:pyRand(.25,.75),brandPower:c.brand,pricePressure:0,isDistressed:false,lastActionWeek:0}));};
  TycoonEngine.prototype.competitorPressureMultiplier=function(businessID,prefID){const area=this.pref(prefID)?.areaID,pressure=pySum(this.g.competitorStates.filter(x=>x.industryID===businessID&&(!x.regionID||x.regionID===area)).map(x=>x.pricePressure));return pyClamp(1-pressure*.015,.86,1);};
  TycoonEngine.prototype.respondToCompetitor=function(id,action){const i=this.g.competitorStates.findIndex(x=>x.id===id);if(i<0)return false;const s=this.g.competitorStates[i];if(action==='ads'){if(this.g.companyCash<2e6)return this.fail('広告防衛費が不足しています。');this.g.companyCash-=2e6;s.pricePressure=pyClamp(s.pricePressure-1,0,8);this.g.companyReputation=pyClamp(this.g.companyReputation+1,0,100);}else if(action==='quality'){if(this.g.companyCash<2.5e6)return this.fail('品質防衛費が不足しています。');this.g.companyCash-=2.5e6;s.pricePressure=pyClamp(s.pricePressure-.8,0,8);const b=this.business(s.industryID);if(b)b.quality=pyClamp(b.quality+2,0,100);}else if(action==='acquire'){const price=Math.max(5e6,s.strength*1e6+s.cash*1.2);if(!s.isDistressed)return this.fail('この競合は買収可能な状態ではありません。');if(this.g.companyCash<price)return this.fail('買収資金が不足しています。');this.g.companyCash-=price;this.g.competitorStates.splice(i,1);this.g.subsidiaries.push({id:pyUID(),name:s.name,domain:s.industryID,industry:s.industryID,valuation:price,status:'active',weeklyProfit:price*.001,growth:.02,risk:.15,ownership:1,retainedEarnings:0,acquiredWeek:this.g.week});this.notify(`${s.name}を買収しました。`,'success');this.save();this.emit();return true;}else return false;this.notify(`${s.name}への対抗策を実行しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.computeIndustryRanking=function(){const result={};for(const id of ['ramen','cafe','conveni']){const ours=this.g.stores.filter(x=>x.businessID===id&&x.status==='open').length,all=[ours,...this.g.competitors.filter(x=>x.businessID===id).map(x=>x.stores)].sort((a,b)=>b-a);result[id]=all.indexOf(ours)+1;}return result;};
  TycoonEngine.prototype.processIndustryAwards=function(){const g=this.g;if(g.week%52!==51||g.lastAwardWeek===g.week)return;g.lastAwardWeek=g.week;let count=0;for(const [id,title] of [['ramen','ラーメン業界MVP'],['cafe','カフェ業界MVP'],['conveni','コンビニ業界MVP']]){const ours=g.stores.filter(x=>x.businessID===id&&x.status==='open').length,top=Math.max(0,...g.competitors.filter(x=>x.businessID===id).map(x=>x.stores));if(ours>top&&ours>=5){g.companyReputation=pyClamp(g.companyReputation+3,0,100);g.globalPrestige=pyNum(g.globalPrestige)+5;g.industryAwards.unshift({id:pyUID(),week:g.week,title,kind:id});g.news.unshift(`【業界アワード】${title}を受賞しました。`);count++;}}if(pyNum(g.esgScore)>=80){g.industryAwards.unshift({id:pyUID(),week:g.week,title:'サステナビリティ優秀企業',kind:'esg'});g.companyReputation=pyClamp(g.companyReputation+2,0,100);g.globalPrestige=pyNum(g.globalPrestige)+8;count++;}if(g.overseasSubsidiaries.length>=3){g.industryAwards.unshift({id:pyUID(),week:g.week,title:'グローバル経営賞',kind:'global'});g.globalPrestige=pyNum(g.globalPrestige)+6;count++;}if(count){const t=`第${g.week}週：業界アワード${count}件を受賞。`;g.awardEventLog.unshift(t);g.history.unshift(t);}};

  TycoonEngine.prototype.updateParityWeekly=function(){
    const g=this.g;let companyAdjustment=0,expenseAdjustment=0;this.seedCompetitorCounterStates();
    // Key personnel payroll and retention.
    for(let i=g.keyPersonnel.length-1;i>=0;i--){const p=g.keyPersonnel[i],pressure=Math.max(0,pyNum(g.overtimeRisk,.3)-.45)*.025;p.motivation=pyClamp(p.motivation+pyRand(-2,1.2)-pressure*100,0,100);p.loyalty=pyClamp(p.loyalty+pyRand(-1.5,1)-pressure*80,0,100);p.retentionRisk=pyClamp(.08+(70-p.loyalty)/160+(55-p.motivation)/220+p.level*.006,0,.95);const wage=Math.max(0,p.salary/52);g.companyCash-=wage;companyAdjustment-=wage;expenseAdjustment+=wage;if(g.week-g.lastKeyPersonnelEventWeek>=8&&p.retentionRisk>.7&&Math.random()<p.retentionRisk*.15){const [leaver]=g.keyPersonnel.splice(i,1);const text=`重要社員「${leaver.name}」が競合へ転職しました。`;g.keyPersonnelEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(text);g.lastKeyPersonnelEventWeek=g.week;}}
    // Small role effects.
    g.companyCredit=pyClamp(g.companyCredit+(this.keyPersonEffectMultiplier('finance')-1)*.08,0,100);g.companyReputation=pyClamp(g.companyReputation+(this.keyPersonEffectMultiplier('pr')-1)*.06,0,100);for(const b of g.businesses){if(g.keyPersonnel.some(x=>x.roleID==='store_manager'))b.efficiency=pyClamp(b.efficiency+(this.keyPersonEffectMultiplier('store_manager')-1)*.02,0,100);}
    if(g.keyPersonnel.length<4&&g.week-g.lastKeyPersonnelEventWeek>=8&&Math.random()<.18){g.lastKeyPersonnelEventWeek=g.week;g.keyPersonnelEventLog.unshift(`第${g.week}週：キーパーソン候補の紹介がありました。`);g.news.unshift('キーパーソン候補の紹介がありました。オフィスで採用できます。');}
    // Competitor counterattack every 8 weeks, every 4 weeks after IPO.
    if(g.week-g.lastCompetitorActionWeek>=(g.publicCompany?4:8)){g.lastCompetitorActionWeek=g.week;for(const s of g.competitorStates){const stores=g.stores.filter(x=>x.status==='open'&&x.businessID===s.industryID),threat=pyClamp(stores.length/20+(g.publicCompany?0.15:0)+Math.max(0,this.companyValue()/1e12)*.05,0,.85),chance=pyClamp(s.aggression*.16+threat*.22,.02,.35);if(Math.random()>=chance)continue;const action=pyPick(['近隣出店','値下げ競争','広告合戦','人材引き抜き','新商品投入','買収チャンス']);s.lastActionWeek=g.week;if(action==='近隣出店'){s.strength=pyClamp(s.strength+3,0,140);s.pricePressure=pyClamp(s.pricePressure+1.2,0,8);}else if(action==='値下げ競争'){s.pricePressure=pyClamp(s.pricePressure+1.8,0,8);s.cash=Math.max(0,s.cash-1e6);}else if(action==='広告合戦'){s.brandPower=pyClamp(s.brandPower+4,0,140);s.pricePressure=pyClamp(s.pricePressure+.8,0,8);}else if(action==='人材引き抜き'&&g.keyPersonnel.length){const p=pyPick(g.keyPersonnel);p.retentionRisk=pyClamp(p.retentionRisk+.10,0,1);}else if(action==='買収チャンス'){s.isDistressed=true;s.cash*=.75;}else s.strength=pyClamp(s.strength+2,0,140);const text=`競合反撃：${s.name}が「${action}」を実行。`;g.competitorEventLog.unshift(`第${g.week}週：${text}`);g.competitorEvents.unshift(text);g.news.unshift(text);}}
    // Apply modest weekly price pressure to matching stores.
    for(const store of g.stores.filter(x=>x.status==='open')){const mult=this.competitorPressureMultiplier(store.businessID,store.prefID);if(mult<1){const loss=Math.max(0,pyNum(store.lastSales)*(1-mult)*.32);g.companyCash-=loss;store.lastProfit=pyNum(store.lastProfit)-loss;companyAdjustment-=loss;expenseAdjustment+=loss;}}
    if(g.publicCompany)this.runEarningsEventsIfNeeded(false);this.processIndustryAwards();const advice=this.generateAdvisorActions();g.advisorLastGeneratedWeek=g.week;if(advice.length)g.advisorActionHistory.unshift(...advice.slice(0,5).map(x=>`第${g.week}週：[${x.category}] ${x.title}`));g.advisorActionHistory=g.advisorActionHistory.slice(0,80);return {companyAdjustment,expenseAdjustment};
  };

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){return this.runTransaction(()=>{const r=baseAdvance.call(this,false);if(!r)return r;this.ensureParityDefaults();if(this.g.lastParityUpdateWeek===this.g.week)return r;this.g.lastParityUpdateWeek=this.g.week;const adj=this.updateParityWeekly();if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.expenses=pyNum(this.g.lastReport.expenses)+adj.expenseAdjustment;this.g.lastReport.profit=pyNum(this.g.lastReport.profit)+adj.companyAdjustment;const i=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(i>=0)this.g.reports[i]=pyCopy(this.g.lastReport);if(this.g.weeklyProfitHistory.length)this.g.weeklyProfitHistory[this.g.weeklyProfitHistory.length-1]=this.g.lastReport.profit;}const fin=globalThis.__capitalismTycoonModules?.finance;if(fin&&!this.g.isCompanySold&&adj.companyAdjustment){fin.event(this.g,'otherOperating',Math.abs(adj.companyAdjustment),{cashEffect:adj.companyAdjustment,profitEffect:adj.companyAdjustment,sourceType:'parityWeeklyAdjustment',sourceID:`${this.g.week}`,idempotencyKey:`week-${this.g.week}-parity-adjustment`,operationID:`week-${this.g.week}-parity-adjustment`,description:'互換レイヤー週次調整'});const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)fin.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);fin.validate(this.g);}const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5)};this.g.lastWeeklySummary=summary;return r;},'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};
}

Object.assign(exports,{KEY_PERSON_ROLES,installParity});
})(__modules.parity={});

})();
