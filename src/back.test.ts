import { describe, expect, it } from "vitest";
import { decideBack, snapshotIsDirty } from "./back";

describe("decideBack", () => {
  const base = {
    confirmOpen: false,
    overlay: "none" as const,
    overlayDirty: false,
    lockOpen: false,
  };

  it("keeps an open confirm dialog", () => {
    expect(decideBack({ ...base, confirmOpen: true })).toEqual({ action: "keep-confirm" });
  });

  it("asks before discarding an unsaved document form", () => {
    expect(decideBack({ ...base, overlay: "doc-form", overlayDirty: true })).toEqual({
      action: "ask-discard",
      target: "doc-form",
    });
  });

  it("asks before discarding an unsaved monthly task form", () => {
    expect(decideBack({ ...base, overlay: "task-form", overlayDirty: true })).toEqual({
      action: "ask-discard",
      target: "task-form",
    });
  });

  it("closes a clean form without asking", () => {
    expect(decideBack({ ...base, overlay: "doc-form" })).toEqual({ action: "close-overlay" });
  });

  it("closes picker, zoom, and details", () => {
    expect(decideBack({ ...base, overlay: "picker" })).toEqual({ action: "close-picker" });
    expect(decideBack({ ...base, overlay: "zoom" })).toEqual({ action: "close-zoom" });
    expect(decideBack({ ...base, overlay: "doc-detail" })).toEqual({ action: "close-overlay" });
  });

  it("does not leave the lock screen via back", () => {
    expect(decideBack({ ...base, lockOpen: true })).toEqual({ action: "keep-lock" });
  });

  it("exits from a root tab", () => {
    expect(decideBack(base)).toEqual({ action: "exit" });
  });
});

describe("snapshotIsDirty", () => {
  it("detects form edits", () => {
    expect(snapshotIsDirty({ name: "A" }, { name: "A" })).toBe(false);
    expect(snapshotIsDirty({ name: "A" }, { name: "" })).toBe(true);
  });
});
