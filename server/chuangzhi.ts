/**
 * 创致文化平台 API 客户端
 * 负责与 apply.czwh.cc 的 REST API 交互
 */

const CHUANGZHI_BASE_URL = "http://apply.czwh.cc/prod-api";

export interface ChuangzhiOrder {
  id: string;
  designerId: string;
  payMethodId: string;
  orderNo: string;
  applyAmount: number;
  registerTime: string;
  customerName: string;
  customerService: string;
  financeStatus: number; // 0=未结算, 1=已结算
  settledAmount: number | null;
  designerApplyStatus: number;
  rejectReason: string | null;
  settledTime: string | null;
}

export interface ChuangzhiListResponse {
  code?: number;
  total: number;
  rows: ChuangzhiOrder[];
  msg?: string;
}

export interface ChuangzhiSubmitRequest {
  orderNo: string;
  customerName: string;
  applyAmount: number;
  customerService: string;
  payMethodId: string;
  registerTime: string;
  remark: string;
}

export interface ChuangzhiSubmitResponse {
  code: number;
  msg: string;
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * 验证Token是否有效
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; message: string }> {
  try {
    const resp = await fetch(`${CHUANGZHI_BASE_URL}/getInfo`, {
      headers: getHeaders(token),
    });
    const data = await resp.json();
    if (data.code === 200) {
      return { valid: true, message: "Token有效" };
    }
    return { valid: false, message: data.msg || "Token无效或已过期" };
  } catch (err: any) {
    return { valid: false, message: `连接失败: ${err.message}` };
  }
}

/**
 * 获取创致平台所有订单（分页遍历）
 */
export async function getAllOrders(token: string): Promise<ChuangzhiOrder[]> {
  const allOrders: ChuangzhiOrder[] = [];
  let pageNum = 1;
  const pageSize = 100;

  while (true) {
    const resp = await fetch(
      `${CHUANGZHI_BASE_URL}/business/designer/getDesignOrderList?pageNum=${pageNum}&pageSize=${pageSize}`,
      { headers: getHeaders(token) }
    );
    const data: ChuangzhiListResponse = await resp.json();

    if (!data.rows || data.rows.length === 0) break;

    allOrders.push(...data.rows);

    if (allOrders.length >= data.total) break;
    pageNum++;
  }

  return allOrders;
}

/**
 * 提交单个订单到创致平台
 */
export async function submitOrder(
  token: string,
  order: ChuangzhiSubmitRequest
): Promise<ChuangzhiSubmitResponse> {
  const resp = await fetch(
    `${CHUANGZHI_BASE_URL}/business/designer/submitDesignOrder`,
    {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify(order),
    }
  );
  const data: ChuangzhiSubmitResponse = await resp.json();
  return data;
}
