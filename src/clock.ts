let frozen: Date | null = null;

export function now(): Date {
  return frozen ? new Date(frozen.getTime()) : new Date();
}

export function setNow(date: Date | null): void {
  frozen = date ? new Date(date.getTime()) : null;
}

/** Freeze the clock to a local calendar day at 09:00. */
export function setToday(iso: string, time = "09:00"): void {
  const [y, m, d] = iso.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  frozen = new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function todayISO(from = now()): string {
  return toISODate(from);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function atTimeOnDate(iso: string, hhmm: string, from = now()): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const date = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(date.getTime())) return from;
  return date;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
