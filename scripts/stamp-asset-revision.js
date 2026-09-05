'use strict';
/*
 * Re-stamps every `?rev=` cache-busting URL (and the two runtime revision
 * diagnostics) from the current content of the versioned asset set.
 *
 * Run it after changing any map-critical asset:
 *   node scripts/stamp-asset-revision.js
 *
 * It is idempotent -- running it on an already-coherent tree writes nothing.
 * tests/static-asset-cache-coherence-test.js fails when the committed stamps
 * disagree with the content, so forgetting this step is a red test rather than
 * a stale production cache.
 */
const { writeStamps } = require('./asset-revision');

const { revision, changed } = writeStamps();
if (!changed.length) {
  console.log(`asset revision ${revision}: already up to date`);
} else {
  console.log(`asset revision ${revision}: restamped ${changed.length} file(s)`);
  for (const file of changed) console.log(`  ${file}`);
}
