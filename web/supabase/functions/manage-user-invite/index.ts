import {createClient} from 'npm:@supabase/supabase-js@2';
import {createInviteHandler} from './handler.mjs';
Deno.serve(createInviteHandler({createClient,env:(key:string)=>Deno.env.get(key)}));
