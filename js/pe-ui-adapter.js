// PE UI boundary: production internals enter here and leave as normalized, read-only data.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;if(!modules?.peFund||!modules?.maDealRoom)throw new Error('PE production modules must load before pe-ui-adapter.js.');
const pf=modules.peFund,ma=modules.maDealRoom,portfolio=modules.pePortfolioOperations,management=modules.managementContext,network=modules.peNetwork,bridge=modules.playerEngineBridge,ACTIVE=new Set([...ma.activeStatuses()]);
const NAVIGATION=Object.freeze([['fund','◫','ファンド'],['deals','◇','案件'],['portfolio','▦','保有'],['network','◎','人脈'],['record','▤','記録']]);
const DECISION_LIMIT=3,FINAL_BID_URGENT_WEEKS=4,INVESTMENT_RISK_FRACTION=.25,DEADLINE_CRITICAL_WEEKS=10,DD_OPPORTUNITY_WEEKS=8,NETWORK_WARNING_MARGIN=5;
const finite=v=>Number.isFinite(Number(v))?Number(v):0,arr=v=>Array.isArray(v)?v:[];
function current(){const engine=bridge?.getEngine?.();return {engine,state:engine?.g||null};}
function activeFund(state){const funds=arr(state?.peFirm?.funds);return [...funds].reverse().find(f=>f?.status!=='closed')||funds.at(-1)||null;}
function targetFor(state,deal){return arr(state?.acquisitionTargets).find(t=>t?.id===deal?.targetID)||null;}
function rawDeals(state){const rooms=arr(state?.maDealRooms).filter(d=>ACTIVE.has(d?.status)&&targetFor(state,d)?.peTierID),opened=new Set(rooms.map(d=>d.targetID));const available=arr(state?.acquisitionTargets).filter(t=>t?.peTierID&&!opened.has(t.id)&&t.dealStatus!=='withdrawn'&&finite(t.expiresWeek)>=finite(state?.week)).map(t=>({id:`target:${t.id}`,targetID:t.id,status:'available',deadlineWeek:t.expiresWeek,competingBids:[]}));return rooms.concat(available).sort((a,b)=>finite(a.deadlineWeek)-finite(b.deadlineWeek)||String(a.id).localeCompare(String(b.id)));}
function actionFor(deal){return deal.status==='available'?{id:'open',label:'詳細を見る'}:deal.status==='screening'?{id:'advance',label:'意向表明へ'}:deal.status==='indication'?{id:'dd',label:'DDへ'}:deal.status==='ready'?{id:'advance',label:'最終入札へ'}:{id:'bid',label:'最終入札'};}
function preferDrop(price,valuation,participants,deploymentRatio,deploymentGate){const maximum=finite(valuation?.maximum),bidPrice=finite(price),overpayRisk=bidPrice>=maximum,priceRisk=bidPrice>=maximum*.95,aggressiveCompetition=arr(participants).some(p=>p?.id==='foreign-major'||p?.id==='strategic-buyer'),deploymentMet=finite(deploymentRatio)>=finite(deploymentGate)&&finite(deploymentGate)>0;return overpayRisk||aggressiveCompetition||(deploymentMet&&priceRisk);}
function normalizeParticipants(state,deal){const metadata=arr(modules.peRivals?.ROSTER).concat(arr(state?.peRivals)),byID=new Map(metadata.map(r=>[String(r?.id||''),r]));return arr(deal?.competingBids).filter(b=>b?.status==='active').map(b=>{const id=String(b.bidderID),rival=byID.get(id);return {id,name:String(b.bidderName||rival?.name||id),aggressiveness:finite(rival?.aggressiveness)};});}
function normalizeDeal(state,deal,{acceptSellerTerm=false,bidPrice=null,deploymentRatio=0,deploymentGate=0}={}){const target=targetFor(state,deal),seller=ma.SELLER_TYPES[target?.sellerType],hasRoom=!String(deal?.id).startsWith('target:'),range=hasRoom&&target?ma.recommendedOfferRange(state,target,deal,{acceptSellerTerm:Boolean(acceptSellerTerm&&seller?.termID)}):null,participants=normalizeParticipants(state,deal);return {id:String(deal?.id||''),title:String(target?.name||'名称未設定'),industry:String(target?.industry||target?.type||'事業会社'),band:String(target?.peTierID||''),sellerType:{id:String(target?.sellerType||''),label:String(seller?.name||'売り手')},sellerPriorities:[{id:String(seller?.termID||'price'),label:String(seller?.wants||'価格条件'),importance:'primary'}],stage:{id:String(deal?.status||'available'),label:String(ma.STATUS_LABELS[deal?.status]||deal?.status||'未着手')},deadline:{weeksRemaining:Math.max(0,finite(deal?.deadlineWeek)-finite(state?.week)),urgency:finite(deal?.deadlineWeek)-finite(state?.week)<=FINAL_BID_URGENT_WEEKS?'urgent':'normal'},valuation:range?{minimum:range.recommendedMinimumPrice,maximum:range.recommendedMaximumPrice,confidence:range.confidence,termDiscount:range.sellerTermEquivalentDiscount}:null,participants,sourcingType:String(target?.dealChannel||'auction'),sourcing:{trust:Number.isFinite(Number(target?.peSourceTrustAtSupply))?finite(target.peSourceTrustAtSupply):null,access:String(target?.peNetworkAccess||target?.dealChannel||'auction'),qualityScore:Number.isFinite(Number(target?.peNetworkQualityScore))?finite(target.peNetworkQualityScore):null,competitionMultiplier:Number.isFinite(Number(target?.peCompetitionMultiplier))?finite(target.peCompetitionMultiplier):1},availableTerms:seller?.termID?[{id:seller.termID,label:seller.termLabel}]:[],selectedTerms:acceptSellerTerm&&seller?.termID?[seller.termID]:[],recommendDrop:range?preferDrop(bidPrice??range.recommendedMinimumPrice,{minimum:range.recommendedMinimumPrice,maximum:range.recommendedMaximumPrice},participants,deploymentRatio,deploymentGate):false,availableActions:[actionFor(deal)]};}
function portfolioAlerts(state){const rows=[];for(const fund of arr(state?.peFirm?.funds))for(const deal of arr(fund?.deals)){const pc=deal?.portfolioCompany;if(deal?.status!=='active'||!pc)continue;const factors=portfolio?.leverFactors?.(pc,state?.week);if(!factors||!(finite(factors.procurementDrag)>0||finite(factors.laborDrag)>0||finite(factors.sideEffectFactor)<1))continue;const causes=[finite(factors.procurementDrag)>0?'仕入れ改革':null,finite(factors.laborDrag)>0?'人員・賃金施策':null].filter(Boolean).join('・');rows.push({id:`p4-${deal.id}`,type:'portfolioSideEffect',priority:4,deadlineWeeks:Infinity,urgency:'watch',eyebrow:'PORTFOLIO SIDE EFFECT',title:String(deal.name||deal.businessID||'保有先'),description:`${causes}の遅延副作用が進行中`,action:null});}return rows;}
function networkAlerts(state){const gate=finite(network?.MONOPOLY_TRUST_THRESHOLD),approaching=gate+NETWORK_WARNING_MARGIN;return arr(state?.peNetwork?.nodes).filter(n=>finite(n?.lastContactWeek)<finite(state?.week)&&finite(n?.trust)<=approaching).map(n=>{const lost=finite(n.trust)<gate;return {id:`p5-${n.id}`,type:'network',priority:5,deadlineWeeks:Infinity,urgency:lost?'risk':'warning',eyebrow:lost?'NETWORK ACCESS LOST':'NETWORK AT RISK',title:String(n.sourceType||n.pathType||'人脈'),description:lost?`Trust ${finite(n.trust).toFixed(0)} · 独占案件アクセス条件を下回っています`:`Trust ${finite(n.trust).toFixed(0)} · 独占案件アクセス喪失が近づいています`,action:null,networkStatus:lost?'lostThreshold':'approachingThreshold'};});}
function decisions(state,fund,deals,metrics){const rows=[];for(const d of deals)if(d.stage.id==='final_bid'&&d.deadline.weeksRemaining<=FINAL_BID_URGENT_WEEKS)rows.push({id:`p1-${d.id}`,type:'finalBid',priority:1,deadlineWeeks:d.deadline.weeksRemaining,urgency:'critical',eyebrow:'最終入札',title:d.title,description:`残り${d.deadline.weeksRemaining}週 · 売り手重視: ${d.sellerPriorities[0].label}`,action:{id:'bid',dealId:d.id,label:'入札を確認'}});if(fund&&metrics.investmentPeriod.severity!=='normal')rows.push({id:`p2-${fund.id}`,type:'deploymentRisk',priority:2,deadlineWeeks:metrics.investmentPeriod.weeksRemaining,urgency:'risk',eyebrow:'PROGRESSION RISK',title:`投資期間終了まで ${metrics.investmentPeriod.weeksRemaining}週`,description:`未投資 ${metrics.capital.undeployedLabel} · Deployment ${(metrics.capital.deploymentRatio*100).toFixed(0)}% / 条件 ${(metrics.performance.deploymentGate*100).toFixed(0)}%`,action:{id:'deals',label:'案件を見る'}});for(const d of deals)if(metrics.diligence.remaining>0&&d.stage.id==='indication'&&d.deadline.weeksRemaining<=DD_OPPORTUNITY_WEEKS)rows.push({id:`p3-${d.id}`,type:'ddOpportunity',priority:3,deadlineWeeks:d.deadline.weeksRemaining,urgency:'warning',eyebrow:'DD OPPORTUNITY',title:`DD枠が${metrics.diligence.remaining}件残っています`,description:`${d.title} · 期限まで${d.deadline.weeksRemaining}週`,action:{id:'dd',dealId:d.id,label:'DDを実行'}});return rows.concat(portfolioAlerts(state),networkAlerts(state)).sort((a,b)=>a.priority-b.priority||a.deadlineWeeks-b.deadlineWeeks||a.id.localeCompare(b.id)).slice(0,DECISION_LIMIT);}
function investmentPeriod(remaining,deployment,deploymentGate){const conditionMet=deployment>=deploymentGate,warningWeeks=pf.INVESTMENT_PERIOD_WEEKS*INVESTMENT_RISK_FRACTION,severity=!conditionMet&&remaining<DEADLINE_CRITICAL_WEEKS?'critical':!conditionMet&&remaining<=warningWeeks?'warning':'normal';return {weeksRemaining:remaining,progress:Math.max(0,Math.min(1,1-remaining/pf.INVESTMENT_PERIOD_WEEKS)),isUrgent:severity!=='normal',severity};}
function fundCapitalSnapshot(state,fund,index){
  const money=modules.dUIShell.money,cash=Math.max(0,finite(fund?.cash)),investable=fund?.status==='investing'?cash:0,reserve=Math.max(0,cash-investable),invested=typeof pf.fundDeployed==='function'?Math.max(0,finite(pf.fundDeployed(fund))):0,deployment=typeof pf.fundDeploymentRate==='function'?pf.fundDeploymentRate(fund):0;
  return {id:String(fund?.id||''),ordinal:index+1,status:String(fund?.status||'unknown'),size:Math.max(0,finite(fund?.size)),sizeLabel:money(Math.max(0,finite(fund?.size))),invested,investedLabel:money(invested),fundCash:cash,fundCashLabel:money(cash),investableCash:investable,investableCashLabel:money(investable),reserve,reserveLabel:money(reserve),dpi:typeof pf.fundDPI==='function'?pf.fundDPI(fund):0,deploymentRatio:deployment};
}
function recentFundCapital(state){const funds=arr(state?.peFirm?.funds);return funds.map((fund,index)=>fundCapitalSnapshot(state,fund,index)).slice(-2);}
function fundFormation(state,gpCommit=null){
  const money=modules.dUIShell.money;
  if(typeof pf.planFundFormation!=='function')return {available:false,ok:false,reason:'unavailable',message:'ファンド組成機能を利用できません。',personalCash:finite(state?.personalCash),personalCashLabel:money(finite(state?.personalCash))};
  const maxPlan=pf.planFundFormation(state);
  if(!maxPlan.ok)return {available:false,ok:false,reason:maxPlan.reason||'unavailable',message:String(maxPlan.message||'ファンドを組成できません。'),personalCash:finite(state?.personalCash),personalCashLabel:money(finite(state?.personalCash)),maxSize:0,maxSizeLabel:money(0),maxGpCommit:0,maxGpCommitLabel:money(0),selectedGpCommit:0,selectedGpCommitLabel:money(0),size:0,sizeLabel:money(0),ratio:0};
  const selected=gpCommit===null||gpCommit===undefined||gpCommit===''?maxPlan.gpCommit:Number(gpCommit);
  const plan=pf.planFundFormation(state,{gpCommit:selected});
  return {available:true,ok:Boolean(plan.ok),reason:plan.reason||null,message:plan.ok?null:String(plan.message||'ファンドを組成できません。'),personalCash:finite(state?.personalCash),personalCashLabel:money(finite(state?.personalCash)),maxSize:finite(maxPlan.maxSize,maxPlan.size),maxSizeLabel:money(finite(maxPlan.maxSize,maxPlan.size)),maxGpCommit:finite(maxPlan.maxGpCommit,maxPlan.gpCommit),maxGpCommitLabel:money(finite(maxPlan.maxGpCommit,maxPlan.gpCommit)),selectedGpCommit:Number.isFinite(selected)?selected:0,selectedGpCommitLabel:money(Number.isFinite(selected)?selected:0),size:plan.ok?finite(plan.size):0,sizeLabel:money(plan.ok?finite(plan.size):0),ratio:finite(maxPlan.ratio),terms:maxPlan.terms||null};
}
function nextFundOutlook(state,fund,{dpi=null,deployment=null,deploymentGate=null,remaining=null}={}){
  const money=modules.dUIShell.money,size=Math.max(0,finite(fund?.size)),currentDPI=dpi===null?pf.fundDPI(fund):Math.max(0,finite(dpi)),currentDeployment=deployment===null?pf.fundDeploymentRate(fund):Math.max(0,finite(deployment)),requiredDeployment=deploymentGate===null?pf.requiredDeploymentRate(fund):Math.max(0,finite(deploymentGate)),weeksRemaining=remaining===null?Math.max(0,finite(fund?.investmentDeadlineWeek)-finite(state?.week)):Math.max(0,finite(remaining)),investing=fund?.status==='investing'&&weeksRemaining>0;
  const feePeriodsAtMaturity=Math.max(0,Math.floor((finite(fund?.investmentDeadlineWeek)-finite(fund?.y0))/52)),paidFeePeriods=Math.max(0,Math.floor(finite(fund?.lastManagementFeePeriod))),remainingFeePeriods=investing?Math.max(0,feePeriodsAtMaturity-paidFeePeriods):0,annualFee=typeof pf.annualManagementFee==='function'?Math.max(0,finite(pf.annualManagementFee(fund))):0,currentCash=Math.max(0,finite(fund?.cash)),scheduledManagementFees=Math.min(currentCash,annualFee*remainingFeePeriods),cashReturnEstimate=investing?Math.max(0,currentCash-scheduledManagementFees):0,projectedDPI=investing&&size>0?Math.max(0,(Math.max(0,finite(fund?.distributed))+cashReturnEstimate)/size):currentDPI;
  const dpiMet=currentDPI>=pf.NEXT_FUND_MIN_DPI,deploymentMet=currentDeployment>=requiredDeployment,projectedDpiMet=projectedDPI>=pf.NEXT_FUND_MIN_DPI;
  let status={id:'dpi-short',label:'DPI不足',tone:'risk'},explanation='資金消化条件は達成していますが、現在DPIが次号条件を下回っています。';
  if(dpiMet&&deploymentMet){status={id:'met',label:'条件達成',tone:'good'};explanation='DPIと資金消化率の通常ルート条件を満たしています。';}
  else if(!dpiMet&&deploymentMet&&investing&&projectedDpiMet){status={id:'projected',label:'満了時達成見込み',tone:'warning'};explanation='資金消化条件は達成済みです。追加投資・将来Exitを織り込まず、予定管理報酬控除後の残余cash返却だけでDPI条件へ届く参考見込みです。';}
  else if(dpiMet&&!deploymentMet){status={id:'deployment-short',label:'資金消化率不足',tone:'risk'};explanation='DPI条件は達成していますが、資金消化率が次号条件を下回っています。';}
  else if(!dpiMet&&!deploymentMet){status={id:'both-short',label:'DPI・消化率とも不足',tone:'risk'};explanation='現在はDPIと資金消化率の両方が通常ルート条件を下回っています。';}
  return {currentDPI,projectedDPI,projectedDpiMet,hasProjection:investing,weeksRemaining,currentDeployment,requiredDeployment,status,explanation,annualManagementFee:annualFee,remainingFeePeriods,scheduledManagementFees,scheduledManagementFeesLabel:money(scheduledManagementFees),cashReturnEstimate,cashReturnEstimateLabel:money(cashReturnEstimate)};
}
function dashboard(state,{gpCommit=null}={}){const fund=activeFund(state),deals=rawDeals(state).map(d=>normalizeDeal(state,d)),formation=fundFormation(state,gpCommit);if(!fund)return {fund:null,formation,investmentPeriod:{weeksRemaining:0,progress:0,isUrgent:false,severity:'normal'},capital:{undeployed:0,undeployedLabel:'0円',invested:0,investedLabel:'0円',fundCash:0,fundCashLabel:'0円',investableCash:0,investableCashLabel:'0円',reserve:0,reserveLabel:'0円',singleDealLimit:0,singleDealLimitLabel:'0円',coinvestRemaining:0,coinvestRemainingLabel:'0円',deploymentRatio:0},fundComparison:[],slots:{used:0,total:0,remaining:0},diligence:{used:0,total:0,remaining:0},performance:{dpi:0,nextFundDpiGate:pf.NEXT_FUND_MIN_DPI,deploymentGate:pf.NEXT_FUND_MIN_DEPLOYMENT,normalGateMet:false,nextFundEligible:false,outlook:{currentDPI:0,projectedDPI:0,projectedDpiMet:false,hasProjection:false,weeksRemaining:0,currentDeployment:0,requiredDeployment:pf.NEXT_FUND_MIN_DEPLOYMENT,status:{id:'dpi-short',label:'DPI不足',tone:'risk'},explanation:'次号ファンド条件を確認してください。',annualManagementFee:0,remainingFeePeriods:0,scheduledManagementFees:0,scheduledManagementFeesLabel:'0円',cashReturnEstimate:0,cashReturnEstimateLabel:'0円'},rescue:{available:false,newExits:0,requiredExits:pf.RESCUE_MIN_NEW_EXITS||0,exitsRemaining:pf.RESCUE_MIN_NEW_EXITS||0,currentScore:finite(state?.peFirm?.trackRecord?.score),requiredScore:0,scoreRemaining:0}},decisions:[],dealCount:deals.length};const remaining=Math.max(0,finite(fund.investmentDeadlineWeek)-finite(state.week)),totalSlots=pf.slotCapacity(fund),usedSlots=pf.activeDealCount(fund),ddUsage=pf.currentDDUsage(state,state.week),dpi=pf.fundDPI(fund),deployment=pf.fundDeploymentRate(fund),deploymentGate=pf.requiredDeploymentRate(fund),fundIndex=arr(state.peFirm?.funds).indexOf(fund),snapshot=fundCapitalSnapshot(state,fund,fundIndex),fundCash=snapshot.fundCash,investableCash=snapshot.investableCash,singleDealLimit=Math.min(investableCash,typeof pf.maxSingleDealSize==='function'?finite(pf.maxSingleDealSize(fund)):0),coinvestRemaining=fund.status==='investing'&&typeof pf.coinvestRemaining==='function'?finite(pf.coinvestRemaining(fund)):0,money=modules.dUIShell.money,capital={undeployed:fundCash,undeployedLabel:money(fundCash),invested:snapshot.invested,investedLabel:snapshot.investedLabel,fundCash,fundCashLabel:snapshot.fundCashLabel,investableCash,investableCashLabel:snapshot.investableCashLabel,reserve:snapshot.reserve,reserveLabel:snapshot.reserveLabel,singleDealLimit,singleDealLimitLabel:money(singleDealLimit),coinvestRemaining,coinvestRemainingLabel:money(coinvestRemaining),deploymentRatio:deployment},diligence={used:ddUsage.used,total:pf.ddSlotsPerYear(state),remaining:pf.ddSlotsRemaining(state,state.week)},normalGateMet=dpi>=pf.NEXT_FUND_MIN_DPI&&deployment>=deploymentGate,newExits=typeof pf.newExitsSinceFund==='function'?finite(pf.newExitsSinceFund(state,fund)):0,requiredExits=finite(pf.RESCUE_MIN_NEW_EXITS),requiredScore=Math.min(100,finite(fund.trackScoreAtFormation)+finite(pf.RESCUE_MIN_SCORE_GAIN)),currentScore=finite(state.peFirm?.trackRecord?.score),rescue={available:typeof pf.gateRescueAvailable==='function'?Boolean(pf.gateRescueAvailable(state,fund)):false,newExits,requiredExits,exitsRemaining:Math.max(0,requiredExits-newExits),currentScore,requiredScore,scoreRemaining:Math.max(0,requiredScore-currentScore)},outlook=nextFundOutlook(state,fund,{dpi,deployment,deploymentGate,remaining}),performance={dpi,nextFundDpiGate:pf.NEXT_FUND_MIN_DPI,deploymentGate,normalGateMet,nextFundEligible:typeof pf.canFormNextFund==='function'?Boolean(pf.canFormNextFund(state)):normalGateMet,outlook,rescue},model={formation,fund:{id:String(fund.id),name:String(fund.name||'Japan Growth Buyout Fund'),ordinal:fundIndex+1,size:finite(fund.size),sizeLabel:money(fund.size),status:String(fund.status)},investmentPeriod:investmentPeriod(remaining,deployment,deploymentGate),capital,fundComparison:recentFundCapital(state),slots:{used:usedSlots,total:totalSlots,remaining:Math.max(0,totalSlots-usedSlots)},diligence,performance,dealCount:deals.length};model.decisions=decisions(state,fund,deals,model);return model;}
function lpRelations(state){
  const rows=typeof pf.lpOutreachRows==='function'?pf.lpOutreachRows(state):typeof pf.visibleLPTypes==='function'?pf.visibleLPTypes(state).map(row=>({...row,outreach:null})):[];
  const normalized=rows.map(row=>{
    const outreach=row.outreach||null,status=outreach?.status||'idle',pending=status==='ddq'||status==='followup',
      weeksRemaining=pending?Math.max(0,finite(outreach.responseWeek)-finite(state?.week)):0,
      retryWeeksRemaining=status==='declined'?Math.max(0,finite(outreach.retryWeek)-finite(state?.week)):0;
    return {
      id:String(row.id),name:String(row.name),scale:String(row.scale),meetConditionLabel:String(row.meetConditionLabel),meetable:Boolean(row.meetable),
      promiseLabel:row.promiseLabel?String(row.promiseLabel):null,riskLabel:row.riskLabel?String(row.riskLabel):null,
      status,weeksRemaining,retryWeeksRemaining,
      canSolicit:Boolean(row.meetable)&&(status==='idle'||(status==='declined'&&retryWeeksRemaining===0)),
      canAnswerQuestions:status==='questions',
      requestedWeek:outreach?finite(outreach.requestedWeek):null,responseWeek:outreach?finite(outreach.responseWeek):null,
      respondedWeek:outreach?.respondedWeek===null||outreach?.respondedWeek===undefined?null:finite(outreach.respondedWeek),
      retryWeek:outreach?.retryWeek===null||outreach?.retryWeek===undefined?null:finite(outreach.retryWeek)
    };
  });
  return {rows:normalized,pending:normalized.filter(row=>row.status==='ddq'||row.status==='followup').length,positive:normalized.filter(row=>row.status==='positive').length};
}
function businessLabel(businessID){const row=arr(modules.data?.MASTER?.businesses).find(b=>String(b?.id)===String(businessID));return String(row?.name||businessID||'事業会社');}
function annualizedIRR(moic,weeksHeld){const multiple=finite(moic),weeksHeldN=finite(weeksHeld);if(multiple<=0||weeksHeldN<13)return null;return (Math.pow(multiple,52/weeksHeldN)-1)*100;}
function holdingStatus(pc){const score=finite(pc?.improvementScore);if(score>=finite(portfolio?.REPUTATION_THRESHOLD||65))return {id:'progress',label:'改善進展'};if(score>50)return {id:'creating',label:'改善中'};return {id:'operating',label:'運営中'};}
// Read-only view of the PE levers this UI can operate, business-agnostic. priceMultiplier is
// sourced from deal.portfolioCompany.* for every business (never store.*). gym additionally gets
// membershipStrategy/strategies -- the one PE lever with no generic equivalent (setPriceMultiplier
// covers price for price-responsive businesses; realEstateAgency is explicitly excluded because
// its production brokerage pipeline never reads business.price. gym is still the only business
// with its own extra lever, setPortfolioGymMembershipStrategy).
function portfolioManagementDetails(deal,pc){
  const details={priceMultiplier:Number.isFinite(Number(pc?.priceMultiplier))?Number(pc.priceMultiplier):1};
  if(deal?.businessID==='gym'){
    const model=modules.gymMembershipModel;
    details.membershipStrategy=String(pc?.gymOperatingState?.gymMembership?.membershipStrategy||'standard');
    details.strategies=model?model.STRATEGY_ORDER.map(id=>({id,name:String(model.STRATEGIES[id]?.name||id)})):[];
  }
  return details;
}
function actionCostLabel(reason){return reason==='cash'?'買収先cash不足':reason==='employment-promise'?'雇用維持の約束により不可':reason==='maxed'?'これ以上実行できません':reason==='unsupported'?'未対応':'実行不可';}
function portfolioGenericLeverDetails(state,fund,deal,pc){
  const wage=Number.isFinite(Number(pc?.wageLevel))?Number(pc.wageLevel):1,headcount=Number.isFinite(Number(pc?.headcountRatio))?Number(pc.headcountRatio):1;
  const quality=finite(pc?.qualityInvestment),procurement=finite(pc?.procurementReform),productMix=finite(pc?.productMixLevel),consolidated=finite(pc?.consolidatedRatio),underperforming=finite(pc?.underperformingRatio);
  const previews=portfolio?.previewManagementActions?.(state,fund.id,deal.id)||{};
  const normalizeCost=row=>({cost:finite(row?.cost),postCash:finite(row?.postCash),executable:Boolean(row?.executable),reason:row?.reason||null,reasonLabel:row?.executable?null:actionCostLabel(row?.reason)});
  return {
    qualityInvestment:quality,procurementReform:procurement,wageLevel:wage,headcountRatio:headcount,productMixLevel:productMix,
    consolidatedRatio:consolidated,underperformingRatio:underperforming,closedSiteCount:Math.max(0,Math.floor(finite(pc?.closedSiteCount))),
    employmentPromise:Boolean(deal?.employmentPromise),
    costs:{
      investQuality:normalizeCost(previews.investQuality),
      reformProcurement:normalizeCost(previews.reformProcurement),
      headcountDown:normalizeCost(previews.headcountDown),
      wageUp:normalizeCost(previews.wageUp),
      renewProductMix:normalizeCost(previews.renewProductMix),
      consolidateSites:normalizeCost(previews.consolidateSites)
    },
    canInvestQuality:Boolean(previews.investQuality?.executable),
    canReformProcurement:Boolean(previews.reformProcurement?.executable),
    canCutHeadcount:Boolean(previews.headcountDown?.executable),
    canRaiseWage:Boolean(previews.wageUp?.executable),
    canRenewProductMix:Boolean(previews.renewProductMix?.executable),
    canConsolidate:Boolean(previews.consolidateSites?.executable)
  };
}
function normalizeParentAcquisition(state,fund,deal){
  const p=portfolio?.previewParentCompanyAcquisition?.(state,fund.id,deal.id)||null;
  if(!p)return {eligible:false,reason:'unavailable',purchasePrice:0,companyCash:finite(state?.companyCash),postCompanyCash:finite(state?.companyCash)};
  return {
    eligible:Boolean(p.ok),reason:p.reason||null,purchasePrice:finite(p.purchasePrice),
    companyCash:finite(p.companyCash),postCompanyCash:finite(p.postCompanyCash),
    settlement:p.settlement?{fundShare:finite(p.settlement.fundShare),coinvestShare:finite(p.settlement.coinvestShare),gpCarry:finite(p.settlement.gpCarry),gpPrincipalAndGain:finite(p.settlement.gpPrincipalAndGain)}:null
  };
}
function normalizePortfolioHolding(state,engine,fund,deal,fundOrdinal){const pc=deal?.portfolioCompany;if(!pc||deal?.status!=='active')return null;const preview=portfolio?.previewPortfolioExit?.(state,fund.id,deal.id,{method:'sale'}),capability=management?.canOpenPEPortfolioManagement?.(engine,fund.id,deal.id),ok=Boolean(preview?.ok),moic=ok?finite(preview.currentMOIC):0,holdingWeeks=ok?finite(preview.holdingWeeks):Math.max(0,finite(state?.week)-finite(deal?.acquiredWeek));return {fundID:String(fund.id),fundOrdinal,fundName:String(fund.name||`Fund ${fundOrdinal}`),dealID:String(deal.id),companyName:String(preview?.companyName||deal.companyName||businessLabel(deal.businessID)),businessID:String(deal.businessID||''),industry:businessLabel(deal.businessID),acquiredWeek:Math.max(0,finite(deal.acquiredWeek)),holdingWeeks,optimalHoldingWeeks:ok?finite(preview.optimalHoldingWeeks):0,improvementScore:finite(pc.improvementScore),weeklyRevenue:finite(pc.weeklyRevenue),weeklyProfit:finite(pc.weeklyProfit),portfolioCash:finite(pc.cash),storeCount:Math.max(1,finite(pc.storeCount)),currentMOIC:moic,currentIRR:annualizedIRR(moic,holdingWeeks),acquisitionPrice:ok?finite(preview.acquisitionPrice):finite(deal.acquisitionPrice),investedAmount:ok?finite(preview.investedAmount):finite(deal.investedAmount),currentEnterpriseValue:ok?finite(preview.exitEnterpriseValue):0,grossProceeds:ok?finite(preview.grossProceeds):0,exitMultiple:ok?finite(preview.exitMultiple):0,marketFactor:ok?finite(preview.marketFactor):0,status:holdingStatus(pc),management:{supported:Boolean(capability?.capability?.supported),actionsEnabled:Boolean(capability?.capability?.actionsEnabled),priceEnabled:deal?.businessID!=='realEstateAgency',reason:String(capability?.reason||capability?.capability?.reason||'management-action-connection-pending'),gym:portfolioManagementDetails(deal,pc),levers:portfolioGenericLeverDetails(state,fund,deal,pc)},parentAcquisition:normalizeParentAcquisition(state,fund,deal),exit:{eligible:Boolean(preview?.eligibility?.eligible),reason:preview?.eligibility?.reason||preview?.reason||null}};}
function normalizeExitScenario(row){
  if(!row)return null;
  if(!row.ok)return {ok:false,horizonWeeks:finite(row.horizonWeeks),targetWeek:finite(row.targetWeek),reason:String(row.reason||'unavailable')};
  const s=row.settlement||{},gpPrincipalAndGain=finite(s.gpPrincipalAndGain),gpCarry=finite(s.gpCarry);
  return {ok:true,label:String(row.label||''),horizonWeeks:finite(row.horizonWeeks),targetWeek:finite(row.targetWeek),exitEnterpriseValue:finite(row.exitEnterpriseValue),portfolioCash:finite(row.portfolioCash),grossProceeds:finite(row.grossProceeds),holdingWeeks:finite(row.holdingWeeks),optimalHoldingWeeks:finite(row.optimalHoldingWeeks),moic:finite(row.moic),irr:Number.isFinite(Number(row.irr))?Number(row.irr)*100:null,exitMultiple:finite(row.exitMultiple),marketFactor:finite(row.marketFactor),improvementScore:finite(row.improvementScore),weeklyProfit:finite(row.weeklyProfit),personalCashProceeds:finite(row.personalCashProceeds),projectedFundDPI:finite(row.projectedFundDPI),deploymentRate:finite(row.deploymentRate),deploymentGate:finite(row.deploymentGate),projectedNormalNextFundGate:Boolean(row.projectedNormalNextFundGate),settlement:{fundShare:finite(s.fundShare),coinvestShare:finite(s.coinvestShare),gpCarry,gpPrincipalAndGain,distributedToFund:finite(s.distributedToFund),returnedToCoinvestors:finite(s.returnedToCoinvestors),settledWeek:finite(s.settledWeek)}};
}
function exitReasonLabel(reason){
  if(reason==='ipo-not-supported')return 'この案件帯はIPO非対応';
  if(reason==='ipo-score')return `改善スコア${portfolio?.IPO_EXIT_MIN_SCORE||65}以上が必要`;
  if(reason==='ipo-hold')return `${portfolio?.IPO_EXIT_MIN_HOLD_WEEKS||52}週以上の保有が必要`;
  if(reason==='deal-not-active')return '保有中の案件ではありません';
  return reason?'実行条件未達':null;
}
function normalizeExitRoute(state,fundID,dealID,method){
  const capability=portfolio?.exitCapabilities?.(state,fundID,dealID)?.find(row=>row.id===method)||null;
  const preview=capability?.eligible?portfolio?.previewPortfolioExit?.(state,fundID,dealID,{method}):null;
  if(!preview?.ok)return {id:String(method),label:String(capability?.label||method),eligible:false,reason:capability?.reason||preview?.reason||'unavailable',reasonLabel:exitReasonLabel(capability?.reason||preview?.reason||'unavailable')};
  const s=preview.settlement||{},gpPrincipalAndGain=finite(s.gpPrincipalAndGain),gpCarry=finite(s.gpCarry);
  return {id:String(method),label:String(capability?.label||method),eligible:true,reason:null,reasonLabel:null,referenceEnterpriseValue:finite(preview.referenceEnterpriseValue,preview.exitEnterpriseValue),pricingDiscount:finite(preview.pricingDiscount),exitEnterpriseValue:finite(preview.exitEnterpriseValue),portfolioCash:finite(preview.portfolioCash),grossProceeds:finite(preview.grossProceeds),moic:finite(preview.currentMOIC),irr:annualizedIRR(preview.currentMOIC,preview.holdingWeeks),holdingWeeks:finite(preview.holdingWeeks),personalCashProceeds:gpPrincipalAndGain+gpCarry,settlement:{fundShare:finite(s.fundShare),coinvestShare:finite(s.coinvestShare),gpCarry,gpPrincipalAndGain,distributedToFund:finite(s.distributedToFund),returnedToCoinvestors:finite(s.returnedToCoinvestors),settledWeek:finite(s.settledWeek)}};
}
function normalizeExitBuyerOffer(row){
  if(!row)return null;
  const s=row.settlement||{},gpPrincipalAndGain=finite(s.gpPrincipalAndGain),gpCarry=finite(s.gpCarry);
  return {id:String(row.id||''),label:String(row.label||''),buyerType:String(row.buyerType||''),buyerFirmID:row.buyerFirmID?String(row.buyerFirmID):null,buyerName:String(row.buyerName||''),eligible:Boolean(row.eligible),reason:row.reason||null,priceFactor:finite(row.priceFactor,1),referenceEnterpriseValue:finite(row.referenceEnterpriseValue),exitEnterpriseValue:finite(row.exitEnterpriseValue),grossProceeds:finite(row.grossProceeds),moic:finite(row.currentMOIC),holdingWeeks:finite(row.holdingWeeks),irr:annualizedIRR(row.currentMOIC,finite(row.holdingWeeks)),personalCashProceeds:gpPrincipalAndGain+gpCarry,settlement:row.settlement?{fundShare:finite(s.fundShare),coinvestShare:finite(s.coinvestShare),gpCarry,gpPrincipalAndGain,distributedToFund:finite(s.distributedToFund),returnedToCoinvestors:finite(s.returnedToCoinvestors),settledWeek:finite(s.settledWeek)}:null};
}
function normalizeExitPreview(state,fundID,dealID){
  const preview=portfolio?.previewPortfolioExit?.(state,fundID,dealID,{method:'sale'});if(!preview?.ok)return null;
  const scenarios=portfolio?.previewPortfolioExitScenarios?.(state,fundID,dealID)?.scenarios||[];
  const routes=(portfolio?.EXIT_METHODS||[{id:'sale'}]).map(method=>normalizeExitRoute(state,fundID,dealID,method.id));
  const buyerOffers=(portfolio?.exitBuyerOffers?.(state,fundID,dealID)||[]).map(normalizeExitBuyerOffer).filter(Boolean);
  const s=preview.settlement||{},gpPrincipalAndGain=finite(s.gpPrincipalAndGain),gpCarry=finite(s.gpCarry);
  return {fundID:String(fundID),dealID:String(dealID),companyName:String(preview.companyName||dealID),method:String(preview.method||'sale'),acquisitionPrice:finite(preview.acquisitionPrice),investedAmount:finite(preview.investedAmount),fundPortion:finite(preview.fundPortion),coinvestPortion:finite(preview.coinvestPortion),exitEnterpriseValue:finite(preview.exitEnterpriseValue),portfolioCash:finite(preview.portfolioCash),grossProceeds:finite(preview.grossProceeds),holdingWeeks:finite(preview.holdingWeeks),optimalHoldingWeeks:finite(preview.optimalHoldingWeeks),currentMOIC:finite(preview.currentMOIC),currentIRR:annualizedIRR(preview.currentMOIC,preview.holdingWeeks),exitMultiple:finite(preview.exitMultiple),marketFactor:finite(preview.marketFactor),routes,buyerOffers,decisionCenter:{assumptionLabel:'現在の経営レバーを維持・マクロ環境は現在値で固定',scenarios:scenarios.map(normalizeExitScenario)},settlement:{fundShare:finite(s.fundShare),coinvestShare:finite(s.coinvestShare),fundPrincipalReturned:finite(s.fundPrincipalReturned),coinvestPrincipalReturned:finite(s.coinvestPrincipalReturned),fundCarry:finite(s.fundCarry),coinvestCarry:finite(s.coinvestCarry),gpCarry,gpPrincipalAndGain,personalCashProceeds:gpPrincipalAndGain+gpCarry,distributedToFund:finite(s.distributedToFund),returnedToCoinvestors:finite(s.returnedToCoinvestors),settledWeek:finite(s.settledWeek)},eligibility:{eligible:Boolean(preview.eligibility?.eligible),reason:preview.eligibility?.reason||null}};
}
function normalizePortfolio(state,engine,{portfolioDealId=null,includeExitPreview=false}={}){const holdings=[];arr(state?.peFirm?.funds).forEach((fund,index)=>arr(fund?.deals).forEach(deal=>{const row=normalizePortfolioHolding(state,engine,fund,deal,index+1);if(row)holdings.push(row);}));holdings.sort((a,b)=>b.currentEnterpriseValue-a.currentEnterpriseValue||a.companyName.localeCompare(b.companyName,'ja'));const totalInvested=holdings.reduce((sum,row)=>sum+row.investedAmount,0),grossValue=holdings.reduce((sum,row)=>sum+row.grossProceeds,0),enterpriseValue=holdings.reduce((sum,row)=>sum+row.currentEnterpriseValue,0),selected=portfolioDealId?holdings.find(row=>row.dealID===String(portfolioDealId))||null:null;return {summary:{holdingCount:holdings.length,enterpriseValue,grossValue,totalInvested,unrealizedGain:grossValue-totalInvested,weightedMOIC:totalInvested>0?grossValue/totalInvested:0,personalCash:finite(state?.personalCash)},holdings,selected,exitPreview:selected&&includeExitPreview?normalizeExitPreview(state,selected.fundID,selected.dealID):null};}
function getPEUIData({dealId=null,acceptSellerTerm=false,bidPrice=null,portfolioDealId=null,includeExitPreview=false,gpCommit=null}={}){const {engine,state}=current();if(!state||!state.peFirm?.unlocked)return {unlocked:false,active:false,navigation:NAVIGATION,dashboard:null,deals:[],bid:null,portfolio:null,lpRelations:{rows:[],pending:0,positive:0}};const active=state.selectedTab==='pe-portfolio',deals=rawDeals(state).map(d=>normalizeDeal(state,d)),fund=activeFund(state),deploymentRatio=fund?pf.fundDeploymentRate(fund):0,deploymentGate=fund?pf.requiredDeploymentRate(fund):0,bid=dealId?normalizeDeal(state,rawDeals(state).find(d=>String(d.id)===String(dealId)),{acceptSellerTerm,bidPrice,deploymentRatio,deploymentGate}):null;return {unlocked:true,active,navigation:NAVIGATION,dashboard:dashboard(state,{gpCommit}),deals,bid,portfolio:normalizePortfolio(state,engine,{portfolioDealId,includeExitPreview}),lpRelations:lpRelations(state)};}
function perform(action,payload={}){const {engine}=current();if(!engine)return false;const id=payload.dealId;if(action==='open')return engine.openMADealRoom(String(id).replace(/^target:/,''));if(action==='advance')return engine.advanceMADealRound(id);if(action==='dd')return engine.startMADueDiligence(id,'financial');if(action==='bid')return engine.submitMAOffer(id,{method:'friendly',offerPrice:payload.price,acceptSellerTerm:payload.acceptSellerTerm});if(action==='drop')return engine.withdrawMADeal(id);if(action==='solicitLP')return engine.solicitPELP?.(payload.lpTypeID)??false;if(action==='answerLPQuestions')return engine.answerPELPQuestions?.(payload.lpTypeID)??false;if(action==='formFund')return engine.formPEFund?.({gpCommit:payload.gpCommit})??false;return false;}
// Management actions require actionsEnabled here as well as in the UI. This defense-in-depth gate
// prevents stale/bypassed D UI calls from reaching production writes for pillars whose detached
// operating bridge is not connected yet. Every write stays inside pePortfolioOperations.
function requireManagementCapability(engine,fundID,dealID){
  const capability=management?.canOpenPEPortfolioManagement?.(engine,fundID,dealID);
  return Boolean(capability?.ok&&capability.capability?.actionsEnabled);
}
function saveSuccessful(engine,result){if(!result)return false;engine.save?.();return true;}
function performPortfolio(action,payload={}){
  const {engine,state}=current();if(!engine||!state||!portfolio)return false;
  const fundID=String(payload.fundID||''),dealID=String(payload.dealID||'');
  if(action==='exit')return saveSuccessful(engine,portfolio.exitPortfolioCompany(state,fundID,dealID,{method:String(payload.method||'sale'),buyerID:payload.buyerID?String(payload.buyerID):null}));
  if(action==='acquireIntoGroup')return engine.acquirePEPortfolioCompany?.(fundID,dealID)??false;
  if(!requireManagementCapability(engine,fundID,dealID))return false;
  // realEstateAgency's production brokerage pipeline never reads business.price. Reject the
  // legacy generic price action instead of accepting a player input that cannot affect settlement.
  // Keep this lookup local to the price exception so the long-standing generic/gym price adapter
  // contract does not acquire a new dependency on findFundAndDeal().
  if(action==='setGymPriceMultiplier'){
    const priceTarget=portfolio.findFundAndDeal?.(state,fundID,dealID);
    if(priceTarget?.deal?.businessID==='realEstateAgency')return false;
    return saveSuccessful(engine,portfolio.setPriceMultiplier(state,fundID,dealID,payload.value));
  }
  if(action==='setGymMembershipStrategy')return saveSuccessful(engine,portfolio.setPortfolioGymMembershipStrategy(state,fundID,dealID,payload.strategyID));
  const found=portfolio.findFundAndDeal?.(state,fundID,dealID),pc=found?.deal?.portfolioCompany;
  if(!pc)return false;
  if(action==='investQuality')return saveSuccessful(engine,portfolio.investQuality(state,fundID,dealID,10_000_000));
  if(action==='reformProcurement')return saveSuccessful(engine,portfolio.reformProcurement(state,fundID,dealID,Math.min(1,finite(pc.procurementReform)+.25)));
  if(action==='setStaffing'){
    if(payload.kind==='headcount-down')return saveSuccessful(engine,portfolio.setStaffing(state,fundID,dealID,{headcountRatio:(Number.isFinite(Number(pc.headcountRatio))?Number(pc.headcountRatio):1)-.1}));
    if(payload.kind==='wage-up')return saveSuccessful(engine,portfolio.setStaffing(state,fundID,dealID,{wageLevel:(Number.isFinite(Number(pc.wageLevel))?Number(pc.wageLevel):1)+.1}));
    return false;
  }
  if(action==='renewProductMix')return saveSuccessful(engine,portfolio.renewProductMix(state,fundID,dealID,Math.min(1,finite(pc.productMixLevel)+.5)));
  if(action==='consolidateSites')return saveSuccessful(engine,portfolio.consolidateSites(state,fundID,dealID));
  return false;
}
modules.peUIAdapter=Object.freeze({NAVIGATION,getPEUIData,perform,performPortfolio,preferDrop,normalizePortfolio,normalizeExitPreview,normalizeExitScenario,normalizeExitRoute,normalizeExitBuyerOffer,thresholds:Object.freeze({DECISION_LIMIT,FINAL_BID_URGENT_WEEKS,INVESTMENT_RISK_FRACTION,DEADLINE_CRITICAL_WEEKS,DD_OPPORTUNITY_WEEKS,NETWORK_WARNING_MARGIN}),__installed:true});
globalThis.CapitalismTycoonPEUIAdapter=modules.peUIAdapter;
})();
