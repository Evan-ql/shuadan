import { drizzle } from 'drizzle-orm/mysql2';
import { mysqlTable, int, bigint, varchar, decimal, tinyint, text, timestamp } from 'drizzle-orm/mysql-core';

const settlements = mysqlTable("settlements", {
  id: int("id").autoincrement().primaryKey(),
  orderDate: bigint("orderDate", { mode: "number" }),
  orderNo: varchar("orderNo", { length: 64 }),
  groupName: varchar("groupName", { length: 128 }),
  customerName: varchar("customerName", { length: 128 }).default(""),
  customerService: varchar("customerService", { length: 64 }).default(""),
  originalPrice: decimal("originalPrice", { precision: 12, scale: 2 }).default("0"),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).default("0"),
  shouldTransfer: decimal("shouldTransfer", { precision: 12, scale: 2 }).default("0"),
  actualTransfer: decimal("actualTransfer", { precision: 12, scale: 2 }).default("0"),
  transferStatus: varchar("transferStatus", { length: 32 }).default(""),
  registrationStatus: varchar("registrationStatus", { length: 32 }).default(""),
  settlementStatus: varchar("settlementStatus", { length: 32 }).default(""),
  isSpecial: tinyint("isSpecial").default(0),
  remark: text("remark"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

const db = drizzle('mysql://test:test123@localhost:3306/test_shuadan');

// Test exactly what the frontend sends via tRPC
const data = {
  orderDate: null,
  orderNo: '',
  groupName: '',
  customerName: '',
  customerService: '',
  originalPrice: '0',
  totalPrice: '0',
  shouldTransfer: '0',
  actualTransfer: '0',
  transferStatus: '',
  registrationStatus: '',
  settlementStatus: '',
  isSpecial: 0,
  remark: '',
  createdBy: 2,
};

console.log('Input data:', JSON.stringify(data));

try {
  const result = await db.insert(settlements).values(data);
  console.log('✅ INSERT succeeded! insertId:', result[0].insertId);
} catch (err) {
  console.log('❌ INSERT failed:', err.message);
  console.log('SQL:', err.sql || 'N/A');
}

process.exit(0);
