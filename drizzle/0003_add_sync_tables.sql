CREATE TABLE IF NOT EXISTS `settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `settings_key_unique` UNIQUE(`key`)
);

CREATE TABLE IF NOT EXISTS `sync_failures` (
  `id` int AUTO_INCREMENT NOT NULL,
  `settlement_id` int NOT NULL,
  `fail_reason` text NOT NULL,
  `sync_type` varchar(20) NOT NULL DEFAULT 'normal',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sync_failures_id` PRIMARY KEY(`id`)
);
