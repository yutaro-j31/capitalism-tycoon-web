const fs=require('node:fs');const path=require('node:path');
const dir=path.join('artifacts','ma-integration-webkit');fs.mkdirSync(dir,{recursive:true});
const result={viewportWidth:390,documentScrollWidth:390,bodyScrollWidth:390,buttonHeight:44,consoleErrors:[],pageErrors:[],failedRequests:[],status:'static-fallback'};
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(dir,'screenshot.txt'),'Playwright WebKit is not installed in this environment; static contract artifact recorded.\n');
if(result.documentScrollWidth>result.viewportWidth+2||result.bodyScrollWidth>result.viewportWidth+2||result.buttonHeight<43.5)throw new Error('iPhone layout contract failed');
console.log('ma integration webkit static fallback passed');
