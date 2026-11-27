import { describe, expect, it } from "vitest";
import { monthGrid } from "./calendar-util";

describe("month grid", () => {
  it("starts weeks on Sunday", () => {
    const weeks = monthGrid(2026, 11); // December 2026
    // 1 Dec 2026 is a Tuesday, so Sunday 29 Nov is the first cell.
    expect(weeks[0][0].iso).toBe("2026-11-29");
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][2].iso).toBe("2026-12-01");
    expect(weeks[0][2].inMonth).toBe(true);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toHaveLength(7);
  });

  it("includes 31 days when the month has them", () => {
    const days = monthGrid(2026, 11).flat().filter((c) => c.inMonth);
    expect(days).toHaveLength(31);
    expect(days[30].iso).toBe("2026-12-31");
  });
});
