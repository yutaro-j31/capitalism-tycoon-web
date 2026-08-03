'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const play = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');

assert.match(play, /<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">/);
assert.match(play, /new URL\('\.\/index\.html',location\.href\)/);
assert.match(play, /target\.searchParams\.set\('v',Date\.now\(\)\.toString\(36\)\)/);
assert.match(play, /location\.replace\(target\)/);
assert.doesNotMatch(play, /fetch\s*\(/, 'redirect launcher must not fetch and rewrite index.html');
assert.doesNotMatch(play, /document\.write|document\.open|document\.close/, 'redirect launcher must not inject scripts dynamically');
assert.doesNotMatch(play, /localStorage|capitalism_tycoon_web_v1|saveVersion/, 'launcher must not read or mutate save data');
assert.doesNotMatch(play, /https?:\/\//, 'launcher must remain same-origin and self-contained');
assert.ok(play.includes('index.html owns the complete script order'), 'launcher must document that production load order belongs to index.html');
assert.ok(play.length < 3000, `launcher unexpectedly large: ${play.length} bytes`);

console.log('cache-safe redirect play entry contract passed');
