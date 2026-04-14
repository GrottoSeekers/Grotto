import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const raw = openDatabaseSync('grotto.db', { enableChangeListener: true });

// Ensure auth schema exists regardless of migration state.
// CREATE TABLE IF NOT EXISTS is safe to re-run; ALTER TABLE is wrapped in
// try/catch because SQLite has no "ADD COLUMN IF NOT EXISTS".
raw.execSync(`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    "createdAt" TEXT DEFAULT (datetime('now'))
  );
`);
try { raw.execSync('ALTER TABLE users ADD COLUMN email TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN password_hash TEXT;'); } catch (_) {}
raw.execSync('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);');

export const db = drizzle(raw, { schema });
