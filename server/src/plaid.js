import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { nanoid } from 'nanoid';
import db from './db.js';
import { decrypt } from './crypto.js';
import { emitRefresh } from './bus.js';

const CLIENT_ID = process.env.PLAID_CLIENT_ID;
const SECRET = process.env.PLAID_SECRET;
const ENV = process.env.PLAID_ENV || 'sandbox';

let client = null;
if (CLIENT_ID && SECRET) {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[ENV] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: { 'PLAID-CLIENT-ID': CLIENT_ID, 'PLAID-SECRET': SECRET },
    },
  });
  client = new PlaidApi(configuration);
}

export function plaidEnabled() {
  return Boolean(client);
}
export function plaidClient() {
  return client;
}
export function plaidEnv() {
  return ENV;
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Normalize a Plaid transaction to our schema.
// IMPORTANT: Plaid `amount` is POSITIVE when money leaves the account (expense)
// and NEGATIVE when money comes in (income) — the opposite of our convention
// (positive = income, negative = expense). So we flip the sign here.
function normalize(t) {
  const category =
    titleCase(t.personal_finance_category?.primary) || (Array.isArray(t.category) && t.category[0]) || 'Uncategorized';
  return {
    external_id: t.transaction_id,
    date: t.date || t.authorized_date,
    description: t.merchant_name || t.name || 'Bank transaction',
    amount: Math.round(-Number(t.amount) * 100) / 100, // sign flip
    category,
  };
}

// Pull all available changes for a connection via /transactions/sync (cursor
// based), upsert added/modified, delete removed, save the new cursor, and emit
// a live-refresh signal. Returns counts.
export async function syncItem(connection) {
  if (!client) throw new Error('Plaid is not configured');
  const accessToken = decrypt(connection.access_token_enc);

  let cursor = connection.cursor || undefined;
  let added = [];
  let modified = [];
  let removed = [];
  let hasMore = true;

  while (hasMore) {
    const resp = await client.transactionsSync({ access_token: accessToken, cursor });
    const d = resp.data;
    added = added.concat(d.added);
    modified = modified.concat(d.modified);
    removed = removed.concat(d.removed);
    hasMore = d.has_more;
    cursor = d.next_cursor;
  }

  const findStmt = db.prepare('SELECT id FROM transactions WHERE user_id = ? AND external_id = ?');
  const insertStmt = db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source, external_id)
     VALUES (?, ?, ?, ?, ?, ?, 'plaid', ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE transactions SET date = ?, description = ?, amount = ?, category = ? WHERE id = ?`
  );
  const deleteStmt = db.prepare('DELETE FROM transactions WHERE user_id = ? AND external_id = ?');

  const apply = db.transaction(() => {
    for (const t of [...added, ...modified]) {
      const n = normalize(t);
      if (!n.date) continue;
      const existing = findStmt.get(connection.user_id, n.external_id);
      if (existing) updateStmt.run(n.date, n.description, n.amount, n.category, existing.id);
      else insertStmt.run(nanoid(), connection.user_id, n.date, n.description, n.amount, n.category, n.external_id);
    }
    for (const t of removed) {
      deleteStmt.run(connection.user_id, t.transaction_id);
    }
    db.prepare("UPDATE connections SET cursor = ?, last_synced_at = datetime('now') WHERE id = ?").run(
      cursor,
      connection.id
    );
  });
  apply();

  emitRefresh(connection.user_id, {
    source: 'plaid',
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  });
  return { added: added.length, modified: modified.length, removed: removed.length };
}
