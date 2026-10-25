import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequestCache,accountChanged} from '../lib/request-cache.mjs';
import {fetchWorkspace} from '../lib/workspace-loader.ts';

test('same-account requests share one in-flight fetch and reuse fresh data',async()=>{
 const cache=createRequestCache();let calls=0;let finish;const fetcher=()=>{calls++;return new Promise(r=>finish=r)};
 const a=cache.fetch('ali',fetcher);const b=cache.fetch('ali',fetcher);await Promise.resolve();assert.equal(calls,1);finish({properties:2});assert.deepEqual(await a,{properties:2});assert.deepEqual(await b,{properties:2});await cache.fetch('ali',fetcher);assert.equal(calls,1);
});
test('stale snapshots are revalidated after the short freshness window',async()=>{
 let time=0,calls=0;const cache=createRequestCache({ttl:30,now:()=>time});const fetcher=async()=>++calls;
 assert.equal(await cache.fetch('ali',fetcher),1);time=20;assert.equal(await cache.fetch('ali',fetcher),1);time=31;assert.equal(await cache.fetch('ali',fetcher),2);
});
test('manual refresh and mutations bypass cached data',async()=>{
 const cache=createRequestCache();let source=1;await cache.fetch('ali',async()=>source);source=2;cache.invalidate('ali');assert.equal(await cache.fetch('ali',async()=>source),2);
});
test('an earlier request cannot overwrite a refresh after a mutation',async()=>{
 const cache=createRequestCache();let finish;const stale=cache.fetch('ali',()=>new Promise(r=>finish=r));await Promise.resolve();cache.invalidate('ali');assert.equal(await cache.fetch('ali',async()=>2),2);finish(1);await stale;assert.equal(await cache.fetch('ali',async()=>3),2);
});
test('sign-out clears private snapshots and discards pending results',async()=>{
 const cache=createRequestCache();let finish;const pending=cache.fetch('ali',()=>new Promise(r=>finish=r));await Promise.resolve();cache.clear();finish({private:'old'});await pending;assert.deepEqual(await cache.fetch('ali',async()=>({private:'new'})),{private:'new'});
});
test('different accounts cannot reuse one another snapshots',async()=>{
 const cache=createRequestCache();await cache.fetch('ali',async()=>({name:'Ali'}));assert.deepEqual(await cache.fetch('reem',async()=>({name:'Reem'})),{name:'Reem'});
});
test('failed requests can be retried instead of becoming cached failures',async()=>{
 const cache=createRequestCache();await assert.rejects(cache.fetch('ali',async()=>{throw Error('offline')}));assert.equal(await cache.fetch('ali',async()=>42),42);
});
test('token refresh and repeated sign-in events for the same ID do not reset workspace state',()=>{
 assert.equal(accountChanged('ali','ali'),false);assert.equal(accountChanged(null,null),false);assert.equal(accountChanged('ali','reem'),true);assert.equal(accountChanged('ali',null),true);assert.equal(accountChanged(undefined,'ali'),true);
});
function fakeClient(role='agent',delayListings=false,members=[]){
 const started=[];let release;const listingPromise=delayListings?new Promise(r=>release=r):Promise.resolve([{id:'property',agent_user_id:'ali'}]);
 return {started,release:()=>release?.([{id:'property',agent_user_id:'ali'}]),from(table){started.push(table);let filtered=false;let single=false;
  const q={select(){return q},eq(){filtered=true;return q},in(column,ids){started.push({table,column,ids});return q},single(){single=true;return q},order(){return q},then(resolve,reject){let result;
   if(table==='listings')return listingPromise.then(data=>resolve({data,error:null}),reject);
   if(table==='profiles')result=single?{id:'ali',full_name:'Ali',account_status:'active'}:[{id:'ali'}];
   else if(table==='user_roles')result=[{user_id:'ali',role}];
   else if(table==='office_members')result=members;
   else if(table==='favorites')result=[{listing_id:'property'}];
   else if(table==='leads')result=[{id:'lead'}];
   else if(table==='offices')result=[{id:'office'}];
   else if(table==='locations')result=[{id:'location',name:'دمشق',enabled:true}];
   return Promise.resolve({data:result,error:null}).then(resolve,reject);
  }};return q;
 }};
}
test('account/profile/favorite requests start before the listing request completes',async()=>{
 const client=fakeClient('agent',true);const request=fetchWorkspace(client,'ali');assert.deepEqual(client.started,['listings','profiles','user_roles','office_members','favorites','leads']);client.release();const snapshot=await request;assert.equal(snapshot.profile.full_name,'Ali');assert.deepEqual(snapshot.favorites,['property']);assert.equal(snapshot.listings.length,1);
});
test('ordinary agents do not fetch administrator collections',async()=>{
 const client=fakeClient();const snapshot=await fetchWorkspace(client,'ali');assert.equal(client.started.includes('offices'),false);assert.deepEqual(snapshot.people,[]);assert.deepEqual(snapshot.allRoles,[]);
});
test('admins load their additional collections after checking their role',async()=>{
 const client=fakeClient('admin');const snapshot=await fetchWorkspace(client,'ali');assert.equal(snapshot.people.length,1);assert.equal(snapshot.offices.length,1);assert.equal(client.started.length,11);
});
test('anonymous visits request only public listings and have no private account data',async()=>{
 const client=fakeClient();const snapshot=await fetchWorkspace(client,null);assert.deepEqual(client.started,['listings']);assert.equal(snapshot.profile,null);assert.deepEqual(snapshot.roles,[]);assert.deepEqual(snapshot.leads,[]);
});

test('agents with office memberships load only the assigned office IDs',async()=>{
 const client=fakeClient('agent',false,[{user_id:'ali',office_id:'office',office_role:'agent',membership_status:'active'},{user_id:'ali',office_id:'former-office',office_role:'agent',membership_status:'inactive'}]);
 const snapshot=await fetchWorkspace(client,'ali');assert.deepEqual(client.started.find(x=>typeof x==='object'),{table:'offices',column:'id',ids:['office','former-office']});assert.equal(snapshot.offices[0].id,'office');assert.equal(snapshot.members.length,2);assert.deepEqual(snapshot.people,[]);assert.deepEqual(snapshot.allRoles,[]);
});

test('office managers request only IDs of offices they actively manage',async()=>{const client=fakeClient('customer',false,[{user_id:'ali',office_id:'managed',office_role:'manager',membership_status:'active'},{user_id:'ali',office_id:'unrelated',office_role:'agent',membership_status:'active'}]);await fetchWorkspace(client,'ali');assert.deepEqual(client.started.find(x=>typeof x==='object'),{table:'offices',column:'id',ids:['managed']})});
