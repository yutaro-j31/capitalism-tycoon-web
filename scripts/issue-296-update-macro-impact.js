'use strict';
const fs=require('node:fs');
const {readIndex,loadGameFromHtml}=require('../tests/harness');
function seeded(seed=246813579){return()=>((seed=(seed*48271)%2147483647)/2147483647);}
function load(html){const {engineModule}=loadGameFromHtml(html,{random:seeded(),headless:true});const e=new engineModule.TycoonEngine();e.g.configured=true;return e;}
const html=readIndex();
const without=html.replace(/\s*<script src="\.\/js\/deterministic-economic-foundation\.js"><\/script>/,'');
if(without===html)throw new Error('deterministic economic foundation script tag not found');
const legacy=load(without),production=load(html);
const fields=['economy','season','policyRate','inflation','exchangeRate','realEstateCycle','macroCrisis'];
function snapshot(e){return Object.fromEntries(fields.map(k=>[k,JSON.parse(JSON.stringify(e.g[k]??null))]));}
for(const e of [legacy,production]){e.g.week=26;e.g.economy=.91;e.g.season=1.04;e.g.policyRate=.012;e.g.inflation=1.03;e.g.exchangeRate=1.08;e.g.realEstateCycle=.95;e.g.macroCrisis={kind:'景気後退',weeks:3,salesMultiplier:.8,costMultiplier:1.1};}
const before={legacy:snapshot(legacy),production:snapshot(production)};
const legacyResult=legacy.updateMacro(),productionResult=production.updateMacro();
const after={legacy:snapshot(legacy),production:snapshot(production)};
console.log(JSON.stringify({before,after,legacyResult,productionResult,economicFoundation:production.g.economicFoundation},null,2));
const changedByLegacy=fields.filter(k=>JSON.stringify(before.legacy[k])!==JSON.stringify(after.legacy[k]));
const changedByProduction=fields.filter(k=>JSON.stringify(before.production[k])!==JSON.stringify(after.production[k]));
console.log('changedByLegacy',changedByLegacy);
console.log('changedByProduction',changedByProduction);
console.log('lostLegacyEffects',changedByLegacy.filter(k=>!changedByProduction.includes(k)));
