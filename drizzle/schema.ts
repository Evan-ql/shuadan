import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** user = 查看权限, admin = 编辑权限 */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 加价结算明细表
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  /** 序号 */
  index: int("idx").notNull(),
  /** 接单日期 */
  orderDate: varchar("orderDate", { length: 64 }),
  /** 单号 */
  orderNo: varchar("orderNo", { length: 64 }),
  /** 群名 */
  groupName: varchar("groupName", { length: 255 }).notNull(),
  /** 原价 */
  originalPrice: decimal("originalPrice", { precision: 12, scale: 2 }).notNull().default("0"),
  /** 加价后总价 */
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull().default("0"),
  /** 实际转出 */
  actualTransferOut: decimal("actualTransferOut", { precision: 12, scale: 2 }).notNull().default("0"),
  /** 转账状态 */
  transferStatus: mysqlEnum("transferStatus", ["已转", "未转"]).default("未转").notNull(),
  /** 登记状态 */
  registerStatus: varchar("registerStatus", { length: 64 }),
  /** 结算状态 */
  settlementStatus: varchar("settlementStatus", { length: 64 }),
  /** 创建人ID */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
