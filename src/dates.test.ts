import { describe, expect, it } from "vitest";
import {
  applyDueDay,
  clampDayOfMonth,
  daysLate,
  daysUntil,
  firstDueOnOrAfter,
  lastDayOfMonth,
  nextDailyAfterExpiry,
  reminderDates,
  rollDueDate,
  rollUntilOnOrAfter,
  urgencyOf,
} from "./dates";

describe("daysUntil", () => {
  it("counts whole local days", () => {
    expect(daysUntil("2026-12-05", "2026-11-22")).toBe(13);
    expect(daysUntil("2026-11-22", "2026-11-22")).toBe(0);
    expect(daysUntil("2026-11-03", "2026-11-22")).toBe(-19);
  });

  it("does not use UTC midnight (Oman-safe)", () => {
    expect(daysUntil("2026-03-01", "2026-02-28")).toBe(1);
  });
});

describe("urgency", () => {
  it("splits late / today / within 30 / ok", () => {
    expect(urgencyOf(-1)).toBe("late");
    expect(urgencyOf(0)).toBe("today");
    expect(urgencyOf(1)).toBe("soon");
    expect(urgencyOf(30)).toBe("soon");
    expect(urgencyOf(31)).toBe("ok");
  });
});

describe("last-day and 29/30/31 clamping", () => {
  it("knows month lengths including leap Feb", () => {
    expect(lastDayOfMonth(2026, 0)).toBe(31); // Jan
    expect(lastDayOfMonth(2026, 1)).toBe(28); // Feb 2026
    expect(lastDayOfMonth(2024, 1)).toBe(29);
    expect(lastDayOfMonth(2026, 3)).toBe(30); // Apr
  });

  it("clamps 31 into shorter months", () => {
    expect(clampDayOfMonth(2026, 1, 31)).toBe(28);
    expect(clampDayOfMonth(2024, 1, 31)).toBe(29);
    expect(clampDayOfMonth(2026, 3, 31)).toBe(30);
    expect(clampDayOfMonth(2026, 0, 31)).toBe(31);
  });

  it("last day of month uses the real last day", () => {
    expect(applyDueDay(2026, 1, { kind: "last" })).toBe("2026-02-28");
    expect(applyDueDay(2024, 1, { kind: "last" })).toBe("2024-02-29");
    expect(applyDueDay(2026, 3, { kind: "last" })).toBe("2026-04-30");
    expect(applyDueDay(2026, 0, { kind: "last" })).toBe("2026-01-31");
  });
});

describe("monthly roll-over", () => {
  it("rolls 31 Jan to Feb last day then back to 31 Mar", () => {
    const dueDay = { kind: "day" as const, day: 31 };
    const feb = rollDueDate("2026-01-31", dueDay, "monthly");
    expect(feb).toBe("2026-02-28");
    expect(rollDueDate(feb, dueDay, "monthly")).toBe("2026-03-31");
  });

  it("rolls last-day through Feb into Mar 31", () => {
    const dueDay = { kind: "last" as const };
    expect(rollDueDate("2026-01-31", dueDay, "monthly")).toBe("2026-02-28");
    expect(rollDueDate("2026-02-28", dueDay, "monthly")).toBe("2026-03-31");
  });

  it("day 30 in Feb stays 30 in March (not last-day)", () => {
    const dueDay = { kind: "day" as const, day: 30 };
    expect(rollDueDate("2026-01-30", dueDay, "monthly")).toBe("2026-02-28");
    expect(rollDueDate("2026-02-28", dueDay, "monthly")).toBe("2026-03-30");
  });

  it("leap 29 Feb yearly becomes 28 Feb next year, 29 in next leap", () => {
    const dueDay = { kind: "day" as const, day: 29 };
    expect(rollDueDate("2024-02-29", dueDay, "yearly")).toBe("2025-02-28");
    expect(rollDueDate("2025-02-28", dueDay, "yearly")).toBe("2026-02-28");
    expect(rollDueDate("2027-02-28", dueDay, "yearly")).toBe("2028-02-29");
  });
});

describe("quarterly and yearly roll-over", () => {
  it("adds three months for quarterly", () => {
    const dueDay = { kind: "day" as const, day: 1 };
    expect(rollDueDate("2026-12-01", dueDay, "quarterly")).toBe("2027-03-01");
    expect(rollDueDate("2026-11-30", { kind: "day", day: 31 }, "quarterly")).toBe("2027-02-28");
  });

  it("adds twelve months for yearly", () => {
    expect(rollDueDate("2026-03-15", { kind: "day", day: 15 }, "yearly")).toBe("2027-03-15");
  });

  it("keeps rolling until on or after today", () => {
    const due = rollUntilOnOrAfter("2026-01-01", { kind: "day", day: 1 }, "monthly", "2026-11-27");
    expect(due).toBe("2026-12-01");
  });
});

describe("first due on or after today", () => {
  it("uses this month if the day is still ahead", () => {
    expect(firstDueOnOrAfter("2026-11-27", { kind: "day", day: 1 })).toBe("2026-12-01");
    expect(firstDueOnOrAfter("2026-11-05", { kind: "day", day: 5 })).toBe("2026-11-05");
    expect(firstDueOnOrAfter("2026-11-27", { kind: "day", day: 31 })).toBe("2026-11-30");
    expect(firstDueOnOrAfter("2026-11-27", { kind: "last" })).toBe("2026-11-30");
  });
});

describe("late detection", () => {
  it("counts days late on the done date", () => {
    expect(daysLate("2026-12-01", "2026-12-01")).toBe(0);
    expect(daysLate("2026-12-01", "2026-11-30")).toBe(0);
    expect(daysLate("2026-09-01", "2026-09-03")).toBe(2);
  });
});

describe("reminder scheduling", () => {
  it("fires on expiry minus each offset, including on the day", () => {
    expect(reminderDates("2026-12-05", [60, 30, 7, 1, 0])).toEqual([
      "2026-10-06",
      "2026-11-05",
      "2026-11-28",
      "2026-12-04",
      "2026-12-05",
    ]);
  });

  it("dedupes offsets", () => {
    expect(reminderDates("2026-12-05", [7, 7, 0])).toEqual(["2026-11-28", "2026-12-05"]);
  });
});

describe("daily-after-expiry scheduling", () => {
  it("starts the day after expiry while still before then", () => {
    expect(nextDailyAfterExpiry("2026-12-05", "2026-12-01")).toBe("2026-12-06");
  });

  it("uses today once expiry has passed", () => {
    expect(nextDailyAfterExpiry("2026-11-03", "2026-11-27")).toBe("2026-11-27");
  });
});
