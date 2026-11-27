export type OverlayKind =
  | "none"
  | "doc-form"
  | "task-form"
  | "doc-detail"
  | "task-detail"
  | "alarm"
  | "zoom"
  | "picker"
  | "lock"
  | "extras";

export type BackDecision =
  | { action: "keep-confirm" }
  | { action: "close-zoom" }
  | { action: "close-picker" }
  | { action: "close-overlay" }
  | { action: "ask-discard"; target: "doc-form" | "task-form" }
  | { action: "close-alarm" }
  | { action: "keep-lock" }
  | { action: "ask-exit" }
  | { action: "exit" };

export interface BackState {
  confirmOpen: boolean;
  overlay: OverlayKind;
  overlayDirty: boolean;
  lockOpen: boolean;
}

export function decideBack(state: BackState): BackDecision {
  if (state.confirmOpen) return { action: "keep-confirm" };
  if (state.lockOpen || state.overlay === "lock") return { action: "keep-lock" };
  if (state.overlay === "zoom") return { action: "close-zoom" };
  if (state.overlay === "picker") return { action: "close-picker" };
  if (state.overlay === "doc-form") {
    if (state.overlayDirty) return { action: "ask-discard", target: "doc-form" };
    return { action: "close-overlay" };
  }
  if (state.overlay === "task-form") {
    if (state.overlayDirty) return { action: "ask-discard", target: "task-form" };
    return { action: "close-overlay" };
  }
  if (state.overlay === "alarm") return { action: "close-alarm" };
  if (state.overlay === "doc-detail" || state.overlay === "task-detail" || state.overlay === "extras") {
    return { action: "close-overlay" };
  }
  return { action: "exit" };
}

export function snapshotIsDirty<T>(current: T, baseline: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}
