import type {SupabaseClient} from '@supabase/supabase-js';
import type {Listing,Person,Lead,Office,OfficeMember} from './model';
import {officeDirectory} from './office-directory.mjs';
import {createRequestCache} from './request-cache.mjs';
export type WorkspaceSnapshot={listings:Listing[];profile:Person|null;roles:string[];members:OfficeMember[];favorites:string[];leads:Lead[];people:Person[];offices:Office[];allRoles:{user_id:string;role:string}[];allMembers:OfficeMember[];locations:{id:string;name:string;enabled:boolean}[]};
export const workspaceRequests=createRequestCache();
export async function fetchWorkspace(client:SupabaseClient,userId:string|null):Promise<WorkspaceSnapshot>{
 const snapshot:WorkspaceSnapshot={listings:[],profile:null,roles:[],members:[],favorites:[],leads:[],people:[],offices:[],allRoles:[],allMembers:[],locations:[]};
 const listingQuery=client.from('listings').select('*').order('created_at',{ascending:false});
 if(!userId){const {data,error}=await listingQuery;if(error)throw error;return {...snapshot,listings:data||[]}}
 // These requests do not depend on one another: do not wait for listings first.
 const [listings,p,r,m,f,l]=await Promise.all([listingQuery,client.from('profiles').select('*').eq('id',userId).single(),client.from('user_roles').select('*').eq('user_id',userId),client.from('office_members').select('*').eq('user_id',userId),client.from('favorites').select('listing_id').eq('user_id',userId),client.from('leads').select('*').order('created_at',{ascending:false})]);
 for(const result of [listings,p,r,m,f,l])if(result.error)throw result.error;
 Object.assign(snapshot,{listings:listings.data||[],profile:p.data,roles:r.data?.map(x=>x.role)||[],members:m.data||[],favorites:f.data?.map(x=>x.listing_id)||[],leads:l.data||[]});
 if(snapshot.roles.includes('admin')||snapshot.members.some(x=>x.office_role==='manager'&&x.membership_status==='active')){
  const officeQuery=snapshot.roles.includes('admin')?client.from('offices').select('*'):client.from('offices').select('*').in('id',snapshot.members.filter(m=>m.office_role==='manager'&&m.membership_status==='active').map(m=>m.office_id));
  const [pp,oo,rr,mm,loc]=await Promise.all([client.from('profiles').select('*'),officeQuery,client.from('user_roles').select('*'),client.from('office_members').select('*'),client.from('locations').select('*').order('name')]);
  for(const result of [pp,oo,rr,mm,loc])if(result.error)throw result.error;
  const directory=officeDirectory({offices:oo.data||[],people:pp.data||[],members:mm.data||[],userId,admin:snapshot.roles.includes('admin')});
  Object.assign(snapshot,{people:directory.people.filter((p:Person&{archived_at?:string|null})=>!p.archived_at),offices:directory.offices,allRoles:rr.data||[],allMembers:directory.members,locations:loc.data||[]});
 }
 else if(snapshot.members.length){
  const {data,error}=await client.from('offices').select('*').in('id',[...new Set(snapshot.members.map(m=>m.office_id))]);
  if(error)throw error;
  snapshot.offices=data||[];
 }
 return snapshot;
}
