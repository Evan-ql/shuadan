import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint, tinyint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 结算明细表（同时标记是否为特殊单）
 */
export const settlements = mysqlTable("settlements", {
  id: int("id").autoincrement().primaryKey(),
  /** 接单日期 - UTC timestamp in ms */
  orderDate: bigint("orderDate", { mode: "number" }),
  /** 单号 */
  orderNo: varchar("orderNo", { length: 64 }),
  /** 群名 */
  groupName: varchar("groupName", { length: 128 }),
  /** 客户名 */
  customerName: varchar("customerName", { length: 128 }).default(""),
  /** 客服 */
  customerService: varchar("customerService", { length: 64 }).default(""),
  /** 原价 */
  originalPrice: decimal("originalPrice", { precision: 12, scale: 2 }).default("0"),
  /** 加价后总价 */
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).default("0"),
  /** 应转出 */
  shouldTransfer: decimal("shouldTransfer", { precision: 12, scale: 2 }).default("0"),
  /** 实际转出 */
  actualTransfer: decimal("actualTransfer", { precision: 12, scale: 2 }).default("0"),
  /** 转账状态 */
  transferStatus: varchar("transferStatus", { length: 32 }).default(""),
  /** 登记状态 */
  registrationStatus: varchar("registrationStatus", { length: 32 }).default(""),
  /** 结算状态 */
  settlementStatus: varchar("settlementStatus", { length: 32 }).default(""),
  /** 是否为特殊单 (0=普通, 1=特殊) */
  isSpecial: tinyint("isSpecial").default(0),
  /** 备注 */
  remark: text("remark"),
  /** 创建人ID */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;

/**
 * 转账记录表（一次转账可关联多个订单）
 */
export const transferRecords = mysqlTable("transfer_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 转账截图（base64 或 URL） */
  imageData: text("imageData"),
  /** 转账备注 */
  note: text("note"),
  /** 创建时间 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TransferRecord = typeof transferRecords.$inferSelect;
export type InsertTransferRecord = typeof transferRecords.$inferInsert;

/**
 * 转账记录与订单的关联表（多对多）
 */
export const transferSettlements = mysqlTable("transfer_settlements", {
  id: int("id").autoincrement().primaryKey(),
  transferId: int("transferId").notNull(),
  settlementId: int("settlementId").notNull(),
});

export type TransferSettlement = typeof transferSettlements.$inferSelect;
export type InsertTransferSettlement = typeof transferSettlements.$inferInsert;

/**
 * 系统设置表（存储Token等配置）
 */
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

/**
 * 同步失败记录表
 */
export const syncFailures = mysqlTable("sync_failures", {
  id: int("id").autoincrement().primaryKey(),
  /** 关联的结算记录ID */
  settlementId: int("settlementId").notNull(),
  /** 失败原因 */
  failReason: text("failReason"),
  /** 同步类型: normal=普通单, special=特殊单 */
  syncType: varchar("syncType", { length: 32 }).default("normal"),
  /** 状态: pending=待处理, ignored=已忽略, resolved=已解决 */
  status: varchar("status", { length: 32 }).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncFailure = typeof syncFailures.$inferSelect;
export type InsertSyncFailure = typeof syncFailures.$inferInsert;
