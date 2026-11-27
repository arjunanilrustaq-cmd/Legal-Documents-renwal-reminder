import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "./backup";
import { emptyData } from "./types";

describe("backup round-trip", () => {
  it("rejects other files", () => {
    expect(() => parseBackup({ app: "other" })).toThrow(/Expiry Guard/);
  });

  it("restores documents and photos", async () => {
    const data = emptyData();
    data.settings.businessName = "Example Trading LLC";
    data.documents.push({
      id: "d1",
      name: "Commercial registration",
      type: "company",
      customType: "",
      expiryDate: "2026-12-05",
      reminderOffsets: [7, 1, 0],
      alarmOnDay: true,
      documentNumber: "",
      renewalCostMilles: 50_000_000,
      note: "",
      photoIds: ["p1"],
      history: [],
      createdAt: "",
      updatedAt: "",
      snoozeUntil: null,
    });
    const backup = await buildBackup(
      data,
      [{ id: "p1", mime: "image/jpeg", blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }) }],
      "2026-11-27T09:00:00",
    );
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed.data.settings.businessName).toBe("Example Trading LLC");
    expect(parsed.data.documents[0].name).toBe("Commercial registration");
    expect(parsed.photos[0].id).toBe("p1");
  });
});
