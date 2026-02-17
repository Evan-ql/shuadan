/**
 * 创致文化平台同步服务
 * 实现完整的同步流程：验证Token → 同步登记状态 → 同步结算状态 → 上传新订单
 */

import { verifyToken, getAllOrders, submitOrder, type ChuangzhiOrder } from "./chuangzhi";
import {
  getSetting,
  getUnsyncedSettlements,
  getUnregisteredSettlements,
  getUnsettledSettlements,
  batchUpdateRegistrationStatus,
  batchUpdateSettlementStatus,
  createSyncFailure,
  updateSyncFailureStatus,
} from "./db";
import type { Settlement } from "../drizzle/schema";

export interface SyncResult {
  success: boolean;
  message: string;
  steps: SyncStepResult[];
  summary: {
    registered: number;
    settled: number;
    uploaded: number;
    skipped: number;
    failed: number;
  };
  failedOrders: Array<{
    orderNo: string;
    customerName: string;
    amount: string;
    reason: string;
  }>;
  successOrders: Array<{
    orderNo: string;
    customerName: string;
    amount: string;
  }>;
}

export interface SyncStepResult {
  step: string;
  success: boolean;
  message: string;
  count?: number;
}

/**
 * 将毫秒时间戳转换为 "YYYY-MM-DD HH:mm:ss" 格式
 */
