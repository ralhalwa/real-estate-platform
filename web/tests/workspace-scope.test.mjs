import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listingsForWorkspace,eligibleAgents,agentOfficeIds} from '../lib/workspace-scope.mjs';
const rows=[{id:'admin-created',agent_user_id:'admin',office_id:null,approval_status:'approved'},{id:'my-pending',agent_user_id:'ali',office_id:'office-a',approval_status:'pending'},{id:'my-live',agent_user_id:'ali',office_id:null,approval_status:'approved'},{id:'other-live',agent_user_id:'other',office_id:'office-b',approval_status:'approved'},{id:'office-team',agent_user_id:'teammate',office_id:'office-a',approval_status:'pending'}];
const ids=rows=>rows.map(l=>l.id);
test('agent dashboard excludes admin-owned and other agents published properties',()=>{const result=listingsForWorkspace(rows,{userId:'ali',roles:['agent'],memberships:[]});assert.deepEqual(ids(result),['my-pending','my-live']);assert.equal(result.length,2);assert.equal(result.filter(l=>l.approval_status==='pending').length,1)});
test('office managers see their managed offices only, including team pending listings',()=>{assert.deepEqual(ids(listingsForWorkspace(rows,{userId:'manager',roles:[],memberships:[{office_id:'office-a',office_role:'manager',membership_status:'active'}]})),['my-pending','office-team'])});
test('inactive office memberships do not broaden the workspace',()=>{assert.deepEqual(ids(listingsForWorkspace(rows,{userId:'ali',roles:['agent'],memberships:[{office_id:'office-b',office_role:'manager',membership_status:'suspended'}]})),['my-pending','my-live'])});
test('admin sees every property including legacy admin-created records',()=>{assert.deepEqual(listingsForWorkspace(rows,{userId:'admin',roles:['admin'],memberships:[]}),rows)});
test('customer and signed-out business scopes are empty',()=>{for(const userId of ['customer',null])assert.deepEqual(listingsForWorkspace(rows,{userId,roles:[],memberships:[]}),[])});
test('workspace filtering does not mutate public listing results',()=>{listingsForWorkspace(rows,{userId:'ali',roles:['agent'],memberships:[]});assert.deepEqual(ids(rows.filter(l=>l.approval_status==='approved')),['admin-created','my-live','other-live'])});
test('assignment options include active agents only, never admins or customers by default',()=>{const profiles=[{id:'admin',account_status:'active'},{id:'ali',account_status:'active'},{id:'customer',account_status:'active'},{id:'suspended',account_status:'suspended'}];const roles=[{user_id:'admin',role:'admin'},{user_id:'ali',role:'agent'},{user_id:'suspended',role:'agent'}];assert.deepEqual(eligibleAgents(profiles,roles).map(p=>p.id),['ali'])});
test('office options are limited to the selected agent active memberships',()=>{assert.deepEqual(agentOfficeIds('ali',[{user_id:'ali',office_id:'a',membership_status:'active'},{user_id:'ali',office_id:'b',membership_status:'suspended'},{user_id:'other',office_id:'c',membership_status:'active'}]),['a'])});
test('reassignment moves dashboard ownership without changing public visibility',()=>{const property={id:'reassign',agent_user_id:'first',office_id:null,approval_status:'approved'};const scope=id=>({userId:id,roles:['agent'],memberships:[]});assert.equal(listingsForWorkspace([property],scope('first')).length,1);const reassigned={...property,agent_user_id:'second'};assert.equal(listingsForWorkspace([reassigned],scope('first')).length,0);assert.equal(listingsForWorkspace([reassigned],scope('second')).length,1);assert.equal(reassigned.approval_status,'approved')});

test('office manager retains personally assigned rejected listings outside their office',()=>{
 const own={id:'own-rejected',agent_user_id:'ali',office_id:null,approval_status:'rejected'};
 const memberships=[{office_id:'office-a',office_role:'manager',membership_status:'active'}];
 for(const roles of [[],['agent']])assert.deepEqual(ids(listingsForWorkspace([...rows,own],{userId:'ali',roles,memberships})),['my-pending','my-live','office-team','own-rejected']);
});
test('a property assigned personally and to a managed office appears only once',()=>{
 assert.deepEqual(ids(listingsForWorkspace(rows,{userId:'ali',roles:['agent'],memberships:[{office_id:'office-a',office_role:'manager',membership_status:'active'}]})),['my-pending','my-live','office-team']);
});

test('dual-role workspace switch separates personal assignments from office inventory',()=>{const base={userId:'ali',roles:['agent'],memberships:[{office_id:'office-a',office_role:'manager',membership_status:'active'}]};assert.deepEqual(ids(listingsForWorkspace(rows,{...base,mode:'personal'})),['my-pending','my-live']);assert.deepEqual(ids(listingsForWorkspace(rows,{...base,mode:'office'})),['my-pending','office-team'])});
test('office staff membership grants no listing workspace',()=>assert.deepEqual(listingsForWorkspace(rows,{userId:'ali',roles:['customer'],memberships:[{office_id:'office-a',office_role:'staff',membership_status:'active'}]}),[]));
