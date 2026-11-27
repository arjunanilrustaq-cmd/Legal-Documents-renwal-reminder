import { addDaysISO, daysUntil, urgencyOf } from "./dates";
import type { LegalDocument, MonthlyTask, Urgency } from "./types";

export interface GridCell {
  iso: string | null;
  inMonth: boolean;
}

/** Sunday-first month grid, 6 weeks. */
export function monthGrid(year: number, monthIndex: number): GridCell[][] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  const cells: GridCell[] = [];
  for (let i = 0; i < startPad; i++) {
    const day = prevMonthDays - startPad + i + 1;
    const date = new Date(year, monthIndex - 1, day);
    cells.push({ iso: isoFromLocal(date), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: isoFromLocal(new Date(year, monthIndex, d)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const extra = cells.length - startPad - daysInMonth + 1;
    cells.push({ iso: isoFromLocal(new Date(year, monthIndex + 1, extra)), inMonth: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1]?.iso;
    cells.push({ iso: last ? addDaysISO(last, 1) : null, inMonth: false });
  }
  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function isoFromLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type CalendarKind = "document" | "monthly";

export interface CalendarMark {
  iso: string;
  kind: CalendarKind;
  urgency: Urgency;
  id: string;
  name: string;
  subtitle: string;
  type: string;
}

export function documentMarks(docs: LegalDocument[], today: string): CalendarMark[] {
  return docs.map((doc) => ({
    iso: doc.expiryDate,
    kind: "document" as const,
    urgency: urgencyOf(daysUntil(doc.expiryDate, today)),
    id: doc.id,
    name: doc.name,
    subtitle: "Document expires",
    type: doc.type,
  }));
}

export function taskMarks(tasks: MonthlyTask[], today: string): CalendarMark[] {
  return tasks.map((task) => ({
    iso: task.nextDue,
    kind: "monthly" as const,
    urgency: urgencyOf(daysUntil(task.nextDue, today)),
    id: task.id,
    name: task.name,
    subtitle: "Monthly",
    type: task.type,
  }));
}

export function marksOnDay(marks: CalendarMark[], iso: string): CalendarMark[] {
  return marks.filter((m) => m.iso === iso);
}

export function dotsForDay(marks: CalendarMark[]): { orange: boolean; blue: boolean; red: boolean } {
  let orange = false;
  let blue = false;
  let red = false;
  for (const mark of marks) {
    if (mark.urgency === "late") red = true;
    else if (mark.kind === "document") orange = true;
    else blue = true;
  }
  return { orange, blue, red };
}

export function agendaRange(marks: CalendarMark[], today: string, days = 90): CalendarMark[] {
  const end = addDaysISO(today, days);
  return marks
    .filter((m) => m.iso <= end)
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.name.localeCompare(b.name));
}
