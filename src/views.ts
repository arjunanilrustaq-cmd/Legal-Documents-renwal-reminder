import {
  agendaRange,
  dotsForDay,
  documentMarks,
  marksOnDay,
  monthGrid,
  taskMarks,
  type CalendarMark,
} from "./calendar-util";
import { daysUntil, urgencyOf } from "./dates";
import {
  daysLeftShort,
  dueDayLabel,
  esc,
  formatDisplayDate,
  formatMonthYear,
  formatOMR,
  formatTime12,
  formatWeekdayDate,
  monthName,
  monthlyHomeSubtitle,
  ordinal,
  reminderOffsetLabel,
  repeatLabel,
} from "./format";
import { icon, typeIcon } from "./icons";
import { formatOMRInput } from "./money";
import type { AppData, DueDay, LegalDocument, MonthlyTask, RepeatRule, Tab, Urgency } from "./types";
import { DOCUMENT_REMINDER_CHIPS, DOCUMENT_TYPES, MONTHLY_TYPES, TASK_REMINDER_CHIPS } from "./types";

export interface HomeItem {
  id: string;
  kind: "document" | "monthly";
  name: string;
  hint: string;
  date: string;
  type: string;
  days: number;
  urgency: Urgency;
}

export function homeItems(data: AppData, today: string): HomeItem[] {
  const docs: HomeItem[] = data.documents.map((d) => ({
    id: d.id,
    kind: "document",
    name: d.name,
    hint: `Expires ${formatDisplayDate(d.expiryDate)}`,
    date: d.expiryDate,
    type: d.type,
    days: daysUntil(d.expiryDate, today),
    urgency: urgencyOf(daysUntil(d.expiryDate, today)),
  }));
  const tasks: HomeItem[] = data.monthlyTasks.map((t) => ({
    id: t.id,
    kind: "monthly",
    name: t.name,
    hint: monthlyHomeSubtitle(t.repeat, t.dueDay, t.amountMilles),
    date: t.nextDue,
    type: t.type,
    days: daysUntil(t.nextDue, today),
    urgency: urgencyOf(daysUntil(t.nextDue, today)),
  }));
  return [...docs, ...tasks].sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}

function counters(items: HomeItem[]): { late: number; soon: number; ok: number } {
  let late = 0;
  let soon = 0;
  let ok = 0;
  for (const item of items) {
    if (item.urgency === "late" || item.urgency === "today") {
      if (item.urgency === "late") late += 1;
      else soon += 1;
    } else if (item.urgency === "soon") soon += 1;
    else ok += 1;
  }
  return { late, soon, ok };
}

function tabBar(tab: Tab): string {
  const item = (id: Tab, label: string, ic: string) =>
    `<button class="tab ${tab === id ? "on" : ""}" data-act="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`;
  return `<nav class="tabs">${item("home", "Home", "home")}${item("calendar", "Calendar", "calendar")}${item("monthly", "Monthly", "monthly")}${item("settings", "Settings", "settings")}</nav>`;
}

function itemRow(item: HomeItem, openAct: string): string {
  const cls = item.kind === "monthly" ? `monthly ${item.urgency}` : item.urgency;
  const meta = typeIcon(item.type, item.kind === "monthly" ? "task" : "doc");
  const days = daysLeftShort(item.days);
  return `<button class="item ${cls}" data-act="${openAct}" data-id="${esc(item.id)}">
    <span class="badge" style="background:${meta.bg}">${icon(meta.icon)}</span>
    <span class="meta"><span class="name">${esc(item.name)}</span><span class="hint">${esc(item.hint)}</span></span>
    <span class="days"><b>${esc(days.n)}</b>${esc(days.unit)}</span>
  </button>`;
}

