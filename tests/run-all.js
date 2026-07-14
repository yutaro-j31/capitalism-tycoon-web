const { spawnSync } = require('node:child_process');
const commands = ['test:syntax','test:static','test:save','test:migration','test:load','test:week','test:transaction','test:long','test:css','test:javascript'];
let failed = 0;
for (const c of commands) { const r = spawnSync('npm', ['run', c, '--silent'], { stdio: 'inherit', shell: false }); if (r.status) failed = r.status; }
process.exit(failed);
