# Bayt web

Arabic-first property website and workspace for Syria, built with Next.js App Router, React, TypeScript and Supabase. The Atelier design uses warm limestone, espresso, bronze, and the approved Syrian house mark. English is available from the header.

## Run locally

```sh
cd web
npm ci
cp .env.example .env.local
# Set the two public Supabase values in .env.local.
npm run dev
```

The current project URL and publishable application key are configured in `lib/supabase.ts` for this private review deployment. They are public application identifiers, not admin credentials. Override them with the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` environment variables when changing projects. Never put a secret key, database password or service-role key in browser code.

## Activate Supabase

The supplied project responds successfully, but the `public.listings` table did not exist at the initial check. This project contains a migration ready for the owner to run. It has NOT been applied to the remote database by this build.

1. Open the project's SQL Editor and run `supabase/001_initial.sql` once. It creates the schema, public property-photo bucket, authentication trigger, RLS policies and privileged RPCs in a transaction. It does not remove existing data.
2. In Authentication → URL Configuration, add the deployed Site origin as the Site URL and add `https://YOUR_SITE_ORIGIN/**` and `http://127.0.0.1:3000/**` as redirect allowlist entries. Keep email confirmation enabled. Configure production email delivery before launch.
3. Create your own Bayt account from the website and confirm the email.
4. Replace the placeholder email in `supabase/002_bootstrap_admin.sql` with YOUR registered email. Run it in the SQL Editor to assign the first administrator. Do not grant admin to customer accounts.
5. Return to Workspace, refresh and sign in. Use People to grant agent access. Use Offices & team to create offices and assign members.
6. An agent can add a listing with photos. An admin approves it. The published listing becomes available in property search. A signed-in customer can save it and send an inquiry. The assigned agent can update its status and add internal notes.

Business access is never accepted from sign-up metadata. All new accounts start with the customer role. Admins can grant agent/admin roles and suspend accounts; office managers can read their office's listings/team and assign leads to active agents in the same office. Agents can update their listings; editing property details returns them to pending review. Public reads only return published and available listings. Internal lead notes are not visible to customers.

Public property-photo URLs are intentionally readable without sign-in. Do NOT upload license documents or identity material to the `listing-images` bucket. Photo replacement uploads a new immutable object instead of overwriting an approved photo. Storage bucket constraints enforce image MIME types and a 5 MB file limit. Failed submissions can leave unused uploaded photo objects; cleanup and media moderation should be added before general launch.

## Included now

- Public homepage, information page, property browsing, filters, property details and image gallery.
- Arabic RTL and English LTR layouts.
- Email/password registration, email confirmation flow, sign-in, reset-password flow and profile editing.
- Saved properties and customer inquiries.
- Admin listing moderation with required rejection reasons and review history.
- Agent listing creation/editing, image uploads, availability status, inquiry status and internal notes.
- Office/team management, agent access assignment, office verification, office lead assignment and CSV export.
- Location management and account suspension.
- Explicit, isolated local demo mode. Demo actions never send mutations to Supabase.
- Draft privacy/terms pages clearly marked for review.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

The security suite uses a local PostgreSQL runtime (PGlite) to execute the actual migration with simulated Supabase auth/storage schemas. It verifies signup permissions, RLS isolation, approval authorization, review history, reapproval, uploads, suspension and office lead assignment. Passing local tests does not replace verification against the actual Supabase project after the owner applies the migration.

The private review deployment uses Next.js static export (`out/`). Authentication and data access run against Supabase directly with RLS; admin operations use database RPCs rather than a browser-held service credential. No Next.js server runtime is needed for this first version. The source can move to a Next.js server deployment when server integrations are added.

## Review limits and next steps

Remote schema installation and first-admin bootstrap are pending owner action. Real authenticated workflows, email redirects and Storage behavior must be verified on the configured remote project afterwards. The browser preview was verified at the available desktop viewport; automated viewport resizing was not honored by the in-app browser, so phone-sized visual QA remains outstanding. Responsive CSS is included.

This is a private first-release review build, not a public launch. No actual listings, testimonial claims or market statistics were invented. Homepage examples, prices and generated property imagery are labeled as illustrative. Native iPhone/Android apps are a later deliverable and are not implemented here. WhatsApp integration, push notifications, verification documents, maps, payments, subscriptions and developer projects are not included. Terms/privacy require a real operator identity, contact details, retention policy and review before public launch. Search engines are disabled for this review build.

Generated concept imagery was created using the built-in image generation tool and saved in `public/images/` as compressed JPEGs. Prompt briefs: (1) a restored Damascene courtyard with limestone, basalt doorway, fountain and citrus tree; (2) a warm contemporary Damascus apartment living room with walnut and subtle Syrian craft details. These images do not represent actual properties. The logo is an editable vector adaptation of the user-approved Syrian house concept in `public/logo.svg`; `public/icon.svg` is the app-style variant.

