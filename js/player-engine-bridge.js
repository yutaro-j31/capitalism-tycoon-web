// Phase 6A-5C / Phase 8A-3: capture the app engine and install product innovation roadmaps.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-engine-bridge.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-engine-bridge.js.');
if(!modules.playerCrisisUI?.__installed)throw new Error('player-crisis-ui.js must be loaded before player-engine-bridge.js.');
if(modules.playerEngineBridge)throw new Error('player engine bridge is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const finance=modules.finance;
const VERSION=2,HISTORY_LIMIT=80,PROJECT_LIMIT=120,FOCUS_SHARE=.65;
// A single productVenture realistically earns tens of thousands of yen per week even after
// years of investment (208-week playtest: ~2.5万円-4万円/週 best case), so a roadmap priced at
// several million yen must be repeatable a reasonable number of times from that revenue, not
// only from an unrelated business line's cash. Base costs were cut ~40% (4.0M/5.5M/8.0M/9.5M
// -> 2.4M/3.3M/4.8M/5.7M) to bring a full multi-roadmap arc within reach of a moderately
// successful product's own trajectory while still keeping every roadmap pricier than the
// equivalent amount of direct quality/marketing investment (js/engine.js productAction).
const ROADMAPS=Object.freeze([
  Object.freeze({id:'quality_refresh',name:'品質刷新',description:'UXと中核機能を再設計し、品質・課金転換率・継続率を改善します。',cost:2_400_000,weeks:8,departmentIDs:['product']}),
  Object.freeze({id:'growth_engine',name:'成長エンジン',description:'紹介導線と顧客獲得ループを構築し、認知・ブランド・市場規模を伸ばします。',cost:3_300_000,weeks:7,departmentIDs:['product','marketing']}),
  Object.freeze({id:'scale_platform',name:'基盤拡張',description:'サーバーと運用基盤を刷新し、処理能力・運用効率・サポート品質を改善します。',cost:4_800_000,weeks:10,departmentIDs:['dx']}),
  Object.freeze({id:'enterprise_suite',name:'法人展開',description:'法人向け機能と営業パッケージを開発し、契約数・ARPU・評価額を伸ばします。',cost:5_700_000,weeks:12,departmentIDs:['product','marketing']})
]);
// Repeating a roadmap gets pricier (diminishing novelty), but uncapped this compounded forever
// across ALL roadmap types combined -- by the 10th-15th repetition seen in a normal 208-week
// playthrough it was already adding 80-120% on top of the base cost with no ceiling in sight.
// Capping the repetition count keeps the "repeats cost more" intent while bounding the
// escalation to a fixed +40% ceiling.
const ROADMAP_REPETITION_CAP=5;
const STATUS_SET=new Set(['active','completed','cancelled']);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const compactYen=modules.engine.compactYen||((v)=>`${Math.round(finite(v)).toLocaleString('ja-JP')}円`);
const roadmapTemplate=id=>ROADMAPS.find(x=>x.id===id)||null;
function ensure(state){
  if(!state||typeof state!=='object')return state;
  state.productInnovationVersion=Math.max(VERSION,integer(state.productInnovationVersion));
  state.productRoadmaps=Array.isArray(state.productRoadmaps)?state.productRoadmaps.filter(Boolean):[];
  state.productInnovationHistory=Array.isArray(state.productInnovationHistory)?state.productInnovationHistory.filter(Boolean).slice(0,HISTORY_LIMIT):[];
  state.productPatentAssignments=state.productPatentAssignments&&typeof state.productPatentAssignments==='object'&&!Array.isArray(state.productPatentAssignments)?state.productPatentAssignments:{};
  state.nextProductRoadmapSeq=Math.max(1,integer(state.nextProductRoadmapSeq,1));
  state.lastProductInnovationWeek=Math.max(0,integer(state.lastProductInnovationWeek));
  for(const product of state.productVentures||[]){
    product.innovationLevel=Math.max(0,integer(product.innovationLevel));
    product.completedRoadmapCount=Math.max(0,integer(product.completedRoadmapCount));
    product.appliedPatentIDs=Array.isArray(product.appliedPatentIDs)?[...new Set(product.appliedPatentIDs.map(String))]:[];
    product.lastInnovationWeek=Math.max(0,integer(product.lastInnovationWeek));
  }
  const focus=typeof state.productInnovationFocusID==='string'?productFor(state,state.productInnovationFocusID):null;
  state.productInnovationFocusID=focus&&focus.status==='released'&&focus.origin!=='founderHome'&&focus.lifecycleStage!=='retired'?String(focus.id):null;
  for(const project of state.productRoadmaps){
    project.projectID=String(project.projectID||`roadmap-${state.nextProductRoadmapSeq++}`);
    project.productID=String(project.productID||'');
    project.roadmapID=String(project.roadmapID||'');
    project.status=STATUS_SET.has(project.status)?project.status:'cancelled';
    project.progress=clamp(project.progress,0,100);
    project.startedWeek=Math.max(1,integer(project.startedWeek,state.week||1));
    project.lastUpdatedWeek=Math.max(0,integer(project.lastUpdatedWeek));
    project.cost=Math.max(0,finite(project.cost));
  }
  if(state.productRoadmaps.length>PROJECT_LIMIT){
    const active=state.productRoadmaps.filter(x=>x.status==='active');
    const closed=state.productRoadmaps.filter(x=>x.status!=='active').slice(-Math.max(0,PROJECT_LIMIT-active.length));
    state.productRoadmaps=[...closed,...active];
  }
  return state;
}
function activeRoadmap(state,productID){ensure(state);return state.productRoadmaps.find(x=>x.productID===String(productID)&&x.status==='active')||null;}
function productFor(state,productID){return (state.productVentures||[]).find(x=>String(x.id)===String(productID))||null;}
function productPortfolioAllocationSnapshot(state){
  ensure(state);const rows=[],contenders=new Map();
  for(const project of state.productRoadmaps.filter(x=>x.status==='active')){
    const product=productFor(state,project.productID),template=roadmapTemplate(project.roadmapID),office=product&&product.origin!=='founderHome'&&product.status==='released'&&product.lifecycleStage!=='retired';
    const requiredDepartments=office&&template?[...template.departmentIDs]:[];
    const row={productID:String(project.productID),projectID:String(project.projectID),requiredDepartments,departmentShares:{},allocationFactor:1,focused:String(project.productID)===state.productInnovationFocusID};rows.push(row);
    for(const departmentID of requiredDepartments){if(!contenders.has(departmentID))contenders.set(departmentID,[]);contenders.get(departmentID).push(row);}
  }
  for(const [departmentID,departmentRows] of contenders){
    const focused=departmentRows.find(x=>x.focused),equal=1/departmentRows.length;
    for(const row of departmentRows)row.departmentShares[departmentID]=focused&&departmentRows.length>1?(row===focused?FOCUS_SHARE:(1-FOCUS_SHARE)/(departmentRows.length-1)):equal;
  }
  for(const row of rows)if(row.requiredDepartments.length)row.allocationFactor=Math.min(...row.requiredDepartments.map(id=>row.departmentShares[id]));
  return rows;
}
function roadmapAllocationFactor(state,project){return productPortfolioAllocationSnapshot(state).find(x=>x.projectID===String(project?.projectID))?.allocationFactor??1;}
function history(state,type,text,extra={}){
  const row={week:integer(state.week,1),type,text:String(text||''),...extra};
  state.productInnovationHistory.unshift(row);
  state.productInnovationHistory=state.productInnovationHistory.slice(0,HISTORY_LIMIT);
  state.news=Array.isArray(state.news)?state.news:[];
  state.news.unshift(`第${row.week}週：${row.text}`);
  state.news=state.news.slice(0,300);
  return row;
}
function roadmapCost(product,template){
  const solo=product?.origin==='founderHome';
  const repetitions=Math.min(ROADMAP_REPETITION_CAP,Math.max(0,integer(product?.completedRoadmapCount)));
  return Math.round(template.cost*(solo?.25:1)*(1+repetitions*.08));
}
function roadmapWeeks(product,template){return template.weeks+(product?.origin==='founderHome'?3:0);}
function missingDepartments(state,product,template){
  if(product?.origin==='founderHome')return [];
  return template.departmentIDs.filter(id=>!state.departments?.[id]);
}
function workforceFactor(state,departmentIDs){
  if(!departmentIDs.length)return 1;
  const values=departmentIDs.map(id=>{
    const result=state.workforceResultsByDepartmentID?.[id]||{};
    const utilization=Math.max(0,finite(result.utilization));
    const fatigue=clamp(result.fatigue,0,100);
    return clamp((utilization>1?1/utilization:1)*(1-fatigue/240),.35,1.15);
  });
  return values.reduce((a,b)=>a+b,0)/values.length;
}
function options(instance,productID){
  const state=ensure(instance?.g),product=productFor(state,productID),active=activeRoadmap(state,productID);
  if(!product)return [];
  return ROADMAPS.map(template=>{
    const cost=roadmapCost(product,template),weeks=roadmapWeeks(product,template),missing=missingDepartments(state,product,template),reasons=[];
    if(product.status!=='released')reasons.push('公開済みプロダクトが必要です');
    if(active)reasons.push(`${roadmapTemplate(active.roadmapID)?.name||'別計画'}が進行中です`);
    if(missing.length)reasons.push(`必要部門: ${missing.join('・')}`);
    if(finite(state.companyCash)<cost)reasons.push('会社資金が不足しています');
    return Object.freeze({...template,cost,weeks,missingDepartments:missing,canStart:reasons.length===0,reasons});
  });
}
function ensureProductFunnel(instance,product){
  if(typeof instance.ensureProductFunnel==='function')return instance.ensureProductFunnel(product);
  instance.g.productFunnels=instance.g.productFunnels||{};
  if(!instance.g.productFunnels[product.id])instance.g.productFunnels[product.id]={productID:product.id,awareness:.03,registeredUsers:finite(product.users),monthlyActiveUsers:finite(product.users)*.55,paidUsers:finite(product.paidUsers),conversionRate:.025,churnRate:.08,arpu:finite(product.price,1000),serverLoad:0,supportBurden:.1,b2bContracts:0,lastUpdatedWeek:instance.g.week};
  return instance.g.productFunnels[product.id];
}
function applyRoadmap(instance,project,product,template){
  const funnel=ensureProductFunnel(instance,product);
  let summary='';
  if(template.id==='quality_refresh'){
    product.quality=clamp(finite(product.quality)+8,0,100);
    funnel.conversionRate=clamp(finite(funnel.conversionRate,.025)+.006,.003,.7);
    funnel.churnRate=clamp(finite(funnel.churnRate,.08)-.006,.003,.28);
    summary='品質+8、転換率改善、解約率低下';
  }else if(template.id==='growth_engine'){
    product.brand=clamp(finite(product.brand)+7,0,100);
    product.market=Math.max(1,finite(product.market,1)*1.03);
    funnel.awareness=clamp(finite(funnel.awareness,.03)+.06,.01,1);
    summary='ブランド+7、認知拡大、市場+3%';
  }else if(template.id==='scale_platform'){
    product.serverCapacity=Math.max(1000,finite(product.serverCapacity,25000)*1.8);
    product.serverCost=Math.max(0,finite(product.serverCost,20000)*.9);
    funnel.supportBurden=clamp(finite(funnel.supportBurden,.1)-.08,0,1.5);
    funnel.serverLoad=clamp(finite(funnel.serverLoad)-.2,0,2);
    summary='処理能力1.8倍、サーバー費-10%、運用負荷低下';
  }else if(template.id==='enterprise_suite'){
    funnel.b2bContracts=Math.max(0,integer(funnel.b2bContracts)+4);
    funnel.arpu=Math.max(1,finite(funnel.arpu,product.price||1000)*1.08);
    product.quality=clamp(finite(product.quality)+3,0,100);
    product.brand=clamp(finite(product.brand)+3,0,100);
    summary='法人契約+4、ARPU+8%、品質・ブランド+3';
  }
  const valuationMultiple={quality_refresh:1.06,growth_engine:1.08,scale_platform:1.10,enterprise_suite:1.12}[template.id]||1.04;
  product.valuation=Math.max(1_000_000,finite(product.valuation,1_000_000)*valuationMultiple);
  product.innovationLevel=Math.max(0,integer(product.innovationLevel))+1;
  product.completedRoadmapCount=Math.max(0,integer(product.completedRoadmapCount))+1;
  product.lastInnovationWeek=integer(instance.g.week,1);
  project.status='completed';project.progress=100;project.completedWeek=integer(instance.g.week,1);project.resultSummary=summary;
  history(instance.g,'roadmapCompleted',`${product.name}の「${template.name}」が完了しました。${summary}。`,{projectID:project.projectID,productID:product.id,roadmapID:template.id});
  return project;
}
function patentImplementationCost(product){return product?.origin==='founderHome'?400_000:1_500_000;}
function applyPatent(instance,patent,product){
  const funnel=ensureProductFunnel(instance,product),effect=String(patent.effect||'product');
  let summary='';
  if(effect==='unitCost'){
    product.serverCost=Math.max(0,finite(product.serverCost,20000)*.92);
    product.quality=clamp(finite(product.quality)+2,0,100);
    funnel.supportBurden=clamp(finite(funnel.supportBurden,.1)-.04,0,1.5);
    summary='運用費-8%、品質+2、サポート負荷低下';
  }else if(effect==='demand'){
    product.market=Math.max(1,finite(product.market,1)*1.05);
    product.brand=clamp(finite(product.brand)+2,0,100);
    funnel.awareness=clamp(finite(funnel.awareness,.03)+.025,.01,1);
    summary='市場+5%、ブランド+2、認知向上';
  }else if(effect==='brand'){
    product.brand=clamp(finite(product.brand)+6,0,100);
    funnel.awareness=clamp(finite(funnel.awareness,.03)+.04,.01,1);
    summary='ブランド+6、認知向上';
  }else{
    product.quality=clamp(finite(product.quality)+5,0,100);
    funnel.conversionRate=clamp(finite(funnel.conversionRate,.025)+.005,.003,.7);
    funnel.churnRate=clamp(finite(funnel.churnRate,.08)-.003,.003,.28);
    summary='品質+5、転換率改善、解約率低下';
  }
  product.valuation=Math.max(1_000_000,finite(product.valuation,1_000_000)*1.04);
  return summary;
}
function validate(state){
  ensure(state);const errors=[],activeByProduct=new Map();
  for(const project of state.productRoadmaps){
    if(!roadmapTemplate(project.roadmapID))errors.push(`unknown roadmap ${project.roadmapID}`);
    if(!STATUS_SET.has(project.status))errors.push(`invalid roadmap status ${project.status}`);
    if(!Number.isFinite(project.progress)||project.progress<0||project.progress>100)errors.push(`invalid roadmap progress ${project.projectID}`);
    if(project.status==='active'){
      if(!productFor(state,project.productID))errors.push(`active roadmap product missing ${project.productID}`);
      activeByProduct.set(project.productID,(activeByProduct.get(project.productID)||0)+1);
    }
  }
  for(const [productID,count] of activeByProduct)if(count>1)errors.push(`multiple active roadmaps for ${productID}`);
  return {ok:errors.length===0,errors};
}
function installProductInnovation(){
  const proto=EngineClass.prototype;if(proto.__productInnovationInstalled)return true;
  if(typeof proto.updateProductFunnelsWeekly!=='function')throw new Error('expansion.js must install before product innovation.');
  const baseNormalize=proto.normalize;
  proto.normalize=function(){baseNormalize.call(this);ensure(this.g);};
  proto.ensureProductInnovationDefaults=function(){return ensure(this.g);};
  proto.productInnovationOptions=function(productID){return options(this,productID);};
  proto.productInnovationSnapshot=function(productID){
    ensure(this.g);const product=productFor(this.g,productID);if(!product)return null;
    return {product,active:activeRoadmap(this.g,productID),completed:this.g.productRoadmaps.filter(x=>x.productID===String(productID)&&x.status==='completed'),options:options(this,productID),assignedPatentIDs:[...(product.appliedPatentIDs||[])]};
  };
  proto.productPortfolioAllocationSnapshot=function(){return productPortfolioAllocationSnapshot(this.g);};
  proto.setProductInnovationFocus=function(productID){return this.runTransaction(()=>{
    ensure(this.g);const next=productID===null?null:String(productID||''),product=next?productFor(this.g,next):null;
    if(next&&(!product||product.status!=='released'||product.origin==='founderHome'||product.lifecycleStage==='retired'))return this.fail('重点開発できる公開済みプロダクトが見つかりません。');
    if(this.g.productInnovationFocusID===next)return false;this.g.productInnovationFocusID=next;this.notify(next?`${product.name}を重点開発に設定しました。`:'開発リソースを均等配分に戻しました。','success');return true;
  });};
  proto.startProductInnovationRoadmap=function(productID,roadmapID){return this.runTransaction(()=>{
    ensure(this.g);const product=productFor(this.g,productID),template=roadmapTemplate(roadmapID);if(!product||!template)return this.fail('プロダクトまたは計画が見つかりません。');
    const option=options(this,productID).find(x=>x.id===roadmapID);if(!option?.canStart)return this.fail(option?.reasons?.[0]||'この計画は開始できません。');
    const projectID=`product-roadmap-${this.g.nextProductRoadmapSeq++}`,project={projectID,productID:String(product.id),productName:product.name,roadmapID:template.id,roadmapName:template.name,status:'active',progress:0,cost:option.cost,plannedWeeks:option.weeks,departmentIDs:[...template.departmentIDs],startedWeek:integer(this.g.week,1),lastUpdatedWeek:0};
    this.g.companyCash-=option.cost;
    finance.event(this.g,'researchAndDevelopment',option.cost,{cashEffect:-option.cost,profitEffect:-option.cost,assetEffect:0,sourceType:'productInnovationRoadmap',sourceID:projectID,operationID:projectID,description:`${product.name} ${template.name}`});
    product.investedCost=finite(product.investedCost)+option.cost;
    this.g.productRoadmaps.push(project);history(this.g,'roadmapStarted',`${product.name}で「${template.name}」を開始しました。`,{projectID,productID:product.id,roadmapID:template.id});
    this.notify(`${product.name}の${template.name}を開始しました。`,'success');return project;
  });};
  proto.cancelProductInnovationRoadmap=function(projectID){return this.runTransaction(()=>{
    ensure(this.g);const project=this.g.productRoadmaps.find(x=>x.projectID===String(projectID)&&x.status==='active');if(!project)return this.fail('進行中の計画が見つかりません。');
    project.status='cancelled';project.cancelledWeek=integer(this.g.week,1);history(this.g,'roadmapCancelled',`${project.productName||'プロダクト'}の「${project.roadmapName||project.roadmapID}」を中止しました。投資額の返金はありません。`,{projectID:project.projectID,productID:project.productID,roadmapID:project.roadmapID});
    this.notify('プロダクト計画を中止しました。','warning');return true;
  });};
  proto.assignPatentToProduct=function(patentID,productID){return this.runTransaction(()=>{
    ensure(this.g);const patent=(this.g.patentRecords||[]).find(x=>String(x.id)===String(patentID)),product=productFor(this.g,productID);if(!patent||!product||product.status!=='released')return this.fail('特許または公開済みプロダクトが見つかりません。');
    if(this.g.productPatentAssignments[String(patent.id)])return this.fail('この特許はすでに別のプロダクトへ実装済みです。');
    const cost=patentImplementationCost(product);if(finite(this.g.companyCash)<cost)return this.fail('特許実装費用が不足しています。');
    this.g.companyCash-=cost;finance.event(this.g,'researchAndDevelopment',cost,{cashEffect:-cost,profitEffect:-cost,assetEffect:0,sourceType:'productPatentImplementation',sourceID:`${patent.id}-${product.id}`,operationID:`productPatent-${patent.id}`,description:`${product.name} ${patent.name}実装`});
    product.investedCost=finite(product.investedCost)+cost;
    const summary=applyPatent(this,patent,product);product.appliedPatentIDs=[...new Set([...(product.appliedPatentIDs||[]),String(patent.id)])];patent.assignedProductID=String(product.id);patent.assignedWeek=integer(this.g.week,1);
    this.g.productPatentAssignments[String(patent.id)]={patentID:String(patent.id),patentName:patent.name,productID:String(product.id),productName:product.name,assignedWeek:integer(this.g.week,1),cost,summary};
    history(this.g,'patentAssigned',`${patent.name}を${product.name}へ実装しました。${summary}。`,{patentID:String(patent.id),productID:String(product.id)});this.notify(`${patent.name}を${product.name}へ実装しました。`,'success');return true;
  });};
  proto.updateProductInnovationWeekly=function(){
    ensure(this.g);if(integer(this.g.lastProductInnovationWeek)===integer(this.g.week))return [];
    this.g.lastProductInnovationWeek=integer(this.g.week);const completed=[],allocations=new Map(productPortfolioAllocationSnapshot(this.g).map(x=>[x.projectID,x.allocationFactor]));
    for(const project of this.g.productRoadmaps.filter(x=>x.status==='active')){
      if(integer(project.lastUpdatedWeek)===integer(this.g.week))continue;
      const product=productFor(this.g,project.productID),template=roadmapTemplate(project.roadmapID);if(!product||!template||product.status==='sold'){
        project.status='cancelled';project.cancelledWeek=integer(this.g.week);history(this.g,'roadmapCancelled',`${project.productName||'プロダクト'}の計画は対象事業が存在しないため終了しました。`,{projectID:project.projectID,productID:project.productID,roadmapID:project.roadmapID});continue;
      }
      const solo=product.origin==='founderHome',departmentEffects=template.departmentIDs.map(id=>finite(this.departmentEffect?.(id),0)),departmentEffect=departmentEffects.length?departmentEffects.reduce((a,b)=>a+b,0)/departmentEffects.length:0;
      const founderTech=clamp(this.g.founderSkillTech,1,3),staffFactor=solo?1:workforceFactor(this.g,template.departmentIDs),teamFactor=clamp((solo?.68:.72)+departmentEffect*.24+founderTech*.09,.55,1.75)*staffFactor;
      const speed=100/Math.max(1,finite(project.plannedWeeks,roadmapWeeks(product,template)))*teamFactor*(allocations.get(project.projectID)??1);project.progress=clamp(finite(project.progress)+speed,0,100);project.lastUpdatedWeek=integer(this.g.week);
      if(project.progress>=100)completed.push(applyRoadmap(this,project,product,template));
    }
    return completed;
  };
  const baseUpdateFunnels=proto.updateProductFunnelsWeekly;
  proto.updateProductFunnelsWeekly=function(){const result=baseUpdateFunnels.call(this);this.updateProductInnovationWeekly();return result;};
  const baseSellProduct=proto.sellProduct;
  proto.sellProduct=function(id){ensure(this.g);for(const project of this.g.productRoadmaps.filter(x=>x.productID===String(id)&&x.status==='active')){project.status='cancelled';project.cancelledWeek=integer(this.g.week);history(this.g,'roadmapCancelled',`${project.productName||'プロダクト'}の計画は事業売却により終了しました。`,{projectID:project.projectID,productID:project.productID,roadmapID:project.roadmapID});}const result=baseSellProduct.call(this,id);ensure(this.g);return result;};
  Object.defineProperty(proto,'__productInnovationInstalled',{value:true});return true;
}
let activeEngine=null,bound=false;
function bindEngine(instance){activeEngine=instance||null;schedule();return instance;}
function getEngine(){return activeEngine;}
function renderKey(html){let hash=2166136261;const text=String(html||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
function renderSection(instance=activeEngine){
  if(!instance||!instance.g?.configured||instance.g.selectedTab!=='business')return '';
  ensure(instance.g);const products=(instance.g.productVentures||[]).filter(x=>x.status==='released'&&x.lifecycleStage!=='retired'),officeProducts=products.filter(x=>x.origin!=='founderHome'),allocations=new Map(productPortfolioAllocationSnapshot(instance.g).map(x=>[x.projectID,x]));if(!products.length)return '';
  const availablePatents=(instance.g.patentRecords||[]).filter(x=>!instance.g.productPatentAssignments[String(x.id)]);
  const rows=products.map(product=>{
    const snapshot=instance.productInnovationSnapshot(product.id),active=snapshot.active,assigned=(product.appliedPatentIDs||[]).length;
    const plan=active?(()=>{const template=roadmapTemplate(active.roadmapID),pct=Math.round(clamp(active.progress,0,100)),allocation=Math.round((allocations.get(active.projectID)?.allocationFactor??1)*100);return `<div class="meters"><label>${esc(template?.name||active.roadmapID)} ${pct}%<div class="progress"><i style="width:${pct}%"></i></div><small>開始 第${integer(active.startedWeek)}週 · 投資 ${esc(compactYen(active.cost))} · 開発配分 ${allocation}%</small></label></div><button class="btn danger small" data-product-innovation-action="cancel" data-project-id="${esc(active.projectID)}">計画を中止</button>`;})():`<div class="button-grid">${snapshot.options.map(option=>`<button class="btn small" data-product-innovation-action="start" data-product-id="${esc(product.id)}" data-roadmap-id="${esc(option.id)}" ${option.canStart?'':`disabled title="${esc(option.reasons.join(' / '))}"`}>${esc(option.name)} · ${esc(compactYen(option.cost))}</button>`).join('')}</div>`;
    const patents=availablePatents.slice(0,4).map(patent=>`<button class="btn ghost small" data-product-innovation-action="patent" data-product-id="${esc(product.id)}" data-patent-id="${esc(patent.id)}">${esc(patent.name)}を実装</button>`).join('');
    return `<article class="item product-innovation-item"><div><h3>${esc(product.name)} <span class="badge">革新Lv${integer(product.innovationLevel)}</span></h3><p>品質 ${finite(product.quality).toFixed(0)} · ブランド ${finite(product.brand).toFixed(0)} · 完了計画 ${integer(product.completedRoadmapCount)}件 · 実装特許 ${assigned}件</p></div>${plan}${patents?`<details class="learning-card"><summary>未実装特許を適用</summary><p>実装費は通常150万円、自宅開発プロダクトは40万円です。1件の特許は1プロダクトにのみ割り当てられます。</p><div class="button-row">${patents}</div></details>`:''}</article>`;
  }).join('');
  const focus=productFor(instance.g,instance.g.productInnovationFocusID),allocation=officeProducts.length>=2?`<div class="learning-card"><h3>開発リソース配分</h3><p>現在: ${focus?`重点 ${esc(focus.name)}`:'均等配分'}</p><div class="button-grid"><button class="btn small ${focus?'ghost':'primary'}" style="min-height:44px" data-product-innovation-action="focus" data-product-id="" ${focus?'':'disabled'}>均等配分${focus?'':'（選択中）'}</button>${officeProducts.map(product=>`<button class="btn small ${focus?.id===product.id?'primary':'ghost'}" style="min-height:44px" data-product-innovation-action="focus" data-product-id="${esc(product.id)}" ${focus?.id===product.id?'disabled':''}>${esc(product.name)}${focus?.id===product.id?'（重点）':''}</button>`).join('')}</div></div>`:'';
  const key=renderKey(allocation+rows);return `<section class="card product-innovation-panel" data-product-innovation-ui="1" data-product-innovation-render-key="${key}" aria-live="polite"><div class="card-head"><div><h2>プロダクト・イノベーション</h2><p>短期投資ではなく、複数週の開発計画と特許実装で競争優位を構築します。</p></div><span class="badge good">Phase 8A-3</span></div><div class="card-body">${allocation}<div class="grid two">${rows}</div></div></section>`;
}
function existingRenderKey(node){return String(node?.getAttribute?.('data-product-innovation-render-key')||node?.dataset?.productInnovationRenderKey||'');}
function enhance(){
  if(typeof document==='undefined'||!activeEngine)return false;const screen=document.getElementById('screen');if(!screen)return false;
  const existing=screen.querySelector?.('[data-product-innovation-ui]'),desired=renderSection(activeEngine);if(!desired){if(existing){existing.remove?.();return true;}return false;}
  const key=(desired.match(/data-product-innovation-render-key="([^"]+)"/)||[])[1]||'';if(existingRenderKey(existing)===key)return false;
  if(existing){existing.outerHTML=desired;return true;}if(typeof screen.insertAdjacentHTML==='function')screen.insertAdjacentHTML('beforeend',desired);else screen.innerHTML=`${String(screen.innerHTML||'')}${desired}`;return true;
}
function schedule(){enhance();}
function handleClick(event){
  const target=event?.target?.closest?.('[data-product-innovation-action]');if(!target||target.disabled||!activeEngine)return false;event.preventDefault?.();event.stopPropagation?.();const action=String(target.dataset.productInnovationAction||'');let result=false;
  if(action==='focus')result=activeEngine.setProductInnovationFocus(target.dataset.productId?String(target.dataset.productId):null);
  else if(action==='start'){
    const productID=String(target.dataset.productId||''),roadmapID=String(target.dataset.roadmapId||''),option=activeEngine.productInnovationOptions(productID).find(x=>x.id===roadmapID);if(!option?.canStart)return false;
    const product=productFor(activeEngine.g,productID),message=`${product?.name||'プロダクト'}で「${option.name}」を開始します。投資額${compactYen(option.cost)}、標準期間${option.weeks}週です。途中で中止しても返金されません。`;if(typeof globalThis.confirm==='function'&&!globalThis.confirm(message))return false;
    result=activeEngine.startProductInnovationRoadmap(productID,roadmapID);
  }else if(action==='cancel'){
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm('進行中の計画を中止します。投資済み資金は返金されません。'))return false;result=activeEngine.cancelProductInnovationRoadmap(String(target.dataset.projectId||''));
  }else if(action==='patent'){
    const productID=String(target.dataset.productId||''),patentID=String(target.dataset.patentId||''),product=productFor(activeEngine.g,productID),patent=(activeEngine.g.patentRecords||[]).find(x=>String(x.id)===patentID),cost=patentImplementationCost(product);
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm(`${patent?.name||'特許'}を${product?.name||'プロダクト'}へ${compactYen(cost)}で実装します。この特許は他のプロダクトへ再割当できません。`))return false;result=activeEngine.assignPatentToProduct(patentID,productID);
  }
  if(result)schedule();return Boolean(result);
}
let registeredEnhancerDefinition=null;
function registerEnhancer(definition){if(registeredEnhancerDefinition)return registeredEnhancerDefinition;registeredEnhancerDefinition=definition;const registry=modules.uiEnhancerRegistry;if(registry?.registerUIEnhancer)return registry.registerUIEnhancer(definition);const key='__capitalismTycoonPendingUIEnhancers';const pending=Array.isArray(globalThis[key])?globalThis[key]:(globalThis[key]=[]);pending.push(definition);return definition;}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',handleClick);bound=true;}registerEnhancer({id:'player-engine-bridge-product-innovation',enhance});}
const productInnovation=Object.freeze({VERSION,HISTORY_LIMIT,PROJECT_LIMIT,FOCUS_SHARE,ROADMAPS,ROADMAP_REPETITION_CAP,ensure,activeRoadmap,options,roadmapCost,roadmapWeeks,missingDepartments,workforceFactor,productPortfolioAllocationSnapshot,roadmapAllocationFactor,applyRoadmap,applyPatent,validate,renderSection,enhance,handleClick,installProductInnovation,__installed:true});
modules.productInnovation=productInnovation;
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){installProductInnovation();const instance=bindEngine(baseLoad(...args));installUI();return instance;};
modules.playerEngineBridge=Object.freeze({bindEngine,getEngine,installProductInnovation,productInnovation,__installed:true});
})();
