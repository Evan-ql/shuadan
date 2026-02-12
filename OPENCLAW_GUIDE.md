# Open Claw 配置指南

本指南帮助你将结算管理系统的 REST API 配置到 Open Claw（或其他 AI Agent）中。

---

## 1. 准备工作

### 1.1 设置 API Token

在 NAS 上部署系统时，需要在环境变量中设置 `API_TOKEN`：

```bash
# 在 docker-compose.yml 或启动命令中添加
API_TOKEN=你的自定义密钥
```

如果不设置，系统启动时会自动生成一个 Token 并打印在控制台日志中。

### 1.2 确认系统地址

假设你的 NAS 内网 IP 为 `192.168.88.247`，系统运行在端口 `9091`，则 API 基础地址为：

```
http://192.168.88.247:9091/api/rest
```

---

## 2. 配置 Open Claw

在 Open Claw 中配置系统 Prompt 或工具描述时，可以参考以下内容：

### 2.1 系统 Prompt 示例

```
你是一个结算管理助手，可以通过 REST API 操作结算管理系统。

API 基础地址: http://192.168.88.247:9091/api/rest
认证方式: 在所有请求的 Header 中添加 Authorization: Bearer <API_TOKEN>

你可以执行以下操作：

【查询】
- 查询结算列表: GET /settlements?page=1&pageSize=20&search=关键词
- 查询特殊单: GET /settlements?isSpecial=true
- 获取单条记录: GET /settlements/{id}
- 查询未转账订单: GET /settlements/untransferred

【创建/修改】
- 创建记录: POST /settlements (JSON body)
- 更新记录: PUT /settlements/{id} (JSON body，只传需要改的字段)
- 删除记录: DELETE /settlements/{id}
- 标记特殊单: PUT /settlements/{id}/toggle-special (body: {"isSpecial": true/false})

【转账】
- 转账登记: POST /transfers (body: {"settlementIds": [1,2], "imageData": "base64...", "note": "备注"})
- 查询转账记录: GET /transfers/settlement/{id}

【统计】
- 结算统计: GET /settlements/stats/settlement → 当月订单数、预估收入
- 特殊单统计: GET /settlements/stats/special → 未转账金额、垫付金额、额外利润

【备份】
- 导出数据: GET /backup/export
- 导入数据: POST /backup/import (body: 导出的JSON数据)

所有金额字段为字符串格式（如 "250.00"），日期为 UTC 毫秒时间戳。
```

### 2.2 字段说明

创建或更新记录时可用的字段：

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `orderDate` | `number` | 接单日期（UTC 毫秒时间戳） | `1678886400000` |
| `orderNo` | `string` | 单号 | `"ORD-2026-001"` |
| `groupName` | `string` | 群名 | `"VIP客户群"` |
| `customerName` | `string` | 客户名 | `"张三"` |
| `customerService` | `string` | 客服 | `"小王"` |
| `originalPrice` | `string` | 原价 | `"250.00"` |
| `totalPrice` | `string` | 加价后总价 | `"350.00"` |
| `shouldTransfer` | `string` | 应转出 | `"60.00"` |
| `actualTransfer` | `string` | 实际转出 | `"60.00"` |
| `transferStatus` | `string` | 转账状态 | `"已转"` / `"未转"` / `""` |
| `registrationStatus` | `string` | 登记状态 | `"已登记"` / `"未登记"` / `""` |
| `settlementStatus` | `string` | 结算状态 | `"已结算"` / `"未结算"` / `"部分结算"` / `""` |
| `isSpecial` | `boolean` | 是否特殊单 | `true` / `false` |
| `remark` | `string` | 备注 | `"需要加急处理"` |

### 2.3 公式说明（特殊单自动计算字段）

以下字段由系统前端自动计算，API 返回的原始数据中不包含，需要 AI 自行计算：

- **原价应到手** = 原价 × 40%
- **加价金额** = 加价后总价 - 原价
- **加价应到手** = 加价金额 × 40%
- **加价部分实际到手** = 加价应到手 - 实际转出
- **订单实际到手** = 加价部分实际到手 + 原价应到手

---

## 3. 使用示例

### 3.1 录入一条新订单

用户说："帮我录入一条订单，群名VIP群，客户张三，原价250，单号ORD-001"

AI 执行：
```bash
curl -X POST "http://192.168.88.247:9091/api/rest/settlements" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "ORD-001",
    "groupName": "VIP群",
    "customerName": "张三",
    "originalPrice": "250",
    "orderDate": 1739318400000
  }'
```

### 3.2 查询本月统计

用户说："这个月接了多少单？预估收入多少？"

AI 执行：
```bash
curl "http://192.168.88.247:9091/api/rest/settlements/stats/settlement" \
  -H "Authorization: Bearer <token>"
```

### 3.3 批量查询未结算订单

用户说："有哪些订单还没结算？"

AI 执行：
```bash
curl "http://192.168.88.247:9091/api/rest/settlements?settlementStatus=未结算&pageSize=100" \
  -H "Authorization: Bearer <token>"
```

---

## 4. 错误处理

| HTTP 状态码 | 说明 |
|---|---|
| `200` | 请求成功 |
| `201` | 创建成功 |
| `400` | 请求参数错误 |
| `401` | 未提供认证信息 |
| `403` | Token 无效 |
| `404` | 记录不存在 |
| `500` | 服务器内部错误 |

所有错误响应格式：
```json
{
  "error": "错误类型",
  "message": "详细错误信息"
}
```
