/** Public visibility never implies ownership in a business workspace. */
export function listingsForWorkspace(listings,{userId,roles,memberships,mode='combined'}) {
 if(roles.includes('admin'))return listings;
 const officeIds=new Set(memberships.filter(m=>m.office_role==='manager'&&m.membership_status==='active').map(m=>m.office_id));
 if(mode==='personal')return userId&&roles.includes('agent')?listings.filter(l=>l.agent_user_id===userId):[];
 if(mode==='office')return listings.filter(l=>l.office_id&&officeIds.has(l.office_id));
 if(!userId||(!roles.includes('agent')&&!officeIds.size))return [];
 // Office management adds visibility; it must not replace personal assignments.
 return listings.filter(l=>l.agent_user_id===userId||(l.office_id&&officeIds.has(l.office_id))); 
}
export function eligibleAgents(profiles,roles) {
 const agentIds=new Set(roles.filter(r=>r.role==='agent').map(r=>r.user_id));
 return profiles.filter(p=>p.account_status==='active'&&agentIds.has(p.id));
}
export function agentOfficeIds(userId,memberships) {
 return memberships.filter(m=>m.user_id===userId&&m.membership_status==='active').map(m=>m.office_id);
}