Browser QA checked Arabic/English switching, the dashboard preview, sample admin approval (pending count decreases and published state updates), and a sample customer inquiry appearing in dashboard leads. No test accounts or live property data were created in Supabase.

### Password recovery

Reset requests now redirect to `/?auth=recovery`, without an application fragment. Supabase reserves the fragment for its access/refresh tokens. Legacy emails with `#dashboard#access_token=…` are normalized before creating the auth client. The app captures recovery intent before Supabase consumes the URL, waits for initialization, and opens the new-password form only when a session is available. Explicit callback errors and failed initialization cannot fall back to an unrelated existing session. The form requires a matching confirmation password. Callback credentials and errors are removed from the address bar after processing.

After updating the app, request a fresh password-reset email and use its latest link. The local origin (including the correct port) and the deployed origin must be in Supabase Authentication → URL Configuration → Redirect URLs. Example development entries: `http://127.0.0.1:3000/**` and `http://localhost:3000/**`. Production must use the actual deployment origin. Recovery regression checks: `node --test tests/auth-return.test.mjs`. No user's password or live recovery link is used by these tests.

### Property responsibility and dashboard scope

Public browsing and business workspace results are now separate. Public search shows approved, available listings. Admins see every property in their workspace; agents see only rows where `agent_user_id` is their account; office managers see rows belonging to offices they actively manage. All property totals, status tabs and latest-property lists use the same workspace scope.

When creating or editing a property, admins must select an active user with the agent role. The optional office selector contains only active offices where that agent has an active membership. Agents creating properties are assigned as the responsible agent automatically; non-admin edits cannot transfer ownership. Existing admin-owned properties are preserved and can be reassigned using Admin → Properties → Review → Edit details. Saving edited details sends the listing to review, so approve it again when ready. New inquiries go to the property's current agent. Existing inquiries retain their assigned agent until separately reassigned from Inquiries. No database migration is needed for these changes.

Regression checks cover role-scoped counts and lists, exclusion of unrelated public listings, active agent selection, office memberships, and admin assignment/reassignment against the actual RLS migration. Browser QA used isolated demo records, not live properties.

### Workspace layout and loading

Successful sign-in opens the workspace with a fixed desktop sidebar and no public header or footer. The sidebar includes account controls, language switching and a link to the public website. On mobile it becomes a keyboard-accessible drawer that closes after navigation.

Account requests run concurrently and recent results are reused in memory for 30 seconds. Same-account session events do not reset the current panel. Manual refresh and successful mutations invalidate cached data; account changes and logout clear it. Cached workspace data is never persisted to disk. First visits still require authentication and network requests; development-mode compilation can also add startup time. Production builds avoid that compilation delay.

Validation: 50 regression tests, TypeScript checks and production export pass. Desktop and mobile demo checks confirm the workspace shell, drawer navigation and no horizontal overflow at 390px.

### Account identity and memberships

The sidebar profile opens My account. A read-only Roles & offices section separates platform roles from office team roles and shows account status, office memberships (including inactive ones), membership status, office verification and office status when accessible. Agents without memberships are labeled independent. Ordinary agents request office details only for their own membership IDs; existing RLS remains unchanged. If RLS hides office details, the recorded membership still appears with an unavailable-details note. Role and membership changes remain administrator-controlled. No SQL migration is required.

Office-manager workspace visibility is additive: personally assigned properties remain visible alongside properties in actively managed offices. A manager's personal rejected listing without an office is no longer hidden by the office filter. Public approval/availability rules and database access policies remain unchanged. Regression checks cover combined roles, rejected personal listings and deduplication.

### Sent and received inquiries

Inquiries now separate read-only My sent inquiries from Received inquiries (all received inquiries for admins). Business status alone does not enable follow-up: the current user must be the assigned agent, an active manager of the property's active office, or an active admin. Sent-view details never fetch internal notes and do not show editing or reassignment controls. Property labels and exports use all accessible listing records, independently of workspace ownership filters. Unavailable property records retain a generic label. Reassignment is limited to office inquiries and eligible active agents; inaccessible current-agent profiles get a nonblank fallback. Existing database policies/RPC checks remain unchanged; no SQL migration required.

Inquiry details now use a responsive property-and-contact layout: listing photos with thumbnails, price/rental period, location, property facts and full-property navigation; sender name, supplied phone, submission time, message and existing permission-scoped follow-up. Initials represent the sender because no profile-photo field exists. Missing photos/contact data/property access have explicit fallbacks. Browser QA verifies full-property navigation, English/Arabic and a single-column mobile layout without horizontal overflow.

My account has a simplified profile layout with initials, name/email, personal information form and compact office/team summary. Platform role badges and instructional paragraphs are no longer displayed. Role authorization is unchanged. The office summary retains team position and verified-office indicator, with inactive memberships and suspended offices labeled. Checked English/Arabic and mobile layout; production export passes.

