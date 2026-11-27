import { describe, expect, it } from "vitest";
import { formatOMR, parseOMR } from "./money";

describe("OMR milles", () => {
  it("formats with thousands separators and 3 decimals", () => {
    expect(formatOMR(1_200_000)).toBe("1,200.000");
    expect(formatOMR(50_000)).toBe("50.000");
    expect(formatOMR(1)).toBe("0.001");
  });

  it("parses typed amounts", () => {
    expect(parseOMR("1,200.000")).toBe(1_200_000);
    expect(parseOMR("50")).toBe(50_000);
    expect(parseOMR("")).toBeNull();
    expect(parseOMR("abc")).toBeNull();
  });
});
