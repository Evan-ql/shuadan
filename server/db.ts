import { eq, like, and, desc, sql, SQL, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, settlements, InsertSettlement, Settlement, transferRecords, transferSettlements } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Settlement CRUD ====================

export async function createSettlement(data: InsertSettlement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(settlements).values(data);
  const insertId = result[0].insertId;
  return getSettlementById(insertId);
}

export async function getSettlementById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listSettlements(params: {
  page: number;
  pageSize: number;
  search?: string;
  transferStatus?: string;
  registrationStatus?: string;
  settlementStatus?: string;
  isSpecial?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: SQL[] = [];

  if (params.search) {
    const searchPattern = `%${params.search}%`;
    conditions.push(
      sql`(${settlements.groupName} LIKE ${searchPattern} OR ${settlements.orderNo} LIKE ${searchPattern} OR ${settlements.customerName} LIKE ${searchPattern})`
    );
  }

  if (params.transferStatus) {
    conditions.push(eq(settlements.transferStatus, params.transferStatus));
  }
  if (params.registrationStatus) {
    conditions.push(eq(settlements.registrationStatus, params.registrationStatus));
  }
  if (params.settlementStatus) {
    conditions.push(eq(settlements.settlementStatus, params.settlementStatus));
  }

  // Filter by isSpecial
  if (params.isSpecial !== undefined) {
    conditions.push(eq(settlements.isSpecial, params.isSpecial));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(settlements)
      .where(whereClause)
      .orderBy(desc(settlements.id))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(settlements)
      .where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0].count),
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(Number(countResult[0].count) / params.pageSize),
  };
}

export async function updateSettlement(id: number, data: Partial<InsertSettlement>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(settlements).set(data).where(eq(settlements.id, id));
  return getSettlementById(id);
}

export async function deleteSettlement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(settlements).where(eq(settlements.id, id));
  return { success: true };
}

export async function toggleSpecial(id: number, isSpecial: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(settlements).set({ isSpecial }).where(eq(settlements.id, id));
  return getSettlementById(id);
}

// ==================== Transfer Record CRUD ====================

export async function createTransferRecord(data: {
  settlementIds: number[];
  imageData: string;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Create transfer record
  const result = await db.insert(transferRecords).values({
    imageData: data.imageData,
    note: data.note || "",
  });
  const transferId = result[0].insertId;

  // 2. Create associations
  if (data.settlementIds.length > 0) {
    await db.insert(transferSettlements).values(
      data.settlementIds.map((sid) => ({ transferId, settlementId: sid }))
    );
  }

  // 3. Update settlement transferStatus to "已转"
  if (data.settlementIds.length > 0) {
    await db
      .update(settlements)
      .set({ transferStatus: "已转" })
      .where(inArray(settlements.id, data.settlementIds));
  }

  return { id: transferId, settlementIds: data.settlementIds };
}

export async function getTransferRecordsBySettlementId(settlementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find all transfer records associated with this settlement
  const associations = await db
    .select()
    .from(transferSettlements)
    .where(eq(transferSettlements.settlementId, settlementId));

  if (associations.length === 0) return [];

  // 去重 transferIds
  const transferIds = [...new Set(associations.map((a) => a.transferId))];
  const records = await db
    .select()
    .from(transferRecords)
    .where(inArray(transferRecords.id, transferIds))
    .orderBy(desc(transferRecords.createdAt));

  // 为每条转账记录查询关联的所有订单信息
  const result = await Promise.all(
    records.map(async (record) => {
      // 查出这条转账记录关联的所有 settlementId
      const relatedAssociations = await db
        .select()
        .from(transferSettlements)
        .where(eq(transferSettlements.transferId, record.id));

      const relatedSettlementIds = [...new Set(relatedAssociations.map((a) => a.settlementId))];

      let relatedSettlements: any[] = [];
      if (relatedSettlementIds.length > 0) {
        relatedSettlements = await db
          .select({
            id: settlements.id,
            orderNo: settlements.orderNo,
            groupName: settlements.groupName,
            customerName: settlements.customerName,
            originalPrice: settlements.originalPrice,
            totalPrice: settlements.totalPrice,
            shouldTransfer: settlements.shouldTransfer,
            actualTransfer: settlements.actualTransfer,
          })
          .from(settlements)
          .where(inArray(settlements.id, relatedSettlementIds));
      }

      return {
        ...record,
        relatedSettlements,
      };
    })
  );

  return result;
}

export async function getUntransferredSettlements() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const items = await db
    .select()
    .from(settlements)
    .where(
      sql`(${settlements.transferStatus} = '' OR ${settlements.transferStatus} = '未转' OR ${settlements.transferStatus} IS NULL)`
    )
    .orderBy(desc(settlements.id));

  return items;
}

// ==================== Backup & Restore ====================

export async function exportAllData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [allSettlements, allTransferRecords, allTransferSettlements] = await Promise.all([
    db.select().from(settlements).orderBy(desc(settlements.id)),
    db.select().from(transferRecords).orderBy(desc(transferRecords.id)),
    db.select().from(transferSettlements),
  ]);

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    data: {
      settlements: allSettlements,
      transferRecords: allTransferRecords,
      transferSettlements: allTransferSettlements,
    },
  };
}

