// Script boundary: js/pe-fund.js (classic JavaScript)
//
// PE mode T5 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §2, §12): the fund container
// itself -- state.peFirm and the lifecycle of a single fund (formation week, investment
// period, term, and the rule that exit proceeds are distributed immediately and never
// reinvested). This file intentionally does not touch js/ma-deal-room.js; funds cannot yet
// finance an acquisition (that wiring is a later task) so state.peFirm.funds[].deals stays
// empty except in tests that seed it directly to exercise T7's DPI/next-fund math.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-fund.js.');
if(!modules?.completion)throw new Error('Capitalism Tycoon completion module must load before pe-fund.js.');
if(modules.peFund)throw new Error('Capitalism Tycoon peFund module is already registered.');
const EngineClass=modules.engine.TycoonEngine;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));
const arr=v=>Array.isArray(v)?v:[];

// ファンド期間10年・投資期間5年（設計書§2）。週次エンジンなので週数で扱う。
const FUND_TERM_WEEKS=520;
const INVESTMENT_PERIOD_WEEKS=260;
// PE mode T7: 次号組成の条件（設計書§3 関門3）。
const NEXT_FUND_MIN_DPI=1.2;
const NEXT_FUND_MIN_DEPLOYMENT=.8;

function defaultTrackRecord(){return {score:0,exits:[],realizedDPI:0};}
// T26-1: 共同投資家の資本は独立した勘定として持つ。
//   coinvestContributed … 共同投資家が案件へ出した累計（プレイヤーの外から入る唯一の資金の
//                          もう一つ。もう一つはファンド組成時のLP拠出 fund.lpContributed）
//   coinvestCapital     … Exitで共同投資家へ返した額の残高（返却先の勘定）。プレイヤーは使えない
// 旧実装は fund.coinvestCommitted / coinvestReturned の累計スカラーだけで、出資元と返却先の
// 勘定が無く、資金の出入りを追跡できなかった（Codex GAME-REAUDIT-001）。
function defaultPeFirm(){return {trackRecord:defaultTrackRecord(),funds:[],ddSlotsPerYear:3,ddUsage:{period:0,used:0},unlocked:false,coinvestContributed:0,coinvestCapital:0};}

// LPコミットメント配列の共通正規化（Codex独立監査の指摘対応）: 同一lpTypeIDの重複除去
// （先勝ち）と MAX_LPS_PER_FUND(5件) への切り詰めを1箇所に集約する。ensureFund（load正規化
// とcreateFundの両方が通る）とaddLPCommitmentの両方がこの関数を経由することで、
// create/load/addのどの書き込み経路からも同じ上限が効く。LP_TYPESに存在しないlpTypeIDの
// エントリも無効として除外する。
function normalizeLPs(list){
  const out=[];
  const seen=new Set();
  for(const c of arr(list)){
    if(!c||!LP_TYPES[c.lpTypeID]||seen.has(c.lpTypeID))continue;
    seen.add(c.lpTypeID);
    out.push({lpTypeID:c.lpTypeID,committedAmount:Math.max(0,finite(c.committedAmount)),promiseAccepted:Boolean(c.promiseAccepted)&&Boolean(LP_TYPES[c.lpTypeID].promiseID),promiseFulfilled:c.promiseFulfilled===true||c.promiseFulfilled===false?c.promiseFulfilled:null});
    if(out.length>=MAX_LPS_PER_FUND)break;
  }
  return out;
}

function ensureFund(f,week){
  if(!f)return f;
  f.lps=normalizeLPs(f.lps);
  f.deals=arr(f.deals).slice(-500);
  f.terms=f.terms&&typeof f.terms==='object'?f.terms:{fee:0,carry:0,hurdle:0};
  f.terms.fee=Math.max(0,finite(f.terms.fee));
  f.terms.carry=Math.max(0,finite(f.terms.carry));
  f.terms.hurdle=Math.max(0,finite(f.terms.hurdle));
  // MAX_FUND_SIZE（設計書§2/§12、5兆円の絶対上限）は formableFundSize() だけでなく、
  // ここ（load正規化・createFundの両方が通る唯一の書き込み経路）でも強制する。
  // formableFundSize経由でない直接のcreateFund呼び出しや、旧セーブの読み込みで
  // 上限超過の値が紛れ込んでも、この行が最終的な境界になる。
  f.size=Math.min(MAX_FUND_SIZE,Math.max(0,finite(f.size)));
  f.gpCommit=Math.max(0,finite(f.gpCommit));
  f.y0=Math.max(1,Math.floor(finite(f.y0,week)));
  // T5 simplification: the whole committed size is called at formation (cash=size,
  // undrawn=0) rather than modeling a gradual capital-call schedule, since no deal-financing
  // mechanic exists yet to draw against a schedule. undrawn is kept in the shape (per the
  // design doc's fund contract) for a later task to actually use.
  f.cash=Math.max(0,finite(f.cash,f.size));
  f.undrawn=Math.max(0,finite(f.undrawn,0));
  f.distributed=Math.max(0,finite(f.distributed,0));
  f.undeployedReturned=Math.max(0,finite(f.undeployedReturned,0));
  f.coinvestCommitted=Math.max(0,finite(f.coinvestCommitted,0));
  // T26: co-invest は案件ごとにLPからcallされる外部資金。cash残高と累計拠出を分けて、
  // 「枠を使った」というメモだけで取得原価が生まれないようにする。
  f.coinvestCash=Math.max(0,finite(f.coinvestCash,0));
  f.coinvestContributed=Math.max(0,finite(f.coinvestContributed,f.coinvestCommitted));
  f.coinvestReturned=Math.max(0,finite(f.coinvestReturned,0));
  // T21: ファンドの現金がどこから来たかを明示する（保存則の検証に使う）。
  // fund.cash の出どころは GP出資(gpCommit) と LP拠出(lpContributed) の2つだけ。
  // 旧セーブ（T21以前に作られたファンド）は差分をLP拠出として補う。
  f.lpContributed=Math.max(0,finite(f.lpContributed,Math.max(0,f.size-f.gpCommit)));
  f.gpDistributed=Math.max(0,finite(f.gpDistributed,0));
  f.lpDistributed=Math.max(0,finite(f.lpDistributed,Math.max(0,f.distributed-f.gpDistributed)));
  f.gpCarryPaid=Math.max(0,finite(f.gpCarryPaid,0));
  f.managementFeesPaid=Math.max(0,finite(f.managementFeesPaid,0));
  f.managementFeeShortfall=Math.max(0,finite(f.managementFeeShortfall,0));
  // T26-2: 管理報酬から払われた投資チームの人件費の累計（GP側の費用）。
  f.teamPayrollPaid=Math.max(0,finite(f.teamPayrollPaid,0));
  // T26以前のsaveにはperiod markerが無い。既に処理済みの周年を未払いとして遡及請求すると
  // load直後に最大10年分が動くため、legacy fundはlastProcessedWeekまで支払済み扱いにする。
  const legacyFeePeriod=Math.min(Math.floor(FUND_TERM_WEEKS/52),Math.max(0,Math.floor((finite(f.lastProcessedWeek,week)-f.y0)/52)));
  f.lastManagementFeePeriod=Math.max(0,Math.floor(finite(f.lastManagementFeePeriod,legacyFeePeriod)));
  f.investmentDeadlineWeek=f.y0+INVESTMENT_PERIOD_WEEKS;
  f.deadlineWeek=f.y0+FUND_TERM_WEEKS;
  f.status=f.status||'investing';
  f.lastProcessedWeek=Math.max(0,Math.floor(finite(f.lastProcessedWeek,f.y0)));
  return f;
}

