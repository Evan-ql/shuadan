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
  `customerService` varchar(64) DEFAULT '',
  `customerName` varchar(128) DEFAULT '',
  `originalPrice` decimal(12,2) DEFAULT '0.00',
  `totalPrice` decimal(12,2) DEFAULT '0.00',
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

-- 安全添加新列（如果列不存在则添加，已存在则跳过）
-- MySQL 不支持 IF NOT EXISTS 添加列，使用存储过程安全处理

DELIMITER //
CREATE PROCEDURE add_column_if_not_exists()
BEGIN
  -- 添加 customerName 列
  IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settlements' AND COLUMN_NAME = 'customerName'
  ) THEN
    ALTER TABLE `settlements` ADD COLUMN `customerName` varchar(128) DEFAULT '' AFTER `customerService`;
  END IF;

  -- 添加 isSpecial 列
  IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settlements' AND COLUMN_NAME = 'isSpecial'
  ) THEN
    ALTER TABLE `settlements` ADD COLUMN `isSpecial` tinyint(1) DEFAULT 0 AFTER `settlementStatus`;
  END IF;
END //
DELIMITER ;

CALL add_column_if_not_exists();
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

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
