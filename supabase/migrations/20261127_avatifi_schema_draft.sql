-- Avatifi CRM — Supabase/Postgres schema DRAFT
-- Source: 営業.gs CRM_*_FIELDS (pack 20261125)
-- Status: DRAFT — do not apply to production; refine after spreadsheet export
-- Generated: 2026-11-27

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  roles text[] not null default '{}',
  active boolean not null default true,
  passphrase_hash text,
  key_issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists history_logs (
  id bigserial primary key,
  actor text,
  action text,
  target text,
  items jsonb,
  created_at timestamptz not null default now()
);

create table if not exists holidays (
  day date primary key
);

create table if not exists payment_rules (
  id bigserial primary key,
  method text not null,
  settle_from text,
  settle_to text,
  deposit_months_later int,
  deposit_day text,
  week_close text,
  days_after_close int,
  holiday_policy text,
  min_transfer numeric,
  note text
);

create table if not exists kpi_targets (
  id bigserial primary key,
  ym text not null,
  person text not null default '',
  route text not null default '',
  apo numeric,
  seat numeric,
  contract_count numeric,
  amount numeric,
  seminar numeric,
  valid_deal numeric,
  unique (ym, person, route)
);

create table if not exists payments (
  id bigserial primary key,
  pay_key text unique,
  customer text,
  method text,
  amount numeric,
  charge_date date,
  due_date date,
  due_override date,
  paid_at date,
  status text,
  memo text,
  updated_at timestamptz,
  updated_by text
);

create table if not exists fee_payouts (
  id bigserial primary key,
  pay_month text not null,
  agency text not null,
  adjust_incl_tax numeric,
  paid_incl_tax numeric,
  paid_on date,
  memo text,
  updated_at timestamptz,
  updated_by text,
  unique (pay_month, agency)
);

create table if not exists deals (
  id text primary key,
  stage text,
  lead_date date,
  name text,
  company text,
  industry text,
  channel text,
  email text,
  sns text,
  followers numeric,
  source text,
  source_detail text,
  lead_owner text,
  apo_owner text,
  apo_date date,
  sent_text text,
  reply_text text,
  proposal text,
  closer text,
  meet_plan date,
  meet_date date,
  result text,
  reason text,
  next_date date,
  hearing text,
  memo text,
  won_service text,
  won_init numeric,
  won_fee numeric,
  won_date date,
  customer text,
  result_date text,
  title text,
  business text,
  background text,
  updated_at timestamptz,
  updated_by text
);
comment on table deals is '商談 / entity=deal';

create table if not exists campaigns (
  id text primary key,
  name text,
  kind text,
  theme text,
  date date,
  time text,
  format text,
  state text,
  partner text,
  speaker text,
  pm text,
  place text,
  fee text,
  entry text,
  planned text,
  schedule text,
  image text,
  memo text,
  imported text,
  goal_people numeric,
  goal_apo numeric,
  goal_won numeric,
  goal_amount numeric,
  material text,
  banner text,
  updated_at timestamptz,
  updated_by text
);
comment on table campaigns is '施策 / entity=camp';

create table if not exists people (
  id text primary key,
  camp text,
  camp_name text,
  company text,
  name text,
  title text,
  background text,
  business text,
  state text,
  staff text,
  deal text,
  memo text,
  updated_at timestamptz,
  updated_by text
);
comment on table people is '参加者 / entity=people';

create table if not exists cards (
  id text primary key,
  date date,
  company text,
  name text,
  title text,
  email text,
  phone text,
  address text,
  url text,
  place text,
  owner text,
  memo text,
  photo text,
  ocr text,
  deal text,
  updated_at timestamptz,
  updated_by text
);
comment on table cards is '名刺 / entity=card';

create table if not exists agencies (
  name text primary key,
  "start" date,
  state text,
  "end" date,
  owner text,
  contact text,
  memo text,
  fee_rule text,
  kind text,
  relation text,
  mtg date,
  imported text,
  updated_at timestamptz,
  updated_by text
);
comment on table agencies is '代理店 / entity=agency';

create table if not exists customers (
  name text primary key,
  company text,
  kana text,
  industry text,
  service text,
  kind text,
  plan text,
  auto text,
  plan_name text,
  state text,
  contract date,
  "end" date,
  notice date,
  "start" date,
  sales text,
  cs text,
  materials text,
  agency text,
  source text,
  deal text,
  init numeric,
  init_pay text,
  paid date,
  fee numeric,
  fee_pay text,
  first_charge date,
  autopay text,
  gform text,
  csheet text,
  csite text,
  email text,
  contact text,
  avatar text,
  voice_id text,
  voice text,
  menu text,
  howto text,
  target text,
  ng text,
  yomi text,
  post text,
  folder text,
  last_req text,
  idle text,
  sales_memo text,
  updated_at timestamptz,
  updated_by text
);
comment on table customers is '顧客 / entity=cust';

create table if not exists requests (
  id text primary key,
  received text,
  cust text,
  type text,
  theme text,
  sales text,
  folder text,
  status text,
  waiting text,
  status_date text,
  ready text,
  ok text,
  due text,
  wait_days text,
  revisions text,
  count text,
  delivered text,
  memo text,
  voice text,
  make text,
  est_usd text,
  est_cr text,
  act_usd text,
  act_el text,
  updated_at timestamptz,
  updated_by text
);
comment on table requests is '依頼 / entity=req';

create table if not exists tasks (
  id text primary key,
  title text,
  person text,
  due date,
  memo text,
  ref_kind text,
  ref_key text,
  done text,
  done_at date,
  created_by text,
  updated_at timestamptz,
  updated_by text
);
comment on table tasks is 'タスク / entity=task';

create index if not exists customers_name_idx on customers (name);
create index if not exists deals_lead_date_idx on deals (lead_date);
create index if not exists deals_source_idx on deals (source, source_detail);
create index if not exists payments_due_date_idx on payments (due_date);
create index if not exists requests_status_idx on requests (status);
create index if not exists tasks_person_idx on tasks (person);
create index if not exists fee_payouts_month_agency_idx on fee_payouts (pay_month, agency);

-- RLS: enable after auth model is locked with boss/client
-- alter table deals enable row level security;
