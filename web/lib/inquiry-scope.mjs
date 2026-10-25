export function canWorkInquiry(lead,{userId,admin,active,listings,members,offices,roles=['agent']}){
 if(!userId||!active)return false;
 if(admin)return true;
 if(lead.assigned_agent_user_id===userId&&roles.includes('agent'))return true;
 const officeId=listings.find(l=>l.id===lead.listing_id)?.office_id;
 if(lead.assigned_agent_user_id===userId&&!!officeId&&offices.some(o=>o.id===officeId&&o.account_status==='active')&&members.some(m=>m.user_id===userId&&m.office_id===officeId&&m.office_role==='staff'&&m.membership_status==='active'))return true;
 return !!officeId&&offices.some(o=>o.id===officeId&&o.account_status==='active')&&members.some(m=>m.user_id===userId&&m.office_id===officeId&&m.office_role==='manager'&&m.membership_status==='active');
}
export function inquiryAssignmentOptions(lead,{listings,people,roles,members}){
 const officeId=listings.find(l=>l.id===lead.listing_id)?.office_id;
 if(!officeId)return [];
 return people.filter(p=>p.account_status==='active'&&members.some(m=>m.office_id===officeId&&m.user_id===p.id&&m.membership_status==='active'&&(m.office_role==='staff'||roles.some(r=>r.user_id===p.id&&r.role==='agent'))));
}
