-- Preview grants: allow PostgREST (anon/authenticated/service_role) to use CRM tables.
-- RLS remains deferred; passphrase auth stays in the Vercel API layer.
-- Safe to re-run.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
