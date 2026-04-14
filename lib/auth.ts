import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { authSessions, users } from '@/db/schema';

export type AuthRole = 'sitter' | 'owner';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function passwordDigest(email: string, password: string) {
  const e = normalizeEmail(email);
  // Use Web Crypto API (available in Hermes / React Native 0.71+, no native module needed)
  const encoded = new TextEncoder().encode(`${e}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCurrentUserFromDb() {
  const rows = await db
    .select({ userId: authSessions.userId })
    .from(authSessions)
    .where(eq(authSessions.id, 1))
    .limit(1);

  if (rows.length === 0) return null;

  const [user] = await db.select().from(users).where(eq(users.id, rows[0]!.userId)).limit(1);
  return user ?? null;
}

export async function signOutDb() {
  await db.delete(authSessions).where(eq(authSessions.id, 1));
}

export async function signUpDb(input: { role: AuthRole; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error('Enter an email address.');
  if (input.password.length < 6) throw new Error('Password must be at least 6 characters.');

  const digest = await passwordDigest(email, input.password);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new Error('An account with that email already exists.');

  const name = email.split('@')[0] || 'Grotto User';

  const inserted = await db
    .insert(users)
    .values({
      email,
      passwordHash: digest,
      name,
      role: input.role,
    })
    .returning({ id: users.id });

  const userId = inserted[0]!.id;

  // Keep a single session row (id=1)
  await db
    .insert(authSessions)
    .values({ id: 1, userId })
    .onConflictDoUpdate({
      target: authSessions.id,
      set: { userId, createdAt: sql`(datetime('now'))` },
    });

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user!;
}

export async function signInDb(input: { role: AuthRole; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error('Enter an email address.');

  const digest = await passwordDigest(email, input.password);

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.passwordHash, digest)))
    .limit(1);

  if (!user) throw new Error('Incorrect email or password.');
  if (user.role !== input.role) throw new Error(`This account is registered as a ${user.role}.`);

  await db
    .insert(authSessions)
    .values({ id: 1, userId: user.id })
    .onConflictDoUpdate({
      target: authSessions.id,
      set: { userId: user.id, createdAt: sql`(datetime('now'))` },
    });

  return user;
}

