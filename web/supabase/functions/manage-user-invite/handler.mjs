export function createInviteHandler({createClient,env}){
// Keep JWT gateway verification enabled; verify the caller and authorization again below.
const allowed=(env('BAYT_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
return async req=>{
 const origin=req.headers.get('Origin')||'';
 const headers={'Content-Type':'application/json',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})};
 const respond=(status,data)=>new Response(JSON.stringify(data),{status,headers});
 if(!allowed.includes(origin))return respond(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}});
 if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
 try{
  const url=env('SUPABASE_URL');const admin=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,'');
  const {data:{user},error:authError}=await admin.auth.getUser(token);if(authError||!user)return respond(401,{error:'Sign in required'});
  const body=await req.json();const name=String(body.name||'').trim(),phone=String(body.phone||'').trim(),email=String(body.email||'').trim(),role=String(body.role||'staff'),office=body.office_id||null;
  if(name.length<2||name.length>160||phone.length>40||!/^\S+@\S+\.\S+$/.test(email)||!['staff','agent','manager','standard'].includes(role))return respond(400,{error:'Invalid invitation details'});
  const {data:profile}=await admin.from('profiles').select('account_status,archived_at').eq('id',user.id).single();
  if(profile?.account_status!=='active'||profile?.archived_at)return respond(403,{error:'Account unavailable'});
  const {data:adminRole}=await admin.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle();
  if(office){const {data:o}=await admin.from('offices').select('account_status').eq('id',office).single();if(o?.account_status!=='active')return respond(403,{error:'Office unavailable'})}
  if(!adminRole){
   if(!office||!['staff','agent'].includes(role))return respond(403,{error:'Office access denied'});
   const {data:member}=await admin.from('office_members').select('office_role,membership_status').eq('office_id',office).eq('user_id',user.id).maybeSingle();
   if(member?.office_role!=='manager'||member?.membership_status!=='active')return respond(403,{error:'Office access denied'});
  }
  if(!office&&['staff','manager'].includes(role))return respond(400,{error:'Select an office'});
  if(office&&role==='standard')return respond(400,{error:'Choose an office position, or select Independent account'});
  const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:name},redirectTo:new URL('/?auth=invite',origin).href});
  if(error)return respond(400,{error:error.message});
  const {error:setupError}=await admin.rpc('provision_invited_user',{p_actor:user.id,p_user_id:data.user.id,p_office_id:office,p_role:role,p_name:name,p_phone:phone});
  if(setupError)return respond(409,{error:'Invitation sent, but office setup failed. Ask a platform administrator to finish membership setup. No office access was granted.'});
  return respond(200,{ok:true});
 }catch{return respond(500,{error:'Could not invite this user. Please try again.'})}
};
}
