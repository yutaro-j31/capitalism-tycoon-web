const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.cwd(),jsDir=path.join(root,'js');
const files=fs.readdirSync(jsDir).filter(x=>x.endsWith('.js')).sort();
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const play=fs.readFileSync(path.join(root,'play.html'),'utf8');
const bootstrap=fs.readFileSync(path.join(jsDir,'d-ui-context-tabs.js'),'utf8');
const loader=fs.readFileSync(path.join(jsDir,'module-integration-loader.js'),'utf8');
assert.doesNotMatch(play,/document\.write\s*\(/,'play.html must not reconstruct index.html with document.write');
assert.match(play,/location\.replace\(target\.toString\(\)\)/,'play.html must redirect to canonical index.html');
assert.match(bootstrap,/module-integration-loader\.js/,'index production path must bootstrap the canonical integration loader');
assert.match(loader,/globalThis\.__capitalismTycoonModuleIntegrationFailed=true/,'loader failures must fail closed');
assert.match(loader,/s\.async=false/,'modules must load sequentially');
const direct=[...index.matchAll(/<script[^>]+src=["']\.\/js\/([^"'?]+\.js)/g)].map(m=>m[1]);
const referenced=new Set(direct);
for(const match of loader.matchAll(/['"]([a-z0-9-]+\.js)['"]/g))referenced.add(match[1]);
referenced.add('module-integration-loader.js');
const dynamicallyReferenced=new Set();
for(const name of files){const text=fs.readFileSync(path.join(jsDir,name),'utf8');for(const match of text.matchAll(/\.\/js\/([a-z0-9-]+\.js)/g))dynamicallyReferenced.add(match[1]);}
for(const name of dynamicallyReferenced)referenced.add(name);
const intentional=new Set([
'boot-recovery.js','runtime.js','data.js','workforce.js','supply.js','competitor.js','market.js','finance.js','engine.js','real-estate.js','save-v9.js','app.js',
'pmi-100-day-loader.js' // obsolete document.write loader retained only for backward-compatible file references; canonical loader wires its children directly.
]);
const unwired=files.filter(name=>!referenced.has(name)&&!intentional.has(name));
assert.deepEqual(unwired,[],`Unwired production modules: ${unwired.join(', ')}`);
const priority=['ceo-dashboard.js','real-estate-ui.js','capital-allocation-actions.js','treasury-prepayment.js','treasury-refinancing-policy.js','product-lifecycle.js','subsidiary-ipo-preparation.js','subsidiary-ipo-secondary-sale.js','save-storage.js','save-storage-ui.js','save-import-atomic-guard.js'];
for(const name of priority)assert.ok(referenced.has(name),`${name} must be reachable from the canonical production path`);
console.log(`All ${files.length} JavaScript files are classified as directly wired, loader wired, dynamically wired, or intentionally excluded with a documented reason.`);
