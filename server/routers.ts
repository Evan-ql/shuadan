import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ========== 订单路由 ==========
  orders: router({
    /** 获取订单列表（公开，但需要登录） */
    list: protectedProcedure
      .input(z.object({
        transferStatus: z.enum(["已转", "未转"]).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getOrders(input ?? undefined);
      }),

    /** 获取单个订单 */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getOrderById(input.id);
      }),

    /** 获取统计数据 */
    stats: protectedProcedure.query(async () => {
      return db.getOrderStats();
    }),

    /** 创建订单（仅admin） */
    create: adminProcedure
      .input(z.object({
        orderDate: z.string().optional().default(""),
        orderNo: z.string().optional().default(""),
        groupName: z.string().min(1, "群名不能为空"),
        originalPrice: z.string().or(z.number()).transform(v => String(v)),
        totalPrice: z.string().or(z.number()).transform(v => String(v)),
        actualTransferOut: z.string().or(z.number()).transform(v => String(v)),
        transferStatus: z.enum(["已转", "未转"]).default("未转"),
        registerStatus: z.string().optional().default(""),
        settlementStatus: z.string().optional().default(""),
      }))
      .mutation(async ({ ctx, input }) => {
        const nextIdx = await db.getNextIndex();
        const id = await db.createOrder({
          index: nextIdx,
          orderDate: input.orderDate,
          orderNo: input.orderNo,
          groupName: input.groupName,
          originalPrice: input.originalPrice,
          totalPrice: input.totalPrice,
          actualTransferOut: input.actualTransferOut,
          transferStatus: input.transferStatus,
          registerStatus: input.registerStatus,
          settlementStatus: input.settlementStatus,
          createdBy: ctx.user.id,
        });
        return { id, index: nextIdx };
      }),

    /** 更新订单（仅admin） */
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        orderDate: z.string().optional(),
        orderNo: z.string().optional(),
        groupName: z.string().min(1).optional(),
        originalPrice: z.string().or(z.number()).transform(v => String(v)).optional(),
        totalPrice: z.string().or(z.number()).transform(v => String(v)).optional(),
        actualTransferOut: z.string().or(z.number()).transform(v => String(v)).optional(),
        transferStatus: z.enum(["已转", "未转"]).optional(),
        registerStatus: z.string().optional(),
        settlementStatus: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateOrder(id, data);
        return { success: true };
      }),

    /** 删除订单（仅admin） */
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteOrder(input.id);
        return { success: true };
      }),
  }),

  // ========== 用户管理路由（仅admin） ==========
  users: router({
    /** 获取所有用户 */
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),

    /** 更新用户角色 */
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