export async function importAllData(backupData: {
  data: {
    settlements: any[];
    transferRecords: any[];
    transferSettlements: any[];
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const stats = { settlements: 0, transferRecords: 0, transferSettlements: 0 };

  // Clear existing data (in reverse dependency order)
  await db.delete(transferSettlements);
  await db.delete(transferRecords);
  await db.delete(settlements);

  // Import settlements
  if (backupData.data.settlements && backupData.data.settlements.length > 0) {
    for (const item of backupData.data.settlements) {
      // Convert date strings back to Date objects
      if (item.orderDate && typeof item.orderDate === 'string') {
        item.orderDate = new Date(item.orderDate);
      }
      if (item.createdAt && typeof item.createdAt === 'string') {
        item.createdAt = new Date(item.createdAt);
      }
      if (item.updatedAt && typeof item.updatedAt === 'string') {
        item.updatedAt = new Date(item.updatedAt);
      }
      await db.insert(settlements).values(item);
      stats.settlements++;
    }
  }

  // Import transfer records
  if (backupData.data.transferRecords && backupData.data.transferRecords.length > 0) {
    for (const item of backupData.data.transferRecords) {
      if (item.createdAt && typeof item.createdAt === 'string') {
        item.createdAt = new Date(item.createdAt);
      }
      await db.insert(transferRecords).values(item);
      stats.transferRecords++;
    }
  }

  // Import transfer-settlement associations
  if (backupData.data.transferSettlements && backupData.data.transferSettlements.length > 0) {
    for (const item of backupData.data.transferSettlements) {
      await db.insert(transferSettlements).values(item);
      stats.transferSettlements++;
    }
  }

  return stats;
}

export async function getDistinctStatuses() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [transferStatuses, registrationStatuses, settlementStatuses] = await Promise.all([
    db.selectDistinct({ value: settlements.transferStatus }).from(settlements).where(sql`${settlements.transferStatus} != ''`),
    db.selectDistinct({ value: settlements.registrationStatus }).from(settlements).where(sql`${settlements.registrationStatus} != ''`),
    db.selectDistinct({ value: settlements.settlementStatus }).from(settlements).where(sql`${settlements.settlementStatus} != ''`),
  ]);

  return {
    transferStatuses: transferStatuses.map(r => r.value).filter(Boolean) as string[],
    registrationStatuses: registrationStatuses.map(r => r.value).filter(Boolean) as string[],
    settlementStatuses: settlementStatuses.map(r => r.value).filter(Boolean) as string[],
  };
}

// ==================== Statistics ====================

// 特殊单统计
export async function getSpecialStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. 未转账金额：转账状态为未转的实际转出金额总和
  const [untransferredResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${settlements.actualTransfer}), 0)` })
    .from(settlements)
    .where(and(
      eq(settlements.isSpecial, true),
      sql`(${settlements.transferStatus} = '' OR ${settlements.transferStatus} = '未转' OR ${settlements.transferStatus} IS NULL)`
    ));

  // 2. 垫付金额：结算状态为未结算，且转账状态为已转的实际转出金额总和
  const [advancedResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${settlements.actualTransfer}), 0)` })
    .from(settlements)
    .where(and(
      eq(settlements.isSpecial, true),
      eq(settlements.transferStatus, "已转"),
      sql`(${settlements.settlementStatus} = '' OR ${settlements.settlementStatus} = '未结算' OR ${settlements.settlementStatus} IS NULL)`
    ));

  // 3. 额外利润：结算状态为已结算，转账状态为已转，加价部分实际到手金额总和
  //    加价部分实际到手 = (加价后总价 - 原价) * 0.4 - 实际转出
  const [profitResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(
        (CAST(${settlements.totalPrice} AS DECIMAL(12,2)) - CAST(${settlements.originalPrice} AS DECIMAL(12,2))) * 0.4
        - CAST(${settlements.actualTransfer} AS DECIMAL(12,2))
      ), 0)`
    })
    .from(settlements)
    .where(and(
      eq(settlements.isSpecial, true),
      eq(settlements.transferStatus, "已转"),
      eq(settlements.settlementStatus, "已结算")
    ));

  // 4. 预估特殊利润：转账状态为已转、结算状态为未结算，加价部分实际到手金额总和
  //    加价部分实际到手 = (加价后总价 - 原价) * 0.4 - 实际转出
  const [estimatedProfitResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(
        (CAST(${settlements.totalPrice} AS DECIMAL(12,2)) - CAST(${settlements.originalPrice} AS DECIMAL(12,2))) * 0.4
        - CAST(${settlements.actualTransfer} AS DECIMAL(12,2))
      ), 0)`
    })
    .from(settlements)
    .where(and(
      eq(settlements.isSpecial, true),
      eq(settlements.transferStatus, "已转"),
      sql`(${settlements.settlementStatus} = '' OR ${settlements.settlementStatus} = '未结算' OR ${settlements.settlementStatus} IS NULL)`
    ));

  return {
    untransferredAmount: Number(untransferredResult.total) || 0,
    advancedAmount: Number(advancedResult.total) || 0,
    extraProfit: Number(profitResult.total) || 0,
    estimatedSpecialProfit: Number(estimatedProfitResult.total) || 0,
  };
}

// 结算明细统计（当月）
export async function getSettlementStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  // orderDate 存储的是 UTC 毫秒时间戳（bigint），需要用毫秒时间戳做比较
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  // 当月已接订单数量
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(settlements)
    .where(and(
      sql`${settlements.orderDate} >= ${firstDayOfMonth}`,
      sql`${settlements.orderDate} <= ${lastDayOfMonth}`
    ));

  // 当月预估收入 = 原价总和 * 40%
  const [incomeResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(CAST(${settlements.originalPrice} AS DECIMAL(12,2))), 0)` })
    .from(settlements)
    .where(and(
      sql`${settlements.orderDate} >= ${firstDayOfMonth}`,
      sql`${settlements.orderDate} <= ${lastDayOfMonth}`
    ));

  return {
    monthlyOrderCount: Number(countResult.count) || 0,
    monthlyEstimatedIncome: (Number(incomeResult.total) || 0) * 0.4,
  };
}
