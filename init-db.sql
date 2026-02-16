-- ============================================
-- 加价结算明细管理系统 - 数据库初始化脚本
-- 注意：此脚本使用 IF NOT EXISTS，不会删除已有数据
-- ============================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `openId` varchar(64) NOT NULL UNIQUE,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settlements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `orderDate` bigint,
  `orderNo` varchar(64),
  `groupName` varchar(128),
  `customerName` varchar(128) DEFAULT '',
  `customerService` varchar(64) DEFAULT '',
  `originalPrice` decimal(12,2) DEFAULT '0.00',
  `totalPrice` decimal(12,2) DEFAULT '0.00',
  `shouldTransfer` decimal(12,2) DEFAULT '0.00',
  `actualTransfer` decimal(12,2) DEFAULT '0.00',
  `transferStatus` varchar(32) DEFAULT '',
  `registrationStatus` varchar(32) DEFAULT '',
  `settlementStatus` varchar(32) DEFAULT '',
  `isSpecial` tinyint(1) DEFAULT 0,
  `remark` text,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 转账记录表
CREATE TABLE IF NOT EXISTS `transfer_records` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `imageData` longtext,
  `note` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 转账记录与订单关联表
CREATE TABLE IF NOT EXISTS `transfer_settlements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `transferId` int NOT NULL,
  `settlementId` int NOT NULL,
  INDEX `idx_transfer_id` (`transferId`),
  INDEX `idx_settlement_id` (`settlementId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统设置表
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `key` varchar(128) NOT NULL UNIQUE,
  `value` text,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 同步失败记录表
CREATE TABLE IF NOT EXISTS `sync_failures` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `settlementId` int NOT NULL,
  `failReason` text,
  `syncType` varchar(32) DEFAULT 'normal',
  `status` varchar(32) DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
