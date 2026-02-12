# 结算管理系统 REST API 文档

**版本:** 1.0.0
**基础路径:** `/api/rest`

本文档为加价结算明细管理系统的 REST API 接口，专为 AI Agent（如 Open Claw）或第三方系统集成设计。所有接口均通过 Bearer Token 进行认证。

---

## 1. 认证

所有 API 请求都需要在 HTTP 请求头中包含 `Authorization` 字段，格式为 `Bearer <your-api-token>`。

**Token 获取:**
在系统启动时，如果环境变量 `API_TOKEN` 未设置，系统会在控制台打印一个自动生成的 Token。请将此 Token 配置到你的 AI Agent 或脚本中。

**请求示例:**
```bash
curl -X GET "http://<your-nas-ip>:3000/api/rest/settlements" \
  -H "Authorization: Bearer <your-api-token>"
```

如果 Token 错误或未提供，API 将返回 `401 Unauthorized` 或 `403 Forbidden` 错误。

---

## 2. 结算记录 (Settlements)

核心资源，用于管理所有结算明细。

### 2.1 查询结算列表

- **GET** `/settlements`
- **描述:** 获取结算记录列表，支持分页、搜索和多条件筛选。
- **查询参数:**

| 参数 | 类型 | 描述 |
|---|---|---|
| `page` | `number` | 页码，默认 `1` |
| `pageSize` | `number` | 每页条数，默认 `20`，最大 `100` |
| `search` | `string` | 搜索关键词（匹配单号、群名、客户名） |
| `isSpecial` | `boolean` | 筛选特殊单 (`true` 或 `false`) |
| `transferStatus` | `string` | 按转账状态筛选（如 `已转`, `未转`） |
| `registrationStatus` | `string` | 按登记状态筛选（如 `已登记`, `未登记`） |
| `settlementStatus` | `string` | 按结算状态筛选（如 `已结算`, `未结算`） |

- **成功响应 (200 OK):**
```json
{
  "items": [
    {
      "id": 1,
      "orderNo": "ORDER-001",
      "groupName": "测试群",
      "originalPrice": "250.00",
      // ... 其他字段
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### 2.2 获取单条记录

- **GET** `/settlements/:id`
- **描述:** 根据 ID 获取单条结算记录的详细信息。
- **成功响应 (200 OK):**
```json
{
  "id": 1,
  "orderNo": "ORDER-001",
  "groupName": "测试群",
  "originalPrice": "250.00",
  // ... 其他字段
}
```

### 2.3 创建结算记录

- **POST** `/settlements`
- **描述:** 创建一条新的结算记录。所有字段均为可选。
- **请求体 (JSON):**
```json
{
  "orderDate": 1678886400000, // 接单日期 (UTC毫秒时间戳)
  "orderNo": "ORDER-002",
  "groupName": "新客户群",
  "customerName": "王五",
  "originalPrice": "300.00",
  "isSpecial": false
}
```
- **成功响应 (201 Created):** 返回新创建的记录对象。

### 2.4 更新结算记录

- **PUT** `/settlements/:id`
- **描述:** 更新指定 ID 的结算记录。只需在请求体中包含需要修改的字段。
- **请求体 (JSON):**
```json
{
  "originalPrice": "350.50",
  "settlementStatus": "已结算"
}
```
- **成功响应 (200 OK):** 返回更新后的完整记录对象。

### 2.5 删除结算记录

- **DELETE** `/settlements/:id`
- **描述:** 删除指定 ID 的结算记录。
- **成功响应 (200 OK):**
```json
{
  "success": true,
  "message": "记录已删除"
}
```

### 2.6 切换特殊单状态

- **PUT** `/settlements/:id/toggle-special`
- **描述:** 标记或取消标记一条记录为“特殊单”。
- **请求体 (JSON):**
```json
{
  "isSpecial": true
}
```
- **成功响应 (200 OK):** 返回更新后的记录对象。

---

## 3. 转账 (Transfers)

管理转账登记和查询。

### 3.1 创建转账登记

- **POST** `/transfers`
- **描述:** 为一个或多个订单进行转账登记，并上传截图凭证。此操作会将关联订单的 `transferStatus` 标记为 `已转`。
- **请求体 (JSON):**
```json
{
  "settlementIds": [1, 2, 5], // 需要标记的订单 ID 数组
  "imageData": "data:image/png;base64,iVBORw0KGgo...", // 截图的 Base64 Data URL
  "note": "三月份第一批转账" // 可选备注
}
```
- **成功响应 (201 Created):**
```json
{
  "id": 1, // 新创建的转账记录 ID
  "settlementIds": [1, 2, 5]
}
```

### 3.2 查询订单的转账记录

- **GET** `/transfers/settlement/:id`
- **描述:** 获取指定订单 ID 关联的所有转账记录（包括截图和备注）。
- **成功响应 (200 OK):** 返回一个转账记录数组。
```json
[
  {
    "id": 1,
    "imageData": "data:image/png;base64,...",
    "note": "三月份第一批转账",
    "createdAt": "2026-02-12T12:00:00.000Z"
  }
]
```

---

## 4. 统计 (Statistics)

获取系统核心业务指标。

### 4.1 获取结算统计

- **GET** `/settlements/stats/settlement`
- **描述:** 获取“结算明细”页面的统计数据。
- **成功响应 (200 OK):**
```json
{
  "monthlyOrderCount": 120, // 当月已接订单总数
  "monthlyEstimatedIncome": 4800.00 // 当月预估收入 (所有订单原价总和 * 40%)
}
```

### 4.2 获取特殊单统计

- **GET** `/settlements/stats/special`
- **描述:** 获取“特殊单明细”页面的统计数据。
- **成功响应 (200 OK):**
```json
{
  "untransferredAmount": 1500.00, // 未转账金额
  "advancedAmount": 3200.50, // 垫付金额
  "extraProfit": 850.75 // 额外利润
}
```

### 4.3 获取未转账订单

- **GET** `/settlements/untransferred`
- **描述:** 获取所有转账状态为“未转”或为空的订单列表。
- **成功响应 (200 OK):** 返回一个结算记录数组。

---

## 5. 数据备份 (Backup)

### 5.1 导出备份

- **GET** `/backup/export`
- **描述:** 导出数据库中所有数据为 JSON 格式。
- **成功响应 (200 OK):** 返回包含所有数据的备份对象。

### 5.2 导入备份

- **POST** `/backup/import`
- **描述:** **（危险操作）** 清空当前所有数据，并从提供的 JSON 文件中导入新数据。
- **请求体 (JSON):** 结构与导出文件一致。
- **成功响应 (200 OK):**
```json
{
  "success": true,
  "message": "数据导入成功",
  "stats": {
    "settlements": 100,
    "transferRecords": 20,
    "transferSettlements": 35
  }
}
```
