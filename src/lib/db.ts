import 'server-only';

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

function getDbPath() {
  return (
    process.env.SQLITE_PATH?.trim() ||
    path.join(process.cwd(), '.local', 'ibrl.sqlite')
  );
}

let singleton: Db | null = null;

export function getDb(): Db {
  if (singleton) return singleton;

  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  singleton = db;
  return db;
}

function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      kind TEXT NOT NULL,
      config_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_fired_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS intents_owner_idx ON intents(owner);
    CREATE INDEX IF NOT EXISTS intents_status_idx ON intents(status);

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      intent_id TEXT,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      quote_json TEXT,
      tx_base64 TEXT,
      simulation_json TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      signature TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(intent_id) REFERENCES intents(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS proposals_owner_status_idx ON proposals(owner, status);
    CREATE INDEX IF NOT EXISTS proposals_intent_status_idx ON proposals(intent_id, status);

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      owner TEXT,
      prompt TEXT NOT NULL,
      execute INTEGER NOT NULL,
      ok INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS interactions_owner_created_idx ON interactions(owner, created_at);
  `);
}