export function renderHome(data: AppData, today: string): string {
  const items = homeItems(data, today);
  const c = counters(items);
  const needs = items.filter((i) => i.days <= 30);
  const later = items.filter((i) => i.days > 30);
  const business = data.settings.businessName.trim();
  return `<div class="screen">
    <header class="header">
      <h1>Coming up</h1>
      <div class="sub">${business ? esc(business) : "Set your business name in Settings"}</div>
      <div class="counters">
        <div class="counter late"><div class="n">${c.late}</div><div class="l">Late</div></div>
        <div class="counter soon"><div class="n">${c.soon}</div><div class="l">Within 30<br>days</div></div>
        <div class="counter ok"><div class="n">${c.ok}</div><div class="l">OK</div></div>
      </div>
    </header>
    <div class="content">
      ${
        items.length === 0
          ? `<div class="empty"><h3>Nothing coming up</h3><p>Tap + Add to track a document renewal or a monthly payment. Photos stay on this phone.</p></div>`
          : `${needs.length ? `<div class="section-label">NEEDS ACTION</div>${needs.map((i) => itemRow(i, i.kind === "monthly" ? "open-task" : "open-doc")).join("")}` : ""}
             ${later.length ? `<div class="section-label">LATER</div>${later.map((i) => itemRow(i, i.kind === "monthly" ? "open-task" : "open-doc")).join("")}` : ""}`
      }
    </div>
    <button class="fab" data-act="add-pick">${icon("plus")} Add</button>
    ${tabBar("home")}
  </div>`;
}

export function renderMonthlyList(data: AppData, today: string): string {
  const items = homeItems(data, today).filter((i) => i.kind === "monthly");
  return `<div class="screen">
    <header class="header">
      <h1>Monthly</h1>
      <div class="sub">Salary, rent, bills and other repeating payments</div>
    </header>
    <div class="content">
      ${
        items.length === 0
          ? `<div class="empty"><h3>No monthly tasks</h3><p>Add salary, rent or bills. Mark done each month and the next date is set for you.</p></div>`
          : items.map((i) => itemRow(i, "open-task")).join("")
      }
    </div>
    <button class="fab" data-act="add-task">${icon("plus")} Add</button>
    ${tabBar("monthly")}
  </div>`;
}

export function renderCalendar(opts: {
  data: AppData;
  today: string;
  year: number;
  monthIndex: number;
  selected: string;
  mode: "month" | "list";
}): string {
  const marks = [...documentMarks(opts.data.documents, opts.today), ...taskMarks(opts.data.monthlyTasks, opts.today)];
  const headerToggle = `<div class="month-toggle">
    <button class="${opts.mode === "month" ? "on" : ""}" data-act="cal-mode" data-mode="month">Month</button>
    <button class="${opts.mode === "list" ? "on" : ""}" data-act="cal-mode" data-mode="list">List</button>
  </div>`;
  let body = "";
  if (opts.mode === "list") {
    const agenda = agendaRange(marks, opts.today, 90);
    body = agenda.length
      ? groupAgenda(agenda, opts.today)
      : `<div class="empty"><h3>Nothing in the next 90 days</h3></div>`;
  } else {
    const weeks = monthGrid(opts.year, opts.monthIndex);
    const wds = ["S", "M", "T", "W", "T", "F", "S"].map((d) => `<div class="cal-wd">${d}</div>`).join("");
    const days = weeks
      .flat()
      .map((cell) => {
        if (!cell.iso) return `<div></div>`;
        const dayMarks = marksOnDay(marks, cell.iso);
        const dots = dotsForDay(dayMarks);
        const n = Number(cell.iso.slice(8));
        const today = cell.iso === opts.today ? "today" : "";
        const sel = cell.iso === opts.selected ? "sel" : "";
        return `<button class="cal-day ${cell.inMonth ? "" : "out"} ${today} ${sel}" data-act="cal-day" data-iso="${cell.iso}">
          <span class="num">${n}</span>
          <span class="dots">
            ${dots.red ? `<i class="dot red"></i>` : ""}
            ${dots.orange ? `<i class="dot orange"></i>` : ""}
            ${dots.blue ? `<i class="dot blue"></i>` : ""}
          </span>
        </button>`;
      })
      .join("");
    const selectedMarks = marksOnDay(marks, opts.selected);
    body = `<div class="cal-nav">
        <button data-act="cal-prev">${icon("back")}</button>
        <div>${formatMonthYear(opts.year, opts.monthIndex)}</div>
        <button data-act="cal-next" style="transform:scaleX(-1)">${icon("back")}</button>
      </div>
      <div class="cal-grid">${wds}${days}</div>
      <div class="legend">
        <span><i class="dot red"></i> Expired</span>
        <span><i class="dot orange"></i> Document</span>
        <span><i class="dot blue"></i> Monthly</span>
      </div>
      <div class="section-label">${formatWeekdayDate(opts.selected)} · ${selectedMarks.length} ITEM${selectedMarks.length === 1 ? "" : "S"}</div>
      ${selectedMarks.length ? selectedMarks.map((m) => markRow(m, opts.today)).join("") : `<div class="empty"><p>Nothing on this day.</p></div>`}`;
  }
  return `<div class="screen">
    <header class="header">
      <h1>Calendar</h1>
      ${headerToggle}
    </header>
    <div class="content">${body}</div>
    <button class="fab" data-act="add-pick">${icon("plus")} Add</button>
    ${tabBar("calendar")}
  </div>`;
}

