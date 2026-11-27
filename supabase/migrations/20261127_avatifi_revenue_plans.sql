-- Revenue "新規の見込み" storage (preview). Safe to re-run.

create table if not exists revenue_plans (
  ym text primary key,
  plan_new numeric,
  updated_at timestamptz,
  updated_by text
);

grant select, insert, update, delete on table revenue_plans to anon, authenticated, service_role;
