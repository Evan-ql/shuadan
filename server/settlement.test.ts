import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => {
  const mockSettlement = {
    id: 1,
    orderDate: 1707408720000,
    orderNo: "TEST001",
    groupName: "测试群",
    originalPrice: "250.00",
    totalPrice: "370.00",
    actualTransfer: "48.00",
    transferStatus: "已转",
    registrationStatus: "已登记",
    settlementStatus: "已结算",
    remark: "测试备注",
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 1,
    openId: "local_user_Evan",
    name: "Evan",
    email: null,
    loginMethod: "password",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    createSettlement: vi.fn().mockResolvedValue(mockSettlement),
    listSettlements: vi.fn().mockResolvedValue({
      items: [mockSettlement],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
    getSettlementById: vi.fn().mockResolvedValue(mockSettlement),
    updateSettlement: vi.fn().mockResolvedValue({
      ...mockSettlement,
      groupName: "修改后群名",
    }),
    deleteSettlement: vi.fn().mockResolvedValue({ success: true }),
    getDistinctStatuses: vi.fn().mockResolvedValue({
      transferStatuses: ["已转", "未转"],
      registrationStatuses: ["已登记", "未登记"],
      settlementStatuses: ["已结算", "未结算"],
    }),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getUserByOpenId: vi.fn().mockResolvedValue(mockUser),
  };
});

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createAuthContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  return {
    ctx: {
      user: {
        id: 1,
        openId: "local_user_Evan",
        email: null,
        name: "Evan",
        loginMethod: "password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
        clearCookie: (name: string, options: Record<string, unknown>) => {
          cookies.push({ name, options });
        },
      } as unknown as TrpcContext["res"],
    },
    cookies,
  };
}

function createUnauthContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  return {
    ctx: {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
        clearCookie: (name: string, options: Record<string, unknown>) => {
          cookies.push({ name, options });
        },
      } as unknown as TrpcContext["res"],
    },
    cookies,
  };
}

describe("auth.login", () => {
  it("rejects wrong credentials", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "wrong", password: "wrong" })
    ).rejects.toThrow("用户名或密码错误");
  });

  it("rejects wrong password with correct username", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "Evan", password: "wrongpass" })
    ).rejects.toThrow("用户名或密码错误");
  });

  it("accepts correct credentials and sets cookie", async () => {
    const { ctx, cookies } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "Evan",
      password: "jiao662532",
    });

    expect(result).toBeDefined();
    expect(result!.name).toBe("Evan");
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe("app_session_id");
    expect(cookies[0]?.value).toBeDefined();
    expect(cookies[0]?.options).toMatchObject({
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, cookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe("app_session_id");
    expect(cookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("settlement router", () => {
  let authCaller: ReturnType<typeof appRouter.createCaller>;
  let unauthCaller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const auth = createAuthContext();
    const unauth = createUnauthContext();
    authCaller = appRouter.createCaller(auth.ctx);
    unauthCaller = appRouter.createCaller(unauth.ctx);
  });

  describe("create", () => {
    it("creates a settlement record when authenticated", async () => {
      const result = await authCaller.settlement.create({
        orderDate: 1707408720000,
        orderNo: "TEST001",
        groupName: "测试群",
        originalPrice: "250.00",
        totalPrice: "370.00",
        actualTransfer: "48.00",
        transferStatus: "已转",
        registrationStatus: "已登记",
        settlementStatus: "已结算",
        remark: "测试备注",
      });

      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(result!.groupName).toBe("测试群");
    });

    it("rejects unauthenticated create", async () => {
      await expect(
        unauthCaller.settlement.create({
          orderNo: "TEST001",
          groupName: "测试群",
        })
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("returns paginated settlement list", async () => {
      const result = await authCaller.settlement.list({
        page: 1,
        pageSize: 20,
      });

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("supports search filter", async () => {
      const result = await authCaller.settlement.list({
        page: 1,
        pageSize: 20,
        search: "测试",
      });

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
    });

    it("supports status filters", async () => {
      const result = await authCaller.settlement.list({
        page: 1,
        pageSize: 20,
        transferStatus: "已转",
        registrationStatus: "已登记",
        settlementStatus: "已结算",
      });

      expect(result).toBeDefined();
    });

    it("rejects unauthenticated list", async () => {
      await expect(
        unauthCaller.settlement.list({ page: 1, pageSize: 20 })
      ).rejects.toThrow();
    });
  });

  describe("getById", () => {
    it("returns a single settlement", async () => {
      const result = await authCaller.settlement.getById({ id: 1 });

      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(result!.orderNo).toBe("TEST001");
    });
  });

  describe("update", () => {
    it("updates a settlement record", async () => {
      const result = await authCaller.settlement.update({
        id: 1,
        data: { groupName: "修改后群名" },
      });

      expect(result).toBeDefined();
      expect(result!.groupName).toBe("修改后群名");
    });

    it("rejects unauthenticated update", async () => {
      await expect(
        unauthCaller.settlement.update({
          id: 1,
          data: { groupName: "test" },
        })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes a settlement record", async () => {
      const result = await authCaller.settlement.delete({ id: 1 });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("rejects unauthenticated delete", async () => {
      await expect(
        unauthCaller.settlement.delete({ id: 1 })
      ).rejects.toThrow();
    });
  });

  describe("statuses", () => {
    it("returns distinct status values", async () => {
      const result = await authCaller.settlement.statuses();

      expect(result).toBeDefined();
      expect(result.transferStatuses).toContain("已转");
      expect(result.registrationStatuses).toContain("已登记");
      expect(result.settlementStatuses).toContain("已结算");
    });
  });
});
