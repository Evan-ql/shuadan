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
} from "./db";

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
          data: settlementInput.partial(),
        })
      )
      .mutation(async ({ input }) => {
        return updateSettlement(input.id, input.data);
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
  }),
});

export type AppRouter = typeof appRouter;
