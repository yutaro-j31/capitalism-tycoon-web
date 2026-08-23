'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  MAX_ATTEMPTS,
  createDiagnostics,
  qualifyingResponse,
  runWithPublishedRetry,
  shouldRetry
} = require('./published-webkit-transient-retry');

const targetUrl = 'https://example.test/app/';
const qualifies = values => qualifyingResponse({ published:true, targetUrl, responseUrl:'https://example.test/app.js', ...values });

assert.equal(MAX_ATTEMPTS, 2);
assert.equal(qualifies({ status:503, resourceType:'script' }), true);
assert.equal(qualifies({ status:500, resourceType:'document' }), true);
assert.equal(qualifies({ status:599, resourceType:'stylesheet' }), true);
assert.equal(qualifies({ status:404, resourceType:'script' }), false);
assert.equal(qualifies({ status:403, resourceType:'script' }), false);
assert.equal(qualifies({ status:503, resourceType:'image' }), false);
assert.equal(qualifies({ status:503, resourceType:'font' }), false);
assert.equal(qualifies({ status:503, resourceType:'fetch' }), false);
assert.equal(qualifyingResponse({ published:true, targetUrl, status:503, resourceType:'script', responseUrl:'https://cdn.example.test/app.js' }), false);
assert.equal(qualifyingResponse({ published:false, targetUrl, status:503, resourceType:'script', responseUrl:'https://example.test/app.js' }), false);

const serverError = createDiagnostics();
serverError.requiredAssetServerErrors.push('503 script https://example.test/app.js');
assert.equal(shouldRetry({ published:true, attempt:1, diagnostics:serverError }), true);
assert.equal(shouldRetry({ published:true, attempt:2, diagnostics:serverError }), false);
assert.equal(shouldRetry({ published:false, attempt:1, diagnostics:serverError }), false);
const pageErrorOnly = createDiagnostics();
pageErrorOnly.pageErrors.push('runtime dependency error');
assert.equal(shouldRetry({ published:true, attempt:1, diagnostics:pageErrorOnly }), false);
assert.equal(shouldRetry({ published:true, attempt:1, diagnostics:createDiagnostics() }), false);

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'published-webkit-retry-'));
  const resultPath = path.join(directory, 'result.json');
  const attempts = [];
  await runWithPublishedRetry({
    published:true,
    resultPath,
    runAttempt:async attempt => {
      attempts.push(attempt);
      fs.writeFileSync(resultPath, JSON.stringify({ status:attempt === 1 ? 'failed' : 'passed', attempt }));
      if (attempt === 1) {
        const error = new Error('transient asset failure');
        error.publishedWebKitDiagnostics = serverError;
        throw error;
      }
    }
  });
  assert.deepEqual(attempts, [1, 2]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'result-attempt-1.json'))).attempt, 1);
  assert.equal(JSON.parse(fs.readFileSync(resultPath)).attempt, 2);

  for (const published of [false, true]) {
    const seen = [];
    await assert.rejects(runWithPublishedRetry({
      published,
      resultPath:null,
      runAttempt:async attempt => {
        seen.push(attempt);
        const error = new Error('non-retryable');
        error.publishedWebKitDiagnostics = published ? createDiagnostics() : serverError;
        throw error;
      }
    }), /non-retryable/);
    assert.deepEqual(seen, [1]);
  }

  let failedAttempts = 0;
  await assert.rejects(runWithPublishedRetry({
    published:true,
    resultPath:null,
    runAttempt:async () => {
      failedAttempts += 1;
      const error = new Error('still failing');
      error.publishedWebKitDiagnostics = serverError;
      throw error;
    }
  }), /still failing/);
  assert.equal(failedAttempts, 2);
  fs.rmSync(directory, { recursive:true, force:true });
  console.log('Published WebKit transient retry policy contract passed');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