function formatTimestamp(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 执行完整同步流程
 * @param mode "normal" | "special"
 */
export async function executeSyncFlow(mode: "normal" | "special"): Promise<SyncResult> {
  const isSpecial = mode === "special";
  const steps: SyncStepResult[] = [];
  const failedOrders: SyncResult["failedOrders"] = [];
  const successOrders: SyncResult["successOrders"] = [];
  const summary = { registered: 0, settled: 0, uploaded: 0, skipped: 0, failed: 0 };

  // Step 1: 验证Token
  const token = await getSetting("chuangzhi_token");
  if (!token) {
    return {
      success: false,
      message: "未配置创致平台Token，请先在设置中配置",
      steps: [{ step: "验证Token", success: false, message: "未配置Token" }],
      summary,
      failedOrders,
      successOrders,
    };
  }

  const tokenResult = await verifyToken(token);
  steps.push({
    step: "验证Token",
    success: tokenResult.valid,
    message: tokenResult.message,
  });

  if (!tokenResult.valid) {
    return {
      success: false,
      message: `Token验证失败: ${tokenResult.message}`,
      steps,
      summary,
      failedOrders,
      successOrders,
    };
  }

  // Step 2: 获取创致平台所有订单
  let chuangzhiOrders: ChuangzhiOrder[];
  try {
    chuangzhiOrders = await getAllOrders(token);
    steps.push({
      step: "获取创致订单",
      success: true,
      message: `获取到 ${chuangzhiOrders.length} 条创致订单`,
      count: chuangzhiOrders.length,
    });
  } catch (err: any) {
    steps.push({
      step: "获取创致订单",
      success: false,
      message: `获取失败: ${err.message}`,
    });
    return {
      success: false,
      message: `获取创致订单失败: ${err.message}`,
      steps,
      summary,
      failedOrders,
      successOrders,
    };
  }

  // 创致订单号集合
  const chuangzhiOrderNos = new Set(chuangzhiOrders.map((o) => o.orderNo));
  // 创致已结算订单号集合
  const chuangzhiSettledOrderNos = new Set(
    chuangzhiOrders.filter((o) => o.financeStatus === 1).map((o) => o.orderNo)
  );

  // Step 3: 同步登记状态
  try {
    const unregistered = await getUnregisteredSettlements();
    const toRegister = unregistered.filter((s) => s.orderNo && chuangzhiOrderNos.has(s.orderNo));
    if (toRegister.length > 0) {
      await batchUpdateRegistrationStatus(
        toRegister.map((s) => s.id),
        "已登记"
      );
    }
    summary.registered = toRegister.length;
    steps.push({
      step: "同步登记状态",
      success: true,
      message: `${toRegister.length} 条订单标记为已登记`,
      count: toRegister.length,
    });
  } catch (err: any) {
    steps.push({
      step: "同步登记状态",
      success: false,
      message: `同步失败: ${err.message}`,
    });
  }

  // Step 4: 同步结算状态
  try {
    const unsettled = await getUnsettledSettlements();
    const toSettle = unsettled.filter((s) => s.orderNo && chuangzhiSettledOrderNos.has(s.orderNo));
    if (toSettle.length > 0) {
      await batchUpdateSettlementStatus(
        toSettle.map((s) => s.id),
        "已结算"
      );
    }
    summary.settled = toSettle.length;
    steps.push({
      step: "同步结算状态",
      success: true,
      message: `${toSettle.length} 条订单标记为已结算`,
      count: toSettle.length,
    });
  } catch (err: any) {
    steps.push({
      step: "同步结算状态",
      success: false,
      message: `同步失败: ${err.message}`,
    });
  }

  // Step 5: 上传新订单
  try {
    const unsynced = await getUnsyncedSettlements(isSpecial);
    let uploadCount = 0;
    let skipCount = 0;

    for (const settlement of unsynced) {
      // 跳过已在创致存在的订单
      if (settlement.orderNo && chuangzhiOrderNos.has(settlement.orderNo)) {
        // 标记为已登记
        await batchUpdateRegistrationStatus([settlement.id], "已登记");
        skipCount++;
        summary.skipped++;
        continue;
      }

      // 前置检查：信息不全的订单直接静默跳过，不记录到失败队列
      const validationError = validateSettlement(settlement, isSpecial);
      if (validationError) {
        skipCount++;
        summary.skipped++;
        continue;
      }

      // 计算金额
      const applyAmount = isSpecial
        ? parseFloat(settlement.totalPrice || "0")
        : parseFloat(settlement.originalPrice || "0");

      // 提交到创致
      try {
        const result = await submitOrder(token, {
          orderNo: settlement.orderNo!,
          customerName: settlement.customerName || "",
          applyAmount,
          customerService: settlement.customerService || "",
          payMethodId: "3", // 默认支付宝
          registerTime: formatTimestamp(settlement.orderDate),
          remark: "",
        });

        if (result.code === 200) {
          // 成功，标记为已登记
          await batchUpdateRegistrationStatus([settlement.id], "已登记");
          uploadCount++;
          summary.uploaded++;
          successOrders.push({
            orderNo: settlement.orderNo!,
            customerName: settlement.customerName || "",
            amount: applyAmount.toFixed(2),
          });
        } else {
          // 失败，记录到失败表并标记登记状态为“同步失败”
          await createSyncFailure({
            settlementId: settlement.id,
            failReason: result.msg || "未知错误",
            syncType: mode,
          });
          await batchUpdateRegistrationStatus([settlement.id], "同步失败");
          failedOrders.push({
            orderNo: settlement.orderNo || "(空)",
            customerName: settlement.customerName || "",
            amount: applyAmount.toFixed(2),
            reason: result.msg || "未知错误",
          });
          summary.failed++;
        }
      } catch (err: any) {
        await createSyncFailure({
          settlementId: settlement.id,
          failReason: `网络错误: ${err.message}`,
          syncType: mode,
        });
        await batchUpdateRegistrationStatus([settlement.id], "同步失败");
        failedOrders.push({
          orderNo: settlement.orderNo || "(空)",
          customerName: settlement.customerName || "",
          amount: applyAmount.toFixed(2),
          reason: `网络错误: ${err.message}`,
        });
        summary.failed++;
      }
    }

    steps.push({
      step: "上传新订单",
      success: true,
      message: `上传 ${uploadCount} 条，跳过 ${skipCount} 条，失败 ${summary.failed} 条`,
      count: uploadCount,
    });
  } catch (err: any) {
    steps.push({
      step: "上传新订单",
      success: false,
      message: `上传失败: ${err.message}`,
    });
  }

  return {
    success: summary.failed === 0,
    message: `同步完成：上传 ${summary.uploaded} 条，登记 ${summary.registered} 条，结算 ${summary.settled} 条，跳过 ${summary.skipped} 条，失败 ${summary.failed} 条`,
    steps,
    summary,
    failedOrders,
    successOrders,
  };
}

/**
 * 单条重新同步
 */
export async function retrySingleSync(
  settlementId: number,
  syncFailureId: number,
  settlement: Settlement
): Promise<{ success: boolean; message: string }> {
  const token = await getSetting("chuangzhi_token");
  if (!token) {
    return { success: false, message: "未配置创致平台Token" };
  }

  const tokenResult = await verifyToken(token);
  if (!tokenResult.valid) {
    return { success: false, message: `Token无效: ${tokenResult.message}` };
  }

  const isSpecial = !!(settlement.isSpecial);
  const applyAmount = isSpecial
    ? parseFloat(settlement.totalPrice || "0")
    : parseFloat(settlement.originalPrice || "0");

  // 前置检查
  const validationError = validateSettlement(settlement, isSpecial);
  if (validationError) {
    return { success: false, message: validationError };
  }

  try {
    const result = await submitOrder(token, {
      orderNo: settlement.orderNo!,
      customerName: settlement.customerName || "",
      applyAmount,
      customerService: settlement.customerService || "",
      payMethodId: "3",
      registerTime: formatTimestamp(settlement.orderDate),
      remark: "",
    });

    if (result.code === 200) {
      // 成功：更新登记状态，标记失败记录为已解决
      await batchUpdateRegistrationStatus([settlementId], "已登记");
      await updateSyncFailureStatus(syncFailureId, "resolved");
      return { success: true, message: "同步成功" };
    } else {
      // 更新失败原因
      await createSyncFailure({
        settlementId,
        failReason: result.msg || "未知错误",
        syncType: isSpecial ? "special" : "normal",
      });
      return { success: false, message: result.msg || "未知错误" };
    }
  } catch (err: any) {
    return { success: false, message: `网络错误: ${err.message}` };
  }
}

/**
 * 验证订单数据是否满足上传条件
 */
function validateSettlement(settlement: Settlement, isSpecial: boolean): string | null {
  // 日期、订单编号、原价/加价后总价、客户名称 任一不全则不参与同步
  if (!settlement.orderNo || settlement.orderNo.trim() === "") {
    return "订单编号为空";
  }
  if (!settlement.customerName || settlement.customerName.trim() === "") {
    return "客户名称为空";
  }
  if (!settlement.orderDate) {
    return "接单日期为空";
  }

  const amount = isSpecial
    ? parseFloat(settlement.totalPrice || "0")
    : parseFloat(settlement.originalPrice || "0");

  if (!amount || amount <= 0) {
    return isSpecial ? "加价后总价为空或为0" : "原价为空或为0";
  }

  return null;
}
