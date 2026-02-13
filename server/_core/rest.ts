import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  createSettlement,
  listSettlements,
  updateSettlement,
  deleteSettlement,
  getSettlementById,
  toggleSpecial,
  createTransferRecord,
  getTransferRecordsBySettlementId,
  getUntransferredSettlements,
  exportAllData,
  importAllData,
  getSpecialStats,
  getSettlementStats,
  deleteTransferRecord,
} from "../db";

// ==================== API Token 管理 ====================

// 从环境变量获取 API Token，如果没有设置则自动生成一个
const API_TOKEN = process.env.API_TOKEN || generateDefaultToken();

function generateDefaultToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  console.log("=".repeat(60));
  console.log("[REST API] 未设置 API_TOKEN 环境变量，已自动生成：");
  console.log(`[REST API] API_TOKEN=${token}`);
  console.log("[REST API] 请将此 Token 配置到环境变量中以保持固定");
  console.log("=".repeat(60));
  return token;
}

// 打印当前 API Token（启动时提示）
export function printApiTokenInfo() {
  if (process.env.API_TOKEN) {
    console.log(`[REST API] API Token 已从环境变量加载`);
  }
  console.log(`[REST API] REST API 已启用，基础路径: /api/rest`);
}

// ==================== 认证中间件 ====================

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "未提供认证信息",
      message: "请在请求头中添加 Authorization: Bearer <your-api-token>",
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "认证格式错误",
      message: "请使用 Bearer Token 格式: Authorization: Bearer <your-api-token>",
    });
  }

  const token = parts[1];
  if (token !== API_TOKEN) {
    return res.status(403).json({
      error: "认证失败",
      message: "API Token 无效",
    });
  }

  next();
}

// ==================== 错误处理辅助 ====================

function handleError(res: Response, error: unknown, operation: string) {
  console.error(`[REST API] ${operation} 失败:`, error);
  const message = error instanceof Error ? error.message : "未知错误";
  res.status(500).json({ error: `${operation}失败`, message });
}

// ==================== 创建路由 ====================

