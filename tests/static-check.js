const fs = require('node:fs');
const { INDEX, readIndex, BIDI } = require('./harness');
const html = readIndex(); const errors = [];
if (!fs.existsSync(INDEX)) errors.push('index.html missing');
if (!/^\s*<!doctype html>/i.test(html)) errors.push('DOCTYPE missing');
for (const tag of ['html','head','body','script']) if (!new RegExp(`<${tag}\\b`, 'i').test(html)) errors.push(`<${tag}> missing`);
if (BIDI.test(html)) errors.push('bidirectional Unicode control character found');
const markup = html.split(/<script\b/i)[0];
const ids = [...markup.matchAll(/\bid\s*=\s*"([^"]+)"/gi)].map(m => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i); if (dup.length) errors.push(`duplicate ids: ${[...new Set(dup)].join(', ')}`);
for (const id of ['app','toast-root','modal-root']) if (!ids.includes(id)) errors.push(`required root id missing: ${id}`);
for (const m of html.matchAll(/getElementById\(['"]([^'"]+)['"]\)|\$\(['"]#([^'"]+)['"]\)/g)) { const id = m[1] || m[2]; if (!ids.includes(id) && !/^business-|overseas-business-|modal-|salary|so|ipo-|new-company|hire-ok|import-file|home-chart|report-chart/.test(id)) errors.push(`referenced id may be missing: ${id}`); }
const opens = (html.match(/<script\b/gi)||[]).length, closes = (html.match(/<\/script>/gi)||[]).length; if (opens !== closes) errors.push(`script tag imbalance ${opens}/${closes}`);
if (!html.includes('</html>') || !html.includes('</body>')) errors.push('body/html closing tag missing');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('static checks passed');
