import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint, boolean } from "drizzle-orm/mysql-core";

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
  /** 实际转出 */
  actualTransfer: decimal("actualTransfer", { precision: 12, scale: 2 }).default("0"),
  /** 转账状态 */
  transferStatus: varchar("transferStatus", { length: 32 }).default(""),
  /** 登记状态 */
  registrationStatus: varchar("registrationStatus", { length: 32 }).default(""),
  /** 结算状态 */
  settlementStatus: varchar("settlementStatus", { length: 32 }).default(""),
  /** 是否为特殊单 */
  isSpecial: boolean("isSpecial").default(false),
  /** 备注 */
  remark: text("remark"),
  /** 创建人ID */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;
