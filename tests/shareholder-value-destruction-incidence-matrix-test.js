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
if(requestedStyle){assert(STYLES.includes(requestedStyle));assert(SEEDS.includes(requestedSeed));const a=run(requestedStyle,requestedSeed),b=run(requestedStyle,requestedSeed);assert.deepEqual(a,b,'case is deterministic');console.log(`SHAREHOLDER_VALUE_DESTRUCTION_MATRIX ${JSON.stringify([a])}`);console.log('shareholder value destruction incidence matrix case passed');}else{const seed=SEEDS[0],rows=[];for(const style of STYLES){const a=run(style,seed),b=run(style,seed);assert.deepEqual(a,b,'representative case is deterministic');rows.push(a);}const byStyle=Object.fromEntries(rows.map(row=>[row.style,row]));assert(byStyle['sustained-destruction'].campaignCount>0,JSON.stringify(rows));assert.equal(byStyle['timely-recovery'].campaignCount,0,JSON.stringify(rows));assert.equal(byStyle['healthy-market'].campaignCount,0,JSON.stringify(rows));console.log(`SHAREHOLDER_VALUE_DESTRUCTION_MATRIX ${JSON.stringify(rows)}`);console.log('shareholder value destruction representative incidence matrix passed');}
