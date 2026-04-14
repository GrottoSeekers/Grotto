import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamp = () => text().default(sql`(datetime('now'))`);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  externalId: text('external_id').unique(),
  name: text().notNull(),
  avatarUrl: text('avatar_url'),
  // 'owner' | 'sitter' | 'both'
  role: text().notNull().default('both'),
  // 'free' | 'perks' | 'paid' | null
  sitterTier: text('sitter_tier'),
  bio: text(),
  rating: real().default(0),
  reviewCount: integer('review_count').default(0),
  createdAt: timestamp(),
});

// ─── Listings ─────────────────────────────────────────────────────────────────
export const listings = sqliteTable('listings', {
  id: integer().primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  title: text().notNull(),
  description: text(),
  address: text(),
  latitude: real().notNull(),
  longitude: real().notNull(),
  city: text(),
  country: text(),
  bedrooms: integer(),
  bathrooms: integer(),
  // JSON array string e.g. '["wifi","pool"]'
  amenities: text(),
  petCount: integer('pet_count').default(0),
  // JSON array string e.g. '["dog","cat"]'
  petTypes: text('pet_types'),
  coverPhotoUrl: text('cover_photo_url'),
  // JSON array of URLs
  photos: text(),
  isActive: integer('is_active').default(1),
  createdAt: timestamp(),
});

// ─── Sits ─────────────────────────────────────────────────────────────────────
export const sits = sqliteTable('sits', {
  id: integer().primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id').references(() => listings.id).notNull(),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  // null = unfilled
  sitterId: integer('sitter_id').references(() => users.id),
  // 'open' | 'confirmed' | 'live' | 'completed' | 'cancelled'
  status: text().notNull().default('open'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  specialInstructions: text('special_instructions'),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

// ─── Photo Schedules ──────────────────────────────────────────────────────────
export const photoSchedules = sqliteTable('photo_schedules', {
  id: integer().primaryKey({ autoIncrement: true }),
  sitId: integer('sit_id').references(() => sits.id).notNull(),
  // e.g. "Morning walk", "Dinner time"
  label: text().notNull(),
  // 'time' | 'activity'
  triggerType: text('trigger_type').notNull().default('time'),
  // HH:MM in 24h, null if activity-based
  triggerTime: text('trigger_time'),
  triggerActivity: text('trigger_activity'),
  // 'daily' | 'once' | 'weekdays' | 'weekends'
  recurrence: text().default('daily'),
  isActive: integer('is_active').default(1),
});

// ─── Photo Requests ───────────────────────────────────────────────────────────
export const photoRequests = sqliteTable('photo_requests', {
  id: integer().primaryKey({ autoIncrement: true }),
  sitId: integer('sit_id').references(() => sits.id).notNull(),
  scheduleId: integer('schedule_id').references(() => photoSchedules.id).notNull(),
  sitterId: integer('sitter_id').references(() => users.id).notNull(),
  // 'pending' | 'submitted' | 'approved' | 'missed'
  status: text().notNull().default('pending'),
  requestedAt: text('requested_at').notNull(),
  dueAt: text('due_at'),
  submittedAt: text('submitted_at'),
  notificationSent: integer('notification_sent').default(0),
});

// ─── Photos ───────────────────────────────────────────────────────────────────
export const photos = sqliteTable('photos', {
  id: integer().primaryKey({ autoIncrement: true }),
  requestId: integer('request_id').references(() => photoRequests.id).notNull(),
  sitId: integer('sit_id').references(() => sits.id).notNull(),
  sitterId: integer('sitter_id').references(() => users.id).notNull(),
  // local file URI initially
  url: text().notNull(),
  caption: text(),
  uploadedAt: timestamp(),
  isApproved: integer('is_approved').default(0),
});

// ─── Boosts ───────────────────────────────────────────────────────────────────
export const boosts = sqliteTable('boosts', {
  id: integer().primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id').references(() => listings.id).notNull(),
  // null = listing-level boost, set for sit-specific boost
  sitId: integer('sit_id').references(() => sits.id),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  // 'tier_upgrade' | 'food_shop' | 'transport' | 'gift' | 'custom'
  boostType: text('boost_type').notNull(),
  // 'perks' | 'paid' — only for tier_upgrade
  tierOffered: text('tier_offered'),
  description: text(),
  // human-readable value e.g. "£50 Ocado voucher"
  valueDisplay: text('value_display'),
  isActive: integer('is_active').default(1),
  expiresAt: text('expires_at'),
  createdAt: timestamp(),
});

// ─── Boost Definitions ────────────────────────────────────────────────────────
export const boostDefinitions = sqliteTable('boost_definitions', {
  id: integer().primaryKey({ autoIncrement: true }),
  key: text().unique().notNull(),
  label: text().notNull(),
  description: text(),
  // SF Symbol name
  icon: text(),
  sortOrder: integer('sort_order').default(0),
});

// ─── Type exports ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Sit = typeof sits.$inferSelect;
export type PhotoSchedule = typeof photoSchedules.$inferSelect;
export type PhotoRequest = typeof photoRequests.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Boost = typeof boosts.$inferSelect;
export type BoostDefinition = typeof boostDefinitions.$inferSelect;
