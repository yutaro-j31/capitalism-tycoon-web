'use strict';
function indexedDBFor(durable, control) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' }, createObjectStore() {},
    transaction() {
      const tx = {};
      const finish = (request, result, mutate, put = false) => {
        const complete = () => queueMicrotask(() => {
          mutate?.(); request.result = result; request.onsuccess?.();
          queueMicrotask(() => tx.oncomplete?.());
        });
        if (put && control.holdPut) { control.holdPut = false; control.release = complete; }
        else complete();
      };
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) {
          control.attempts.push(String(payload)); const r = {};
          finish(r, key, () => durable.set(String(key), String(payload)), true); return r;
        },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      });
      return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}


function inject(e,m,mirror,key,kind) {
  const save=e.save,emit=e.emit,backend=m.saveStorageIDB;
  const target=typeof Storage!=='undefined'&&mirror instanceof Storage?Storage.prototype:mirror;
  const setItem=target.setItem;let hits=0;
  if(kind==='save-false')e.save=()=>{hits++;return false;};
  if(kind==='mirror')target.setItem=function(k,v){if(this===mirror&&k===key){hits++;throw Object.assign(new Error('PE acquisition mirror rejected'),{name:'SecurityError'});}return setItem.call(this,k,v);};
  if(['enqueue-false','enqueue-throw'].includes(kind))m.saveStorageIDB={...backend,writeSync(k,v){backend.writeSync(k,v);hits++;if(kind==='enqueue-throw')throw new Error('PE acquisition enqueue threw after admission');return false;}};
  if(kind==='save-throw')e.save=function(...args){const r=save.apply(this,args);if(!this.inTransaction()){hits++;throw new Error('PE acquisition save accepted then threw');}return r;};
  if(['saved','change','notify'].includes(kind))e.emit=function(type='change',...args){if(type===kind&&(kind==='notify'||!this.inTransaction())){hits++;throw new Error('PE acquisition '+kind+' threw');}return emit.call(this,type,...args);};
  return {hits:()=>hits,restore(){e.save=save;e.emit=emit;target.setItem=setItem;m.saveStorageIDB=backend;}};
}
module.exports={indexedDBFor,inject};
