-- 删除旧表（字段名用了snake_case，和drizzle schema不匹配）
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `sync_failures`;

-- 重新创建，字段名使用camelCase与drizzle schema一致
CREATE TABLE `settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(128) NOT NULL,
  `value` text,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  UNIQUE KEY `settings_key_unique`(`key`)
);

CREATE TABLE `sync_failures` (
  `id` int AUTO_INCREMENT NOT NULL,
  `settlementId` int NOT NULL,
  `failReason` text,
  `syncType` varchar(32) DEFAULT 'normal',
  `status` varchar(32) DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);
