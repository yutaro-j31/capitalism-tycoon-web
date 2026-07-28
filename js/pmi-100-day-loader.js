// Script boundary: js/pmi-100-day-loader.js (classic JavaScript)
'use strict';
(function(){
const src=String(document.currentScript?.src||''),query=src.includes('?')?src.slice(src.indexOf('?')):'';
document.write(`<script src="./js/pmi-100-day-plan.js${query}"><\/script><script src="./js/pmi-long-run-guard.js${query}"><\/script><script>if(!globalThis.__capitalismTycoonModules?.pmi100DayPlan||!globalThis.__capitalismTycoonModules?.pmiLongRunGuard)throw Error('PMI 100日計画モジュールを起動できませんでした。')<\/script>`);
})();
