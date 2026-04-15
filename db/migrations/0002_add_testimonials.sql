CREATE TABLE `testimonials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sitter_id` integer NOT NULL,
	`owner_name` text NOT NULL,
	`owner_email` text,
	`sit_description` text,
	`body` text,
	`rating` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`request_token` text,
	`createdAt` text DEFAULT (datetime('now')),
	FOREIGN KEY (`sitter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
