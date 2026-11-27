export function icon(name: string): string {
  switch (name) {
    case "home":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>`;
    case "calendar":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`;
    case "monthly":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>`;
    case "settings":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
    case "back":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5 8 12l7 7"/></svg>`;
    case "plus":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>`;
    case "car":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 11.5 6.2 8.2A2 2 0 0 1 8.1 7h7.8a2 2 0 0 1 1.9 1.2L19 11.5V17a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm2.5 1.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4m9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4"/></svg>`;
    case "building":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20V7l8-4 8 4v13h-5v-5H9v5z"/></svg>`;
    case "person":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="3.2"/><path d="M5 19.5c.6-3.4 3.4-5 7-5s6.4 1.6 7 5"/></svg>`;
    case "shield":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 8.5 4.2-1.3 7-4.3 7-8.5V6z"/></svg>`;
    case "key":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 7a5 5 0 1 0 0 2h3v2h2V9h1V7zm-5 1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"/></svg>`;
    case "camera":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 6h2l1-1h4l1 1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm3 10.2A3.2 3.2 0 1 0 12 9.8a3.2 3.2 0 0 0 0 6.4"/></svg>`;
    case "file":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V9h4.5z"/></svg>`;
    case "bag":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 8V7a4 4 0 0 1 8 0v1h2.5a1 1 0 0 1 1 1.2l-1.4 9A2 2 0 0 1 16.1 20H7.9a2 2 0 0 1-2-1.8l-1.4-9A1 1 0 0 1 5.5 8zm2 0h4V7a2 2 0 0 0-4 0z"/></svg>`;
    case "house":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 11.5 12 4l8 7.5V20h-6v-6H10v6H4z"/></svg>`;
    case "bolt":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3 5 14h6l-1 7 9-12h-6z"/></svg>`;
    case "bank":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h16v2H4zm1 3h2v6H5zm4 0h2v6H9zm4 0h2v6h-2zm4 0h2v6h-2zM3 19h18v2H3zM12 3 4 8h16z"/></svg>`;
    case "percent":
      return `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="16" r="2.2"/><path d="M7 17 17 7" stroke="#fff" stroke-width="2"/></svg>`;
    case "clock":
      return `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" fill="#fff"/><circle cx="32" cy="32" r="22" stroke="#fff" stroke-width="4"/><path d="M32 18v16l10 6" stroke="#e23d3d" stroke-width="4" stroke-linecap="round"/><path d="M20 8l-6 8M44 8l6 8" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
    case "check":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5 10 17l9-10"/></svg>`;
    case "share":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/><path d="M8.2 13.2 15.7 17.8M15.8 6.2 8.3 10.7"/></svg>`;
    case "edit":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13 7 4 4"/></svg>`;
    case "trash":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13"/></svg>`;
    case "lock":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
    case "fingerprint":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 14c0-3 2-5 5-5s5 2 5 5"/><path d="M9 20c0-4 1.2-7 3-7s3 3 3 7"/><path d="M6 11a6 6 0 0 1 12 0"/><path d="M12 8v2"/></svg>`;
    case "chevron":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 6 6 6-6 6"/></svg>`;
    default:
      return "";
  }
}

export function typeIcon(type: string, kind: "doc" | "task"): { icon: string; bg: string } {
  if (kind === "task") {
    switch (type) {
      case "salary":
        return { icon: "bag", bg: "#f59e0b" };
      case "rent":
        return { icon: "house", bg: "#fb923c" };
      case "bills":
        return { icon: "bolt", bg: "#eab308" };
      case "loan_emi":
        return { icon: "bank", bg: "#6366f1" };
      case "tax_vat":
        return { icon: "percent", bg: "#0ea5e9" };
      default:
        return { icon: "file", bg: "#64748b" };
    }
  }
  switch (type) {
    case "vehicle":
      return { icon: "car", bg: "#ef4444" };
    case "company":
      return { icon: "building", bg: "#3b82f6" };
    case "id_visa":
      return { icon: "person", bg: "#8b5cf6" };
    case "insurance":
      return { icon: "shield", bg: "#10b981" };
    case "lease":
      return { icon: "key", bg: "#14b8a6" };
    case "rop_security":
      return { icon: "shield", bg: "#1d4ed8" };
    case "cctv":
      return { icon: "camera", bg: "#475569" };
    default:
      return { icon: "file", bg: "#64748b" };
  }
}
