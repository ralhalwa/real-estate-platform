import { createClient } from '@supabase/supabase-js';
import {inspectAuthReturn} from './auth-return.mjs';
// Capture intent before Supabase consumes the callback, including during cold starts.
const incoming=typeof window==='undefined'?null:inspectAuthReturn(window.location.href);
if(incoming&&incoming.normalizedUrl!==window.location.href){
 window.history.replaceState(window.history.state,'',incoming.normalizedUrl);
}
export const authReturn={inviteRequested:incoming?.inviteRequested||false,signupRequested:incoming?.signupRequested||false,recoveryRequested:incoming?.recoveryRequested||false,hasCredentials:incoming?.hasCredentials||false,hasError:incoming?.hasError||false,isAuthReturn:incoming?.isAuthReturn||false};
// This is a public application key. All authorization is enforced by PostgreSQL RLS.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zzhzrzgdtiijhozpebap.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_eUiRSSNIpTKEdIci0OfeBw_LmRUNTfs';
export const supabase = createClient(url, key);