function markRow(mark: CalendarMark, today: string): string {
  const days = daysUntil(mark.iso, today);
  const item: HomeItem = {
    id: mark.id,
    kind: mark.kind === "monthly" ? "monthly" : "document",
    name: mark.name,
    hint: mark.kind === "monthly" ? "Monthly" : "Document expires",
    date: mark.iso,
    type: mark.type,
    days,
    urgency: mark.urgency,
  };
  return itemRow(item, mark.kind === "monthly" ? "open-task" : "open-doc");
}

function groupAgenda(marks: CalendarMark[], today: string): string {
  const groups = new Map<string, CalendarMark[]>();
  for (const mark of marks) {
    const list = groups.get(mark.iso) ?? [];
    list.push(mark);
    groups.set(mark.iso, list);
  }
  return [...groups.entries()]
    .map(
      ([iso, list]) =>
        `<div class="section-label">${formatWeekdayDate(iso)}${iso < today ? " · LATE" : ""} · ${list.length} ITEM${list.length === 1 ? "" : "S"}</div>${list.map((m) => markRow(m, today)).join("")}`,
    )
    .join("");
}

export function renderSettings(data: AppData): string {
  const s = data.settings;
  const reminders = s.defaultReminderOffsets
    .slice()
    .sort((a, b) => b - a)
    .map(reminderOffsetLabel)
    .join(", ");
  return `<div class="screen">
    <header class="header">
      <h1>Settings</h1>
    </header>
    <div class="content">
      <div class="settings-card">
        <label class="set-row"><div class="grow"><div class="k">Business name</div>
          <input class="input" style="margin-top:8px" data-act="business-name" value="${esc(s.businessName)}" placeholder="e.g. Example Trading LLC"></div></label>
        <button class="set-row" data-act="edit-defaults"><div class="grow"><div class="k">Default reminders</div><div class="v">${esc(reminders || "None")}</div></div><span class="action">Change</span></button>
        <button class="set-row" data-act="edit-time"><div class="grow"><div class="k">Reminder time</div><div class="v">${esc(formatTime12(s.reminderTime))}</div></div><span class="action">Change</span></button>
        <div class="set-row"><div class="grow"><div class="k">Alarm on expiry day</div><div class="v">For new documents</div></div>${switchHtml("set-alarm", s.alarmOnExpiryDay)}</div>
        <div class="set-row"><div class="grow"><div class="k">Daily reminder after expiry</div><div class="v">Until marked renewed</div></div>${switchHtml("set-daily", s.dailyReminderAfterExpiry)}</div>
        <div class="set-row"><button class="grow" data-act="edit-lock" style="text-align:left;background:none"><div class="k">App lock</div><div class="v">${s.appLockEnabled ? "PIN" + (s.biometricEnabled ? " or fingerprint" : "") : "Off"}</div></button>${switchHtml("set-lock", s.appLockEnabled)}</div>
        <button class="set-row" data-act="backup"><div class="grow"><div class="k">Backup</div><div class="v">Save all to one file · restore on a new phone</div></div><span class="action">Backup</span></button>
        <div class="set-row"><div class="grow"><div class="k">Monthly summary</div><div class="v">What expires next month, 1st of each month</div></div>${switchHtml("set-summary", s.monthlySummary)}</div>
      </div>
      <p class="small-note">Works offline. Photos stay on the phone. Currency is OMR.</p>
    </div>
    ${tabBar("settings")}
  </div>`;
}