function ensure(state){
  if(!state)return state;
  if(!state.peFirm||typeof state.peFirm!=='object')state.peFirm=defaultPeFirm();
  const pf=state.peFirm;
  pf.trackRecord=pf.trackRecord&&typeof pf.trackRecord==='object'?pf.trackRecord:defaultTrackRecord();
  pf.trackRecord.exits=arr(pf.trackRecord.exits).slice(-200);
  pf.trackRecord.score=clamp(finite(pf.trackRecord.score),0,100);
  pf.trackRecord.realizedDPI=Math.max(0,finite(pf.trackRecord.realizedDPI));
  pf.funds=arr(pf.funds).slice(-20);
  pf.unlocked=Boolean(pf.unlocked);
  pf.funds.forEach(f=>ensureFund(f,finite(state.week,1)));
  // T24-1: 救済導線の基準点。T24以前のセーブには無いので、読み込み時点のスコアを基準にする
  // （その時点から RESCUE_MIN_SCORE_GAIN 伸ばせば再開放される、という保守的な既定値）。
  pf.funds.forEach(f=>{if(!Number.isFinite(Number(f.trackScoreAtFormation)))f.trackScoreAtFormation=finite(pf.trackRecord.score);});
  // T26-1: 旧セーブには共同投資の勘定が無いので、既存のファンド側の累計から復元する
  // （出資済み累計＝各ファンドの coinvestCommitted の合計、返却残高＝coinvestReturned の合計）。
  pf.coinvestContributed=Math.max(0,finite(pf.coinvestContributed,pf.funds.reduce((sum,f)=>sum+Math.max(0,finite(f?.coinvestCommitted)),0)));
  pf.coinvestCapital=Math.max(0,finite(pf.coinvestCapital,pf.funds.reduce((sum,f)=>sum+Math.max(0,finite(f?.coinvestReturned)),0)));
  pf.ddUsage=pf.ddUsage&&typeof pf.ddUsage==='object'?pf.ddUsage:{period:0,used:0};
  pf.ddUsage.period=Math.max(0,Math.floor(finite(pf.ddUsage.period,0)));
  pf.ddUsage.used=Math.max(0,Math.floor(finite(pf.ddUsage.used,0)));
  // ddSlotsPerYear is a derived value (パートナー数に連動、設計書§4/T10) recomputed on every
  // normalize so it never goes stale relative to the current team; the stored field exists
  // only so old T5-era saves (fixed at 3) and any code reading it directly see a valid number.
  pf.ddSlotsPerYear=computeDDSlotsPerYear(state);
  if(!Number.isFinite(finite(state.currentCompanyFoundedInvestment,NaN)))state.currentCompanyFoundedInvestment=Math.max(1,finite(state.companyCash,8_000_000));
  return state;
}

// PE mode T6 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §3 関門2): GP出資・報酬条件.
// GP commits GP_COMMIT_FRACTION_OF_PERSONAL_CASH of personal cash; the required GP ratio
// falls (and the formable fund size rises) as trackRecord.score climbs. Formulas are the
// task doc's literal ones, not the design doc's illustrative table (which mixes in later
// LP-trust history from its own simulation and doesn't reduce to one clean formula).
const GP_COMMIT_FRACTION_OF_PERSONAL_CASH=.5;
// ファンド1本の絶対上限（設計書§2/§12）: 逓減では100年の指数爆発を止められないと検証済みの
// ため、規模そのものに天井を置く。天井到達後は複利ではなく単利的な成長に切り替わる
// （複数ファンド運用・個人資産への流出でのみ資産が伸び続ける、というのが設計書の結論）。
//
// T24-2: 5兆円 → 1兆円。設計書§12が5兆円を選んだ時点では、§15の業種帯（最大4,000億円）と
// 年4件固定の供給では投資期間5年に1兆円弱しか消化できないことが検証されていなかった。
// 5兆円のファンドは構造的に消化できず、次号ゲートの資金消化率を満たせないまま梯子が
// 止まる（T20/T22で実測）。日本市場を舞台にしている以上、現実の世界最大級（2〜3兆円）に
// 対して1兆円の方が実態にも近い。設計書§12の検証表にも1兆円の行（天井到達24年・
// 100年後の個人資産2.19兆）が既にあり、その値を採用する。
const MAX_FUND_SIZE=1_000_000_000_000;
function requiredGPRatio(score){return clamp(.20-.18*Math.pow(clamp(score,0,100)/100,.7),.02,.20);}
function managementFeeRate(score){return .015+.01*(clamp(score,0,100)/100);}
function carryRate(score){return .15+.10*(clamp(score,0,100)/100);}
function hurdleRate(score){return .10-.02*(clamp(score,0,100)/100);}
function fundTermsForScore(score){return {fee:managementFeeRate(score),carry:carryRate(score),hurdle:hurdleRate(score)};}
// LP信頼度（設計書§3）: reacts to the most recently EVALUATED fund's DPI tier (set by T7's
// evaluateFund below). Until any fund has been evaluated there is no history to react to, so
// it stays neutral (1).
function lpTrustMultiplier(state){ensure(state);const funds=state.peFirm.funds;for(let i=funds.length-1;i>=0;i--){const f=funds[i];if(Number.isFinite(f.dpiAtEvaluation))return f.dpiAtEvaluation>=NEXT_FUND_MIN_DPI?1.12:f.dpiAtEvaluation>=1.0?.80:.55;}return 1;}
// T22: 市場が吸収できるファンド規模の上限。
// 案件供給は年4件で固定（設計書§15）で、そのうち今のファンドの帯に合うのは一部だけ。
// 投資期間5年のあいだに打てる件数 × 1件あたりに実際に出る金額 が、そのファンドが消化
// できる金額の上限になる。これを超える規模を集めても資金消化率が上がらず、次号ゲート
// （DPI 1.2倍以上 かつ 規模相応の消化率）を満たせなくなってファンドの梯子が恒久的に
// 止まる — T20の通し検証で年20前後の停止として実際に観測された。
// 現実のPEでも「打てる案件の量に対してファンドを大きくしすぎない」のが普通なので、
// 集める額そのものをここで頭打ちにする。
//
// 1件あたりの金額はレバレッジ後の自己資金ではなく買収価格そのもの（取得経路は価格の全額を
// ファンドの現金で払う）。帯の中の分布は対数一様なので、代表値は下限と上限の幾何平均。
const ACQUISITION_PREMIUM_ESTIMATE=1.18; // 友好的買収のプレミアム（js/ma-deal-room.js OFFER_METHODS）
function marketAbsorbableFundSize(){
  const tiers=globalThis.__capitalismTycoonModules?.peIndustryTiers;
  if(!tiers)return Infinity;
  const ids=tiers.TIER_IDS;
  if(!ids?.length)return Infinity;
  // 規模が上がるほど打てる帯は絞られる（最終的に最大の帯だけになる）。その1帯ぶんの流量で見る。
  const dealsInPeriod=tiers.DEALS_PER_YEAR*(INVESTMENT_PERIOD_WEEKS/52)/ids.length;
  const top=ids.reduce((best,id)=>tiers.TIERS[id].sizeMax>tiers.TIERS[best].sizeMax?id:best,ids[0]);
  const typicalPrice=Math.sqrt(tiers.TIERS[top].sizeMin*tiers.TIERS[top].sizeMax)*ACQUISITION_PREMIUM_ESTIMATE;
  // NEXT_FUND_MIN_DEPLOYMENT で割る = 「消化率の要件を満たせる最大の規模」。
  return dealsInPeriod*typicalPrice/NEXT_FUND_MIN_DEPLOYMENT;
}
function formableFundSize(state){
  ensure(state);
  const ratio=requiredGPRatio(state.peFirm.trackRecord.score);
  const gpBudget=Math.max(0,finite(state.personalCash))*GP_COMMIT_FRACTION_OF_PERSONAL_CASH;
  const funds=state.peFirm.funds,latestFund=funds[funds.length-1];
  const promiseMultiplier=latestFund?promiseComplianceMultiplier(latestFund):1;
  const raw=ratio>0?gpBudget/ratio*lpTrustMultiplier(state)*promiseMultiplier:0;
  return Math.min(raw,MAX_FUND_SIZE,marketAbsorbableFundSize());
}

// PE mode T6: a single exit's "quality" in [0,1], composited from MOIC, speed, and business
// quality (profitable-week streak + headcount). Weights and curve shape are this file's own
// calibration -- neither doc gives an exact formula, only the two testable bounds: a first
// exit must land in [5,15], and the score must climb toward 100 with a longer, better track
// record.
function exitQuality(exit){
  const moicQ=clamp((finite(exit.personalMOIC,1)-1)/2,0,1);
  const speedQ=clamp(1-(finite(exit.yearsElapsed,10)-1)/9,0,1);
  // A fund-level track-record entry (T7's evaluateFund) has no employee/profit-streak
  // concept of its own -- it is the fund's blended DPI, not one company -- so it is scored
  // purely on MOIC and speed instead of diluting those with a fabricated quality signal.
  if(exit.exitType==='fund')return moicQ*.6+speedQ*.4;
  const qualityQ=clamp(finite(exit.profitableWeekStreak)/260,0,1)*.7+clamp(finite(exit.employeeCount)/50,0,1)*.3;
  return moicQ*.4+speedQ*.2+qualityQ*.4;
}
function computeTrackScore(exits){
  const list=arr(exits);
  if(!list.length)return 0;
  const n=list.length;
  const ceilingFor=k=>k<=1?15:Math.min(100,15+(k-1)*20);
  const ceiling=ceilingFor(n),floor=ceilingFor(n-1);
  const avgQuality=list.reduce((sum,e)=>sum+exitQuality(e),0)/n;
  return Math.round(clamp(floor+avgQuality*(ceiling-floor),0,100));
}

