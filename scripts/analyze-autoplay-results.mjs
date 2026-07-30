import fs from 'node:fs/promises';
import path from 'node:path';

const input=process.env.AUTOPLAY_RESULTS||'artifacts/autoplay/runs.json';
const output=process.env.AUTOPLAY_REPORT||'artifacts/autoplay/report.md';
const runs=JSON.parse(await fs.readFile(input,'utf8'));

function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function pct(value){return `${(value*100).toFixed(1)}%`;}
function yen(value){return Number.isFinite(value)?new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(value):'—';}
function groupKey(r){return `${r.browser} / ${r.difficulty} / ${r.strategy}`;}
function isInfrastructureFailure(run){return run.failureReason==='runner-error'||run.failureReason==='unreadable-save';}

const validRuns=runs.filter(run=>!isInfrastructureFailure(run)&&Number(run.weeksCompleted)>0);
const invalidRuns=runs.filter(run=>!validRuns.includes(run));
const groups=new Map();
for(const run of validRuns){const key=groupKey(run);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(run);}
const reasons=new Map();
for(const run of validRuns){const reason=run.failureReason||'survived';reasons.set(reason,(reasons.get(reason)||0)+1);}
for(const run of invalidRuns){const reason=run.failureReason||'invalid-run';reasons.set(reason,(reasons.get(reason)||0)+1);}

const lines=['# Playwright大量自動プレイ分析','',`- 総実行数: ${runs.length}`,`- 有効プレイ数: ${validRuns.length}`,`- 無効プレイ数: ${invalidRuns.length}`,'- ビューポート: 390×844（iPhone相当）','- 判定: 実ゲーム画面を操作し、localStorageセーブを集計','', '## 戦略・難易度別サマリー','', '| ブラウザ / 難易度 / 戦略 | 有効実行 | 生存率 | 到達週中央値 | 最低現金中央値 | 累計利益中央値 | JSエラー実行 |','|---|---:|---:|---:|---:|---:|---:|'];
for(const [key,items] of [...groups.entries()].sort()){
  const survived=items.filter(r=>!r.gameOver&&!r.failureReason).length;
  const errorRuns=items.filter(r=>(r.consoleErrors?.length||0)+(r.pageErrors?.length||0)>0).length;
  lines.push(`| ${key} | ${items.length} | ${pct(survived/items.length)} | ${median(items.map(r=>r.weeksCompleted))??'—'} | ${yen(median(items.map(r=>r.minCompanyCash)))} | ${yen(median(items.map(r=>r.cumulativeProfit)))} | ${errorRuns} |`);
}
if(!groups.size)lines.push('| — | 0 | — | — | — | — | — |');
lines.push('','## 終了・倒産・無効理由','', '| 理由 | 件数 | 比率 |','|---|---:|---:|');
for(const [reason,count] of [...reasons.entries()].sort((a,b)=>b[1]-a[1]))lines.push(`| ${reason} | ${count} | ${pct(count/runs.length)} |`);

const strategyGroups=new Map();
for(const run of validRuns){if(!strategyGroups.has(run.strategy))strategyGroups.set(run.strategy,[]);strategyGroups.get(run.strategy).push(run);}
const ranked=[...strategyGroups.entries()].map(([strategy,items])=>({strategy,survival:items.filter(r=>!r.gameOver&&!r.failureReason).length/items.length,profit:median(items.map(r=>r.cumulativeProfit)),cash:median(items.map(r=>r.minCompanyCash))})).sort((a,b)=>(b.survival-a.survival)||((b.profit??-Infinity)-(a.profit??-Infinity)));
lines.push('','## 攻略傾向（有効プレイのみ）','');
if(ranked.length){
  const best=ranked[0],worst=ranked.at(-1);
  lines.push(`- 最も安定した戦略: **${best.strategy}**（生存率 ${pct(best.survival)}、累計利益中央値 ${yen(best.profit)}）`);
  lines.push(`- 最も不安定な戦略: **${worst.strategy}**（生存率 ${pct(worst.survival)}、最低現金中央値 ${yen(worst.cash)}）`);
}else lines.push('- 有効プレイがないため攻略傾向を判定できない。');
const errorRuns=runs.filter(r=>r.runnerError||(r.consoleErrors?.length||0)||(r.pageErrors?.length||0));
lines.push(`- JavaScriptまたはランナーエラーを含む実行: **${errorRuns.length}件**`);

lines.push('','## バランス警告','');
const warnings=[];
for(const item of ranked){if(item.survival>=0.95)warnings.push(`${item.strategy}: 生存率が95%以上で、難易度または戦略が強すぎる可能性`);if(item.survival<=0.2)warnings.push(`${item.strategy}: 生存率が20%以下で、初心者に厳しすぎる可能性`);}
const earlyFailures=validRuns.filter(r=>r.gameOver&&Number(r.weeksCompleted)<=26).length;
if(validRuns.length&&earlyFailures/validRuns.length>=0.2)warnings.push(`26週以内の早期終了が${pct(earlyFailures/validRuns.length)}あり、初期導線・初期固定費・資金警告の改善が必要`);
if(invalidRuns.length)warnings.push(`無効プレイが${invalidRuns.length}件あり、ゲームバランス判定から除外した`);
if(!warnings.length)warnings.push('設定した閾値を超える極端な偏りは未検出。実行数を増やして継続確認する。');
for(const warning of warnings)lines.push(`- ${warning}`);

lines.push('','## iPhone UI改善へ渡す観測項目','', '- 26週以内の現金枯渇が多い場合: ホームに資金ランウェイ、次週支払額、危険行動警告を表示', '- 操作不能がある場合: 画面外・無効ボタン・モーダル残留・横スクロールを個別記録', '- leveragedの破綻率が高い場合: 借入前に返済総額と危険度を表示', '- growthの破綻率が高い場合: 出店前に固定費増加と損益分岐点を表示', '- passiveでも早期破綻する場合: 初期設定または自動支出バランスを再調整','');

await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,lines.join('\n'));
console.log(`Wrote autoplay analysis to ${output}`);

const minimumValidRate=Number(process.env.AUTOPLAY_MIN_VALID_RATE||0.8);
const validRate=runs.length?validRuns.length/runs.length:0;
if(validRuns.length===0)throw new Error('Autoplay produced no valid completed runs');
if(validRate<minimumValidRate)throw new Error(`Autoplay valid run rate ${pct(validRate)} is below required ${pct(minimumValidRate)}`);
