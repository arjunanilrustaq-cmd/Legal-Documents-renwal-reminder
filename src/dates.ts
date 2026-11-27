import { parseISODate, toISODate, todayISO } from "./clock";
import type { DueDay, RepeatRule, Urgency } from "./types";

export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDayOfMonth(year: number, monthIndex: number, day: number): number {
  const last = lastDayOfMonth(year, monthIndex);
  return Math.max(1, Math.min(day, last));
}

export function applyDueDay(year: number, monthIndex: number, dueDay: DueDay): string {
  const day = dueDay.kind === "last" ? lastDayOfMonth(year, monthIndex) : clampDayOfMonth(year, monthIndex, dueDay.day);
  return toISODate(new Date(year, monthIndex, day));
}

/** Whole days from `fromISO` to `toISO`. Negative means `toISO` is in the past. */
export function daysUntil(toISO: string, fromISO = todayISO()): number {
  const from = parseISODate(fromISO).getTime();
  const to = parseISODate(toISO).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function urgencyOf(days: number): Urgency {
  if (days < 0) return "late";
  if (days === 0) return "today";
  if (days <= 30) return "soon";
  return "ok";
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(year: number, monthIndex: number, months: number): { year: number; monthIndex: number } {
  const raw = monthIndex + months;
  const yearDelta = Math.floor(raw / 12);
  let nextMonth = raw % 12;
  if (nextMonth < 0) nextMonth += 12;
  return { year: year + yearDelta, monthIndex: nextMonth };
}

export function monthsForRepeat(repeat: RepeatRule): number {
  if (repeat === "quarterly") return 3;
  if (repeat === "yearly") return 12;
  return 1;
}

/** Roll a due date forward by one period, applying last-day / 29/30/31 clamping. */
export function rollDueDate(currentDue: string, dueDay: DueDay, repeat: RepeatRule): string {
  const current = parseISODate(currentDue);
  const next = addMonths(current.getFullYear(), current.getMonth(), monthsForRepeat(repeat));
  return applyDueDay(next.year, next.monthIndex, dueDay);
}

/** First occurrence of dueDay on or after today. Repeat does not skip the coming due day. */
export function firstDueOnOrAfter(today: string, dueDay: DueDay): string {
  const date = parseISODate(today);
  const thisMonth = applyDueDay(date.getFullYear(), date.getMonth(), dueDay);
  if (thisMonth >= today) return thisMonth;
  const next = addMonths(date.getFullYear(), date.getMonth(), 1);
  return applyDueDay(next.year, next.monthIndex, dueDay);
}

export function rollUntilOnOrAfter(currentDue: string, dueDay: DueDay, repeat: RepeatRule, today: string): string {
  let due = currentDue;
  let guard = 0;
  while (due < today && guard < 48) {
    due = rollDueDate(due, dueDay, repeat);
    guard += 1;
  }
  return due;
}

export function reminderDates(eventISO: string, offsets: number[]): string[] {
  const unique = [...new Set(offsets)].sort((a, b) => b - a);
  return unique.map((offset) => addDaysISO(eventISO, -offset));
}

/** Next daily reminder on or after `fromISO` once the event date has passed. */
export function nextDailyAfterExpiry(eventISO: string, fromISO: string): string {
  if (fromISO <= eventISO) return addDaysISO(eventISO, 1);
  return fromISO;
}

export function isLate(eventISO: string, today = todayISO()): boolean {
  return daysUntil(eventISO, today) < 0;
}

export function daysLate(eventISO: string, doneISO: string): number {
  const late = daysUntil(eventISO, doneISO) * -1;
  return Math.max(0, late);
}

export function ymOf(iso: string): string {
  return iso.slice(0, 7);
}

export function firstOfNextMonth(iso: string): string {
  const date = parseISODate(iso);
  const next = addMonths(date.getFullYear(), date.getMonth(), 1);
  return applyDueDay(next.year, next.monthIndex, { kind: "day", day: 1 });
}

export function monthStart(year: number, monthIndex: number): string {
  return toISODate(new Date(year, monthIndex, 1));
}

export function monthEnd(year: number, monthIndex: number): string {
  return toISODate(new Date(year, monthIndex, lastDayOfMonth(year, monthIndex)));
}