// Records one Exit (会社売却・IPO・子会社売却) into trackRecord.exits and refreshes the
// composite score. Unlocks PE mode on the very first exit (設計書§3 関門1).
function recordExit(state,{exitType,realizedAmount=0,investedAmount=1,foundedWeek=1,exitedWeek=1,profitableWeekStreak=0,employeeCount=0}={}){
  ensure(state);
  const investedSafe=Math.max(1,finite(investedAmount,1));
  const personalMOIC=Math.max(0,finite(realizedAmount)/investedSafe);
  const yearsElapsed=Math.max(1/52,(finite(exitedWeek)-finite(foundedWeek))/52);
  const entry={id:`pe-exit-${state.peFirm.trackRecord.exits.length+1}-${finite(exitedWeek)}`,exitType:String(exitType||'unknown'),realizedAmount:Math.max(0,finite(realizedAmount)),investedAmount:investedSafe,personalMOIC,yearsElapsed,profitableWeekStreak:Math.max(0,finite(profitableWeekStreak)),employeeCount:Math.max(0,finite(employeeCount)),recordedWeek:Math.max(1,finite(state.week,1))};
  state.peFirm.trackRecord.exits.push(entry);
  state.peFirm.trackRecord.exits=state.peFirm.trackRecord.exits.slice(-200);
  state.peFirm.trackRecord.score=computeTrackScore(state.peFirm.trackRecord.exits);
  state.peFirm.unlocked=true;
  return entry;
}

// Derives the 4 recorded items (設計書§3) from state for an exit of the CURRENT company
// (whole-company buyout, or an IPO founder-share sale that doesn't end the company).
function recordExitForCurrentCompany(state,exitType,realizedAmount){
  ensure(state);
  const foundedWeek=Math.max(1,finite(state.currentCompanyFoundedWeek,1));
  const exitedWeek=Math.max(foundedWeek,finite(state.week,foundedWeek));
  const investedAmount=Math.max(1,finite(state.currentCompanyFoundedInvestment,8_000_000));
  const history=arr(state.weeklyProfitHistory);
  let profitableWeekStreak=0;
  for(let i=history.length-1;i>=0&&finite(history[i])>0;i--)profitableWeekStreak++;
  const employeeCount=arr(state.workforceTeams).reduce((sum,t)=>sum+Math.max(0,finite(t?.headcount)),0);
  return recordExit(state,{exitType,realizedAmount,investedAmount,foundedWeek,exitedWeek,profitableWeekStreak,employeeCount});
}

// Test/internal-only fund creation (no UI action yet -- see file header). Returns the
// created fund. y0 defaults to the current week.
// T21（会計整合性）: ファンド組成は1つのアトミックなトランザクション。
// 設計書§3「GP出資は回収不能。失敗すれば個人資産も消える」の通り、GP出資は必ず
// state.personalCash から出る。旧実装は fund.cash を作るだけで個人資産もLP資本も
// 減らしておらず、無から現金が生まれていた（T20レポート§9-2 / Codex GAME-AUDIT-006）。
//
// 保存則: 組成の前後で
//     personalCash_after + fund.cash === personalCash_before + fund.lpContributed
// が厳密に成り立つ（LP拠出はプレイヤーの外から入る唯一の資金で、額を必ず記録する）。
// 会社の現金（companyCash）はファンド組成に一切関与しない。
// 個人資産が gpCommit に足りなければ何も変更せず null を返す。
function createFund(state,{size=0,gpCommit=0,terms={fee:0,carry:0,hurdle:0},lps=[],y0}={}){
  ensure(state);
  const cappedSize=Math.min(MAX_FUND_SIZE,Math.max(0,finite(size)));
  const commit=Math.max(0,Math.min(cappedSize,finite(gpCommit)));
  if(finite(state.personalCash)<commit)return null; // 個人資産が足りなければ組成できない
  state.personalCash=finite(state.personalCash)-commit;
  const fund={id:`pe-fund-${state.peFirm.funds.length+1}-${finite(state.week,1)}`,size:cappedSize,gpCommit:commit,lpContributed:cappedSize-commit,gpDistributed:0,lpDistributed:0,gpCarryPaid:0,managementFeesPaid:0,managementFeeShortfall:0,teamPayrollPaid:0,lastManagementFeePeriod:0,coinvestCash:0,coinvestContributed:0,trackScoreAtFormation:finite(state.peFirm.trackRecord.score),lps:arr(lps),terms:{...terms},y0:Math.max(1,Math.floor(finite(y0,finite(state.week,1)))),cash:cappedSize,undrawn:0,distributed:0,deals:[],status:'investing'};
  ensureFund(fund,finite(state.week,1));
  state.peFirm.funds.push(fund);
  // Fix 3 (Codex独立監査): push直後にもファンド本数上限(20)を適用する。ensure()側の
  // slice(-20)は次回normalize時にしか効かないため、createFund単体で20本目を超えて
  // 積み上げてから一度もnormalizeを挟まずに次のcreateFundを呼ぶ経路（テスト・将来のUI）を
  // 塞ぐには、この場でも即座に切り詰める必要がある。
  state.peFirm.funds=state.peFirm.funds.slice(-20);
  return fund;
}

// T21: ファンドからの分配。LPとGPは出資比率どおりに分け合うので、GPの持分（gpCommit/size）は
// プレイヤーの個人資産へ実際に戻る。これがGP出資の元本返済であり、キャリー（成功報酬）とは別物。
// fund.distributed はファンド全体の分配額（DPIの分子）なので、GP持分を含めた総額を積む。
function gpShareOfFund(fund){const size=Math.max(0,finite(fund?.size));return size>0?clamp(finite(fund?.gpCommit)/size,0,1):0;}
function distributeToInvestors(state,fund,amount){
  const gross=Math.max(0,finite(amount));
  if(!fund||gross<=0)return 0;
  fund.distributed=Math.max(0,finite(fund.distributed))+gross;
  const gpPart=gross*gpShareOfFund(fund);
  fund.lpDistributed=Math.max(0,finite(fund.lpDistributed))+(gross-gpPart);
  if(gpPart>0&&state){
    fund.gpDistributed=Math.max(0,finite(fund.gpDistributed))+gpPart;
    state.personalCash=finite(state.personalCash)+gpPart;
  }
  return gpPart;
}

