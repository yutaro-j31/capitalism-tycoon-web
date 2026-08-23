'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_ATTEMPTS = 2;
const REQUIRED_RESOURCE_TYPES = new Set(['document', 'script', 'stylesheet']);

function createDiagnostics() {
  return { consoleErrors: [], pageErrors: [], failedRequests: [], requiredAssetServerErrors: [] };
}

function isPublishedTarget(targetUrl) {
  if (!targetUrl) return false;
  const url = new URL(targetUrl);
  return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

function qualifyingResponse({ published, targetUrl, status, resourceType, responseUrl }) {
  if (!published || status < 500 || status > 599 || !REQUIRED_RESOURCE_TYPES.has(resourceType)) return false;
  try { return new URL(responseUrl).origin === new URL(targetUrl).origin; } catch (_) { return false; }
}

function observePageDiagnostics(page, { published, targetUrl, diagnostics }) {
  page.on('console', message => message.type() === 'error' && diagnostics.consoleErrors.push(message.text()));
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', response => {
    const status = response.status();
    const resourceType = response.request().resourceType();
    if (qualifyingResponse({ published, targetUrl, status, resourceType, responseUrl: response.url() })) {
      diagnostics.requiredAssetServerErrors.push(`${status} ${resourceType} ${response.url()}`);
    }
  });
}

function shouldRetry({ published, attempt, diagnostics }) {
  return published === true && attempt === 1 && diagnostics.requiredAssetServerErrors.length > 0;
}

function preserveAttemptEvidence(resultPath, attempt) {
  if (!resultPath || !fs.existsSync(resultPath)) return;
  const extension = path.extname(resultPath);
  const attemptPath = `${resultPath.slice(0, -extension.length)}-attempt-${attempt}${extension}`;
  fs.copyFileSync(resultPath, attemptPath);
}

async function runWithPublishedRetry({ published, resultPath, runAttempt }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runAttempt(attempt);
    } catch (error) {
      const diagnostics = error?.publishedWebKitDiagnostics || createDiagnostics();
      if (shouldRetry({ published, attempt, diagnostics })) {
        preserveAttemptEvidence(resultPath, attempt);
        console.warn('Published Pages required asset returned HTTP 5xx; retrying WebKit check once.');
        continue;
      }
      throw error;
    }
  }
}

module.exports = { MAX_ATTEMPTS, createDiagnostics, isPublishedTarget, observePageDiagnostics, qualifyingResponse, runWithPublishedRetry, shouldRetry };
