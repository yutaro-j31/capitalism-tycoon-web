'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os');
const path = require('node:path'), cp = require('node:child_process');
const { compareRoots } = require('./parallel-shard-k-source-drift.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k-source-drift-'));
const repo = path.join(root, 'current'), baseline = path.join(root, 'baseline'); fs.mkdirSync(repo);
const git = (...args) => cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
const write = (p, text) => { fs.mkdirSync(path.dirname(path.join(repo,p)), {recursive:true}); fs.writeFileSync(path.join(repo,p),text); };
try {
  git('init'); git('config','core.filemode','true'); git('config','user.name','Work B fixture'); git('config','user.email','work-b-fixture@example.invalid');
  // Fixture workload bodies throw if executed. Enumeration intercepts spawnSync;
  // contract mode exits after its metadata line, just like the canonical runner.
  write('tests/run-all-shard.js', "if(process.env.TEST_SHARD_CONTRACT==='1'){console.log('canonical-test-shard-summary: shard=K contractOnly=true executed=0 seen=29 total=0.0s');}else{for(let i=0;i<29;i++)require('node:child_process').spawnSync('node',['tests/t'+i+'.js']);}\n");
  for(let i=0;i<29;i++)write('tests/t'+i+'.js', "throw Error('fixture workload must not execute');\n");
  write('scripts/parallel-shard-runner.js','// fixture runner fingerprint\n');
  write('js/shared.js','// indirect input\n'); write('docs/note.md','initial\n');
  git('add','.'); git('commit','-m','baseline'); const pin = git('rev-parse','HEAD');
  git('worktree','add','--detach',baseline,pin);
  const same = compareRoots(baseline,pin,repo,pin);
  assert.equal(same.sameKCommandContract,true); assert.equal(same.trackedTreeMatches,true);
  assert.equal(same.directInputPathCount,29); assert.deepEqual(same.changedDirectInputs,[]);
  // Same identities but changed direct content, indirect source and docs must all survive.
  write('tests/t0.js',"throw Error('changed fixture workload must not execute');\n");
  write('js/shared.js','// changed indirect input\n'); write('docs/note.md','changed\n');
  git('add','.'); git('commit','-m','drift'); const current = git('rev-parse','HEAD');
  const changed = compareRoots(baseline,pin,repo,current);
  assert.equal(changed.sameKCommandContract,true); assert.equal(changed.trackedTreeMatches,false);
  assert.deepEqual(changed.changedDirectInputs.map(c=>c.path),['tests/t0.js']);
  assert.deepEqual(changed.otherTrackedChanges.map(c=>c.path),['docs/note.md','js/shared.js']);
  assert.notEqual(changed.changedDirectInputs[0].baseline.oid,changed.changedDirectInputs[0].current.oid);
  for(const key of ['runtimeExecuted','dependencyClosureVerified','evidenceRequalified','productionAuthorized'])assert.equal(changed[key],false);
  assert.throws(()=>compareRoots(baseline,'a'.repeat(40),repo,current));
  assert.throws(()=>compareRoots(baseline,undefined,repo,current));
  assert.throws(()=>compareRoots(baseline,pin,repo,'short'));
  write('js/shared.js','dirty\n'); assert.throws(()=>compareRoots(baseline,pin,repo,current),/clean/);
  write('js/shared.js','// changed indirect input\n');
  // Git mode drift, missing input and an added pathname with a tab remain visible.
  fs.chmodSync(path.join(repo,'tests/t1.js'),0o755); fs.unlinkSync(path.join(repo,'tests/t2.js'));
  write('docs/with\ttab.md','tab\n'); git('add','-A'); git('commit','-m','mode missing and tab');
  const edgePin=git('rev-parse','HEAD'), edge=compareRoots(baseline,pin,repo,edgePin);
  assert.ok(edge.changedDirectInputs.some(c=>c.path==='tests/t1.js'&&c.baseline.mode!==c.current.mode));
  assert.ok(edge.changedDirectInputs.some(c=>c.path==='tests/t2.js'&&c.status==='deleted'));
  assert.deepEqual(edge.unresolvedDirectFiles,['tests/t2.js']);
  assert.ok(edge.otherTrackedChanges.some(c=>c.path==='docs/with\ttab.md'&&c.status==='added'));
  const cli=JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'parallel-shard-k-source-drift.cjs'),baseline,pin,repo,edgePin],{encoding:'utf8'}));
  assert.deepEqual(cli,edge);
  const relativeCli = JSON.parse(cp.execFileSync(process.execPath,
    [path.join(__dirname,'parallel-shard-k-source-drift.cjs'),'../baseline',pin,'.',edgePin],
    {cwd:repo,encoding:'utf8'}));
  assert.deepEqual(relativeCli,edge,'relative CLI roots resolve before enumeration');
  assert.deepEqual(compareRoots(path.relative(process.cwd(),baseline),pin,path.relative(process.cwd(),repo),edgePin),edge,
    'relative module roots resolve before enumeration');
  const body = fs.readFileSync(path.join(repo,'tests/run-all-shard.js'),'utf8');
  write('tests/run-all-shard.js',body.replace("['tests/t'+i+'.js']", "['tests/t'+i+'.js','--changed']"));
  git('add','.'); git('commit','-m','command arguments drift');
  assert.equal(compareRoots(baseline,pin,repo,git('rev-parse','HEAD')).sameKCommandContract,false);
  write('tests/run-all-shard.js',body.replace('i<29','i<28'));
  git('add','.'); git('commit','-m','missing invocation');
  assert.throws(()=>compareRoots(baseline,pin,repo,git('rev-parse','HEAD')),/K29/);
  console.log('K source drift: PASS (metadata/committed blobs only; no runtime requalification)');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
