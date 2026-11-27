/**
 * Lightweight Supabase REST helper (no @supabase/supabase-js dep required).
 * Uses service role on server only. Never expose service key to the browser.
 * Project: qxzftftbvgysgzhqgfoz
 */

function env(name) {
  return String(process.env[name] || '').trim();
}

function configured() {
  return !!(env('SUPABASE_URL') && (env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY')));
}

function baseUrl() {
  const u = env('SUPABASE_URL') || 'https://qxzftftbvgysgzhqgfoz.supabase.co';
  return u.replace(/\/$/, '');
}

function key() {
  return env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY');
}

async function rest(path, { method = 'GET', query = '', body, prefer } = {}) {
  if (!configured()) {
    const err = new Error('Supabase env not configured (SUPABASE_URL + key)');
    err.status = 501;
    throw err;
  }
  const url = `${baseUrl()}/rest/v1/${path}${query ? `?${query}` : ''}`;
  const headers = {
    apikey: key(),
    Authorization: `Bearer ${key()}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error_description || data.error)) || text || res.statusText;
    const err = new Error(String(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function select(table, query = 'select=*') {
  return rest(table, { query });
}

async function insert(table, rows, { returning = true } = {}) {
  return rest(table, {
    method: 'POST',
    body: rows,
    prefer: returning ? 'return=representation' : 'return=minimal',
  });
}

async function update(table, query, patch) {
  return rest(table, {
    method: 'PATCH',
    query,
    body: patch,
    prefer: 'return=representation',
  });
}

async function del(table, query) {
  return rest(table, {
    method: 'DELETE',
    query,
    prefer: 'return=representation',
  });
}

/** Health: list tables via OpenAPI or a cheap select on app_users if present. */
async function ping() {
  try {
    await select('app_users', 'select=id&limit=1');
    return { ok: true, tables: { app_users: true } };
  } catch (err) {
    return { ok: false, error: err.message, status: err.status || 0 };
  }
}

module.exports = {
  configured,
  baseUrl,
  select,
  insert,
  update,
  del,
  ping,
  rest,
};
