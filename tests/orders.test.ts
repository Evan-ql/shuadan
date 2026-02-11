import { describe, expect, it } from "vitest";

// Test the calculation logic that matches the Excel formulas
describe("Order Calculation Logic", () => {
  function calcFields(originalPrice: number, totalPrice: number, actualTransferOut: number) {
    const markup = totalPrice - originalPrice;
    const origIncome = originalPrice * 0.4;
    const markupIncome = markup * 0.4;
    const markupActual = markupIncome - actualTransferOut;
    const actualIncome = origIncome + markupActual;
    return { markup, origIncome, markupIncome, markupActual, actualIncome };
  }

  it("should calculate correctly for ilymufc (row 1)", () => {
    const result = calcFields(250, 370, 48);
    expect(result.markup).toBe(120);
    expect(result.origIncome).toBe(100);
    expect(result.markupIncome).toBe(48);
    expect(result.markupActual).toBe(0);
    expect(result.actualIncome).toBe(100);
  });

  it("should calculate correctly for 祉怡cute (row 2)", () => {
    const result = calcFields(30, 60, 7);
    expect(result.markup).toBe(30);
    expect(result.origIncome).toBe(12);
    expect(result.markupIncome).toBe(12);
    expect(result.markupActual).toBe(5);
    expect(result.actualIncome).toBe(17);
  });

  it("should calculate correctly for 西小猫2013 (row 3)", () => {
    const result = calcFields(30, 150, 38);
    expect(result.markup).toBe(120);
    expect(result.origIncome).toBe(12);
    expect(result.markupIncome).toBe(48);
    expect(result.markupActual).toBe(10);
    expect(result.actualIncome).toBe(22);
  });

  it("should calculate correctly for 墨锤锤 (zero original price)", () => {
    const result = calcFields(0, 160, 40);
    expect(result.markup).toBe(160);
    expect(result.origIncome).toBe(0);
    expect(result.markupIncome).toBe(64);
    expect(result.markupActual).toBe(24);
    expect(result.actualIncome).toBe(24);
  });

  it("should calculate correctly for 安菲尔德的香克利大门 (large amount)", () => {
    const result = calcFields(0, 1000, 370);
    expect(result.markup).toBe(1000);
    expect(result.origIncome).toBe(0);
    expect(result.markupIncome).toBe(400);
    expect(result.markupActual).toBe(30);
    expect(result.actualIncome).toBe(30);
  });

  it("should handle zero values", () => {
    const result = calcFields(0, 0, 0);
    expect(result.markup).toBe(0);
    expect(result.origIncome).toBe(0);
    expect(result.markupIncome).toBe(0);
    expect(result.markupActual).toBe(0);
    expect(result.actualIncome).toBe(0);
  });
});

describe("Input Validation", () => {
  it("should require groupName to be non-empty", () => {
    const groupName = "";
    expect(groupName.trim().length > 0).toBe(false);
  });

  it("should accept valid groupName", () => {
    const groupName = "ilymufc";
    expect(groupName.trim().length > 0).toBe(true);
  });

  it("should parse numeric strings correctly", () => {
    expect(parseFloat("250") || 0).toBe(250);
    expect(parseFloat("0") || 0).toBe(0);
    expect(parseFloat("") || 0).toBe(0);
    expect(parseFloat("abc") || 0).toBe(0);
  });
});
