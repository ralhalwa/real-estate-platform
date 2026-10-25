/** Keep auth callbacks separate from the application's hash-based navigation. */
export function inspectAuthReturn(href) {
 const url=new URL(href);
 const hash=url.hash.slice(1);
 // Compatibility with emails previously sent to /#dashboard#access_token=… .
 const separator=hash.lastIndexOf('#');
 const fragment=separator>=0?hash.slice(separator+1):hash;
 const params=new URLSearchParams(fragment);
 const authFragment=['access_token','refresh_token','error','error_code','error_description'].some(key=>params.has(key));
 const hasError=['error','error_code','error_description'].some(key=>params.has(key)||url.searchParams.has(key));
 const callbackType=params.get('type')||url.searchParams.get('type')||url.searchParams.get('auth');
 const inviteRequested=callbackType==='invite';
 const recoveryRequested=callbackType==='recovery';
 const signupRequested=callbackType==='signup'||callbackType==='email';
 const hasCredentials=!!(params.get('access_token')&&params.get('refresh_token'))||url.searchParams.has('code');
 if(separator>=0&&authFragment)url.hash=fragment;
 return {normalizedUrl:url.href,inviteRequested,signupRequested,recoveryRequested,hasCredentials,hasError,isAuthReturn:authFragment||url.searchParams.has('code')||url.searchParams.has('auth')};
}
export function authRedirect(origin,kind) {
 const url=new URL('/',origin);
 url.searchParams.set('auth',kind);
 return url.href;
}
export function cleanAuthReturn(href) {
 const url=new URL(href);
 for(const key of ['auth','code','error','error_code','error_description'])url.searchParams.delete(key);
 const info=inspectAuthReturn(href);
 if(info.isAuthReturn)url.hash='';
 return url.pathname+url.search+url.hash;
}
/** A failed incoming link must never fall back to an unrelated existing session. */
export async function resolveRecovery(client,incoming) {
 if(incoming.hasError)return {ready:false};
 const initialized=await client.initialize();
 if(initialized.error)return {ready:false};
 const {data,error}=await client.getSession();
 if(error||!data.session)return {ready:false};
 return {ready:true};
}

export async function resolveConfirmation(client,incoming){
 if(incoming.hasError||!incoming.signupRequested||!incoming.hasCredentials)return {ready:false};
 const initialized=await client.initialize();if(initialized.error)return {ready:false};
 const {data,error}=await client.getSession();
 return {ready:!error&&!!data.session?.user?.email_confirmed_at};
}

export async function resolveInvitation(client,incoming){if(!incoming.inviteRequested||!incoming.hasCredentials||incoming.hasError)return {ready:false};return resolveRecovery(client,incoming)}
