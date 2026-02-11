CREATE TABLE `settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderDate` bigint,
	`orderNo` varchar(64),
	`groupName` varchar(128),
	`originalPrice` decimal(12,2) DEFAULT '0',
	`totalPrice` decimal(12,2) DEFAULT '0',
	`actualTransfer` decimal(12,2) DEFAULT '0',
	`transferStatus` varchar(32) DEFAULT '',
	`registrationStatus` varchar(32) DEFAULT '',
	`settlementStatus` varchar(32) DEFAULT '',
	`remark` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settlements_id` PRIMARY KEY(`id`)
);
