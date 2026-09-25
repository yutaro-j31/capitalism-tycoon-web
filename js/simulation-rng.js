// Script boundary: js/simulation-rng.js (classic JavaScript)
// Deterministic simulation randomness and entity IDs (#731).
// The stream lives in the save (state.simulationRng), so the same save and the same actions give
// the same results in any runtime: nothing here reads Math.random, the clock or crypto. Call sites
// move onto this module subsystem by subsystem; tests/simulation-determinism-contract-test.js
// ratchets the remaining nondeterministic sources down to zero.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before simulation-rng.js.');
if(modules.simulationRng)throw new Error('Capitalism Tycoon simulationRng module is already registered.');
const VERSION=1,FALLBACK_SEED=0x9e3779b9;
const uint32=value=>Number.isInteger(value)&&value>=0&&value<=0xffffffff;
const count=value=>Number.isSafeInteger(value)&&value>=0;
function hash32(text){let h=2166136261;for(const c of String(text)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
// A save made before #731 has no stream: derive its seed from the save itself, never from the host.
function legacySeed(state){
  const week=Number.isFinite(Number(state?.week))?Math.floor(Number(state.week)):1;
  return hash32(`${state?.companyName||''}|${state?.playerName||''}|${state?.selectedPref||''}|${week}`)||FALLBACK_SEED;
}
// Creates the stream when missing and repairs invalid fields; a valid stream is left untouched, so
// normalize stays idempotent and a reload does not move the stream.
function ensure(state){
  if(!state||typeof state!=='object')return null;
  const box=state.simulationRng&&typeof state.simulationRng==='object'&&!Array.isArray(state.simulationRng)?state.simulationRng:{};
  if(!uint32(box.seed)||box.seed===0)box.seed=legacySeed(state);
  if(!uint32(box.state))box.state=box.seed;
  if(!count(box.draws))box.draws=0;
  if(!count(box.nextID)||box.nextID===0)box.nextID=1;
  box.version=VERSION;
  state.simulationRng=box;
  return box;
}
// mulberry32: one uint32 of state, JSON-safe.
function step(box){
  let t=box.state=(box.state+0x6D2B79F5)>>>0;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}
function next(state){const box=ensure(state);if(!box)throw new Error('simulationRng.next needs a game state.');box.draws+=1;return step(box);}
function range(state,min,max){return min+next(state)*(max-min);}
function pick(state,items){return items[Math.floor(next(state)*items.length)];}
function chance(state,probability){return next(state)<probability;}
// Deterministic entity IDs: a persisted counter, unique within the save.
function nextID(state,prefix='sim'){const box=ensure(state);if(!box)throw new Error('simulationRng.nextID needs a game state.');const id=`${prefix}-s${box.nextID.toString(36)}`;box.nextID+=1;return id;}
// Test hook: sets the seed and starting point of the real stream. Consumers keep drawing through
// next(), so a test that uses it still exercises the production wiring.
function reseed(state,seed,{skip=0}={}){
  if(!uint32(seed)||seed===0)throw new Error('simulationRng.reseed needs a non-zero uint32 seed.');
  const box=ensure(state);box.seed=seed;box.state=seed;box.draws=0;
  for(let i=0;i<Math.max(0,Math.floor(skip));i++)next(state);
  return box;
}
// A new game's seed from one host entropy draw in [0,1); 0 and out-of-range values fall back.
function seedFromEntropy(value){const seed=Number.isFinite(value)?Math.floor(value*0x100000000)>>>0:0;return seed||FALLBACK_SEED;}
// The next values the stream will produce, without consuming them.
function peek(state,countToPeek=1){const box={...ensure(state)},values=[];for(let i=0;i<countToPeek;i++)values.push(step(box));return values;}
modules.simulationRng=Object.freeze({VERSION,hash32,legacySeed,ensure,next,range,pick,chance,nextID,reseed,peek,seedFromEntropy});
})();
