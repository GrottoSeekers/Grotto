import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const raw = openDatabaseSync('grotto.db', { enableChangeListener: true });

export const db = drizzle(raw, { schema });
