'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const play = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');

assert.match(play, /<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">/);
assert.match(play, /new URL\('\.\/index\.html',location\.href\)/);
assert.match(play, /fetch\(indexUrl,\{cache:'no-store',credentials:'same-origin'\}\)/);
assert.match(play, /indexUrl\.searchParams\.set\('launch',token\)/, 'launcher must attach a cache-busting launch token');
assert.match(play, /location\.replace\(indexUrl\.toString\(\)\)/, 'launcher must redirect to the canonical index entry');
assert.match(play, /id="fallback" href="\.\/index\.html"/, 'launcher must provide a direct canonical fallback link');
assert.match(play, /fallback\.href=indexUrl\.toString\(\)/, 'fallback link must inherit the launch token');
assert.doesNotMatch(play, /document\.write\s*\(|document\.open\s*\(|document\.close\s*\(/, 'launcher must not reconstruct the application document');
assert.doesNotMatch(play, /html\.replace\s*\(|fresh\.includes\s*\(/, 'launcher must not transform fetched index HTML');
assert.doesNotMatch(play, /localStorage|capitalism_tycoon_web_v1|saveVersion/, 'launcher must not read or mutate save data');
assert.doesNotMatch(play, /https?:\/\//, 'launcher must remain same-origin and self-contained');
assert.ok(play.length < 12000, `launcher unexpectedly large: ${play.length} bytes`);

console.log('cache-safe canonical redirect play entry contract passed');