function switchHtml(act: string, on: boolean): string {
  return `<button class="switch ${on ? "on" : ""}" data-act="${act}" aria-pressed="${on}"><i></i></button>`;
}

function chip(label: string, on: boolean, act: string, extra = ""): string {
  return `<button class="chip ${on ? "on" : ""}" data-act="${act}" ${extra}>${label}</button>`;
}

export interface DocFormState {
  draft: LegalDocument;
  photoUrls: string[];
  customOffset: string;
  title: string;
}

export function renderDocForm(state: DocFormState): string {
  const d = state.draft;
  const types = DOCUMENT_TYPES.map((t) =>
    chip(t.id === "other" ? "+ Other" : t.label, d.type === t.id, "doc-type", `data-type="${t.id}"`),
  ).join("");
  const reminders = DOCUMENT_REMINDER_CHIPS.map((n) =>
    chip(reminderOffsetLabel(n), d.reminderOffsets.includes(n), "doc-offset", `data-offset="${n}"`),
  ).join("");
  const photos = [0, 1, 2].map((i) => {
    const url = state.photoUrls[i];
    if (url) {
      return `<button class="photo-slot" data-act="photo-zoom" data-index="${i}"><img src="${esc(url)}" alt=""></button>`;
    }
    const label = i === 0 ? "Front" : i === 1 ? "Back" : "More pages";
    return `<button class="photo-slot add" data-act="add-photo" data-index="${i}">${icon("camera")}<span>${label}</span><small>Camera or gallery</small></button>`;
  });
  return `<div class="screen">
    <header class="header row">
      <button class="icon-btn" data-act="back">${icon("back")}</button>
      <h1>${esc(state.title)}</h1>
    </header>
    <div class="content no-tab">
      <div class="field-label">PHOTOS (FRONT, BACK, MORE PAGES)</div>
      <div class="photos">${photos.join("")}</div>
      <div class="field-label">NAME</div>
      <input class="input" data-act="doc-name" value="${esc(d.name)}" placeholder="Commercial registration">
      <div class="field-label">TYPE</div>
      <div class="chips">${types}</div>
      ${d.type === "other" ? `<input class="input" style="margin-top:8px" data-act="doc-custom-type" value="${esc(d.customType)}" placeholder="Type name">` : ""}
      <div class="field-label">EXPIRY DATE</div>
      <input class="input" type="date" data-act="doc-expiry" value="${esc(d.expiryDate)}">
      <div class="field-label">REMIND ME</div>
      <div class="chips">${reminders}${chip("+ Custom", false, "doc-custom-offset")}</div>
      ${state.customOffset ? `<input class="input" style="margin-top:8px" data-act="doc-custom-offset-val" inputmode="numeric" value="${esc(state.customOffset)}" placeholder="Days before">` : ""}
      <div class="toggle-row">
        <div><div class="t">Alarm on the day</div><div class="s">Rings like an alarm at ${formatTime12("09:00")}</div></div>
        ${switchHtml("doc-alarm", d.alarmOnDay)}
      </div>
      <button class="btn primary" data-act="save-doc">SAVE</button>
      <div class="field-label">OPTIONAL</div>
      <input class="input" data-act="doc-number" value="${esc(d.documentNumber)}" placeholder="Document number">
      <div class="amount-wrap" style="margin-top:8px">
        <input class="input" data-act="doc-cost" inputmode="decimal" value="${esc(formatOMRInput(d.renewalCostMilles))}" placeholder="Renewal cost">
        <span class="ccy">OMR</span>
      </div>
      <textarea class="textarea" style="margin-top:8px" data-act="doc-note" placeholder="Note">${esc(d.note)}</textarea>
    </div>
  </div>`;
}

