-- Key/value settings bag for preview (sources, services, results, prices, costs, sales, company days).
-- Safe to re-run.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz,
  updated_by text
);

grant select, insert, update, delete on table app_settings to anon, authenticated, service_role;
