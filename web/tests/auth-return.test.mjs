import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectAuthReturn,authRedirect,cleanAuthReturn,resolveRecovery,resolveConfirmation,resolveInvitation} from '../lib/auth-return.mjs';

test('recovery redirects never put an application route in the token fragment',()=>{
 const url=new URL(authRedirect('http://127.0.0.1:3000','recovery'));
 assert.equal(url.pathname,'/');assert.equal(url.hash,'');assert.equal(url.searchParams.get('auth'),'recovery');
});
test('the exact legacy double-fragment shape is repaired before Supabase initialization',()=>{
 const original='http://127.0.0.1:3000/#dashboard#access_token=test-access&refresh_token=test-refresh&type=recovery&expires_in=3600';
 const result=inspectAuthReturn(original);const params=new URLSearchParams(new URL(result.normalizedUrl).hash.slice(1));
 assert.equal(params.get('access_token'),'test-access');assert.equal(params.get('refresh_token'),'test-refresh');assert.equal(params.get('type'),'recovery');assert.equal(result.recoveryRequested,true);assert.equal(result.hasCredentials,true);
});
test('standard token callbacks and query-based intent are detected',()=>{
 const r=inspectAuthReturn('https://example.com/?auth=recovery#access_token=a&refresh_token=r&type=recovery');assert.equal(r.recoveryRequested,true);assert.equal(r.hasCredentials,true);assert.equal(r.hasError,false);
});
test('regular hash navigation remains unchanged',()=>{
 for(const hash of ['dashboard','home','browse','about']){const url='https://example.com/#'+hash;const r=inspectAuthReturn(url);assert.equal(r.normalizedUrl,url);assert.equal(r.recoveryRequested,false);assert.equal(r.isAuthReturn,false);assert.equal(cleanAuthReturn(url),'/#'+hash)}
});
test('signup confirmation is never mistaken for password recovery',()=>{
 const r=inspectAuthReturn('https://example.com/?auth=signup#access_token=a&refresh_token=b&type=signup');assert.equal(r.recoveryRequested,false);assert.equal(r.isAuthReturn,true);
});
test('expired-link errors are recognized in modern and legacy URLs',()=>{
 for(const suffix of ['?auth=recovery#error=access_denied&error_code=otp_expired','#dashboard#error=access_denied&error_description=Expired']){assert.equal(inspectAuthReturn('https://example.com/'+suffix).hasError,true)}
});
test('credentials and callback errors are removed without dropping unrelated query parameters',()=>{
 assert.equal(cleanAuthReturn('https://example.com/?auth=recovery&source=email&code=test-code#access_token=a&refresh_token=b&type=recovery'),'/?source=email');
 assert.equal(cleanAuthReturn('https://example.com/?auth=recovery#error=access_denied&error_description=Expired'),'/');
});
test('cold-start recovery waits for initialization then reads the session',async()=>{
 const calls=[];let initialized=false;const client={async initialize(){calls.push('initialize');await Promise.resolve();initialized=true;return {error:null}},async getSession(){assert.ok(initialized);calls.push('getSession');return {data:{session:{user:{id:'test'}}},error:null}}};
 assert.deepEqual(await resolveRecovery(client,{hasError:false}),{ready:true});assert.deepEqual(calls,['initialize','getSession']);
});
test('failed recovery never accepts a previously signed-in account as a fallback',async()=>{
 let reads=0;const client={async initialize(){return {error:new Error('Invalid recovery token')}},async getSession(){reads++;return {data:{session:{user:{id:'existing-user'}}},error:null}}};
 assert.deepEqual(await resolveRecovery(client,{hasError:false}),{ready:false});assert.equal(reads,0);
});
test('an explicit callback error cannot unlock password changes',async()=>{
 const client={initialize(){throw Error('Must not initialize a failed link')}};assert.deepEqual(await resolveRecovery(client,{hasError:true}),{ready:false});
});
test('a link without a recovery session cannot unlock password changes',async()=>{
 const client={async initialize(){return {error:null}},async getSession(){return {data:{session:null},error:null}}};assert.deepEqual(await resolveRecovery(client,{hasError:false}),{ready:false});
});

test('confirmation errors remain confirmation callbacks, never recovery',()=>{const r=inspectAuthReturn('https://example.com/?auth=signup#error=access_denied&error_code=otp_expired');assert.equal(r.signupRequested,true);assert.equal(r.recoveryRequested,false)});
test('explicit signup token type overrides a stale recovery redirect',()=>{const r=inspectAuthReturn('https://example.com/?auth=recovery#access_token=a&refresh_token=b&type=signup');assert.equal(r.signupRequested,true);assert.equal(r.recoveryRequested,false)});
test('valid signup confirmation requires a confirmed session after initialization',async()=>{const client={async initialize(){return {error:null}},async getSession(){return {data:{session:{user:{email_confirmed_at:'2026-10-25'}}},error:null}}};assert.deepEqual(await resolveConfirmation(client,{signupRequested:true,hasCredentials:true,hasError:false}),{ready:true})});
test('failed or credential-free confirmation cannot claim success from an existing session',async()=>{const client={initialize(){throw Error('Must not use existing session')}};for(const incoming of [{signupRequested:true,hasCredentials:true,hasError:true},{signupRequested:true,hasCredentials:false},{signupRequested:false,hasCredentials:true}])assert.deepEqual(await resolveConfirmation(client,incoming),{ready:false})});

test('invitation is separate from recovery and requires incoming credentials',async()=>{const incoming=inspectAuthReturn('https://example.com/?auth=invite#access_token=a&refresh_token=b&type=invite');assert.equal(incoming.inviteRequested,true);assert.equal(incoming.recoveryRequested,false);assert.deepEqual(await resolveInvitation({initialize(){throw Error('Must not use existing session')}},{inviteRequested:true,hasCredentials:false}),{ready:false})});
