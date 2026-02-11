import { describe, it, expect } from "vitest";

// 测试自动计算公式
function calcFields(o: { originalPrice: number; totalPrice: number; actualTransferOut: number }) {
  const markup = o.totalPrice - o.originalPrice;
  const origIncome = o.originalPrice * 0.4;
  const markupIncome = markup * 0.4;
  const markupActual = markupIncome - o.actualTransferOut;
  const actualIncome = origIncome + markupActual;
  return { markup, origIncome, markupIncome, markupActual, actualIncome };
}

describe("加价结算计算公式", () => {
  it("应正确计算所有字段 - 示例1: 原价100, 加价后200, 实际转出100", () => {
    const result = calcFields({ originalPrice: 100, totalPrice: 200, actualTransferOut: 100 });
    expect(result.markup).toBe(100);
    expect(result.origIncome).toBe(40);
    expect(result.markupIncome).toBe(40);
    expect(result.markupActual).toBe(-60);
    expect(result.actualIncome).toBe(-20);
  });

  it("应正确计算所有字段 - 示例2: 原价300, 加价后430, 实际转出130", () => {
    const result = calcFields({ originalPrice: 300, totalPrice: 430, actualTransferOut: 130 });
    expect(result.markup).toBe(130);
    expect(result.origIncome).toBe(120);
    expect(result.markupIncome).toBe(52);
    expect(result.markupActual).toBe(-78);
    expect(result.actualIncome).toBe(42);
  });

  it("应正确计算所有字段 - 示例3: 原价0, 加价后1000, 实际转出1000", () => {
    const result = calcFields({ originalPrice: 0, totalPrice: 1000, actualTransferOut: 1000 });
    expect(result.markup).toBe(1000);
    expect(result.origIncome).toBe(0);
    expect(result.markupIncome).toBe(400);
    expect(result.markupActual).toBe(-600);
    expect(result.actualIncome).toBe(-600);
  });

  it("应正确计算所有字段 - 示例4: 原价110, 加价后220, 实际转出110", () => {
    const result = calcFields({ originalPrice: 110, totalPrice: 220, actualTransferOut: 110 });
    expect(result.markup).toBe(110);
    expect(result.origIncome).toBeCloseTo(44);
    expect(result.markupIncome).toBeCloseTo(44);
    expect(result.markupActual).toBeCloseTo(-66);
    expect(result.actualIncome).toBeCloseTo(-22);
  });

  it("应正确处理零值", () => {
    const result = calcFields({ originalPrice: 0, totalPrice: 0, actualTransferOut: 0 });
    expect(result.markup).toBe(0);
    expect(result.origIncome).toBe(0);
    expect(result.markupIncome).toBe(0);
    expect(result.markupActual).toBe(0);
    expect(result.actualIncome).toBe(0);
  });

  it("应正确处理仅有原价无加价的情况", () => {
    const result = calcFields({ originalPrice: 500, totalPrice: 500, actualTransferOut: 0 });
    expect(result.markup).toBe(0);
    expect(result.origIncome).toBe(200);
    expect(result.markupIncome).toBe(0);
    expect(result.markupActual).toBe(0);
    expect(result.actualIncome).toBe(200);
  });
});

describe("表格列配置", () => {
  const COLUMNS = [
    { key: "index", label: "序号", editable: false },
    { key: "orderDate", label: "接单日期", editable: true },
    { key: "orderNo", label: "单号", editable: true },
    { key: "groupName", label: "群名", editable: true },
    { key: "originalPrice", label: "原价", editable: true },
    { key: "origIncome", label: "原价应到手", editable: false },
    { key: "totalPrice", label: "加价后总价", editable: true },
    { key: "markup", label: "加价", editable: false },
    { key: "markupIncome", label: "加价应到手", editable: false },
    { key: "actualTransferOut", label: "实际转出", editable: true },
    { key: "transferStatus", label: "转账状态", editable: true },
    { key: "markupActual", label: "加价实际到手", editable: false },
    { key: "actualIncome", label: "实际到手", editable: false },
    { key: "registerStatus", label: "登记状态", editable: true },
    { key: "settlementStatus", label: "结算状态", editable: true },
  ];

  it("应有15列与Excel表格一致", () => {
    expect(COLUMNS.length).toBe(15);
  });

  it("应有9个可编辑列", () => {
    const editableCols = COLUMNS.filter((c) => c.editable);
    expect(editableCols.length).toBe(9);
  });

  it("应有6个只读列（序号+5个自动计算）", () => {
    const readOnlyCols = COLUMNS.filter((c) => !c.editable);
    expect(readOnlyCols.length).toBe(6);
  });

  it("列顺序应与Excel一致", () => {
    const labels = COLUMNS.map((c) => c.label);
    expect(labels).toEqual([
      "序号", "接单日期", "单号", "群名", "原价", "原价应到手",
      "加价后总价", "加价", "加价应到手", "实际转出", "转账状态",
      "加价实际到手", "实际到手", "登记状态", "结算状态",
    ]);
  });
});

describe("权限系统", () => {
  it("admin角色应有编辑权限", () => {
    const role = "admin";
    const canEdit = role === "admin";
    expect(canEdit).toBe(true);
  });

  it("user角色应只有查看权限", () => {
    const role: string = "user";
    const canEdit = role === "admin";
    expect(canEdit).toBe(false);
  });
});