export interface TaskFormState {
  draft: MonthlyTask;
  title: string;
}

export function renderTaskForm(state: TaskFormState, reminderTime: string): string {
  const t = state.draft;
  const types = MONTHLY_TYPES.map((x) =>
    chip(x.id === "other" ? "+ Other" : x.label, t.type === x.id, "task-type", `data-type="${x.id}"`),
  ).join("");
  const repeats: { id: RepeatRule; label: string }[] = [
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Every 3 months" },
    { id: "yearly", label: "Yearly" },
  ];
  const reminders = TASK_REMINDER_CHIPS.map((n) =>
    chip(reminderOffsetLabel(n), t.reminderOffsets.includes(n), "task-offset", `data-offset="${n}"`),
  ).join("");
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${t.dueDay.kind === "day" && t.dueDay.day === n ? "selected" : ""}>${ordinal(n)}</option>`)
    .join("");
  return `<div class="screen">
    <header class="header row">
      <button class="icon-btn" data-act="back">${icon("back")}</button>
      <h1>${esc(state.title)}</h1>
    </header>
    <div class="content no-tab">
      <div class="field-label">NAME</div>
      <input class="input" data-act="task-name" value="${esc(t.name)}" placeholder="Staff salary deposit">
      <div class="field-label">TYPE</div>
      <div class="chips">${types}</div>
      ${t.type === "other" ? `<input class="input" style="margin-top:8px" data-act="task-custom-type" value="${esc(t.customType)}" placeholder="Type name">` : ""}
      <div class="field-label">DUE EVERY</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="input" data-act="task-day">${dayOptions}<option value="last" ${t.dueDay.kind === "last" ? "selected" : ""}>Last day of month</option></select>
        <span class="ccy">of the month</span>
      </div>
      <div class="chips" style="margin-top:10px">${repeats.map((r) => chip(r.label, t.repeat === r.id, "task-repeat", `data-repeat="${r.id}"`)).join("")}</div>
      <div class="field-label">AMOUNT (OPTIONAL)</div>
      <div class="amount-wrap">
        <input class="input" data-act="task-amount" inputmode="decimal" value="${esc(formatOMRInput(t.amountMilles))}" placeholder="0.000">
        <span class="ccy">OMR</span>
      </div>
      <div class="field-label">REMIND ME</div>
      <div class="chips">${reminders}</div>
      <div class="toggle-row">
        <div><div class="t">Alarm on the day</div><div class="s">Rings like an alarm at ${esc(formatTime12(reminderTime))}</div></div>
        ${switchHtml("task-alarm", t.alarmOnDay)}
      </div>
      <button class="btn primary" data-act="save-task">SAVE</button>
    </div>
  </div>`;
}

export function renderDocDetail(doc: LegalDocument, today: string, photoUrl: string | null, reminderTime: string): string {
  const days = daysUntil(doc.expiryDate, today);
  const urgency = urgencyOf(days);
  const short = daysLeftShort(days);
  const nextOffset = doc.reminderOffsets
    .slice()
    .sort((a, b) => a - b)
    .find((o) => daysUntil(doc.expiryDate, today) > o || days > o);
  const nextIsoCandidates = doc.reminderOffsets
    .map((o) => ({ o, iso: offsetDate(doc.expiryDate, o) }))
    .filter((x) => x.iso >= today)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  const next = nextIsoCandidates[0];
  const cost = doc.renewalCostMilles !== null ? `${formatOMR(doc.renewalCostMilles)} OMR` : "—";
  void nextOffset;
  return `<div class="screen">
    <header class="header row">
      <button class="icon-btn" data-act="back">${icon("back")}</button>
      <h1>${esc(doc.name)}</h1>
    </header>
    <div class="content no-tab">
      <button class="hero-photo" data-act="photo-zoom" data-index="0">
        ${photoUrl ? `<img src="${esc(photoUrl)}" alt="">` : `${icon("file")}<div>tap to zoom · ${doc.photoIds.length} page${doc.photoIds.length === 1 ? "" : "s"}</div>`}
        <span class="pages">tap to zoom · ${doc.photoIds.length} page${doc.photoIds.length === 1 ? "" : "s"}</span>
      </button>
      <div class="days-card ${urgency}">
        <div class="big">${esc(short.n)}</div>
        <div class="unit">${esc(short.unit)} · expires ${esc(formatDisplayDate(doc.expiryDate))}</div>
      </div>
      <div class="facts">
        <div>Next reminder: ${next ? `${esc(formatDisplayDate(next.iso))} (${next.o === 0 ? "on the day" : `${next.o} day${next.o === 1 ? "" : "s"} before`})` : "None upcoming"}</div>
        <div>Alarm: ${doc.alarmOnDay ? `${esc(formatTime12(reminderTime))}` : "Off"}</div>
        <div>Renewal cost: ${esc(cost)}</div>
        ${doc.note ? `<div>Note: ${esc(doc.note)}</div>` : ""}
      </div>
      <button class="btn green" data-act="renew-doc">${icon("check")} Renewed: set new date</button>
      <div class="pair">
        <button class="btn ghost" data-act="share-doc">${icon("share")} Share</button>
        <button class="btn ghost" data-act="edit-doc">${icon("edit")} Edit</button>
      </div>
      <button class="btn danger" data-act="delete-doc">Delete document</button>
    </div>
  </div>`;
}

function offsetDate(expiry: string, offset: number): string {
  const [y, m, d] = expiry.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - offset);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function renderTaskDetail(task: MonthlyTask, today: string): string {
  const days = daysUntil(task.nextDue, today);
  const urgency = urgencyOf(days);
  const short = daysLeftShort(days);
  const amount = task.amountMilles !== null ? `${formatOMR(task.amountMilles)} OMR` : "";
  const rule = `${repeatLabel(task.repeat).toLowerCase()} on the ${dueDayLabel(task.dueDay).toLowerCase()}`;
  const history = task.history
    .map((h) => {
      const late = h.daysLate > 0 ? ` <span class="late">· ${h.daysLate} day${h.daysLate === 1 ? "" : "s"} late</span>` : "";
      return `<div class="h"><span>${esc(monthName(h.periodDue))} ${h.periodDue.slice(0, 4)}</span><span>✓ Done ${esc(formatDisplayDate(h.doneAt).replace(/ \d{4}$/, ""))}${late}</span></div>`;
    })
    .join("");
  return `<div class="screen">
    <header class="header row">
      <button class="icon-btn" data-act="back">${icon("back")}</button>
      <h1>${esc(task.name)}</h1>
    </header>
    <div class="content no-tab">
      <div class="days-card ${urgency}">
        <div class="big">${esc(short.n)}</div>
        <div class="unit">${esc(short.unit)} · due ${esc(formatDisplayDate(task.nextDue))}</div>
        <div class="when">${esc(amount ? `${amount} · ${rule}` : rule)}</div>
      </div>
      <button class="btn green" data-act="done-task">${icon("check")} Done for ${esc(monthName(task.nextDue))}</button>
      <div class="field-label">HISTORY</div>
      <div class="history">${history || `<div class="small-note">No payments recorded yet.</div>`}</div>
      <div class="pair">
        <button class="btn ghost" data-act="skip-task">Skip this month</button>
        <button class="btn ghost" data-act="edit-task">Edit</button>
      </div>
      <button class="btn danger" data-act="delete-task">Delete task</button>
    </div>
  </div>`;
}

export function renderAlarm(opts: {
  time: string;
  title: string;
  body: string;
}): string {
  return `<div class="alarm">
    <div class="time">${esc(formatTime12(opts.time))}</div>
    <div class="bell">${icon("clock")}</div>
    <h2>${esc(opts.title)}</h2>
    <p>${esc(opts.body)}</p>
    <div class="stack">
      <button class="btn green" data-act="alarm-renewed">${icon("check")} I renewed it</button>
      <button class="btn white" data-act="alarm-snooze">Snooze 1 hour</button>
      <button class="btn white" data-act="alarm-tomorrow">Remind me tomorrow</button>
    </div>
  </div>`;
}

export function renderLock(pin: string, biometric: boolean, error: string): string {
  const dots = [0, 1, 2, 3].map((i) => `<b class="${i < pin.length ? "on" : ""}"></b>`).join("");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return `<div class="lock">
    ${icon("lock")}
    <h1>Expiry Guard</h1>
    <div>${error ? esc(error) : "Enter PIN"}</div>
    <div class="dots-pin">${dots}</div>
    ${biometric ? `<button class="btn white" style="max-width:280px" data-act="bio">Use fingerprint</button>` : ""}
    <div class="pad">${keys
      .map((k) =>
        k === ""
          ? `<span></span>`
          : `<button data-act="pin-key" data-key="${k === "⌫" ? "del" : k}">${k}</button>`,
      )
      .join("")}</div>
  </div>`;
}

export function renderPicker(): string {
  return `<div class="sheet-backdrop" data-act="close-picker"><div class="sheet" data-stop="1">
    <h3>Add</h3>
    <button class="choice" data-act="add-doc">Document</button>
    <button class="choice" data-act="add-task">Monthly task</button>
    <button class="choice" data-act="close-picker">Cancel</button>
  </div></div>`;
}

export function renderConfirm(opts: { title: string; body: string; confirm: string; danger?: boolean }): string {
  return `<div class="modal-backdrop" data-act="confirm-no"><div class="modal" data-stop="1">
    <h3>${esc(opts.title)}</h3>
    <p>${esc(opts.body)}</p>
    <button class="btn ${opts.danger ? "danger" : "primary"}" data-act="confirm-yes">${esc(opts.confirm)}</button>
    <button class="btn ghost" data-act="confirm-no">Cancel</button>
  </div></div>`;
}

export function renderZoom(url: string, index: number, total: number): string {
  return `<div class="zoom-backdrop" data-act="close-zoom">
    ${index > 0 ? `<button class="icon-btn ghost" style="position:absolute;left:12px" data-act="zoom-prev">${icon("back")}</button>` : ""}
    <img src="${esc(url)}" alt="Page ${index + 1} of ${total}">
    ${index < total - 1 ? `<button class="icon-btn ghost" style="position:absolute;right:12px;transform:scaleX(-1)" data-act="zoom-next">${icon("back")}</button>` : ""}
  </div>`;
}

export function overlayPrompt(title: string, bodyHtml: string): string {
  return `<div class="modal-backdrop" data-act="prompt-cancel"><div class="modal" data-stop="1">
    <h3>${esc(title)}</h3>
    ${bodyHtml}
  </div></div>`;
}

export function dueDayFromValue(value: string): DueDay {
  if (value === "last") return { kind: "last" };
  return { kind: "day", day: Number(value) };
}