// PE mode T7 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §3 関門3): DPI / IRR and the
// next-fund formation gate. T5 calls a fund's entire size at formation, so "出資総額" is just
// fund.size; fundDeployed reads state.peFirm.funds[].deals, which stays empty until a later
// task can actually finance an acquisition from a fund -- tests exercise this by pushing
// synthetic deal records directly.
function fundContributed(fund){return Math.max(0,finite(fund?.size));}
// Fund deployment is the capital paid by the fund itself.  `investedAmount` is the total
// acquisition cost and also includes the LP co-investment slice, so using it here would let
// external co-investment inflate the fund's deployment gate and its track-record denominator.
// Legacy deals predate the split and therefore continue to fall back to investedAmount.
function fundDeployed(fund){return arr(fund?.deals).reduce((sum,d)=>sum+Math.max(0,finite(d?.fundPortion,d?.investedAmount)),0);}
function fundDeploymentRate(fund){const c=fundContributed(fund);return c>0?clamp(fundDeployed(fund)/c,0,1):0;}
function fundDPI(fund){const c=fundContributed(fund);return c>0?Math.max(0,finite(fund.distributed))/c:0;}
// Approximates IRR as the fund's compound annual growth rate (distributed/contributed over
// elapsed years). This is not a true multi-cashflow XIRR, but neither doc's next-fund gate or
// LP-trust tiers are defined in terms of IRR (both use DPI), so a closer approximation isn't
// load-bearing for any tested behavior -- IRR here is informational.
function fundIRR(fund,currentWeek){
  const years=Math.max(1/52,(finite(currentWeek,fund.y0)-fund.y0)/52);
  const dpi=fundDPI(fund);
  return dpi>0?Math.pow(dpi,1/years)-1:-1;
}
// Evaluates a fund's current performance: records its DPI for js/pe-fund.js's own LP-trust
// tiering (lpTrustMultiplier), and -- only when at least NEXT_FUND_MIN_DEPLOYMENT of its
// capital was actually deployed -- feeds that performance into trackRecord (a fund that
// mostly sat in cash and returned it undeployed does not get credited, per the task doc's
// "資金消化80%未満だと実績が加算されない"). Callable at any time (no auto-trigger from
// processFundsWeek yet -- there is no fund-financed deal-exit mechanic to react to until a
// later task, so a test or a future "raise the next fund" action calls this on demand).
function evaluateFund(state,fundID,evaluationWeek,{recordTrackRecord=true}={}){
  ensure(state);
  const fund=state.peFirm.funds.find(f=>f.id===fundID);
  if(!fund)return null;
  const week=Math.max(fund.y0,finite(evaluationWeek,finite(state.week,fund.y0)));
  const dpi=fundDPI(fund),deploymentRate=fundDeploymentRate(fund);
  fund.dpiAtEvaluation=dpi;
  fund.deploymentRateAtEvaluation=deploymentRate;
  fund.evaluatedWeek=week;
  state.peFirm.trackRecord.realizedDPI=dpi;
  // T17: evaluateFund は週次処理からも自動的に呼ばれるようになったため、トラックレコードへの
  // 加算は「1ファンドにつき1回だけ」に制限する（recordTrackRecord:false の週次リフレッシュでは
  // そもそも加算しない）。加算済みかどうかは fund.trackRecordExitID が持つ。
  const trackRecordAdded=deploymentRate>=requiredDeploymentRate(fund)&&recordTrackRecord&&!fund.trackRecordExitID;
  if(trackRecordAdded){
    // 設計書: 未投資返却分（額面1.0x）はファンド全体のDPI(上のdpi/fundDPI)には含めるが、
    // トラックレコードのスコア計算には一切加算しない。ここで使うMOICは、実際に投資に
    // 回した分（fundDeployed）が生んだ回収額（distributed-undeployedReturned）だけを
    // 分子・分母に使い、未投資分を除外する。
    const deployedInvested=Math.max(1,fundDeployed(fund));
    const deployedRealized=Math.max(0,finite(fund.distributed)-finite(fund.undeployedReturned));
    const entry=recordExit(state,{exitType:'fund',realizedAmount:deployedRealized,investedAmount:deployedInvested,foundedWeek:fund.y0,exitedWeek:week});
    fund.trackRecordExitID=entry.id;
  }
  return {dpi,deploymentRate,irr:fundIRR(fund,week),trackRecordAdded};
}
// T22: 次号ゲートの資金消化率の要件は、ファンドの規模に応じて段階的に緩める。
// 案件供給は年4件で固定（設計書§15）なのに対しファンド規模は実績とともに伸びるため、
// 大型ファンドほど期間内に消化しきれない。要件を80%で固定したままだと、規模が案件供給を
// 追い越した瞬間に梯子が恒久的に止まる（T20検証で年20前後の停止として観測）。
// DPI 1.2倍以上の要件は設計の核（実績が実現していないと次号は組めない）なので変えない。
const DEPLOYMENT_RELAXATION_START=500_000_000_000;  // 5,000億円を超えたところから緩め始める
const MIN_DEPLOYMENT_FLOOR=.35;                     // どれだけ大型でもここまでしか緩めない
// 投資期間を終えたファンドは「もう消化する機会が無い」ので、さらに一段緩める。
const CLOSED_PERIOD_DEPLOYMENT_FACTOR=.8;
function requiredDeploymentRate(fund){
  const size=Math.max(0,finite(fund?.size));
  if(size<=DEPLOYMENT_RELAXATION_START)return NEXT_FUND_MIN_DEPLOYMENT;
  // 規模が2倍になるごとに要件を線形に下げ、MIN_DEPLOYMENT_FLOOR で頭打ちにする。
  const doublings=Math.log2(size/DEPLOYMENT_RELAXATION_START);
  const relaxed=NEXT_FUND_MIN_DEPLOYMENT-(NEXT_FUND_MIN_DEPLOYMENT-MIN_DEPLOYMENT_FLOOR)*clamp(doublings/4,0,1);
  const periodFactor=fund&&fund.status!=='investing'?CLOSED_PERIOD_DEPLOYMENT_FACTOR:1;
  return Math.max(MIN_DEPLOYMENT_FLOOR,relaxed*periodFactor);
}
// T24-1（救済導線の結線）: 設計書§10 の「2号を組めない年は起業に戻って会社を作りExitする」を
// ゲートに接続する。これ以前は canFormNextFund が最新ファンドだけを見ており、クローズした
// ファンドのDPIは二度と改善しないため、1本でもDPI 1.2を下回ると**恒久的に**次号を組めなく
// なっていた（T23の較正後、普通のプレイヤーがFund Iで100年停止することを実測）。
// 設計書が想定していたのは「15%が足踏みする」一時的な停滞であって、詰みではない。
//
// 再開放の条件（無条件にはしない。Exit1回で失敗を帳消しにできるとゲートの意味が消える）:
//   1. その号を組成したあとに、ファンド評価ではない新しいExit（会社売却・IPO等）が
//      RESCUE_MIN_NEW_EXITS 件以上ある ＝ 実際に起業パートへ戻って結果を出したこと
//   2. トラックレコードのスコアが、その号の組成時点から RESCUE_MIN_SCORE_GAIN 以上伸びている
//      （スコアが既に100なら min(100, ...) により「100のまま維持」が条件になる）
const RESCUE_MIN_NEW_EXITS=2;
const RESCUE_MIN_SCORE_GAIN=10;
function newExitsSinceFund(state,fund){
  return arr(state?.peFirm?.trackRecord?.exits).filter(e=>e&&e.exitType!=='fund'&&finite(e.recordedWeek)>finite(fund?.y0)).length;
}
function gateRescueAvailable(state,fund){
  if(!state||!fund)return false;
  if(newExitsSinceFund(state,fund)<RESCUE_MIN_NEW_EXITS)return false;
  const required=Math.min(100,finite(fund.trackScoreAtFormation)+RESCUE_MIN_SCORE_GAIN);
  return finite(state.peFirm.trackRecord.score)>=required;
}

// 次号を組成できる条件（設計書§3）: DPI 1.2倍以上 かつ 資金消化が規模相応の水準以上。
// 最新のファンドが評価済みならその値を、未評価ならその場で計算した現在値を使う。
// ファンドがまだ無ければ Fund Iの話（T6の解禁条件のみ）。
function canFormNextFund(state){
  ensure(state);
  const funds=state.peFirm.funds;
  if(!funds.length)return state.peFirm.unlocked;
  const latest=funds[funds.length-1];
  const dpi=Number.isFinite(latest.dpiAtEvaluation)?latest.dpiAtEvaluation:fundDPI(latest);
  const deploymentRate=Number.isFinite(latest.deploymentRateAtEvaluation)?latest.deploymentRateAtEvaluation:fundDeploymentRate(latest);
  if(dpi>=NEXT_FUND_MIN_DPI&&deploymentRate>=requiredDeploymentRate(latest))return true;
  // 通常のゲートに落ちても、起業パートで新しい実績を積んでいれば再挑戦できる（設計書§10）。
  return gateRescueAvailable(state,latest);
}

// PE mode T8 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §3 関門3): LP面談. This is
// deliberately NOT a "decision" screen (§9 failure 7 found every LP-mix optimization reduces
// to "raise the max regardless") -- it is progress visibility (which LPs are meetable),
// evaluation of the last fund, and promise bookkeeping. Meet conditions follow the design
// doc's table; each LP type's accompanying condition is a PROMISE (something the player can
// accept or decline, never a hard constraint), except formerColleague/wealthyFamilyOffice,
// whose rows describe a passive risk instead of an active promise to keep.
const LP_TYPES=Object.freeze({
  formerColleague:Object.freeze({id:'formerColleague',name:'元同僚・知人',scale:'小',meetConditionLabel:'実績不問',promiseID:null,promiseLabel:null,riskLabel:'失敗すると人間関係の記録が残る'}),
  wealthyFamilyOffice:Object.freeze({id:'wealthyFamilyOffice',name:'富裕層・ファミリーオフィス',scale:'小〜中',meetConditionLabel:'Exit経験1回',promiseID:null,promiseLabel:null,riskLabel:'途中解約を言い出すことがある'}),
  regionalBankCorporate:Object.freeze({id:'regionalBankCorporate',name:'地方銀行・事業会社',scale:'中',meetConditionLabel:'スコア30',promiseID:'localInvestment',promiseLabel:'地元企業へ2件以上投資する',riskLabel:null}),
  pensionFund:Object.freeze({id:'pensionFund',name:'年金基金',scale:'大',meetConditionLabel:'DPI 1.2倍実績',promiseID:'quarterlyReporting',promiseLabel:'四半期報告を行う',riskLabel:null}),
  universitySovereign:Object.freeze({id:'universitySovereign',name:'大学基金・政府系',scale:'最大',meetConditionLabel:'実現実績2本',promiseID:'investmentRestriction',promiseLabel:'投資対象を制約に従わせる',riskLabel:null})
});
const LP_TYPE_IDS=Object.freeze(Object.keys(LP_TYPES));
// 破っても即ペナルティではなく、次号の調達額が目減りするだけ（設計書「守れないと次号で
// 不利になるだけ」）。全履行なら1.0（ボーナスなし）、全不履行ならこの下限まで下がる。
const PROMISE_BROKEN_FLOOR=.7;
// ファンド1本あたりのLP件数上限。現状LP_TYPESは5種類しかないため同一タイプ拒否と
// 実質同じ効果になるが、T14でLP面談UIが付く前に上限自体を明示しておく。
const MAX_LPS_PER_FUND=5;

