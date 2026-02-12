-- ============================================
-- 加价结算明细管理系统 - 数据库初始化脚本
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
  `remark` text,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
