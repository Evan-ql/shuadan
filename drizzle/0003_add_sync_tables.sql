-- Settings table (matches drizzle schema exactly)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(128) NOT NULL,
  `value` text,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `settings_key_unique` UNIQUE(`key`)
);

-- Sync failures table (matches drizzle schema exactly)
CREATE TABLE IF NOT EXISTS `sync_failures` (
  `id` int AUTO_INCREMENT NOT NULL,
  `settlementId` int NOT NULL,
  `failReason` text,
  `syncType` varchar(32) DEFAULT 'normal',
  `status` varchar(32) DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sync_failures_id` PRIMARY KEY(`id`)
);
