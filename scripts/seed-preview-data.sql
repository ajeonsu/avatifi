-- Preview seed for Avatifi CRM (safe to re-run).
-- Passphrase for preview user: avatifi-preview-key-2026-ok (≥20 chars)
-- Hash = SHA-256 hex of that passphrase.

insert into app_users (name, roles, active, passphrase_hash, key_issued_at)
values (
  'preview',
  array['管理','FS']::text[],
  true,
  '53c6462e12fd60273a566b2f90aa1ff7b4d645333b64c6f9c7a829a6bbadd90d',
  now()
)
on conflict (name) do update set
  roles = excluded.roles,
  active = true,
  passphrase_hash = excluded.passphrase_hash;

insert into deals (id, stage, lead_date, name, company, industry, channel, email, source, lead_owner, apo_owner, apo_date, closer, meet_plan, result, updated_at, updated_by)
values
  ('S00001', 'アポ', '2026-11-01', '山田 太郎', '見本商事', '小売', 'メール', 'demo@example.com', '紹介', 'preview', 'preview', '2026-11-05', 'preview', '2026-11-12', null, now(), 'preview'),
  ('S00002', '見込み', '2026-10-15', '佐藤 花子', 'サンプル美容院', '美容', 'LINE', null, '施策', 'preview', 'preview', '2026-10-20', 'preview', '2026-10-25', '見込みB', now(), 'preview')
on conflict (id) do update set
  stage = excluded.stage,
  result = excluded.result,
  updated_at = now();

insert into customers (name, company, service, state, sales, updated_at, updated_by)
values
  ('見本商事', '見本商事', 'アバター', '契約中', 'preview', now(), 'preview'),
  ('サンプル美容院', 'サンプル美容院', '自動編集', '契約中', 'preview', now(), 'preview')
on conflict (name) do update set service = excluded.service, state = excluded.state;

insert into requests (id, received, cust, type, theme, status, waiting, make, updated_at, updated_by)
values
  ('見本商事-001', '2026-11-10', '見本商事', '⑦ お知らせ・告知型', '秋の告知', '制作中', '制作', 'アバター', now(), 'preview')
on conflict (id) do update set status = excluded.status;

insert into campaigns (id, name, kind, date, state, updated_at, updated_by)
values
  ('E0001', '見本セミナー', 'セミナー', '2026-10-01', '開催済み', now(), 'preview')
on conflict (id) do update set name = excluded.name;

insert into agencies (name, state, kind, updated_at, updated_by)
values
  ('見本代理店', '契約中', '紹介', now(), 'preview')
on conflict (name) do update set state = excluded.state;

insert into tasks (id, title, person, due, memo, done, created_by, updated_at, updated_by)
values
  ('T00001', '見本フォロー', 'preview', '2026-11-28', '', null, 'preview', now(), 'preview')
on conflict (id) do update set title = excluded.title, person = excluded.person;

insert into payments (pay_key, customer, method, amount, due_date, status, memo, updated_at, updated_by)
values
  ('見本商事|初期|1', '見本商事', 'マネフォ', 120000, '2026-11-30', 'open', 'preview seed', now(), 'preview')
on conflict (pay_key) do update set amount = excluded.amount, due_date = excluded.due_date;

insert into payment_rules (method, note)
select 'マネフォ', '1〜15日決済→当月末'
where not exists (select 1 from payment_rules where method = 'マネフォ');

-- People / cards for people→deal and card→deal demos
insert into people (id, camp, camp_name, name, company, title, staff, deal, updated_at, updated_by)
values
  ('P00001', 'E0001', '見本セミナー', '参加者 一郎', '見本商事', '部長', 'preview', null, now(), 'preview'),
  ('P00002', 'E0001', '見本セミナー', '参加者 二郎', 'サンプル美容院', '店長', 'preview', null, now(), 'preview')
on conflict (id) do update set
  camp = excluded.camp,
  camp_name = excluded.camp_name,
  name = excluded.name,
  company = excluded.company,
  deal = excluded.deal,
  updated_at = now();

insert into cards (id, date, place, owner, name, company, title, email, deal, ocr, updated_at, updated_by)
values
  ('N00001', '2026-11-20', '見本セミナー', 'preview', '名刺 太郎', 'カード商事', '代表', 'card@example.com', null, 'preview seed', now(), 'preview'),
  ('N00002', '2026-11-21', null, 'preview', '名刺 花子', 'カード美容', 'スタイリスト', null, null, 'preview seed', now(), 'preview')
on conflict (id) do update set
  name = excluded.name,
  company = excluded.company,
  deal = excluded.deal,
  updated_at = now();
