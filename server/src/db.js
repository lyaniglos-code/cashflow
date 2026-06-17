import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configurable DB location: DATABASE_PATH overrides the default file (tests pass
// ':memory:' for a throwaway DB; production can point elsewhere). Defaults to
// server/data/app.db.
const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'app.db');
const isMemory = dbPath === ':memory:';
if (!isMemory) mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

if (!isMemory) db.pragma('journal_mode = WAL'); // WAL is a no-op for in-memory DBs
db.pragma('foreign_keys = ON');

// Schema is kept ANSI-friendly so it ports to Postgres with minimal changes.
// (For Postgres: swap TEXT PRIMARY KEY ids stay the same; INTEGER autoincrement
// is not used here — we use string ids from nanoid — and REAL -> NUMERIC.)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    business_name TEXT NOT NULL DEFAULT '',
    business_type TEXT NOT NULL DEFAULT '',
    industry_vertical TEXT NOT NULL DEFAULT '',
    shortfall_threshold REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    adjustments TEXT NOT NULL DEFAULT '[]',
    impact TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id, created_at);

  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'plaid',
    access_token_enc TEXT NOT NULL,
    item_id TEXT NOT NULL,
    cursor TEXT,
    institution_name TEXT NOT NULL DEFAULT 'Bank',
    status TEXT NOT NULL DEFAULT 'active',
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conn_user ON connections(user_id);
  CREATE INDEX IF NOT EXISTS idx_conn_item ON connections(item_id);
`);

// Idempotent migration: add transactions.external_id (Plaid transaction_id) for
// upsert/delete on sync. better-sqlite3 throws if the column already exists, so
// check the table info first.
const txCols = db.prepare(`PRAGMA table_info(transactions)`).all();
if (!txCols.some((c) => c.name === 'external_id')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN external_id TEXT`);
}
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_external ON transactions(user_id, external_id) WHERE external_id IS NOT NULL`
);

// --- SMS / notifications migrations ---
function addColumn(table, name, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
}
addColumn('users', 'phone_number', 'TEXT');
addColumn('users', 'phone_verified', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'pending_phone', 'TEXT');
addColumn('users', 'verify_code', 'TEXT');
addColumn('users', 'verify_expires', 'TEXT');
addColumn('users', 'sms_opt_in', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'alert_shortfall', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'alert_weekly_pulse', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'alert_improvement', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'quiet_start', "TEXT NOT NULL DEFAULT '21:00'");
addColumn('users', 'quiet_end', "TEXT NOT NULL DEFAULT '08:00'");
addColumn('users', 'timezone', "TEXT NOT NULL DEFAULT 'America/New_York'");
addColumn('users', 'last_balance', 'REAL');
addColumn('users', 'last_projection_value', 'REAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS notification_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    projection_value_at_send REAL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_notiflog_user_type ON notification_log(user_id, alert_type, sent_at);

  CREATE TABLE IF NOT EXISTS queued_sms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    body TEXT NOT NULL,
    projection_value REAL,
    send_after TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_queued_sms_after ON queued_sms(send_after);
`);

export default db;