function meetsLPCondition(state,lpTypeID){
  ensure(state);
  const tr=state.peFirm.trackRecord;
  if(lpTypeID==='formerColleague')return true;
  if(lpTypeID==='wealthyFamilyOffice')return tr.exits.length>=1;
  if(lpTypeID==='regionalBankCorporate')return tr.score>=30;
  if(lpTypeID==='pensionFund')return state.peFirm.funds.some(f=>Number.isFinite(f.dpiAtEvaluation)&&f.dpiAtEvaluation>=NEXT_FUND_MIN_DPI);
  if(lpTypeID==='universitySovereign')return tr.exits.length>=2;
  return false;
}
// 進捗の可視化（画面6）: 会えるLPだけでなく、会えないLPも条件付きで返す。
function visibleLPTypes(state){
  ensure(state);
  return LP_TYPE_IDS.map(id=>({...LP_TYPES[id],meetable:meetsLPCondition(state,id)}));
}

// 案件ではなくLPとの間の「約束」。断っても(promiseAccepted:false)ペナルティは無く、単に
// その分の金額が小さいだけ（金額そのものはUIが無いためcommittedAmountを呼び出し側が渡す）。
function addLPCommitment(fund,{lpTypeID,committedAmount=0,promiseAccepted=false}={}){
  if(!fund||!LP_TYPES[lpTypeID])return null;
  fund.lps=normalizeLPs(fund.lps); // 既存状態を先に重複除去・上限適用してから判定する
  if(fund.lps.some(c=>c.lpTypeID===lpTypeID))return null; // 同一LPタイプは1ファンドにつき1件まで
  if(fund.lps.length>=MAX_LPS_PER_FUND)return null; // ファンド1本あたりのLP件数上限
  const commitment={lpTypeID,committedAmount:Math.max(0,finite(committedAmount)),promiseAccepted:Boolean(promiseAccepted)&&Boolean(LP_TYPES[lpTypeID].promiseID),promiseFulfilled:null};
  fund.lps.push(commitment);
  return commitment;
}
// 約束の達成状況を記録する。fulfilled=null (未評価) はそのまま、true/falseで確定させる。
function recordLPPromiseOutcome(fund,lpTypeID,fulfilled){
  if(!fund)return null;
  const commitment=arr(fund.lps).find(c=>c.lpTypeID===lpTypeID&&c.promiseAccepted);
  if(!commitment)return null;
  commitment.promiseFulfilled=Boolean(fulfilled);
  return commitment;
}
// 次号の調達額への反映（完了条件）。承諾した約束のうち何割を守れたかで1.0(全履行)〜
// PROMISE_BROKEN_FLOOR(全不履行)を線形補間する。約束が無い/未評価ならニュートラル(1)。
function promiseComplianceMultiplier(fund){
  const accepted=arr(fund?.lps).filter(c=>c.promiseAccepted&&c.promiseFulfilled!==null);
  if(!accepted.length)return 1;
  const rate=accepted.filter(c=>c.promiseFulfilled).length/accepted.length;
  return PROMISE_BROKEN_FLOOR+clamp(rate,0,1)*(1-PROMISE_BROKEN_FLOOR);
}
// 既存LPは自動継続（設計書）。前号のLP構成をそのまま次号の出発点として返す。実際に次号へ
//引き継ぐかどうかは呼び出し側（将来のUI）が決める。
function continuingLPCommitments(state){
  ensure(state);
  const funds=state.peFirm.funds;
  if(!funds.length)return [];
  return arr(funds[funds.length-1].lps).map(c=>({...c}));
}

// PE mode T5: exit proceeds are distributed immediately and never reinvested (design doc §9
// failure 3) -- so weekly processing here only ever moves cash OUT of a fund (to distributed)
// or advances its lifecycle status, it never adds cash back into fund.cash from a return.
// T26-2（設計書§4）: 管理報酬を現金として動かす。
//   1. ファンドの現金から引かれる（＝LPとGPが拠出済みの資金が負担する費用）
//   2. GP（＝プレイヤーの会社。DD費用・アドバイザリー費用が既に会社負担なのでそこに揃える）の
//      収益として companyCash に入り、法人税の対象にもなる
//   3. そこからチームの人件費（1人あたり年 MANAGEMENT_FEE_PER_HEAD＝2,000万円）を払う
//   4. チーム上限（TEAM_CAP=60人）を超えた分の報酬は素直に会社の利益になる（設計書§4）
// 課金は年1回、ファンドの周年ごと。周年の番号（lastManagementFeePeriod）を永続化するので、
// セーブ／ロードや同一週の再処理でも二重払いにならない。週次で課金すると finance の取引が
// 1ファンドあたり年104件積み上がり、100年でセーブサイズの上限(5MB)を超える（実測5.42MB）。
// ファンドの現金が足りなければ払える分だけ払い、未払金は発明せず shortfall として記録する。
function processManagementFeePeriods(state,fund,week){
  const finance=modules.finance;
  const duePeriod=Math.min(Math.floor(FUND_TERM_WEEKS/52),Math.max(0,Math.floor((finite(week)-fund.y0)/52)));
  let fee=0,payroll=0;
  while(fund.lastManagementFeePeriod<duePeriod){
    fund.lastManagementFeePeriod++;
    const period=fund.lastManagementFeePeriod;
    const due=Math.max(0,annualManagementFee(fund));
    const paidFee=Math.min(Math.max(0,finite(fund.cash)),due);
    fund.cash=Math.max(0,finite(fund.cash)-paidFee);
    fund.managementFeesPaid=Math.max(0,finite(fund.managementFeesPaid))+paidFee;
    fund.managementFeeShortfall=Math.max(0,finite(fund.managementFeeShortfall))+(due-paidFee);
    if(paidFee>0){
      state.companyCash=finite(state.companyCash)+paidFee;
      state.quarterlyPretaxProfit=finite(state.quarterlyPretaxProfit)+paidFee;
      const op=`pe-management-fee-${fund.id}-p${period}`;
      finance?.event?.(state,'revenue',paidFee,{week,cashEffect:paidFee,profitEffect:paidFee,sourceType:'peManagementFee',sourceID:`${fund.id}-p${period}`,operationID:op,idempotencyKey:op,description:`${fund.id} 管理報酬`});
    }
    fee+=paidFee;
    // チームは管理報酬で養われるので、報酬を取れなかった分だけ人件費も払えない（比例）。
    // ファンドの現金が尽きた後（投資期間終了で未投資分を返した後）は自然にゼロになる。
    const target=Math.max(0,teamCapacity(fund)*MANAGEMENT_FEE_PER_HEAD)*(due>0?paidFee/due:0);
    const paidPayroll=Math.min(target,Math.max(0,finite(state.companyCash)));
    if(paidPayroll>0){
      state.companyCash=finite(state.companyCash)-paidPayroll;
      state.quarterlyPretaxProfit=finite(state.quarterlyPretaxProfit)-paidPayroll;
      fund.teamPayrollPaid=Math.max(0,finite(fund.teamPayrollPaid))+paidPayroll;
      const op=`pe-team-payroll-${fund.id}-p${period}`;
      finance?.event?.(state,'payroll',paidPayroll,{week,cashEffect:-paidPayroll,profitEffect:-paidPayroll,sourceType:'peTeamPayroll',sourceID:`${fund.id}-p${period}`,operationID:op,idempotencyKey:op,description:`${fund.id} 投資チーム人件費`});
    }
    payroll+=paidPayroll;
  }
  return {fee,payroll};
}

