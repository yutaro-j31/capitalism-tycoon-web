'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');

const stage32=[
  'd-ui-shell.js',
  'd-ui-context-tabs.js'
];
const stage33=[
  'industry-event-response-plans-ui.js',
  'real-estate-capex-actuals-ui.js',
  'real-estate-capex-roi-ui.js',
  'real-estate-complete-cycle-ui.js',
  'real-estate-maintenance-reserves-ui.js',
  'real-estate-mortgage-refinancing-ui.js',
  'real-estate-portfolio-dashboard-ui.js',
  'real-estate-property-disposals-ui.js',
  'real-estate-property-insurance-ui.js',
  'real-estate-property-maintenance-ui.js',
  'real-estate-property-management-ui.js',
  'real-estate-property-taxes-ui.js',
  'real-estate-redevelopment-projects-ui.js',
  'real-estate-rent-guarantee-ui.js',
  'real-estate-rent-performance-ui.js',
  'real-estate-rent-pricing-ui.js',
  'real-estate-security-deposits-ui.js',
  'real-estate-tenant-collections-ui.js',
  'real-estate-tenant-renewals-ui.js',
  'save-storage-ui.js'
];
const stage34=[
  'capital-allocation-decision-memo.js',
  'capital-allocation-forecast.js',
  'capital-allocation-policy.js',
  'capital-allocation-recovery-funding-outcome.js',
  'capital-allocation-score.js',
  'competitor-dashboard-ui.js',
  'group-capital-allocation-execution.js',
  'group-capital-allocation-plan.js',
  'inter-subsidiary-synergy-performance.js',
  'ma-portfolio-summary-ui.js',
  'new-business-market-analysis.js',
  'player-crisis-creditor-ui.js',
  'player-crisis-ui.js',
  'player-turnaround-plan-ui.js',
  'playtest-report-ui.js',
  'release-diagnostics-ui.js',
  'shareholder-returns.js',
  'subsidiary-mandate-apply.js',
  'treasury-prepayment.js',
  'treasury-refinancing-policy.js'
];
const migrated=[...stage32,...stage33,...stage34];
assert.equal(migrated.length,42,'screen-scope audit must cover all 42 Stage 3-2/3-3/3-4 migrated enhancers');
assert.equal(new Set(migrated).size,42,'screen-scope audit list must not contain duplicates');

const assets=[
  'real-estate-capex-actuals-ui.js',
  'real-estate-capex-roi-ui.js',
  'real-estate-complete-cycle-ui.js',
  'real-estate-maintenance-reserves-ui.js',
  'real-estate-mortgage-refinancing-ui.js',
  'real-estate-portfolio-dashboard-ui.js',
  'real-estate-property-disposals-ui.js',
  'real-estate-property-insurance-ui.js',
  'real-estate-property-maintenance-ui.js',
  'real-estate-property-management-ui.js',
  'real-estate-property-taxes-ui.js',
  'real-estate-redevelopment-projects-ui.js',
  'real-estate-rent-guarantee-ui.js',
  'real-estate-rent-performance-ui.js',
  'real-estate-rent-pricing-ui.js',
  'real-estate-security-deposits-ui.js',
  'real-estate-tenant-collections-ui.js',
  'real-estate-tenant-renewals-ui.js'
];
assert.equal(assets.length,18,'exactly 18 migrated real-estate enhancers require assets-screen scoping');
const appWideDashboards=new Set([
  'real-estate-capex-actuals-ui.js',
  'real-estate-capex-roi-ui.js',
  'real-estate-complete-cycle-ui.js',
  'real-estate-portfolio-dashboard-ui.js',
  'real-estate-rent-performance-ui.js'
]);

function code(name){return fs.readFileSync(path.join(ROOT,'js',name),'utf8');}
for(const name of migrated){
  const source=code(name);
  assert.match(source,/registerUIEnhancer|registerEnhancer/,`${name} must remain connected to the central enhancer registry`);
}
for(const name of assets){
  const source=code(name);
  assert.match(source,/document\.querySelector\('\[data-screen="assets"\]'\)/,`${name} must explicitly scope rendering to the assets screen`);
  assert.doesNotMatch(source,/document\.querySelectorAll\('\[data-real-estate-property\]'\)/,`${name} must not scan property cards across the whole document`);
  if(appWideDashboards.has(name)){
    assert.doesNotMatch(source,/\bapp\.prepend\(/,`${name} must not prepend a dashboard to #app`);
    assert.doesNotMatch(source,/document\.getElementById\('app'\)/,`${name} must not use #app as its dashboard insertion root`);
    assert.match(source,/screen\.prepend\(/,`${name} must keep fallback insertion inside the assets screen`);
  }else{
    assert.match(source,/screen\.querySelectorAll\('\[data-real-estate-property\]'\)/,`${name} must scan only assets-screen property cards`);
  }
}

// The remaining 24 enhancers are intentionally scoped by selected tab, a dedicated
// screen/container marker, or an explicitly global crisis/shell contract.
const scopeContracts=new Map([
  ['d-ui-shell.js',/function activeTab\(\)/],
  ['d-ui-context-tabs.js',/\.d-context-panel/],
  ['industry-event-response-plans-ui.js',/selectedTab!=='market'/],
  ['save-storage-ui.js',/\[data-screen="settings"\]/],
  ['capital-allocation-decision-memo.js',/selectedTab!=='market'/],
  ['capital-allocation-forecast.js',/selectedTab!=='market'/],
  ['capital-allocation-policy.js',/selectedTab!=='market'/],
  ['capital-allocation-recovery-funding-outcome.js',/selectedTab!=='market'/],
  ['capital-allocation-score.js',/selectedTab!=='market'/],
  ['competitor-dashboard-ui.js',/selectedTab!=='rivals'/],
  ['group-capital-allocation-execution.js',/selectedTab!=='venture'/],
  ['group-capital-allocation-plan.js',/selectedTab!=='venture'/],
  ['inter-subsidiary-synergy-performance.js',/selectedTab!=='venture'/],
  ['ma-portfolio-summary-ui.js',/\[data-screen="ma"\]/],
  ['new-business-market-analysis.js',/selectedTab!=='venture'/],
  ['player-crisis-creditor-ui.js',/#player-crisis-panel/],
  ['player-crisis-ui.js',/snapshot\.status==='stable'/],
  ['player-turnaround-plan-ui.js',/playerTurnaroundPlan\?\.status==='active'/],
  ['playtest-report-ui.js',/\[data-release-diagnostics-card\]/],
  ['release-diagnostics-ui.js',/settingsVisible\(screen\)/],
  ['shareholder-returns.js',/selectedTab!=='market'/],
  ['subsidiary-mandate-apply.js',/selectedTab!=='venture'/],
  ['treasury-prepayment.js',/selectedTab!=='bank'/],
  ['treasury-refinancing-policy.js',/selectedTab!=='bank'/]
]);
assert.equal(scopeContracts.size,24,'all non-real-estate migrated enhancers must have an audited scope contract');
for(const [name,pattern] of scopeContracts){
  assert.match(code(name),pattern,`${name} lost its audited screen/container scope contract`);
}

console.log('Stage 3 UI enhancer screen-scope regression contract passed');
