import { eq, like, and, desc, sql, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, settlements, InsertSettlement, Settlement } from "../drizzle/schema";
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: SQL[] = [];

  if (params.search) {
    const searchPattern = `%${params.search}%`;
    conditions.push(
      sql`(${settlements.groupName} LIKE ${searchPattern} OR ${settlements.orderNo} LIKE ${searchPattern})`
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
