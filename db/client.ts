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
try { raw.execSync('ALTER TABLE users ADD COLUMN occupation TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN location TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE listings ADD COLUMN pet_photos TEXT;'); } catch (_) {}
try { raw.execSync("ALTER TABLE listings ADD COLUMN listing_status TEXT DEFAULT 'active';"); } catch (_) {}
// Backfill any rows that pre-date the column
raw.execSync("UPDATE listings SET listing_status = 'active' WHERE listing_status IS NULL;");
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

raw.execSync(`
  CREATE TABLE IF NOT EXISTS saved_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    sitter_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🏡',
    "createdAt" TEXT DEFAULT (datetime('now'))
  );
`);
raw.execSync(`
  CREATE TABLE IF NOT EXISTS saved_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    list_id INTEGER NOT NULL REFERENCES saved_lists(id),
    listing_id INTEGER NOT NULL REFERENCES listings(id),
    "addedAt" TEXT DEFAULT (datetime('now')),
    notes TEXT
  );
`);

raw.execSync(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    sit_id INTEGER NOT NULL REFERENCES sits(id),
    listing_id INTEGER NOT NULL REFERENCES listings(id),
    sitter_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT DEFAULT (datetime('now'))
  );
`);

try { raw.execSync('ALTER TABLE applications ADD COLUMN archived_by_sitter INTEGER DEFAULT 0;'); } catch (_) {}
try { raw.execSync('ALTER TABLE applications ADD COLUMN archived_by_owner INTEGER DEFAULT 0;'); } catch (_) {}

raw.execSync(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    "createdAt" TEXT DEFAULT (datetime('now'))
  );
`);

raw.execSync(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES users(id),
    author_name TEXT NOT NULL,
    author_avatar_url TEXT,
    sit_description TEXT,
    body TEXT NOT NULL,
    rating INTEGER NOT NULL,
    "createdAt" TEXT DEFAULT (datetime('now'))
  );
`);

try { raw.execSync('ALTER TABLE chat_messages ADD COLUMN attachment_type TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE chat_messages ADD COLUMN attachment_uri TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE chat_messages ADD COLUMN attachment_name TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN email_verification_code TEXT;'); } catch (_) {}
try { raw.execSync('ALTER TABLE users ADD COLUMN password_reset_code TEXT;'); } catch (_) {}
// Backfill: only auto-verify accounts that pre-date the email verification feature (no code stored)
raw.execSync('UPDATE users SET email_verified = 1 WHERE (email_verified IS NULL OR email_verified = 0) AND email_verification_code IS NULL;');

export const db = drizzle(raw, { schema });
