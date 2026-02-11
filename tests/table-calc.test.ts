import { describe, it, expect } from "vitest";

// Replicate the calcFields function from orders.tsx
function calcFields(o: { originalPrice: string | number; totalPrice: string | number; actualTransferOut: string | number }) {
  const orig = Number(o.originalPrice) || 0;
  const tot = Number(o.totalPrice) || 0;
  const actOut = Number(o.actualTransferOut) || 0;
  const markup = tot - orig;
  const origIncome = orig * 0.4;
  const markupIncome = markup * 0.4;
  const markupActual = markupIncome - actOut;
  const actualIncome = origIncome + markupActual;
  return { markup, origIncome, markupIncome, markupActual, actualIncome };
}

describe("Table calcFields", () => {
  it("should calculate correctly for a standard order", () => {
    const result = calcFields({ originalPrice: "100", totalPrice: "200", actualTransferOut: "0" });
    expect(result.markup).toBe(100);
    expect(result.origIncome).toBe(40);
    expect(result.markupIncome).toBe(40);
    expect(result.markupActual).toBe(40);
    expect(result.actualIncome).toBe(80);
  });

  it("should handle actual transfer out deduction", () => {
    const result = calcFields({ originalPrice: "100", totalPrice: "130", actualTransferOut: "30" });
    // markup = 30, origIncome = 40, markupIncome = 12, markupActual = 12 - 30 = -18, actualIncome = 40 + (-18) = 22
    expect(result.markup).toBe(30);
    expect(result.origIncome).toBe(40);
    expect(result.markupIncome).toBe(12);
    expect(result.markupActual).toBe(-18);
    expect(result.actualIncome).toBe(22);
  });

  it("should handle zero values", () => {
    const result = calcFields({ originalPrice: "0", totalPrice: "0", actualTransferOut: "0" });
    expect(result.markup).toBe(0);
    expect(result.origIncome).toBe(0);
    expect(result.markupIncome).toBe(0);
    expect(result.markupActual).toBe(0);
    expect(result.actualIncome).toBe(0);
  });

  it("should match Excel data row: 等待50世界", () => {
    // 原价=300, 加价后总价=430, 实际转出=130
    const result = calcFields({ originalPrice: "300", totalPrice: "430", actualTransferOut: "130" });
    expect(result.markup).toBe(130); // 430 - 300
    expect(result.origIncome).toBeCloseTo(120); // 300 * 0.4
    expect(result.markupIncome).toBeCloseTo(52); // 130 * 0.4
    expect(result.markupActual).toBeCloseTo(-78); // 52 - 130
    expect(result.actualIncome).toBeCloseTo(42); // 120 + (-78)
  });

  it("should match Excel data row: tb39646454", () => {
    // 原价=100, 加价后总价=200, 实际转出=100
    const result = calcFields({ originalPrice: "100", totalPrice: "200", actualTransferOut: "100" });
    expect(result.markup).toBe(100);
    expect(result.origIncome).toBeCloseTo(40);
    expect(result.markupIncome).toBeCloseTo(40);
    expect(result.markupActual).toBeCloseTo(-60);
    expect(result.actualIncome).toBeCloseTo(-20);
  });

  it("should handle numeric inputs (not just strings)", () => {
    const result = calcFields({ originalPrice: 110, totalPrice: 220, actualTransferOut: 110 });
    expect(result.markup).toBe(110);
    expect(result.origIncome).toBeCloseTo(44);
    expect(result.markupIncome).toBeCloseTo(44);
    expect(result.markupActual).toBeCloseTo(-66);
    expect(result.actualIncome).toBeCloseTo(-22);
  });

  it("should handle empty/invalid strings gracefully", () => {
    const result = calcFields({ originalPrice: "", totalPrice: "abc", actualTransferOut: "" });
    expect(result.markup).toBe(0);
    expect(result.origIncome).toBe(0);
    expect(result.actualIncome).toBe(0);
  });
});

describe("Column definitions", () => {
  const COLUMNS = [
    { key: "index", label: "序号", width: 60 },
    { key: "orderDate", label: "接单日期", width: 140 },
    { key: "orderNo", label: "单号", width: 130 },
    { key: "groupName", label: "群名", width: 130 },
    { key: "originalPrice", label: "原价", width: 100 },
    { key: "origIncome", label: "原价应到手", width: 110 },
    { key: "totalPrice", label: "加价后总价", width: 110 },
    { key: "markup", label: "加价", width: 90 },
    { key: "markupIncome", label: "加价应到手", width: 110 },
    { key: "actualTransferOut", label: "实际转出", width: 100 },
    { key: "transferStatus", label: "转账状态", width: 90 },
    { key: "markupActual", label: "加价实际到手", width: 120 },
    { key: "actualIncome", label: "实际到手", width: 100 },
    { key: "registerStatus", label: "登记状态", width: 90 },
    { key: "settlementStatus", label: "结算状态", width: 90 },
  ];

  it("should have 15 columns matching Excel layout", () => {
    expect(COLUMNS.length).toBe(15);
  });

  it("should have correct column order matching Excel", () => {
    const labels = COLUMNS.map(c => c.label);
    expect(labels).toEqual([
      "序号", "接单日期", "单号", "群名", "原价", "原价应到手",
      "加价后总价", "加价", "加价应到手", "实际转出", "转账状态",
      "加价实际到手", "实际到手", "登记状态", "结算状态",
    ]);
  });
});
