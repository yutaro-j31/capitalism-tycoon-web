(async()=>{
'use strict';
const status=document.getElementById('runtimeStatus');
try{
  if(typeof DecompressionStream==='undefined')throw new Error('このブラウザはDecompressionStreamに対応していません');
  const files=['game-data-01.txt','game-data-02.txt','game-data-03.txt','game-data-04.txt','game-data-05.txt','game-data-06.txt','game-data-07.txt','game-data-08.txt','game-data-09.txt','game-data-10.txt','game-data-11.txt','game-data-12.txt'];
  const parts=await Promise.all(files.map(async f=>{const r=await fetch(f,{cache:'no-store'});if(!r.ok)throw new Error(f+' '+r.status);return r.text()}));
  const b64=parts.join('').replace(/\s/g,'');
  const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const stream=new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  const js=await new Response(stream).text();
  (0,eval)(js);
}catch(e){console.error(e);if(status){status.textContent='起動エラー: '+(e&&e.message?e.message:String(e));status.className='runtime bad'}}
})();
