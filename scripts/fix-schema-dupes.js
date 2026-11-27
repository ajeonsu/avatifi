const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'supabase', 'migrations', '20261127_avatifi_schema_draft.sql');
let s = fs.readFileSync(p, 'utf8');

// Remove text updated_at/updated_by when followed by timestamptz versions
s = s.replace(/\n\s*updated_at text,\n\s*updated_by text,(?=\n\s*updated_at timestamptz)/g, '');

// deals: text updated_* between result_date and title
s = s.replace(
  /(result_date text,)\n\s*updated_at text,\n\s*updated_by text,(\n\s*title text,)/g,
  '$1$2'
);

// campaigns: text updated_* between imported and goal_people
s = s.replace(
  /(imported text,)\n\s*updated_at text,\n\s*updated_by text,(\n\s*goal_people)/g,
  '$1$2'
);

// people: text updated_* between memo and timestamptz
s = s.replace(
  /(memo text,)\n\s*updated_at text,\n\s*updated_by text,(\n\s*updated_at timestamptz)/g,
  '$1$2'
);

// cards: text updated_* between deal and timestamptz
s = s.replace(
  /(deal text,)\n\s*updated_at text,\n\s*updated_by text,(\n\s*updated_at timestamptz)/g,
  '$1$2'
);

// agencies: text updated_* between imported and timestamptz
s = s.replace(
  /(imported text,)\n\s*updated_at text,\n\s*updated_by text,(\n\s*updated_at timestamptz)/g,
  '$1$2'
);

// tasks: text updated_* between created_by and timestamptz
s = s.replace(
  /(created_by text,)\n\s*updated_at text,\n\s*updated_by text,(\n\s*updated_at timestamptz)/g,
  '$1$2'
);

s = s.replace(
  /create index if not exists tasks_assignee_idx on tasks \(assignee\);/,
  'create index if not exists tasks_person_idx on tasks (person);'
);

if (!s.includes('customers_name_idx')) {
  s = s.replace(
    'create index if not exists deals_lead_date_idx',
    'create index if not exists customers_name_idx on customers (name);\ncreate index if not exists deals_lead_date_idx'
  );
}

// add stage column for deals (UI uses stage)
if (!/create table if not exists deals \([\s\S]*?\bstage\b/.test(s)) {
  s = s.replace(
    /create table if not exists deals \(\n\s*id text primary key,/,
    'create table if not exists deals (\n  id text primary key,\n  stage text,'
  );
}

fs.writeWriteSync = undefined;
fs.writeFileSync(p, s);
console.log('schema patched OK');

// verify no duplicate updated_at text+timestamptz pairs remain in same table block
const blocks = s.split(/create table if not exists /).slice(1);
for (const b of blocks) {
  const name = b.split(/[\s(]/)[0];
  const body = b.split(';')[0];
  const textU = (body.match(/updated_at text/g) || []).length;
  const tsU = (body.match(/updated_at timestamptz/g) || []).length;
  if (textU && tsU) console.warn('WARN still dup updated_at in', name);
}
