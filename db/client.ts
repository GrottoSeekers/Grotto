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
try { raw.execSync('ALTER TABLE users ADD COLUMN occupation TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN location TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN preferred_pets TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN why_i_want_to_sit TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN gallery_photos TEXT;'); } catch (_) {}
raw.execSync('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);');
raw.execSync(`
  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    sitter_id INTEGER NOT NULL REFERENCES users(id),
    owner_name TEXT NOT NULL,
    owner_email TEXT,
    sit_description TEXT,
    body TEXT,
    rating INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    request_token TEXT,
    "createdAt" TEXT DEFAULT (datetime('now'))
  );
`);

export const db = drizzle(raw, { schema });
