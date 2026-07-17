'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const override=fs.readFileSync('css/d-ui-reference-fidelity.css','utf8');
const loader=fs.readFileSync('css/d-ui-mobile-company.css','utf8');
assert.match(loader,/@import url\("\.\/d-ui-reference-fidelity\.css"\);/,'reference fidelity stylesheet must load after the base D UI');
for(const selector of ['.d-topbar','.d-kpi-strip','.d-sidebar','.d-map-workspace','.d-city-surface','.d-map-marker','.d-map-overlay','.d-context-panel','.d-bottom-dock']){
  assert.ok(override.includes(selector),`missing reference fidelity selector: ${selector}`);
}
for(const interaction of ['.d-topbar::after','.d-map-marker:hover','.d-white-card:hover','.d-context-tabs b::after','@media(prefers-reduced-motion:reduce)']){
  assert.ok(override.includes(interaction),`missing reference interaction treatment: ${interaction}`);
}
for(const mobileContract of ['env(safe-area-inset-bottom,0px)','min-width:44px','min-height:44px']){
  assert.ok(override.includes(mobileContract),`missing iPhone safe-area or touch-target contract: ${mobileContract}`);
}
assert.ok(override.includes('@media(max-width:820px)'), 'iPhone/tablet fallback must remain explicit');
assert.ok(!/url\((?!["']?\.\/)/.test(override), 'remote or root-relative assets are not allowed');
assert.ok(!/localStorage|SAVE_KEY|save version|Math\.random/.test(override), 'visual override must not touch runtime state contracts');
console.log('D UI reference fidelity contract passed.');
