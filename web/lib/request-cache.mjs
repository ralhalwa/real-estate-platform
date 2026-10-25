/** Short-lived memory only. No profiles, permissions or tokens are persisted to disk. */
export function createRequestCache({ttl=30000,now=Date.now}={}) {
 const entries=new Map();
 return {
  clear(){entries.clear()},
  invalidate(key){entries.delete(key)},
  fetch(key,fetcher){
   const existing=entries.get(key);
   if(existing?.pending)return existing.pending;
   if(existing&&existing.expires>now())return Promise.resolve(existing.value);
   const entry={pending:null,value:undefined,expires:0};
   const pending=Promise.resolve().then(fetcher).then(value=>{
    if(entries.get(key)===entry){entry.value=value;entry.expires=now()+ttl;entry.pending=null}
    return value;
   },error=>{if(entries.get(key)===entry)entries.delete(key);throw error});
   entry.pending=pending;entries.set(key,entry);return pending;
  }
 };
}
export function accountChanged(previous,next){return previous!==next}
