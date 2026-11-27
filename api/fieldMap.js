/**
 * Vue/GAS uses camelCase keys; Postgres draft schema uses snake_case.
 * Map both directions for REST rows. Reserved words stay quoted in SQL only.
 */

const RESERVED = new Set(['start', 'end', 'order', 'group', 'user', 'table', 'type']);

function toSnake(key) {
  const s = String(key || '');
  if (!s) return s;
  if (s.includes('_') && s === s.toLowerCase()) return s;
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function toCamel(key) {
  const s = String(key || '');
  if (!s) return s;
  if (!s.includes('_')) return s;
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function rowToCamel(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'updated_at' || k === 'updated_by' || k === 'created_at') {
      out[toCamel(k)] = v;
      continue;
    }
    out[toCamel(k)] = v;
  }
  return out;
}

function rowsToCamel(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(rowToCamel);
}

/** Convert Vue patch (camelCase) → DB columns (snake_case). Drop undefined. */
function patchToSnake(patch) {
  const out = {};
  if (!patch || typeof patch !== 'object') return out;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[toSnake(k)] = v;
  }
  return out;
}

/** Payments: DB columns → Vue/GAS-ish row shape used by pays-view. */
function paymentToUi(row) {
  if (!row) return row;
  const c = rowToCamel(row);
  const key = c.payKey || c.key || '';
  const status = String(c.status || '').toLowerCase();
  return {
    key,
    customer: c.customer || '',
    kind: c.kind || '',
    n: c.n == null ? '' : c.n,
    date: c.dueDate || c.date || c.chargeDate || '',
    amount: c.amount == null ? '' : Number(c.amount),
    method: c.method || '',
    ok: status === 'ok' || status === 'paid' || status === 'confirmed' || c.ok === true,
    ng: status === 'ng' || c.ng === true,
    actual: c.paidAt || c.actual || '',
    memo: c.memo || '',
    moved: c.dueOverride || c.moved || '',
  };
}

module.exports = {
  toSnake,
  toCamel,
  rowToCamel,
  rowsToCamel,
  patchToSnake,
  paymentToUi,
  RESERVED,
};
