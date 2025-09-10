Supabase Team Notes (Multi-tenant demo)

A tiny app to exercise Supabase end-to-end and demonstrate a multi-tenant pattern with Row Level Security (RLS).

What this showcases

Auth: magic link sign-in (local email via Inbucket)
Database: orgs, memberships, notes, attachments tables
Security: RLS policies using org membership (USING + WITH CHECK)
Realtime: live updates on notes via postgres_changes
Storage: private bucket “attachments” with org-scoped access and signed URLs
Edge Functions: Deno function that forwards the caller’s JWT so RLS applies server-side
Migrations: schema + policies committed to supabase/migrations for reproducible setup
Tech stack

Next.js (App Router, src/app/page.tsx), TypeScript
Supabase: Postgres, Auth, Realtime, Storage, Edge Functions
Supabase CLI for local dev (Docker)
Quickstart (local)

Prereqs: Docker Desktop running, Node 18+, Supabase CLI
Start services:
supabase start
Apply DB schema/policies:
supabase db push
Env (client):
cp .env.example .env.local
Fill values from supabase status (API URL + anon key)
Run the app:
npm i && npm run dev → http://localhost:3000
Local email inbox (magic links): http://localhost:54324 (Inbucket)
Edge function (new terminal):
Create supabase/functions/.env with:
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=YOUR_LOCAL_ANON_KEY
supabase functions serve --env-file supabase/functions/.env
Schema & security

Migrations: supabase/migrations/0001_init.sql
Tables: orgs, memberships, notes, attachments (+ profiles optional)
Helper: public.is_org_member(org uuid) → checks membership via auth.uid()
Policies:
orgs/memberships: users read only orgs they belong to
notes: members can CRUD notes in their org
attachments: storage.objects policies enforce org/{orgId}/filename path + membership
Directory structure

src/app/page.tsx ← UI (sign-in, orgs, notes, realtime, storage, function)
src/lib/supabaseClient.ts ← supabase-js client
supabase/migrations/0001_init.sql ← schema + RLS + storage policies
supabase/functions/digest/ ← Edge Function (JWT-forwarding example)
NPM scripts (add as needed)

dev: next dev
build: next build
start: next start
sb:start: supabase start
sb:push: supabase db push
sb:reset: supabase db reset
sb:functions: supabase functions serve --env-file supabase/functions/.env
Troubleshooting

RLS “permission denied”: check WITH CHECK clauses (e.g., author_id = auth.uid()) and membership rows exist.
Storage 401: ensure you’re signed in; object path must be org/{orgId}/...; confirm storage schema initialized (supabase stop && supabase start).
Realtime not firing: verify channel filter matches org_id exactly; ensure subscription is active.
Reset local DB: supabase db reset (wipes local data, reapplies migrations).
