CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idx` int NOT NULL,
	`orderDate` varchar(64),
	`orderNo` varchar(64),
	`groupName` varchar(255) NOT NULL,
	`originalPrice` decimal(12,2) NOT NULL DEFAULT '0',
	`totalPrice` decimal(12,2) NOT NULL DEFAULT '0',
	`actualTransferOut` decimal(12,2) NOT NULL DEFAULT '0',
	`transferStatus` enum('已转','未转') NOT NULL DEFAULT '未转',
	`registerStatus` varchar(64),
	`settlementStatus` varchar(64),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
