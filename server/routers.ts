import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import {
  createSettlement,
  listSettlements,
  updateSettlement,
  deleteSettlement,
  getSettlementById,
  getDistinctStatuses,
  upsertUser,
  getUserByOpenId,
  toggleSpecial,
  createTransferRecord,
  getTransferRecordsBySettlementId,
  getUntransferredSettlements,
  deleteTransferRecord,
  exportAllData,
  importAllData,
  getSpecialStats,
  getSettlementStats,
  getSetting,
  setSetting,
  listSyncFailures,
  updateSyncFailureStatus,
  deleteSyncFailure,
} from "./db";
import { verifyToken } from "./chuangzhi";
import { executeSyncFlow, retrySingleSync } from "./syncService";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const settlementInput = z.object({
  orderDate: z.number().nullable().optional(),
  orderNo: z.string().optional().default(""),
  groupName: z.string().optional().default(""),
  customerName: z.string().optional().default(""),
  customerService: z.string().optional().default(""),
  originalPrice: z.string().optional().default("0"),
  totalPrice: z.string().optional().default("0"),
  shouldTransfer: z.string().optional().default("0"),
  actualTransfer: z.string().optional().default("0"),
  transferStatus: z.string().optional().default(""),
  registrationStatus: z.string().optional().default(""),
  settlementStatus: z.string().optional().default(""),
  isSpecial: z.boolean().optional().default(false),
  remark: z.string().optional().default(""),
});

// 更新用的 schema：不带 default 值，未传的字段保持 undefined，不会覆盖数据库中的值
const settlementUpdateInput = z.object({
  orderDate: z.number().nullable().optional(),
  orderNo: z.string().optional(),
  groupName: z.string().optional(),
  customerName: z.string().optional(),
  customerService: z.string().optional(),
  originalPrice: z.string().optional(),
  totalPrice: z.string().optional(),
  shouldTransfer: z.string().optional(),
  actualTransfer: z.string().optional(),
  transferStatus: z.string().optional(),
  registrationStatus: z.string().optional(),
  settlementStatus: z.string().optional(),
  isSpecial: z.boolean().optional(),
  remark: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(
        z.object({
          username: z.string(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.username !== ADMIN_USERNAME || input.password !== ADMIN_PASSWORD) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        // Use a fixed openId for this hardcoded user
        const openId = `local_user_${ADMIN_USERNAME}`;

        // Upsert user in database
        await upsertUser({
          openId,
          name: ADMIN_USERNAME,
          email: null,
          loginMethod: "password",
          lastSignedIn: new Date(),
        });

        // Create session token
        const sessionToken = await sdk.createSessionToken(openId, {
          name: ADMIN_USERNAME,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        const user = await getUserByOpenId(openId);
        return user;
      }),
  }),

  settlement: router({
    create: protectedProcedure
      .input(settlementInput)
      .mutation(async ({ input, ctx }) => {
        return createSettlement({
          ...input,
          createdBy: ctx.user.id,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(20),
          search: z.string().optional(),
          transferStatus: z.string().optional(),
          registrationStatus: z.string().optional(),
          settlementStatus: z.string().optional(),
          isSpecial: z.boolean().optional(),
        })
      )
      .query(async ({ input }) => {
        return listSettlements(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getSettlementById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: settlementUpdateInput,
        })
      )
      .mutation(async ({ input }) => {
        // 过滤掉 undefined 的字段，只更新实际传递的字段
        const cleanData = Object.fromEntries(
          Object.entries(input.data).filter(([_, v]) => v !== undefined)
        );
        return updateSettlement(input.id, cleanData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteSettlement(input.id);
      }),

    toggleSpecial: protectedProcedure
      .input(z.object({ id: z.number(), isSpecial: z.boolean() }))
      .mutation(async ({ input }) => {
        return toggleSpecial(input.id, input.isSpecial);
      }),

    statuses: protectedProcedure.query(async () => {
      return getDistinctStatuses();
    }),

    specialStats: protectedProcedure.query(async () => {
      return getSpecialStats();
    }),

    settlementStats: protectedProcedure.query(async () => {
      return getSettlementStats();
    }),
  }),

  backup: router({
    // 导出所有数据
    export: protectedProcedure.query(async () => {
      return exportAllData();
    }),

    // 导入备份数据
    import: protectedProcedure
      .input(
        z.object({
          data: z.object({
            settlements: z.array(z.any()),
            transferRecords: z.array(z.any()),
            transferSettlements: z.array(z.any()),
          }),
        })
      )
      .mutation(async ({ input }) => {
        return importAllData(input);
      }),
  }),

  transfer: router({
    // 创建转账记录（批量标记已转账 + 上传截图）
    create: protectedProcedure
      .input(
        z.object({
          settlementIds: z.array(z.number()).min(1, "请至少选择一个订单"),
          imageData: z.string().min(1, "请上传转账截图"),
          note: z.string().optional().default(""),
        })
      )
      .mutation(async ({ input }) => {
        return createTransferRecord(input);
      }),

    // 查询某个订单的转账记录
    getBySettlement: protectedProcedure
      .input(z.object({ settlementId: z.number() }))
      .query(async ({ input }) => {
        return getTransferRecordsBySettlementId(input.settlementId);
      }),

    // 获取所有未转账的订单
    untransferred: protectedProcedure.query(async () => {
      return getUntransferredSettlements();
    }),

    // 删除转账记录
    delete: protectedProcedure
      .input(z.object({ transferId: z.number() }))
      .mutation(async ({ input }) => {
        return deleteTransferRecord(input.transferId);
      }),
  }),

  // ==================== 创致同步模块 ====================
  chuangzhi: router({
    // Token管理
    getToken: protectedProcedure.query(async () => {
      const token = await getSetting("chuangzhi_token");
      return { token: token ? "已配置" : null, hasToken: !!token };
    }),

    saveToken: protectedProcedure
      .input(z.object({ token: z.string().min(1, "Token不能为空") }))
      .mutation(async ({ input }) => {
        await setSetting("chuangzhi_token", input.token);
        return { success: true };
      }),

    verifyToken: protectedProcedure.mutation(async () => {
      const token = await getSetting("chuangzhi_token");
      if (!token) {
        return { valid: false, message: "未配置Token" };
      }
      return verifyToken(token);
    }),

    // 执行同步
    sync: protectedProcedure
      .input(
        z.object({
          mode: z.enum(["normal", "special"]),
        })
      )
      .mutation(async ({ input }) => {
        return executeSyncFlow(input.mode);
      }),

    // 单条重新同步
    retrySync: protectedProcedure
      .input(
        z.object({
          syncFailureId: z.number(),
          settlementId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const settlement = await getSettlementById(input.settlementId);
        if (!settlement) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "订单记录不存在",
          });
        }
        return retrySingleSync(input.settlementId, input.syncFailureId, settlement);
      }),

    // 失败记录列表
    failures: protectedProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(20),
          status: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return listSyncFailures(input);
      }),

    // 忽略失败记录
    ignoreFailure: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return updateSyncFailureStatus(input.id, "ignored");
      }),

    // 删除失败记录
    deleteFailure: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteSyncFailure(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
