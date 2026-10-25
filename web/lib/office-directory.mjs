export function officeDirectory({offices,people,members,userId,admin}){
 if(admin)return {offices,people,members};
 const ids=new Set(members.filter(m=>m.user_id===userId&&m.office_role==='manager'&&m.membership_status==='active').filter(m=>offices.some(o=>o.id===m.office_id&&o.account_status==='active')).map(m=>m.office_id));
 const scopedMembers=members.filter(m=>ids.has(m.office_id));const users=new Set(scopedMembers.map(m=>m.user_id));
 return {offices:offices.filter(o=>ids.has(o.id)),people:people.filter(p=>users.has(p.id)),members:scopedMembers};
}
