const vm = require('node:vm');
const { extractScripts, extractEventHandlers } = require('./harness');
let failures = 0;
extractScripts().forEach((s, i) => { try { new vm.Script(s.code, { filename: `index.html <script #${i+1}> line ${s.startLine}` }); console.log(`ok script #${i+1} starting line ${s.startLine}`); } catch (e) { failures++; console.error(`script #${i+1} starting line ${s.startLine}: ${e.message}`); } });
extractEventHandlers().forEach(h => { try { new vm.Script(`(function(event){${h.code}\n})`, { filename: `index.html ${h.name} line ${h.line}` }); } catch (e) { failures++; console.error(`${h.name} at line ${h.line}: ${e.message}`); } });
if (failures) process.exit(1);