function processFundsWeek(state,week){
  ensure(state);
  for(const fund of state.peFirm.funds){
    if(fund.status==='closed'){fund.lastProcessedWeek=Math.max(fund.lastProcessedWeek,week);continue;}
    if(fund.lastProcessedWeek>=week){continue;}
    processManagementFeePeriods(state,fund,week);
    if(fund.status==='investing'&&week>=fund.investmentDeadlineWeek){
      // 投資期間終了。使い切れなかった資金は額面(1.0x)でLP・GPへ返す。
      if(fund.cash>0){const returned=fund.cash;fund.cash=0;fund.undeployedReturned+=returned;distributeToInvestors(state,fund,returned);}
      fund.status='harvesting';
    }
    if(week>=fund.deadlineWeek&&fund.status!=='closed'){
      if(fund.cash>0){const returned=fund.cash;fund.cash=0;fund.undeployedReturned+=returned;distributeToInvestors(state,fund,returned);}
      fund.status='closed';
      fund.closedWeek=week;
    }
    // T17: evaluateFund を週次処理から自動的に呼ぶ。通常週は DPI・資金消化率のリフレッシュ
    // だけを行い（次号組成の関門とLP信頼度がこれを見る）、トラックレコードへの加算は
    // ファンドが実際に終了した週だけ・1回だけ行う（evaluateFund側の once ガード）。
    evaluateFund(state,fund.id,week,{recordTrackRecord:fund.status==='closed'});
    fund.lastProcessedWeek=week;
  }
  return state;
}

// PE mode T9 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §4, §9 失敗6): team headcount and
// deal-slot capacity. Both are pure functions of a single fund (its locked-in size/terms.fee),
// not of live global state, so they stay valid for a past/closed fund too.
//
// チーム上限は管理報酬から自動的に決まる（1人あたり年2000万円）。§9 失敗6の教訓により、
// 機械的な計算をそのまま使わず60人で頭打ちにする（超過分の管理報酬は素直に利益になる —
// この配分自体は既存のfinance.eventで会社/個人キャッシュに乗る一般の管理報酬計算の話であり、
// ここでは「雇える人数」の算出のみを扱う）。
const MANAGEMENT_FEE_PER_HEAD=20_000_000;
const TEAM_CAP=60;
// スロット数の上限を決める2要素（設計書§4）。下限投下額は「小型承継」帯の下限(§15)に合わせる。
const MIN_TICKET_PER_DEAL=300_000_000;
const MAX_DEAL_SHARE_OF_FUND=.25;
const SLOT_CAP_ABSOLUTE=8;
// 保有期間の最適解（設計書§2/§4）: 1号は再投資できず機会費用がゼロなので4年、2号以降は3年。
const FIRST_FUND_HOLD_WEEKS=208; // 4年
const LATER_FUND_HOLD_WEEKS=156; // 3年

function teamCapacity(fund){
  if(!fund)return 0;
  const annualFee=Math.max(0,finite(fund.size)*finite(fund.terms?.fee));
  return Math.max(0,Math.min(TEAM_CAP,Math.floor(annualFee/MANAGEMENT_FEE_PER_HEAD)));
}
// チーム人数から「同時に手が回る案件数」を導く（設計書§9 解決: 制約を資金からチームへ）。
// 6人ごとに2枠ずつ増える段階制で、2→4→6→8で頭打ちにする（設計書§4の記述通り）。下限投下額
// （MIN_TICKET_PER_DEAL）を満たせないほど小さいファンドでは、そちらが先に効く。
function slotCapacity(fund){
  if(!fund||finite(fund.size)<=0)return 0;
  const team=teamCapacity(fund);
  const teamDriven=team>0?2*Math.ceil(team/6):1;
  const ticketDriven=Math.max(1,Math.floor(finite(fund.size)/MIN_TICKET_PER_DEAL));
  return Math.max(1,Math.min(SLOT_CAP_ABSOLUTE,teamDriven,ticketDriven));
}
// LPの分散義務（設計書§4）: 1件あたりの投下額はファンド規模の25%まで。
function maxSingleDealSize(fund){return Math.max(0,finite(fund?.size))*MAX_DEAL_SHARE_OF_FUND;}
function activeDealCount(fund){return arr(fund?.deals).filter(d=>d&&d.status!=='exited').length;}
// attention = チーム人数 ÷ 案件数（設計書§4）。1件に1人を割れないと改善が鈍る、という
// 方向性のみが両文書で明記されている（正確な係数の指定はない）ため、ratio>=1で頭打ち・
// ratio=0で半減という単調な較正をこのファイル独自に採用する。
function attentionRatio(fund){return teamCapacity(fund)/Math.max(1,activeDealCount(fund));}
function attentionMultiplier(fund){return fund?(.5+.5*clamp(attentionRatio(fund),0,1)):1;}
// 保有期間の最適解（週）。fundIndexはstate.peFirm.funds内での0始まりの通し番号。
function optimalHoldWeeks(fundIndex){return fundIndex<=0?FIRST_FUND_HOLD_WEEKS:LATER_FUND_HOLD_WEEKS;}

// PE mode T10 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §4): DD枠の有限化。
// `ddSlotsPerYear = 3 + パートナー数/4`。パートナー数は現在アクティブ（未クローズ）な
// ファンドのうち最大のチーム人数（T9のteamCapacity）を採用する -- ファンドを複数同時運用
// しても、実際にDDを回せる頭数は最大のチームに律速される、という単純化。
// 既存の DILIGENCE_SCOPES（confidence .40/.72/.94）はそのまま使う（設計書: 再調整不要）。
const DD_SLOTS_BASE=3;
const DD_SLOTS_PER_PARTNER_DIVISOR=4;
const DD_YEAR_WEEKS=52;

function partnerCount(state){
  const funds=arr(state?.peFirm?.funds).filter(f=>f&&f.status!=='closed');
  if(!funds.length)return 0;
  return Math.max(...funds.map(teamCapacity));
}
function computeDDSlotsPerYear(state){return DD_SLOTS_BASE+Math.floor(partnerCount(state)/DD_SLOTS_PER_PARTNER_DIVISOR);}
function ddSlotsPerYear(state){ensure(state);return state.peFirm.ddSlotsPerYear;}
function ddPeriodIndex(week){return Math.floor(Math.max(0,finite(week,0))/DD_YEAR_WEEKS);}
// 年次リセット（52週ごと）。同じ期に達した使用量はそのまま、期が変わればゼロに戻す。
function currentDDUsage(state,week){
  ensure(state);
  const usage=state.peFirm.ddUsage;
  const period=ddPeriodIndex(week);
  if(usage.period!==period){usage.period=period;usage.used=0;}
  return usage;
}
// 表示用（消費しない）: 現在の期であと何件精査に回せるか。
function ddSlotsRemaining(state,week){const usage=currentDDUsage(state,week);return Math.max(0,ddSlotsPerYear(state)-usage.used);}
// DD開始時に1枠消費する。枠が無ければ何も変えずfalseを返す（呼び出し側がDD開始を拒否する
// 判断材料になる）。deal.dueDiligenceScope等の実際の精査フローとの結線は、精査対象の案件が
// どのファンドに紐づくか（fundID）を決める仕組みがまだ無い（T11以降）ため、T7のDPI計算群と
// 同様に、この段階では呼び出し可能な純粋な状態機械として提供する。
function consumeDDSlot(state,week){
  const usage=currentDDUsage(state,week);
  if(usage.used>=ddSlotsPerYear(state))return false;
  usage.used+=1;
  return true;
}

// PE mode T12 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §14): 共同投資（コインベスト）。
// LPが案件ごとに追加出資し、分散義務（25%上限）を超える大型案件を打てるようにする。枠は
// ファンド規模の1倍まで（累計）。共同投資分のキャリーはフルの半分（設計書: ゼロにすると
// 機能が死ぬ）。管理報酬は共同投資分にかからない（fund.sizeだけを基準にする既存の
// annualManagementFee はそのままで成立する -- 明示的な純関数として切り出す）。
const COINVEST_CAP_MULTIPLE=1;
const COINVEST_CARRY_FACTOR=.5;