export function createRestApiRouter(): Router {
  const router = Router();

  // 所有 REST API 路由都需要认证
  router.use(authMiddleware);

  // --------------------------------------------------
  // 结算记录 CRUD
  // --------------------------------------------------

  /**
   * GET /settlements
   * 查询结算列表（支持分页、搜索、筛选）
   *
   * Query Parameters:
   *   page         - 页码（默认 1）
   *   pageSize     - 每页条数（默认 20，最大 100）
   *   search       - 搜索关键词（群名/单号/客户名）
   *   isSpecial    - 是否特殊单（true/false）
   *   transferStatus      - 转账状态筛选
   *   registrationStatus  - 登记状态筛选
   *   settlementStatus    - 结算状态筛选
   */
  router.get("/settlements", async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const search = (req.query.search as string) || undefined;
      const isSpecial = req.query.isSpecial === "true" ? true : req.query.isSpecial === "false" ? false : undefined;
      const transferStatus = (req.query.transferStatus as string) || undefined;
      const registrationStatus = (req.query.registrationStatus as string) || undefined;
      const settlementStatus = (req.query.settlementStatus as string) || undefined;

      const result = await listSettlements({
        page,
        pageSize,
        search,
        isSpecial,
        transferStatus,
        registrationStatus,
        settlementStatus,
      });

      res.json(result);
    } catch (error) {
      handleError(res, error, "查询结算列表");
    }
  });

  /**
   * GET /settlements/stats/settlement
   * 获取结算明细统计（当月订单数、预估收入）
   */
  router.get("/settlements/stats/settlement", async (_req: Request, res: Response) => {
    try {
      const stats = await getSettlementStats();
      res.json(stats);
    } catch (error) {
      handleError(res, error, "获取结算统计");
    }
  });

  /**
   * GET /settlements/stats/special
   * 获取特殊单统计（未转账金额、垫付金额、额外利润）
   */
  router.get("/settlements/stats/special", async (_req: Request, res: Response) => {
    try {
      const stats = await getSpecialStats();
      res.json(stats);
    } catch (error) {
      handleError(res, error, "获取特殊单统计");
    }
  });

  /**
   * GET /settlements/untransferred
   * 获取所有未转账的订单
   */
  router.get("/settlements/untransferred", async (_req: Request, res: Response) => {
    try {
      const items = await getUntransferredSettlements();
      res.json(items);
    } catch (error) {
      handleError(res, error, "获取未转账订单");
    }
  });

  /**
   * GET /settlements/:id
   * 获取单条结算记录
   */
  router.get("/settlements/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的 ID" });
      }
      const item = await getSettlementById(id);
      if (!item) {
        return res.status(404).json({ error: "记录不存在" });
      }
      res.json(item);
    } catch (error) {
      handleError(res, error, "获取结算记录");
    }
  });

  /**
   * POST /settlements
   * 创建新的结算记录
   *
   * Body (JSON):
   *   orderDate           - 接单日期（UTC 时间戳，毫秒）
   *   orderNo             - 单号
   *   groupName           - 群名
   *   customerName        - 客户名
   *   customerService     - 客服
   *   originalPrice       - 原价（字符串，如 "250.00"）
   *   totalPrice          - 加价后总价
   *   shouldTransfer      - 应转出
   *   actualTransfer      - 实际转出
   *   transferStatus      - 转账状态（"已转"/"未转"/""）
   *   registrationStatus  - 登记状态（"已登记"/"未登记"/""）
   *   settlementStatus    - 结算状态（"已结算"/"未结算"/"部分结算"/""）
   *   isSpecial           - 是否特殊单（boolean）
   *   remark              - 备注
   */
  router.post("/settlements", async (req: Request, res: Response) => {
    try {
      const data = {
        orderDate: req.body.orderDate ?? null,
        orderNo: req.body.orderNo || "",
        groupName: req.body.groupName || "",
        customerName: req.body.customerName || "",
        customerService: req.body.customerService || "",
        originalPrice: req.body.originalPrice || "0",
        totalPrice: req.body.totalPrice || "0",
        shouldTransfer: req.body.shouldTransfer || "0",
        actualTransfer: req.body.actualTransfer || "0",
        transferStatus: req.body.transferStatus || "",
        registrationStatus: req.body.registrationStatus || "",
        settlementStatus: req.body.settlementStatus || "",
        isSpecial: req.body.isSpecial === true,
        remark: req.body.remark || "",
        createdBy: 1, // API 创建的记录默认 createdBy = 1
      };

      const result = await createSettlement(data);
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error, "创建结算记录");
    }
  });

  /**
   * PUT /settlements/:id
   * 更新结算记录
   *
   * Body (JSON): 同 POST，所有字段可选（只传需要更新的字段）
   */
  router.put("/settlements/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的 ID" });
      }

      // 检查记录是否存在
      const existing = await getSettlementById(id);
      if (!existing) {
        return res.status(404).json({ error: "记录不存在" });
      }

      // 只更新传入的字段
      const data: Record<string, any> = {};
      const allowedFields = [
        "orderDate", "orderNo", "groupName", "customerName", "customerService",
        "originalPrice", "totalPrice", "shouldTransfer", "actualTransfer",
        "transferStatus", "registrationStatus", "settlementStatus",
        "isSpecial", "remark",
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      const result = await updateSettlement(id, data);
      res.json(result);
    } catch (error) {
      handleError(res, error, "更新结算记录");
    }
  });

  /**
   * DELETE /settlements/:id
   * 删除结算记录
   */
  router.delete("/settlements/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的 ID" });
      }

      const existing = await getSettlementById(id);
      if (!existing) {
        return res.status(404).json({ error: "记录不存在" });
      }

      await deleteSettlement(id);
      res.json({ success: true, message: "记录已删除" });
    } catch (error) {
      handleError(res, error, "删除结算记录");
    }
  });

  /**
   * PUT /settlements/:id/toggle-special
   * 切换特殊单状态
   *
   * Body (JSON):
   *   isSpecial - 是否标记为特殊单（boolean）
   */
  router.put("/settlements/:id/toggle-special", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的 ID" });
      }

      const isSpecial = req.body.isSpecial === true;
      const result = await toggleSpecial(id, isSpecial);
      res.json(result);
    } catch (error) {
      handleError(res, error, "切换特殊单状态");
    }
  });

  // --------------------------------------------------
  // 转账记录
  // --------------------------------------------------

  /**
   * POST /transfers
   * 创建转账登记（批量标记已转账 + 上传截图凭证）
   *
   * Body (JSON):
   *   settlementIds - 订单 ID 数组（如 [1, 2, 3]）
   *   imageData     - 转账截图（base64 Data URL）
   *   note          - 备注（可选）
   */
  router.post("/transfers", async (req: Request, res: Response) => {
    try {
      const { settlementIds, imageData, note } = req.body;

      if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
        return res.status(400).json({ error: "请至少选择一个订单", message: "settlementIds 必须是非空数组" });
      }
      if (!imageData) {
        return res.status(400).json({ error: "请上传转账截图", message: "imageData 不能为空" });
      }

      const result = await createTransferRecord({
        settlementIds: settlementIds.map(Number),
        imageData,
        note: note || "",
      });

      res.status(201).json(result);
    } catch (error) {
      handleError(res, error, "创建转账登记");
    }
  });

  /**
   * GET /transfers/settlement/:id
   * 查询某个订单关联的转账记录
   */
  router.get("/transfers/settlement/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的 ID" });
      }

      const records = await getTransferRecordsBySettlementId(id);
      res.json(records);
    } catch (error) {
      handleError(res, error, "查询转账记录");
    }
  });

  /**
   * DELETE /transfers/:id
   * 删除转账记录（同时清理关联并回滚订单状态）
   */
  router.delete("/transfers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的 ID" });
      }

      const result = await deleteTransferRecord(id);
      res.json(result);
    } catch (error) {
      handleError(res, error, "删除转账记录");
    }
  });

  // --------------------------------------------------
  // 数据备份
  // --------------------------------------------------

  /**
   * GET /backup/export
   * 导出所有数据（JSON 格式备份）
   */
  router.get("/backup/export", async (_req: Request, res: Response) => {
    try {
      const data = await exportAllData();
      res.json(data);
    } catch (error) {
      handleError(res, error, "导出数据");
    }
  });

  /**
   * POST /backup/import
   * 导入备份数据（会清空现有数据后导入）
   *
   * Body (JSON):
   *   data.settlements          - 结算记录数组
   *   data.transferRecords      - 转账记录数组
   *   data.transferSettlements  - 转账关联数组
   */
  router.post("/backup/import", async (req: Request, res: Response) => {
    try {
      const { data } = req.body;

      if (!data || !data.settlements) {
        return res.status(400).json({
          error: "无效的备份数据",
          message: "请提供包含 data.settlements 的 JSON 数据",
        });
      }

      const stats = await importAllData({ data });
      res.json({
        success: true,
        message: "数据导入成功",
        stats,
      });
    } catch (error) {
      handleError(res, error, "导入数据");
    }
  });

  // --------------------------------------------------
  // API 信息
  // --------------------------------------------------

  /**
   * GET /info
   * 获取 API 基本信息
   */
  router.get("/info", async (_req: Request, res: Response) => {
    res.json({
      name: "结算管理系统 REST API",
      version: "1.0.0",
      description: "加价结算明细管理系统的 REST API 接口，支持订单管理、转账登记、统计查询等功能",
      endpoints: {
        settlements: {
          list: "GET /api/rest/settlements",
          getById: "GET /api/rest/settlements/:id",
          create: "POST /api/rest/settlements",
          update: "PUT /api/rest/settlements/:id",
          delete: "DELETE /api/rest/settlements/:id",
          toggleSpecial: "PUT /api/rest/settlements/:id/toggle-special",
          untransferred: "GET /api/rest/settlements/untransferred",
          settlementStats: "GET /api/rest/settlements/stats/settlement",
          specialStats: "GET /api/rest/settlements/stats/special",
        },
        transfers: {
          create: "POST /api/rest/transfers",
          getBySettlement: "GET /api/rest/transfers/settlement/:id",
        },
        backup: {
          export: "GET /api/rest/backup/export",
          import: "POST /api/rest/backup/import",
        },
      },
    });
  });

  return router;
}