Offices & team now uses a compact office directory, office/team/verification totals, selectable office team filtering, and a membership table with office-scoped property counts. Create-office and membership forms open on demand and focus their first field. Existing admin mutations and office-manager read access are preserved. Browser QA checks office selection, membership form, English/Arabic and mobile without horizontal overflow; production export passes.

People now uses a compact directory with name/phone search, account-status filtering, summary counts and aligned access/status columns. Manage expands account-specific permissions and suspension controls; existing RPCs, self-protection and disabled demo actions are preserved. Browser QA covers search, empty filtered results, management expansion and English/Arabic mobile layout; production export passes.

### Office staff and workspace scope

Apply `supabase/003_office_staff.sql` in the hosted Supabase SQL Editor after the initial migration. It is idempotent and preserves existing memberships/Agent roles. New membership positions are Office agent (existing `agent` value), Office manager and Office staff (`staff`). Membership never grants the platform Agent role. New memberships default to Office staff; office-agent assignment requires existing Agent access in the UI. Switching an existing agent to staff does not silently revoke Agent access; remove that separate permission through People if a staff-only account is intended.

Office staff have an assigned-inquiry queue, may update those inquiry statuses/internal notes, and may read the linked property. They cannot submit/edit listings, view unrelated office leads, reassign inquiries or manage the office. Follow-up access is lost when staff membership/account/office is inactive. Admins/office managers may assign office inquiries to active staff without Agent access. SQL policies enforce this independently of UI. No additional access is granted before the migration is run.

Users with both Agent access and an active office-manager membership can switch My workspace (personal property/inquiry assignments) and Office workspace (managed-office inventory/inquiries). Managers without Agent access use Office workspace; ordinary office agents retain personal scope. Admins retain platform-wide scope. Regression validation: 63 tests including real PostgreSQL-policy execution via PGlite, staff assignment and write denial, unrelated lead isolation, membership suspension and rerunnable migration. Browser checks cover staff queue/navigation and personal-versus-office switch.

Email confirmation callbacks are now distinct from password recovery. Signup/email token types take priority over a stale redirect marker; failed or unknown email links open sign-in with confirmation/generic guidance instead of reset-password errors. Successful confirmation requires incoming credentials, successful client initialization and a confirmed session. Sign-in includes an explicit resend-signup-confirmation action using the current origin's signup callback. No email was sent or live user link consumed during QA. Supabase redirect allowlist still needs both the local and deployed origins.

Confirmation errors now retain both translations and render using the current React language, avoiding cold-start localStorage/language races. Expired signup callbacks open a dedicated email-only confirmation form; sign-in links to it through Resend confirmation email. The form submits Supabase resend(type=signup), provides rate-limit guidance and does not require a password. Browser QA verified English error copy, resend button and zero password fields using a synthetic expired callback; no live email was sent.

### Scoped user management setup

1. Apply `supabase/004_user_management.sql` after migrations 001 and 003 in Supabase SQL Editor. Existing users are preserved.
2. Deploy the invitation Edge Function (Supabase CLI from this `web` directory):
   `supabase functions deploy manage-user-invite --project-ref zzhzrzgdtiijhozpebap`
   Keep the platform JWT verification enabled. The handler also verifies each bearer token with Supabase Auth and checks the caller’s office permissions.
3. Configure function secret `BAYT_ALLOWED_ORIGINS` as a comma-separated list of exact app origins, for example `http://127.0.0.1:3000,http://localhost:3000,https://bayt-marketplace-mvp-1025.lemonyreed.chatgpt.site`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside Edge Functions; never put a service key in browser environment variables.
4. Add app origins to Authentication redirect URLs and configure a production email provider. Invitations send real emails only when the user submits Create & send invitation.

Admins can invite new users, edit profile details and memberships, and archive users (suspension plus an archive timestamp, preserving property/inquiry history). Active work must be reassigned before archiving. Managers see only offices they actively manage and those teams; they can invite staff/agents into those offices, edit eligible team contacts and memberships, and remove a membership by suspending it. They cannot delete global accounts, edit admins/managers, promote managers, change unrelated offices, or edit shared account details affecting other active offices. Those changes require platform administration. Invitations never grant administrator access. Membership alone never grants Agent access; an explicit new-agent invitation does so during protected server-side provisioning.

Create-user invitations require the deployed Edge Function. Migration and Edge Function deployment were prepared and tested locally but cannot be applied to hosted Supabase from the current public-key-only connection. If an invitation sends but membership provisioning fails, the UI reports the partial outcome; the new account keeps only its default customer access and needs admin membership setup. Invited users use the invitation link to set their own password. Existing accounts are edited through their profile/membership controls, not recreated through invitations.

Office managers now manage members directly in Offices & team; the global People navigation and page are admin-only. Add member opens an office-scoped invitation form. Each eligible team row has Edit and Remove actions tied to that membership's office. Removing from this view suspends only that office membership, including when performed by an admin; account archival remains on the admin People page. Existing migration 004 and the invitation Edge Function are still required; this UI relocation does not need a new migration.
