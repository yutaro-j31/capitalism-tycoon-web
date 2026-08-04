'use strict';
const fs=require('node:fs');
function replace(path,needle,replacement){const source=fs.readFileSync(path,'utf8');if(source.includes(replacement))return false;if(!source.includes(needle))throw new Error(`${path}: anchor not found`);fs.writeFileSync(path,source.replace(needle,replacement));return true;}
replace('index.html','<script src="./js/shareholder-returns.js"></script>','<script src="./js/shareholder-returns.js"></script><script src="./js/shareholder-activism.js"></script>');
replace('tests/run-all.js',"  ['shareholder-returns', 'tests/shareholder-returns-test.js'],","  ['shareholder-returns', 'tests/shareholder-returns-test.js'],\n  ['shareholder-activism', 'tests/shareholder-activism-test.js'],");
replace('docs/gameplay-systems-roadmap.md','4. Founder control, executive dismissal, shareholder proposals, and activist pressure.','4. Founder control, executive dismissal, shareholder proposals, and activist pressure. In progress: state-driven shareholder proposals, negotiation, and deterministic proxy fights.');
console.log('shareholder activism wiring complete');
