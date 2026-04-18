import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { authSessions, users } from '@/db/schema';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export type AuthRole = 'sitter' | 'owner';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function passwordDigest(email: string, password: string) {
  const e = normalizeEmail(email);
  // globalThis.crypto is available in Hermes (React Native 0.71+)
  const subtle = (globalThis as unknown as { crypto: Crypto }).crypto?.subtle;
  if (subtle) {
    const encoded = new TextEncoder().encode(`${e}:${password}`);
    const hashBuffer = await subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: simple djb2-style hash (local-only app)
  const str = `${e}:${password}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
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

export async function signUpDb(input: { role: AuthRole; firstName: string; email: string; password: string }): Promise<{ userId: number; verificationCode: string }> {
  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  if (!firstName) throw new Error('Enter your first name.');
  if (!email) throw new Error('Enter an email address.');
  if (input.password.length < 6) throw new Error('Password must be at least 6 characters.');

  const digest = await passwordDigest(email, input.password);

  const existing = await db.select({ id: users.id, emailVerified: users.emailVerified }).from(users).where(eq(users.email, email)).limit(1);

  const verificationCode = generateCode();

  if (existing.length > 0) {
    const existingUser = existing[0]!;
    if (existingUser.emailVerified) throw new Error('An account with that email already exists.');

    // Unverified account — overwrite with new signup details so they can retry
    await db
      .update(users)
      .set({ passwordHash: digest, name: firstName, role: input.role, emailVerificationCode: verificationCode })
      .where(eq(users.id, existingUser.id));

    return { userId: existingUser.id, verificationCode };
  }

  const inserted = await db
    .insert(users)
    .values({
      email,
      passwordHash: digest,
      name: firstName,
      role: input.role,
      emailVerified: 0,
      emailVerificationCode: verificationCode,
    })
    .returning({ id: users.id });

  return { userId: inserted[0]!.id, verificationCode };
}

export async function verifyEmail(userId: number, code: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('Account not found.');
  if (user.emailVerificationCode !== code) throw new Error('Incorrect code. Please try again.');

  await db
    .update(users)
    .set({ emailVerified: 1, emailVerificationCode: null })
    .where(eq(users.id, userId));

  await db
    .insert(authSessions)
    .values({ id: 1, userId })
    .onConflictDoUpdate({
      target: authSessions.id,
      set: { userId, createdAt: sql`(datetime('now'))` },
    });

  const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return updated!;
}

export async function requestPasswordReset(email: string): Promise<{ code: string }> {
  const normalised = normalizeEmail(email);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalised)).limit(1);
  if (!user) throw new Error('No account found with that email address.');

  const code = generateCode();
  await db.update(users).set({ passwordResetCode: code }).where(eq(users.id, user.id));
  return { code };
}

export async function deleteAccountDb(userId: number) {
  await db.delete(authSessions).where(eq(authSessions.id, 1));
  await db.delete(users).where(eq(users.id, userId));
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const normalised = normalizeEmail(email);
  const [user] = await db.select().from(users).where(eq(users.email, normalised)).limit(1);
  if (!user) throw new Error('No account found with that email address.');
  if (user.passwordResetCode !== code) throw new Error('Incorrect code. Please try again.');

  const digest = await passwordDigest(normalised, newPassword);
  await db.update(users).set({ passwordHash: digest, passwordResetCode: null }).where(eq(users.id, user.id));
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
  if (!user.emailVerified) throw new Error('Please verify your email before signing in.');

  await db
    .insert(authSessions)
    .values({ id: 1, userId: user.id })
    .onConflictDoUpdate({
      target: authSessions.id,
      set: { userId: user.id, createdAt: sql`(datetime('now'))` },
    });

  return user;
}

