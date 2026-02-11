# ============================================
# 加价结算明细管理系统 - Docker 构建文件
# ============================================

# --- 阶段1: 安装依赖 + 构建 ---
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# 复制依赖文件
COPY package.json ./
COPY pnpm-lock.yaml* ./

# 安装所有依赖（包括 devDependencies 用于构建）
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 复制源代码
COPY . .

# 构建前端 + 后端
RUN pnpm build

# --- 阶段2: 生产运行 ---
FROM node:22-alpine AS runner

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# 复制依赖文件
COPY package.json ./
COPY pnpm-lock.yaml* ./

# 只安装生产依赖
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist

# 复制 drizzle 迁移文件（用于数据库初始化）
COPY --from=builder /app/drizzle ./drizzle

# 环境变量
ENV NODE_ENV=production
ENV PORT=9091

EXPOSE 9091

# 启动服务
CMD ["node", "dist/index.js"]