function coinvestCapacity(fund){return Math.max(0,finite(fund?.size))*COINVEST_CAP_MULTIPLE;}
function coinvestCommitted(fund){return Math.max(0,finite(fund?.coinvestCommitted));}
function coinvestRemaining(fund){return Math.max(0,coinvestCapacity(fund)-coinvestCommitted(fund));}
function annualManagementFee(fund){return Math.max(0,finite(fund?.size)*finite(fund?.terms?.fee));}
// 案件ごとの選択（設計書§14「規模を取るか報酬率を取るかの交換」）:
//   useCoinvest=false: 全額ファンドで打つ。25%上限までしか投下できず、超過分は打てない
//     (rejectedAmount)。キャリーはフル。
//   useCoinvest=true: 25%上限を超える分を共同投資で埋める（枠が尽きればそこで頭打ち）。
//     共同投資分にはフルの半分のキャリーしか付かないため、案件全体のキャリーは
//     ファンド持分とのブレンドになる。
function planDealFinancing(fund,dealSize,useCoinvest){
  const size=Math.max(0,finite(dealSize));
  const cap=maxSingleDealSize(fund);
  const fullCarry=finite(fund?.terms?.carry);
  if(!useCoinvest||size<=cap){
    const fundPortion=Math.min(size,cap);
    return {fundPortion,coinvestPortion:0,rejectedAmount:Math.max(0,size-cap),blendedCarryRate:fullCarry};
  }
  const excess=size-cap;
  const coinvestPortion=Math.min(excess,coinvestRemaining(fund));
  const fundPortion=Math.min(size-coinvestPortion,cap);
  const rejectedAmount=Math.max(0,size-fundPortion-coinvestPortion);
  const halfCarry=fullCarry*COINVEST_CARRY_FACTOR;
  const financed=fundPortion+coinvestPortion;
  const blendedCarryRate=financed>0?(fundPortion*fullCarry+coinvestPortion*halfCarry)/financed:fullCarry;
  return {fundPortion,coinvestPortion,rejectedAmount,blendedCarryRate};
}
// 実際に共同投資額を確定させる（枠を消費する）。枠を超える要求は自動的に切り詰める。
// T26-1: 共同投資家の資本を呼び込む唯一の経路。ファンド側の pool（coinvestCash）と、
// ファーム全体の勘定（peFirm.coinvestContributed = 外から入った累計）の両方に記録する。
// state は省略できる（枠の計算だけを試すテスト用）。その場合ファーム側の勘定は動かない。
function recordCoinvestment(state,fund,amount){
  if(!fund)return 0;
  const used=Math.max(0,Math.min(finite(amount),coinvestRemaining(fund)));
  fund.coinvestCommitted=coinvestCommitted(fund)+used;
  fund.coinvestContributed=Math.max(0,finite(fund.coinvestContributed))+used;
  fund.coinvestCash=Math.max(0,finite(fund.coinvestCash))+used;
  if(state&&used>0){ensure(state);state.peFirm.coinvestContributed=Math.max(0,finite(state.peFirm.coinvestContributed))+used;}
  return used;
}
// 共同投資poolから売り手へ支払う唯一の経路。拠出記録だけを増やして取得することを防ぐ。
function spendCoinvestment(fund,amount){
  if(!fund)return 0;
  const spent=Math.max(0,Math.min(finite(amount),Math.max(0,finite(fund.coinvestCash))));
  fund.coinvestCash=Math.max(0,finite(fund.coinvestCash)-spent);
  return spent;
}

// PE mode T17 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §2・§14): Exit代金の分配。
// これ以前は Exit の回収額をまるごと fund.distributed に足していただけで、元本返済・ハードル・
// キャリーのどれも存在しなかった（Codex監査 PE-AUDIT-006）。ここが唯一の分配経路になる。
//
// お金の出どころと戻り先を明示する（T17の完了条件）:
//   - deal.fundPortion    … ファンドの現金から出た分。回収額のうちこの持分に対応する部分は
//                            キャリー控除後に fund.distributed（＝LP+GPへの分配）へ入る。
//   - deal.coinvestPortion… 共同投資家（LP）が案件ごとに直接出した分。ファンドの現金は一切
//                            通らない。回収額の対応部分はキャリー控除後に共同投資家へ戻り、
//                            fund.coinvestReturned に累計だけを記録する。fund.cash にも
//                            fund.distributed にも入らない（＝DPIを水増ししない）。
//   - キャリー            … GP（プレイヤー個人）の報酬。state.personalCash に入る。会社の
//                            現金（companyCash）にも会社の会計にも一切触れない。
//
// ウォーターフォール（1案件ぶん）:
//   1. 回収額を投下額の比でファンド分／共同投資分に按分する
//   2. それぞれ元本を返す
//   3. 元本超過分のうちハードル（保有年数で複利）を超えた部分だけがキャリーの対象
//   4. ファンド分はフルのキャリー率、共同投資分はその半分（COINVEST_CARRY_FACTOR）
//   5. 残りをそれぞれの出し手へ返す
// 二重徴収防止: 決済済みの案件（deal.settlement あり）は再決済しない。
function settleExitProceeds(state,fund,deal,proceeds,week){
  if(!state||!fund||!deal)return null;
  ensure(state);
  if(deal.settlement)return deal.settlement;
  const gross=Math.max(0,finite(proceeds));
  const fundPortion=Math.max(0,finite(deal.fundPortion));
  const coinvestPortion=Math.max(0,finite(deal.coinvestPortion));
  const invested=fundPortion+coinvestPortion;
  const fundShare=invested>0?gross*fundPortion/invested:gross;
  const coinvestShare=invested>0?gross*coinvestPortion/invested:0;
  const w=Math.max(0,Math.floor(finite(week,finite(state.week,0))));
  const years=Math.max(0,(w-finite(deal.acquiredWeek,w))/52);
  const hurdle=Math.max(0,finite(fund.terms?.hurdle));
  const hurdleFactor=Math.pow(1+hurdle,years)-1;
  const fullCarry=Math.max(0,finite(fund.terms?.carry));

  const fundProfit=Math.max(0,fundShare-fundPortion);
  const fundHurdleAmount=fundPortion*hurdleFactor;
  const fundCarry=Math.max(0,fundProfit-fundHurdleAmount)*fullCarry;
  const coinvestProfit=Math.max(0,coinvestShare-coinvestPortion);
  const coinvestHurdleAmount=coinvestPortion*hurdleFactor;
  const coinvestCarry=Math.max(0,coinvestProfit-coinvestHurdleAmount)*fullCarry*COINVEST_CARRY_FACTOR;

  const distributedToFund=Math.max(0,fundShare-fundCarry);
  const returnedToCoinvestors=Math.max(0,coinvestShare-coinvestCarry);
  const gpCarry=fundCarry+coinvestCarry;
  // 分配（元本＋利益、キャリー控除後）。GPの出資持分ぶんは個人資産へ戻る（T21）。
  const gpPrincipalAndGain=distributeToInvestors(state,fund,distributedToFund);
  // 共同投資家への返却は、ファンドの累計と共同投資家の勘定（残高）の両方に記録する（T26-1）。
  fund.coinvestReturned=Math.max(0,finite(fund.coinvestReturned))+returnedToCoinvestors;
  if(returnedToCoinvestors>0)state.peFirm.coinvestCapital=Math.max(0,finite(state.peFirm.coinvestCapital))+returnedToCoinvestors;
  if(gpCarry>0){state.personalCash=finite(state.personalCash)+gpCarry;fund.gpCarryPaid=Math.max(0,finite(fund.gpCarryPaid))+gpCarry;}
  const settlement={
    grossProceeds:gross,
    fundShare,coinvestShare,
    fundPrincipalReturned:Math.min(fundShare,fundPortion),
    coinvestPrincipalReturned:Math.min(coinvestShare,coinvestPortion),
    hurdleFactor,fundHurdleAmount,coinvestHurdleAmount,
    fundCarry,coinvestCarry,gpCarry,
    gpPrincipalAndGain,
    distributedToFund,returnedToCoinvestors,
    settledWeek:w
  };
  deal.settlement=settlement;
  return settlement;
}

