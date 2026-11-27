import { describe, expect, it } from "vitest";
import { createDocumentDraft, createTaskDraft, Store } from "./store";
import { planDocumentNotices, planTaskNotices, planAllNotices } from "./schedule";
import { emptyData } from "./types";
import type { LegalDocument, MonthlyTask } from "./types";

function at(iso: string, hhmm = "08:00"): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function doc(over: Partial<LegalDocument> = {}): LegalDocument {
  return {
    ...createDocumentDraft([60, 30, 7, 1, 0]),
    name: "Commercial registration",
    expiryDate: "2026-12-05",
    alarmOnDay: true,
    ...over,
  };
}

function task(over: Partial<MonthlyTask> = {}): MonthlyTask {
  return {
    ...createTaskDraft("2026-11-27"),
    name: "Staff salary deposit",
    nextDue: "2026-12-01",
    reminderOffsets: [3, 1, 0],
    alarmOnDay: true,
    ...over,
  };
}

describe("document reminder plan", () => {
  it("schedules lead reminders as notices and the due day as an alarm", () => {
    const planned = planDocumentNotices(doc(), "09:00", true, at("2026-11-22"));
    const dates = planned.map((p) => new Date(p.atMs).toDateString());
    expect(dates.some((d) => d.includes("Nov 28"))).toBe(true); // 7 days before
    const due = planned.find((p) => p.style === "alarm");
    expect(due?.title).toContain("TODAY");
    expect(new Date(due!.atMs).getDate()).toBe(5);
    expect(new Date(due!.atMs).getMonth()).toBe(11);
  });

  it("skips reminders already in the past", () => {
    const planned = planDocumentNotices(doc(), "09:00", true, at("2026-12-04", "10:00"));
    const bodies = planned.map((p) => p.key);
    expect(bodies.some((k) => k.includes("2026-12-04"))).toBe(false);
  });

  it("keeps a daily reminder after expiry", () => {
    const planned = planDocumentNotices(doc({ expiryDate: "2026-11-03" }), "09:00", true, at("2026-11-27", "08:00"));
    const daily = planned.find((p) => p.key.includes("daily"));
    expect(daily).toBeTruthy();
    expect(daily!.title.toLowerCase()).toContain("late");
  });

  it("does not plan daily follow-ups when the setting is off", () => {
    const planned = planDocumentNotices(doc({ expiryDate: "2026-11-03" }), "09:00", false, at("2026-11-27"));
    expect(planned.every((p) => !p.key.includes("daily"))).toBe(true);
  });
});

describe("monthly task reminder plan", () => {
  it("uses 3, 1, on-the-day by default", () => {
    const planned = planTaskNotices(task(), "09:00", true, at("2026-11-20"));
    const days = planned.filter((p) => p.itemKind === "task").map((p) => new Date(p.atMs).getDate());
    expect(days).toContain(28); // 3 days before Dec 1
    expect(days).toContain(30); // 1 day before
    expect(days).toContain(1);
    const alarm = planned.find((p) => p.style === "alarm");
    expect(alarm?.title).toContain("TODAY");
  });

  it("reminds daily after a missed due date", () => {
    const planned = planTaskNotices(task({ nextDue: "2026-11-01" }), "09:00", true, at("2026-11-27", "08:00"));
    expect(planned.some((p) => p.key.includes("daily"))).toBe(true);
  });
});

describe("done vs skip", () => {
  it("done writes history with lateness and rolls the due date", () => {
    const store = new Store();
    const next = store.markTaskDone(task(), "2026-12-03");
    expect(next.history[0].daysLate).toBe(2);
    expect(next.history[0].periodDue).toBe("2026-12-01");
    expect(next.nextDue).toBe("2027-01-01");
  });

  it("skip rolls the due date and does not record history", () => {
    const store = new Store();
    const next = store.skipTask(task());
    expect(next.history).toHaveLength(0);
    expect(next.nextDue).toBe("2027-01-01");
  });
});

describe("planAllNotices", () => {
  it("includes a 1st-of-month summary when enabled", () => {
    const data = emptyData();
    data.settings.monthlySummary = true;
    data.settings.reminderTime = "09:00";
    data.documents.push(doc({ expiryDate: "2026-12-12" }));
    const planned = planAllNotices(data, at("2026-11-27"));
    expect(planned.some((p) => p.itemKind === "summary")).toBe(true);
  });
});
