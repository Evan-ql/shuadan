import { eq, like, and, desc, sql, SQL, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, settlements, InsertSettlement, Settlement, transferRecords, transferSettlements, settings, syncFailures } from "../drizzle/schema";
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

export async function batchCreateSettlements(dataList: InsertSettlement[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (dataList.length === 0) return { count: 0 };

  await db.insert(settlements).values(dataList);
  return { count: dataList.length };
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

  // 0. 防重复检查：过滤掉已经有转账记录的订单
  let filteredIds = data.settlementIds;
  if (filteredIds.length > 0) {
    const existingAssociations = await db
      .select({ settlementId: transferSettlements.settlementId })
      .from(transferSettlements)
      .where(inArray(transferSettlements.settlementId, filteredIds));
    const alreadyTransferred = new Set(existingAssociations.map((a) => a.settlementId));
    filteredIds = filteredIds.filter((id) => !alreadyTransferred.has(id));
  }

  if (filteredIds.length === 0) {
    throw new Error("所选订单已全部完成转账登记，无需重复操作");
  }

  // 1. Create transfer record
  const result = await db.insert(transferRecords).values({
    imageData: data.imageData,
    note: data.note || "",
  });
  const transferId = result[0].insertId;

  // 2. Create associations
  await db.insert(transferSettlements).values(
    filteredIds.map((sid) => ({ transferId, settlementId: sid }))
  );

  // 3. Update settlement transferStatus to "已转"
  await db
    .update(settlements)
    .set({ transferStatus: "已转" })
    .where(inArray(settlements.id, filteredIds));

  const skippedCount = data.settlementIds.length - filteredIds.length;
  return { id: transferId, settlementIds: filteredIds, skippedCount };
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
  const transferIds = Array.from(new Set(associations.map((a) => a.transferId)));
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

      const relatedSettlementIds = Array.from(new Set(relatedAssociations.map((a) => a.settlementId)));

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

export async function deleteTransferRecord(transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. 查出该转账记录关联的所有订单
  const associations = await db
    .select({ settlementId: transferSettlements.settlementId })
    .from(transferSettlements)
    .where(eq(transferSettlements.transferId, transferId));

  const settlementIds = associations.map((a) => a.settlementId);

  // 2. 删除关联记录
  await db.delete(transferSettlements).where(eq(transferSettlements.transferId, transferId));

  // 3. 删除转账记录
  await db.delete(transferRecords).where(eq(transferRecords.id, transferId));

  // 4. 检查这些订单是否还有其他转账记录，如果没有则将状态改回"未转"
  if (settlementIds.length > 0) {
    for (const sid of settlementIds) {
      const remaining = await db
        .select({ id: transferSettlements.id })
        .from(transferSettlements)
        .where(eq(transferSettlements.settlementId, sid))
        .limit(1);
      if (remaining.length === 0) {
        await db
          .update(settlements)
          .set({ transferStatus: "未转" })
          .where(eq(settlements.id, sid));
      }
    }
  }

  return { deletedTransferId: transferId, affectedSettlements: settlementIds };
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

  // Use raw SQL for maximum compatibility
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'`);

  try {
    // Clear existing data
    try { await db.execute(sql`TRUNCATE TABLE transfer_settlements`); } catch(e) { console.warn('[Import] truncate transfer_settlements failed:', e); }
    try { await db.execute(sql`TRUNCATE TABLE transfer_records`); } catch(e) { console.warn('[Import] truncate transfer_records failed:', e); }
    try { await db.execute(sql`TRUNCATE TABLE settlements`); } catch(e) { console.warn('[Import] truncate settlements failed:', e); }

    // Helper: format ISO date string to MySQL datetime
    const formatTimestamp = (val: any): string => {
      if (!val) return new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (typeof val === 'string') {
        // "2026-02-12T16:37:20.000Z" -> "2026-02-12 16:37:20"
        return val.slice(0, 19).replace('T', ' ');
      }
      if (val instanceof Date) {
        return val.toISOString().slice(0, 19).replace('T', ' ');
      }
      // fallback
      return new Date().toISOString().slice(0, 19).replace('T', ' ');
    };

    // Helper: safe string
    const str = (val: any, fallback = ''): string => {
      if (val === null || val === undefined) return fallback;
      return String(val);
    };

    // Helper: safe number or null
    const numOrNull = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };

    // Import settlements using raw SQL
    if (backupData.data.settlements && backupData.data.settlements.length > 0) {
      for (const item of backupData.data.settlements) {
        try {
          const id = Number(item.id);
          const orderDate = numOrNull(item.orderDate);
          const orderNo = str(item.orderNo);
          const groupName = str(item.groupName);
          const customerName = str(item.customerName);
          const customerService = str(item.customerService);
          const originalPrice = str(item.originalPrice, '0');
          const totalPrice = str(item.totalPrice, '0');
          const shouldTransfer = str(item.shouldTransfer, '0');
          const actualTransfer = str(item.actualTransfer, '0');
          const transferStatus = str(item.transferStatus);
          const registrationStatus = str(item.registrationStatus);
          const settlementStatus = str(item.settlementStatus);
          const isSpecialVal = item.isSpecial ? 1 : 0;
          const remark = str(item.remark);
          const createdBy = numOrNull(item.createdBy);
          const createdAt = formatTimestamp(item.createdAt);
          const updatedAt = formatTimestamp(item.updatedAt);

          console.log(`[Import] Settlement #${id}: orderDate=${orderDate}, isSpecial=${isSpecialVal}, createdAt=${createdAt}`);

          await db.execute(sql`INSERT INTO settlements
            (id, orderDate, orderNo, groupName, customerName, customerService,
             originalPrice, totalPrice, shouldTransfer, actualTransfer,
             transferStatus, registrationStatus, settlementStatus,
             isSpecial, remark, createdBy, createdAt, updatedAt)
            VALUES (
              ${id},
              ${orderDate},
              ${orderNo},
              ${groupName},
              ${customerName},
              ${customerService},
              ${originalPrice},
              ${totalPrice},
              ${shouldTransfer},
              ${actualTransfer},
              ${transferStatus},
              ${registrationStatus},
              ${settlementStatus},
              ${isSpecialVal},
              ${remark},
              ${createdBy},
              ${createdAt},
              ${updatedAt}
            )`);
          stats.settlements++;
        } catch (err: any) {
          console.error(`[Import] Failed to insert settlement #${item.id}:`, err.message);
          console.error(`[Import] Settlement data:`, JSON.stringify(item));
          throw new Error(`导入结算记录 #${item.id} 失败: ${err.message}`);
        }
      }
    }

    // Import transfer records using raw SQL
    if (backupData.data.transferRecords && backupData.data.transferRecords.length > 0) {
      for (const item of backupData.data.transferRecords) {
        try {
          const id = Number(item.id);
          const imageData = item.imageData ?? null;
          const note = item.note ?? null;
          const createdAt = formatTimestamp(item.createdAt);

          await db.execute(sql`INSERT INTO transfer_records
            (id, imageData, note, createdAt)
            VALUES (
              ${id},
              ${imageData},
              ${note},
              ${createdAt}
            )`);
          stats.transferRecords++;
        } catch (err: any) {
          console.error(`[Import] Failed to insert transfer_record #${item.id}:`, err.message);
          throw new Error(`导入转账记录 #${item.id} 失败: ${err.message}`);
        }
      }
    }

    // Import transfer-settlement associations using raw SQL
    if (backupData.data.transferSettlements && backupData.data.transferSettlements.length > 0) {
      for (const item of backupData.data.transferSettlements) {
        try {
          await db.execute(sql`INSERT INTO transfer_settlements
            (id, transferId, settlementId)
            VALUES (
              ${Number(item.id)},
              ${Number(item.transferId)},
              ${Number(item.settlementId)}
            )`);
          stats.transferSettlements++;
        } catch (err: any) {
          console.error(`[Import] Failed to insert transfer_settlement #${item.id}:`, err.message);
          throw new Error(`导入转账关联 #${item.id} 失败: ${err.message}`);
        }
      }
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
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

// ==================== Settings CRUD ====================

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result.length > 0 ? (result[0].value ?? null) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({
    set: { value },
  });
}

// ==================== Sync Failures CRUD ====================

export async function createSyncFailure(data: {
  settlementId: number;
  failReason: string;
  syncType: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 先检查是否已有pending的失败记录，有则更新
  const existing = await db
    .select()
    .from(syncFailures)
    .where(
      and(
        eq(syncFailures.settlementId, data.settlementId),
        eq(syncFailures.status, "pending")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(syncFailures)
      .set({ failReason: data.failReason, syncType: data.syncType })
      .where(eq(syncFailures.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(syncFailures).values({
    settlementId: data.settlementId,
    failReason: data.failReason,
    syncType: data.syncType,
    status: "pending",
  });
  return result[0].insertId;
}

export async function listSyncFailures(params: {
  page: number;
  pageSize: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: SQL[] = [];
  if (params.status) {
    conditions.push(eq(syncFailures.status, params.status));
  } else {
    // 默认只显示pending
    conditions.push(eq(syncFailures.status, "pending"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: syncFailures.id,
        settlementId: syncFailures.settlementId,
        failReason: syncFailures.failReason,
        syncType: syncFailures.syncType,
        status: syncFailures.status,
        createdAt: syncFailures.createdAt,
        // Join settlement data
        orderNo: settlements.orderNo,
        groupName: settlements.groupName,
        customerName: settlements.customerName,
        customerService: settlements.customerService,
        originalPrice: settlements.originalPrice,
        totalPrice: settlements.totalPrice,
        isSpecial: settlements.isSpecial,
        orderDate: settlements.orderDate,
      })
      .from(syncFailures)
      .innerJoin(settlements, eq(syncFailures.settlementId, settlements.id))
      .where(whereClause)
      .orderBy(desc(syncFailures.createdAt))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(syncFailures)
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

export async function updateSyncFailureStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(syncFailures).set({ status }).where(eq(syncFailures.id, id));
  return { success: true };
}

export async function deleteSyncFailure(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(syncFailures).where(eq(syncFailures.id, id));
  return { success: true };
}

// ==================== Sync Helpers ====================

/**
 * 获取所有未登记且未结算的订单（用于上传到创致）
 */
export async function getUnsyncedSettlements(isSpecial: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const items = await db
    .select()
    .from(settlements)
    .where(
      and(
        eq(settlements.isSpecial, isSpecial),
        sql`(${settlements.settlementStatus} = '' OR ${settlements.settlementStatus} = '未结算' OR ${settlements.settlementStatus} IS NULL)`,
        sql`(${settlements.registrationStatus} = '' OR ${settlements.registrationStatus} = '未登记' OR ${settlements.registrationStatus} IS NULL)`
      )
    )
    .orderBy(desc(settlements.id));

  return items;
}

/**
 * 批量更新登记状态
 */
export async function batchUpdateRegistrationStatus(ids: number[], status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (ids.length === 0) return;
  await db
    .update(settlements)
    .set({ registrationStatus: status })
    .where(inArray(settlements.id, ids));
}

/**
 * 批量更新结算状态
 */
export async function batchUpdateSettlementStatus(ids: number[], status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (ids.length === 0) return;
  await db
    .update(settlements)
    .set({ settlementStatus: status })
    .where(inArray(settlements.id, ids));
}

/**
 * 获取所有未结算的订单（用于同步结算状态）
 */
export async function getUnsettledSettlements() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(settlements)
    .where(
      sql`(${settlements.settlementStatus} = '' OR ${settlements.settlementStatus} = '未结算' OR ${settlements.settlementStatus} IS NULL)`
    );
}

/**
 * 获取所有未登记的订单（用于同步登记状态）
 */
export async function getUnregisteredSettlements() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(settlements)
    .where(
      sql`(${settlements.registrationStatus} = '' OR ${settlements.registrationStatus} = '未登记' OR ${settlements.registrationStatus} IS NULL)`
    );
}