// T21-2（GAME-AUDIT-001）: プレイヤーがファンドを組成する production アクション。
// これ以前は createFund が test/internal 専用で、Fund I を作る経路がゲーム内に存在せず、
// PE案件も供給されないためPEモード全体に入れなかった。
//
// 1つのトランザクションで、解禁判定 → 組成可能額 → GP出資額 → 報酬条件 → LP構成 → 資金移動
// までを行う。Fund II 以降もこの同じ関数を通り、次号ゲート（canFormNextFund: DPI 1.2以上かつ
// 資金消化80%以上）を満たす場合だけ実行できる。
// 失敗時は state を一切変更せず、理由つきの結果を返す（呼び出し側がメッセージに使う）。
function planFundFormation(state){
  ensure(state);
  const firm=state.peFirm;
  if(!firm.unlocked)return {ok:false,reason:'locked',message:'PEファンドの組成にはExit経験が必要です。'};
  if(firm.funds.length&&!canFormNextFund(state))return {ok:false,reason:'gate',message:'次号ファンドの組成条件（DPI 1.2倍以上・資金消化80%以上）を満たしていません。'};
  const score=firm.trackRecord.score;
  const size=formableFundSize(state);
  const ratio=requiredGPRatio(score);
  const gpCommit=size*ratio;
  if(size<=0||gpCommit<=0)return {ok:false,reason:'size',message:'組成できる規模がありません。'};
  if(finite(state.personalCash)<gpCommit)return {ok:false,reason:'gpCash',message:`GP出資${Math.round(gpCommit).toLocaleString('ja-JP')}円に対して個人資産が不足しています。`};
  return {ok:true,size,gpCommit,ratio,score,terms:fundTermsForScore(score)};
}
// LP構成: 会える相手（前号からの継続を優先）にLP拠出分を均等に割り付ける。金額の交渉自体は
// 設計書§9 失敗7の通り「最大額を取るだけの最適化」に落ちるため作らない。
function buildLPCommitments(state,fund,{acceptPromises=false}={}){
  const continuing=continuingLPCommitments(state).map(c=>c.lpTypeID);
  const meetable=LP_TYPE_IDS.filter(id=>meetsLPCondition(state,id));
  const ordered=[...continuing.filter(id=>meetable.includes(id)),...meetable.filter(id=>!continuing.includes(id))].slice(0,MAX_LPS_PER_FUND);
  if(!ordered.length)return [];
  const each=Math.max(0,finite(fund.lpContributed))/ordered.length;
  return ordered.map(id=>addLPCommitment(fund,{lpTypeID:id,committedAmount:each,promiseAccepted:acceptPromises})).filter(Boolean);
}
function formFund(state,{acceptPromises=false}={}){
  const plan=planFundFormation(state);
  if(!plan.ok)return plan;
  const fund=createFund(state,{size:plan.size,gpCommit:plan.gpCommit,terms:plan.terms,y0:finite(state.week,1)});
  if(!fund)return {ok:false,reason:'gpCash',message:'GP出資に対して個人資産が不足しています。'};
  buildLPCommitments(state,fund,{acceptPromises});
  return {ok:true,fund,size:plan.size,gpCommit:plan.gpCommit};
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peFundInstalled)return true;
  const baseNormalize=proto.normalize;
  proto.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
  // executeIPO is a plain class method on TycoonEngine (js/engine.js), available immediately
  // -- unlike recordCurrentCompany/configure/foundNewCompanyAfterBuyout below, which only
  // exist once js/completion.js's exported installCompletion(TycoonEngine) actually runs (see
  // installCompletionDependentHooks).
  const baseExecuteIPO=proto.executeIPO;
  proto.executeIPO=function(market,sellShares){
    const before=finite(this.g.personalCash);
    const r=baseExecuteIPO.call(this,market,sellShares);
    if(r===true){
      const founderSale=finite(this.g.personalCash)-before;
      if(founderSale>0)recordExitForCurrentCompany(this.g,'ipo',founderSale);
    }
    return r;
  };
  const baseAdvanceWeek=proto.advanceWeek;
  proto.advanceWeek=function(showSummary=true){
    return this.runTransaction(()=>{
      const before=finite(this.g.week);
      const r=baseAdvanceWeek.call(this,false);
      if(r!==false){
        ensure(this.g);
        if(this.g.peFirm.funds.length)for(let w=before+1;w<=finite(this.g.week);w++)processFundsWeek(this.g,w);
      }
      return r;
    },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));
  };
  // T21-2: プレイヤー操作としてのファンド組成。表示用の見積り（formablePEFund）と、
  // 実行（formPEFund）を分ける。
  proto.formablePEFund=function(){return planFundFormation(this.g);};
  proto.formPEFund=function(options={}){
    const result=formFund(this.g,options);
    if(!result.ok)return this.fail(result.message);
    this.notify?.(`${Math.round(result.size/100_000_000).toLocaleString('ja-JP')}億円のPEファンドを組成しました。`,'success');
    this.save();
    this.emit();
    return true;
  };
  Object.defineProperty(proto,'__peFundInstalled',{value:true});
  return true;
}
install();

// PE mode T6: js/completion.js only *defines* installCompletion(TycoonEngine) -- app.js is
// what actually calls it (alongside installMADealRoom etc.), late in the canonical script
// order. recordCurrentCompany/configure/foundNewCompanyAfterBuyout do not exist on the
// prototype until that call happens, so wrapping them here at pe-fund.js's own load time
// would silently wrap `undefined` and then be clobbered when installCompletion runs afterward
// and (re)defines them from scratch. js/pe-value-creation.js solves the identical problem
// (there, waiting on installExpansion) the same way: defer to DOMContentLoaded, which in both
// the real page and tests/harness.js's simulated one fires only after every synchronous
// script -- app.js included -- has already run.
function installCompletionDependentHooks(){
  const proto=EngineClass.prototype;
  if(proto.__peFundCompletionHooksInstalled)return true;
  if(typeof proto.recordCurrentCompany!=='function'||typeof proto.foundNewCompanyAfterBuyout!=='function'||typeof proto.configure!=='function')return false;
  // recordCurrentCompany is the one call site behind selling the whole company (会社売却).
  // No existing action pays the founder personally for a *subsidiary* sale
  // (sellMASubsidiary/ipoSubsidiary credit companyCash, not personalCash), so "子会社売却"
  // has nothing to hook yet -- recordExit stays generic enough for a later task to call
  // directly once/if such a flow is added.
  const baseRecordCurrentCompany=proto.recordCurrentCompany;
  proto.recordCurrentCompany=function(exitType,exitPrice=0,founderProceeds=0,note=''){
    const r=baseRecordCurrentCompany.call(this,exitType,exitPrice,founderProceeds,note);
    recordExitForCurrentCompany(this.g,exitType,founderProceeds);
    return r;
  };
  const baseFoundNewCompanyAfterBuyout=proto.foundNewCompanyAfterBuyout;
  proto.foundNewCompanyAfterBuyout=function(companyName,investment,mode){
    const r=baseFoundNewCompanyAfterBuyout.call(this,companyName,investment,mode);
    ensure(this.g);
    this.g.currentCompanyFoundedInvestment=Math.max(1,finite(investment,this.g.companyCash));
    return r;
  };
  const baseConfigure=proto.configure;
  proto.configure=function(options){
    const r=baseConfigure.call(this,options);
    ensure(this.g);
    this.g.currentCompanyFoundedInvestment=Math.max(1,finite(this.g.companyCash,8_000_000));
    return r;
  };
  Object.defineProperty(proto,'__peFundCompletionHooksInstalled',{value:true});
  return true;
}
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  if(!EngineClass.prototype.__peFundCompletionHooksInstalled)document.addEventListener('DOMContentLoaded',installCompletionDependentHooks,{once:true});
}

modules.peFund=Object.freeze({
  FUND_TERM_WEEKS,INVESTMENT_PERIOD_WEEKS,GP_COMMIT_FRACTION_OF_PERSONAL_CASH,MAX_FUND_SIZE,NEXT_FUND_MIN_DPI,NEXT_FUND_MIN_DEPLOYMENT,
  DEPLOYMENT_RELAXATION_START,MIN_DEPLOYMENT_FLOOR,CLOSED_PERIOD_DEPLOYMENT_FACTOR,requiredDeploymentRate,ACQUISITION_PREMIUM_ESTIMATE,marketAbsorbableFundSize,
  ensure,ensureFund,createFund,processFundsWeek,install,installCompletionDependentHooks,
  requiredGPRatio,managementFeeRate,carryRate,hurdleRate,fundTermsForScore,formableFundSize,lpTrustMultiplier,
  exitQuality,computeTrackScore,recordExit,recordExitForCurrentCompany,
  fundContributed,fundDeployed,fundDeploymentRate,fundDPI,fundIRR,evaluateFund,canFormNextFund,
  RESCUE_MIN_NEW_EXITS,RESCUE_MIN_SCORE_GAIN,newExitsSinceFund,gateRescueAvailable,
  gpShareOfFund,distributeToInvestors,planFundFormation,buildLPCommitments,formFund,
  LP_TYPES,LP_TYPE_IDS,PROMISE_BROKEN_FLOOR,MAX_LPS_PER_FUND,normalizeLPs,meetsLPCondition,visibleLPTypes,addLPCommitment,recordLPPromiseOutcome,promiseComplianceMultiplier,continuingLPCommitments,
  MANAGEMENT_FEE_PER_HEAD,TEAM_CAP,MIN_TICKET_PER_DEAL,MAX_DEAL_SHARE_OF_FUND,SLOT_CAP_ABSOLUTE,FIRST_FUND_HOLD_WEEKS,LATER_FUND_HOLD_WEEKS,
  teamCapacity,slotCapacity,maxSingleDealSize,activeDealCount,attentionRatio,attentionMultiplier,optimalHoldWeeks,
  DD_SLOTS_BASE,DD_SLOTS_PER_PARTNER_DIVISOR,DD_YEAR_WEEKS,partnerCount,computeDDSlotsPerYear,ddSlotsPerYear,ddPeriodIndex,currentDDUsage,ddSlotsRemaining,consumeDDSlot,
  COINVEST_CAP_MULTIPLE,COINVEST_CARRY_FACTOR,coinvestCapacity,coinvestCommitted,coinvestRemaining,annualManagementFee,processManagementFeePeriods,planDealFinancing,recordCoinvestment,spendCoinvestment,settleExitProceeds,
  __installed:true
});
})();
