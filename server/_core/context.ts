import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// 默认用户，跳过登录认证
const defaultUser: User = {
  id: 1,
  openId: "local_user_admin",
  name: "Evan",
  email: null,
  loginMethod: "password",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication failed, use default user to skip login
    user = null;
  }

  // 如果没有认证用户，使用默认用户（跳过登录）
  if (!user) {
    user = defaultUser;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
