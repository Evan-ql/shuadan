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
} from "./db";

const HARDCODED_USERNAME = "Evan";
const HARDCODED_PASSWORD = "jiao662532";

const settlementInput = z.object({
  orderDate: z.number().nullable().optional(),
  orderNo: z.string().optional().default(""),
  groupName: z.string().optional().default(""),
  customerService: z.string().optional().default(""),
  originalPrice: z.string().optional().default("0"),
  totalPrice: z.string().optional().default("0"),
  actualTransfer: z.string().optional().default("0"),
  transferStatus: z.string().optional().default(""),
  registrationStatus: z.string().optional().default(""),
  settlementStatus: z.string().optional().default(""),
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
        if (input.username !== HARDCODED_USERNAME || input.password !== HARDCODED_PASSWORD) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        // Use a fixed openId for this hardcoded user
        const openId = `local_user_${HARDCODED_USERNAME}`;

        // Upsert user in database
        await upsertUser({
          openId,
          name: HARDCODED_USERNAME,
          email: null,
          loginMethod: "password",
          lastSignedIn: new Date(),
        });

        // Create session token
        const sessionToken = await sdk.createSessionToken(openId, {
          name: HARDCODED_USERNAME,
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

    statuses: protectedProcedure.query(async () => {
      return getDistinctStatuses();
    }),
  }),
});

export type AppRouter = typeof appRouter;
