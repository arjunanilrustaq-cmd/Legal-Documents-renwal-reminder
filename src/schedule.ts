import { atTimeOnDate, now, todayISO } from "./clock";
import { addDaysISO, daysUntil, firstOfNextMonth, reminderDates, ymOf } from "./dates";
import { formatDisplayDate, formatOMR } from "./format";
import type { AppData, LegalDocument, MonthlyTask } from "./types";

export type NoticeStyle = "notice" | "alarm";

export interface PlannedNotice {
  key: string;
  atMs: number;
  title: string;
  body: string;
  style: NoticeStyle;
  itemKind: "document" | "task" | "summary";
  itemId: string;
}

export interface ScheduleOptions {
  nowDate?: Date;
  horizonDays?: number;
}

function noticeTime(iso: string, hhmm: string, current: Date): Date {
  return atTimeOnDate(iso, hhmm, current);
}

export function planDocumentNotices(
  doc: LegalDocument,
  reminderTime: string,
  dailyAfter: boolean,
  current = now(),
  horizonDays = 400,
): PlannedNotice[] {
  const today = todayISO(current);
  const horizon = addDaysISO(today, horizonDays);
  const out: PlannedNotice[] = [];
  const offsets = doc.reminderOffsets.length ? doc.reminderOffsets : [0];

  for (const fireDate of reminderDates(doc.expiryDate, offsets)) {
    if (fireDate > horizon) continue;
    const at = noticeTime(fireDate, reminderTime, current);
    if (at.getTime() <= current.getTime()) continue;
    const days = daysUntil(doc.expiryDate, fireDate);
    const isDayOf = days === 0;
    const style: NoticeStyle = isDayOf && doc.alarmOnDay ? "alarm" : "notice";
    out.push({
      key: `doc:${doc.id}:${fireDate}:${style}`,
      atMs: at.getTime(),
      title: isDayOf ? `${doc.name} expires TODAY` : `${doc.name} reminder`,
      body: isDayOf
        ? `Renew today to avoid a late fine. Expires ${formatDisplayDate(doc.expiryDate)}.`
        : `${days} day${days === 1 ? "" : "s"} left · expires ${formatDisplayDate(doc.expiryDate)}.`,
      style,
      itemKind: "document",
      itemId: doc.id,
    });
  }

  if (dailyAfter && today >= addDaysISO(doc.expiryDate, 1)) {
    let cursor = today;
    if (noticeTime(today, reminderTime, current).getTime() <= current.getTime()) {
      cursor = addDaysISO(today, 1);
    }
    const at = noticeTime(cursor, reminderTime, current);
    if (at.getTime() > current.getTime() && cursor <= horizon) {
      const late = Math.abs(daysUntil(doc.expiryDate, cursor));
      out.push({
        key: `doc:${doc.id}:daily:${cursor}`,
        atMs: at.getTime(),
        title: `${doc.name} is ${late} day${late === 1 ? "" : "s"} late`,
        body: `Expired ${formatDisplayDate(doc.expiryDate)}. Renew to stop daily reminders.`,
        style: doc.alarmOnDay ? "alarm" : "notice",
        itemKind: "document",
        itemId: doc.id,
      });
    }
  } else if (dailyAfter) {
    const firstDaily = addDaysISO(doc.expiryDate, 1);
    const at = noticeTime(firstDaily, reminderTime, current);
    if (at.getTime() > current.getTime() && firstDaily <= horizon) {
      out.push({
        key: `doc:${doc.id}:daily:${firstDaily}`,
        atMs: at.getTime(),
        title: `${doc.name} expired yesterday`,
        body: `Expired ${formatDisplayDate(doc.expiryDate)}. Renew to stop daily reminders.`,
        style: "notice",
        itemKind: "document",
        itemId: doc.id,
      });
    }
  }

  if (doc.snoozeUntil) {
    const snooze = new Date(doc.snoozeUntil);
    if (snooze.getTime() > current.getTime()) {
      out.push({
        key: `doc:${doc.id}:snooze`,
        atMs: snooze.getTime(),
        title: `${doc.name} reminder`,
        body: `Still due · expires ${formatDisplayDate(doc.expiryDate)}.`,
        style: doc.alarmOnDay ? "alarm" : "notice",
        itemKind: "document",
        itemId: doc.id,
      });
    }
  }

  return out;
}

