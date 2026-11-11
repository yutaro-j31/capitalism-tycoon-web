// UI v3 missions screen — docs/ui-v3/README.md 5 (UI3-9), list type, read-only: missions, achievements and the long-term goals.
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-missions.js.');
const esc=modules.ui3.esc;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(title,note,end)=>`<div class="u-row" role="listitem"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></div>`;
const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
function render(ctx){
  const {g,money,engine}=ctx;
  const defs=modules.data?.MISSION_DEFS||[];
  const missions=defs.map(m=>{const done=(g.completedMissionIDs||[]).includes(m.id),active=(g.activeMissionIDs||[]).includes(m.id);return row(`${done?'✓ ':active?'● ':'○ '}${m.title}`,`報酬 ${money(finite(m.reward))}`,done?'達成済み':active?'進行中':'未解放');}).join('');
  const goals=[['10店舗',`${Math.min((g.stores||[]).length,10)}/10`],['企業価値10億',`${Math.min(finite(engine.companyValue())/1e9*100,100).toFixed(1)}%`],['個人資産10億',`${Math.min(finite(engine.personalNetWorth())/1e9*100,100).toFixed(1)}%`],
    ['M&A 5件',`${Math.min(finite(g.totalAcquisitions),5)}/5`],['公開プロダクト3件',`${Math.min((g.productVentures||[]).filter(p=>p.status==='released').length,3)}/3`],['IPO',g.publicCompany?'達成':'未達成']];
  const ranks=engine.computeIndustryRanking?.()||{};
  const ranking=[['ラーメン','ramen'],['カフェ','cafe'],['コンビニ','conveni']].map(([label,key])=>stat(label,`${ranks[key]||1}位`)).join('');
  const awards=(g.industryAwards||[]).map(x=>row(`🏆 ${x.title}`,`第${x.week}週`,'')).join('');
  const achievements=(g.achievements||[]).map(a=>row(`🏆 ${a}`,'','')).join('');
  const list=(rows,key,none)=>rows?`<div class="u-list" role="list" data-ui3-missions="${key}">${rows}</div>`:`<div class="u-h2" data-ui3-missions="none-${key}">${none}</div>`;
  return `<h2 class="u-h2">ミッション</h2><div class="u-list" role="list" data-ui3-missions="missions">${missions}</div>`
    +`<h2 class="u-h2">長期目標</h2><section class="u-card" data-ui3-missions="goals"><div class="u-stats">${goals.slice(0,3).map(([l,v])=>stat(l,v)).join('')}</div><div class="u-stats">${goals.slice(3).map(([l,v])=>stat(l,v)).join('')}</div></section>`
    +`<h2 class="u-h2">業界ランキング</h2><section class="u-card" data-ui3-missions="ranking"><div class="u-stats">${ranking}</div></section>`
    +`<h2 class="u-h2">受賞歴</h2>`+list(awards,'awards','毎年末、受賞歴が記録されます。')
    +`<h2 class="u-h2">実績</h2>`+list(achievements,'achievements','まだ実績はありません。');
}
modules.ui3.registerScreen('missions',{render});
})();
