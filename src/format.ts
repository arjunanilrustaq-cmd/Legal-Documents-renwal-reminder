import { daysUntil } from "./dates";
import { formatOMR } from "./money";
import type { DueDay, RepeatRule } from "./types";

export { formatOMR };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatMonthYear(year: number, monthIndex: number): string {
  return `${MONTHS_LONG[monthIndex]} ${year}`;
}

export function formatWeekdayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const wd = WEEKDAYS[date.getDay()].slice(0, 3).toUpperCase();
  return `${wd} ${d} ${MONTHS[m - 1].toUpperCase()}`;
}

export function monthName(iso: string): string {
  const month = Number(iso.slice(5, 7)) - 1;
  return MONTHS_LONG[month];
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days late`;
  if (days === 0) return "TODAY";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function daysLeftShort(days: number): { n: string; unit: string } {
  if (days < 0) return { n: String(-days), unit: "days late" };
  if (days === 0) return { n: "0", unit: "today" };
  if (days === 1) return { n: "1", unit: "day left" };
  return { n: String(days), unit: "days left" };
}

export function dueDayLabel(dueDay: DueDay): string {
  if (dueDay.kind === "last") return "Last day";
  return ordinal(dueDay.day);
}

export function repeatLabel(repeat: RepeatRule): string {
  if (repeat === "quarterly") return "Every 3 months";
  if (repeat === "yearly") return "Every year";
  return "Every month";
}

export function monthlyHomeSubtitle(repeat: RepeatRule, dueDay: DueDay, amountMilles: number | null): string {
  const parts = [repeatLabel(repeat), dueDayLabel(dueDay)];
  if (amountMilles !== null) parts.push(formatOMR(amountMilles));
  return parts.join(" · ");
}

export function reminderOffsetLabel(offset: number): string {
  if (offset === 0) return "On the day";
  if (offset === 1) return "1 day";
  return `${offset} days`;
}

export function formatTime12(hhmm: string): string {
  const [hRaw, m] = hhmm.split(":").map(Number);
  const h = hRaw % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function countdownParts(iso: string, today: string): { n: number; label: string } {
  const days = daysUntil(iso, today);
  if (days < 0) return { n: Math.abs(days), label: "days late" };
  if (days === 0) return { n: 0, label: "today" };
  if (days === 1) return { n: 1, label: "day left" };
  return { n: days, label: "days left" };
}

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