export function planTaskNotices(
  task: MonthlyTask,
  reminderTime: string,
  dailyAfter: boolean,
  current = now(),
  horizonDays = 400,
): PlannedNotice[] {
  const today = todayISO(current);
  const horizon = addDaysISO(today, horizonDays);
  const out: PlannedNotice[] = [];
  const offsets = task.reminderOffsets.length ? task.reminderOffsets : [0];

  for (const fireDate of reminderDates(task.nextDue, offsets)) {
    if (fireDate > horizon) continue;
    const at = noticeTime(fireDate, reminderTime, current);
    if (at.getTime() <= current.getTime()) continue;
    const days = daysUntil(task.nextDue, fireDate);
    const isDayOf = days === 0;
    const style: NoticeStyle = isDayOf && task.alarmOnDay ? "alarm" : "notice";
    const amount = task.amountMilles !== null ? ` · ${formatOMR(task.amountMilles)} OMR` : "";
    out.push({
      key: `task:${task.id}:${fireDate}:${style}`,
      atMs: at.getTime(),
      title: isDayOf ? `${task.name} is due TODAY` : `${task.name} reminder`,
      body: isDayOf
        ? `Due ${formatDisplayDate(task.nextDue)}${amount}.`
        : `${days} day${days === 1 ? "" : "s"} left · due ${formatDisplayDate(task.nextDue)}${amount}.`,
      style,
      itemKind: "task",
      itemId: task.id,
    });
  }

  if (dailyAfter && today >= addDaysISO(task.nextDue, 1)) {
    let cursor = today;
    if (noticeTime(today, reminderTime, current).getTime() <= current.getTime()) {
      cursor = addDaysISO(today, 1);
    }
    const at = noticeTime(cursor, reminderTime, current);
    if (at.getTime() > current.getTime() && cursor <= horizon) {
      const late = Math.abs(daysUntil(task.nextDue, cursor));
      out.push({
        key: `task:${task.id}:daily:${cursor}`,
        atMs: at.getTime(),
        title: `${task.name} is ${late} day${late === 1 ? "" : "s"} late`,
        body: `Was due ${formatDisplayDate(task.nextDue)}. Mark done to stop daily reminders.`,
        style: task.alarmOnDay ? "alarm" : "notice",
        itemKind: "task",
        itemId: task.id,
      });
    }
  } else if (dailyAfter) {
    const firstDaily = addDaysISO(task.nextDue, 1);
    const at = noticeTime(firstDaily, reminderTime, current);
    if (at.getTime() > current.getTime() && firstDaily <= horizon) {
      out.push({
        key: `task:${task.id}:daily:${firstDaily}`,
        atMs: at.getTime(),
        title: `${task.name} was due yesterday`,
        body: `Due ${formatDisplayDate(task.nextDue)}. Mark done to stop daily reminders.`,
        style: "notice",
        itemKind: "task",
        itemId: task.id,
      });
    }
  }

  if (task.snoozeUntil) {
    const snooze = new Date(task.snoozeUntil);
    if (snooze.getTime() > current.getTime()) {
      out.push({
        key: `task:${task.id}:snooze`,
        atMs: snooze.getTime(),
        title: `${task.name} reminder`,
        body: `Still due ${formatDisplayDate(task.nextDue)}.`,
        style: task.alarmOnDay ? "alarm" : "notice",
        itemKind: "task",
        itemId: task.id,
      });
    }
  }

  return out;
}

export function planMonthlySummary(data: AppData, current = now()): PlannedNotice | null {
  if (!data.settings.monthlySummary) return null;
  const today = todayISO(current);
  const ym = ymOf(today);
  if (data.settings.lastMonthlySummaryYm === ym && today.slice(8, 10) !== "01") {
    // already sent this month; still schedule next month's
  }
  const fireDay = today.endsWith("-01") ? today : firstOfNextMonth(today);
  if (ymOf(fireDay) === data.settings.lastMonthlySummaryYm && fireDay === today) {
    // skip today's if already recorded; schedule next
  }
  let at = noticeTime(fireDay, data.settings.reminderTime, current);
  let fireIso = fireDay;
  if (at.getTime() <= current.getTime()) {
    fireIso = firstOfNextMonth(fireDay);
    at = noticeTime(fireIso, data.settings.reminderTime, current);
  }
  if (data.settings.lastMonthlySummaryYm === ymOf(fireIso)) {
    fireIso = firstOfNextMonth(fireIso);
    at = noticeTime(fireIso, data.settings.reminderTime, current);
  }
  const nextMonthStart = firstOfNextMonth(fireIso);
  const nextMonthEnd = firstOfNextMonth(nextMonthStart);
  const docs = data.documents.filter((d) => d.expiryDate >= nextMonthStart && d.expiryDate < nextMonthEnd);
  const tasks = data.monthlyTasks.filter((t) => t.nextDue >= nextMonthStart && t.nextDue < nextMonthEnd);
  const n = docs.length + tasks.length;
  return {
    key: `summary:${ymOf(fireIso)}`,
    atMs: at.getTime(),
    title: "What expires next month",
    body:
      n === 0
        ? "Nothing is due next month."
        : `${n} item${n === 1 ? "" : "s"} due next month. Open Expiry Guard to review.`,
    style: "notice",
    itemKind: "summary",
    itemId: ymOf(fireIso),
  };
}

export function planAllNotices(data: AppData, current = now()): PlannedNotice[] {
  const daily = data.settings.dailyReminderAfterExpiry;
  const time = data.settings.reminderTime;
  const out: PlannedNotice[] = [];
  for (const doc of data.documents) {
    out.push(...planDocumentNotices(doc, time, daily, current));
  }
  for (const task of data.monthlyTasks) {
    out.push(...planTaskNotices(task, time, daily, current));
  }
  const summary = planMonthlySummary(data, current);
  if (summary) out.push(summary);
  return out.sort((a, b) => a.atMs - b.atMs);
}

export function hashNoticeId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const id = Math.abs(hash) % 2_000_000_000;
  return id === 0 ? 1 : id;
}

export function activeAlarmTarget(
  data: AppData,
  current = now(),
): { kind: "document" | "task"; id: string } | null {
  const today = todayISO(current);
  const t = current.getTime();
  const alarmAt = atTimeOnDate(today, data.settings.reminderTime, current);
  if (t < alarmAt.getTime()) return null;
  for (const doc of data.documents) {
    if (!doc.alarmOnDay) continue;
    if (doc.expiryDate !== today) continue;
    if (doc.snoozeUntil && new Date(doc.snoozeUntil).getTime() > t) continue;
    return { kind: "document", id: doc.id };
  }
  for (const task of data.monthlyTasks) {
    if (!task.alarmOnDay) continue;
    if (task.nextDue !== today) continue;
    if (task.snoozeUntil && new Date(task.snoozeUntil).getTime() > t) continue;
    return { kind: "task", id: task.id };
  }
  return null;
}
