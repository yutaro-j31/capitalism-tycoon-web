'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const STYLES=['neglected-low-roic','remedied-low-roic','high-roic'];
const SEEDS=[0x6c300101,0x6c300202,0x6c300303];
const script=path.join(__dirname,'shareholder-portfolio-inefficiency-incidence-case.js');
function run(style,seed){const r=spawnSync(process.execPath,[script,style,String(seed)],{encoding:'utf8',timeout:10*60*1000,maxBuffer:64*1024*1024});if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');assert.fail(`${style}-${seed} failed`);}const line=r.stdout.split(/\r?\n/).find(x=>x.startsWith('SHAREHOLDER_PORTFOLIO_INEFFICIENCY_CASE '));assert(line);return JSON.parse(line.slice('SHAREHOLDER_PORTFOLIO_INEFFICIENCY_CASE '.length));}
function assertStyle(row){if(row.style==='neglected-low-roic')assert(row.campaignCount>=1,JSON.stringify(row));else assert.equal(row.campaignCount,0,JSON.stringify(row));assert(row.totalActivistCampaigns<=6,'shared cooldown bounds total campaigns');}
const requestedStyle=process.env.PORTFOLIO_INEFFICIENCY_STYLE;
const requestedSeed=Number(process.env.PORTFOLIO_INEFFICIENCY_SEED);
if(requestedStyle){assert(STYLES.includes(requestedStyle));assert(SEEDS.includes(requestedSeed));const a=run(requestedStyle,requestedSeed),b=run(requestedStyle,requestedSeed);assert.deepEqual(a,b,'case is deterministic');assertStyle(a);console.log(`SHAREHOLDER_PORTFOLIO_INEFFICIENCY_MATRIX ${JSON.stringify([a])}`);console.log('shareholder portfolio inefficiency incidence matrix case passed');}else{const a=run('neglected-low-roic',SEEDS[0]),b=run('neglected-low-roic',SEEDS[0]);assert.deepEqual(a,b,'canonical representative is deterministic');assertStyle(a);console.log(`SHAREHOLDER_PORTFOLIO_INEFFICIENCY_MATRIX ${JSON.stringify([a])}`);console.log('shareholder portfolio inefficiency canonical incidence representative passed');}
