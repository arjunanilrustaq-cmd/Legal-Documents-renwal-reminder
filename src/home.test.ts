import { describe, expect, it } from "vitest";
import { homeItems } from "./views";
import { emptyData } from "./types";
import { createDocumentDraft, createTaskDraft } from "./store";

describe("home combined list", () => {
  it("sorts documents and monthly tasks soonest first", () => {
    const data = emptyData();
    const late = createDocumentDraft([0]);
    late.name = "Vehicle registration";
    late.expiryDate = "2026-11-03";
    const salary = createTaskDraft("2026-11-27");
    salary.name = "Staff salary deposit";
    salary.nextDue = "2026-12-01";
    salary.amountMilles = 1_200_000;
    const ok = createDocumentDraft([0]);
    ok.name = "Shop insurance";
    ok.expiryDate = "2027-03-02";
    data.documents.push(late, ok);
    data.monthlyTasks.push(salary);
    const items = homeItems(data, "2026-11-27");
    expect(items.map((i) => i.name)).toEqual(["Vehicle registration", "Staff salary deposit", "Shop insurance"]);
    expect(items[1].kind).toBe("monthly");
    expect(items[1].hint).toContain("Every month");
    expect(items[1].hint).toContain("1st");
    expect(items[1].hint).toContain("1,200.000");
  });
});
