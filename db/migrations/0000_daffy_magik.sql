CREATE TABLE `boost_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boost_definitions_key_unique` ON `boost_definitions` (`key`);--> statement-breakpoint
CREATE TABLE `boosts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`sit_id` integer,
	`owner_id` integer NOT NULL,
	`boost_type` text NOT NULL,
	`tier_offered` text,
	`description` text,
	`value_display` text,
	`is_active` integer DEFAULT 1,
	`expires_at` text,
	`createdAt` text DEFAULT (datetime('now')),
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sit_id`) REFERENCES `sits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`address` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`city` text,
	`country` text,
	`bedrooms` integer,
	`bathrooms` integer,
	`amenities` text,
	`pet_count` integer DEFAULT 0,
	`pet_types` text,
	`cover_photo_url` text,
	`photos` text,
	`is_active` integer DEFAULT 1,
	`createdAt` text DEFAULT (datetime('now')),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photo_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sit_id` integer NOT NULL,
	`schedule_id` integer NOT NULL,
	`sitter_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text NOT NULL,
	`due_at` text,
	`submitted_at` text,
	`notification_sent` integer DEFAULT 0,
	FOREIGN KEY (`sit_id`) REFERENCES `sits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `photo_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sitter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photo_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sit_id` integer NOT NULL,
	`label` text NOT NULL,
	`trigger_type` text DEFAULT 'time' NOT NULL,
	`trigger_time` text,
	`trigger_activity` text,
	`recurrence` text DEFAULT 'daily',
	`is_active` integer DEFAULT 1,
	FOREIGN KEY (`sit_id`) REFERENCES `sits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`sit_id` integer NOT NULL,
	`sitter_id` integer NOT NULL,
	`url` text NOT NULL,
	`caption` text,
	`uploadedAt` text DEFAULT (datetime('now')),
	`is_approved` integer DEFAULT 0,
	FOREIGN KEY (`request_id`) REFERENCES `photo_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sit_id`) REFERENCES `sits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sitter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`sitter_id` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`special_instructions` text,
	`createdAt` text DEFAULT (datetime('now')),
	`updatedAt` text DEFAULT (datetime('now')),
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sitter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'both' NOT NULL,
	`sitter_tier` text,
	`bio` text,
	`rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0,
	`createdAt` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_id_unique` ON `users` (`external_id`);