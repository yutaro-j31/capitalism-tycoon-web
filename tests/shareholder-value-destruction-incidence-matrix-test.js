'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const STYLES=['sustained-destruction','timely-recovery','healthy-market'];
const SEEDS=[0x6b200101,0x6b200202,0x6b200303];
const script=path.join(__dirname,'shareholder-value-destruction-incidence-case.js');
function run(style,seed){const r=spawnSync(process.execPath,[script,style,String(seed)],{encoding:'utf8',timeout:10*60*1000,maxBuffer:64*1024*1024});if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');assert.fail(`${style}-${seed} failed`);}const line=r.stdout.split(/\r?\n/).find(x=>x.startsWith('SHAREHOLDER_VALUE_DESTRUCTION_CASE '));assert(line);return JSON.parse(line.slice('SHAREHOLDER_VALUE_DESTRUCTION_CASE '.length));}
const requestedStyle=process.env.VALUE_DESTRUCTION_STYLE;
const requestedSeed=Number(process.env.VALUE_DESTRUCTION_SEED);
if(requestedStyle){assert(STYLES.includes(requestedStyle));assert(SEEDS.includes(requestedSeed));const a=run(requestedStyle,requestedSeed),b=run(requestedStyle,requestedSeed);assert.deepEqual(a,b,'case is deterministic');console.log(`SHAREHOLDER_VALUE_DESTRUCTION_MATRIX ${JSON.stringify([a])}`);console.log('shareholder value destruction incidence matrix case passed');}else{const rows=[];for(const style of STYLES)for(const seed of SEEDS){const a=run(style,seed),b=run(style,seed);assert.deepEqual(a,b);rows.push(a);}const rates=Object.fromEntries(STYLES.map(style=>[style,rows.filter(r=>r.style===style&&r.campaignCount>0).length]));assert(rates['sustained-destruction']>=2,JSON.stringify(rates));assert(rates['timely-recovery']<=1,JSON.stringify(rates));assert.equal(rates['healthy-market'],0,JSON.stringify(rates));console.log(`SHAREHOLDER_VALUE_DESTRUCTION_MATRIX ${JSON.stringify(rows)}`);console.log('shareholder value destruction incidence matrix passed');}
