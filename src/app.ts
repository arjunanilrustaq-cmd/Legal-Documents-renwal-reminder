import { App as CapApp } from "@capacitor/app";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { decideBack, snapshotIsDirty, type OverlayKind } from "./back";
import { addHours, now, setToday, todayISO, toISODate } from "./clock";
import { addDaysISO, firstDueOnOrAfter } from "./dates";
import { buildBackup, parseBackup } from "./backup";
import { formatDisplayDate, formatOMR } from "./format";
import { pinLooksValid, sha256Hex } from "./lock";
import { parseOMR } from "./money";
import { listenForAlarmOpen, requestNotificationPermission, syncNotifications } from "./reminders";
import { activeAlarmTarget } from "./schedule";
import { createDocumentDraft, createTaskDraft, store } from "./store";
import type { AppData, LegalDocument, MonthlyTask, Tab } from "./types";
import {
  dueDayFromValue,
  overlayPrompt,
  renderAlarm,
  renderCalendar,
  renderConfirm,
  renderDocDetail,
  renderDocForm,
  renderHome,
  renderLock,
  renderMonthlyList,
  renderPicker,
  renderSettings,
  renderTaskDetail,
  renderTaskForm,
  renderZoom,
} from "./views";

type Route =
  | { name: "tabs" }
  | { name: "doc-form"; mode: "create" | "edit" | "renew" }
  | { name: "doc-detail"; id: string }
  | { name: "task-form"; mode: "create" | "edit" }
  | { name: "task-detail"; id: string }
  | { name: "alarm"; kind: "document" | "task"; id: string };

interface ConfirmSpec {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  onYes: () => void | Promise<void>;
}

export class App {
  private root: HTMLElement;
  private tab: Tab = "home";
  private route: Route = { name: "tabs" };
  private stack: Route[] = [];
  private picker = false;
  private zoom: { urls: string[]; index: number } | null = null;
  private confirm: ConfirmSpec | null = null;
  private lockOpen = false;
  private pinBuffer = "";
  private lockError = "";
  private docDraft: LegalDocument | null = null;
  private docBaseline = "";
  private taskDraft: MonthlyTask | null = null;
  private taskBaseline = "";
  private pendingPhotos: Blob[] = [];
  private photoUrls: string[] = [];
  private customOffset = "";
  private cal = { year: 0, monthIndex: 0, selected: "", mode: "month" as "month" | "list" };
  private prompt: { title: string; html: string } | null = null;
  private swipeX: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    const t = todayISO();
    const [y, m] = t.split("-").map(Number);
    this.cal = { year: y, monthIndex: m - 1, selected: t, mode: "month" };
  }

  async start(): Promise<void> {
    this.applyQueryFlags();
    if (store.data.settings.appLockEnabled && store.data.settings.pinHash) this.lockOpen = true;
    this.bind();
    this.render();
    await this.prepareNative();
    await syncNotifications(store.data);
    listenForAlarmOpen((target) => this.openAlarm(target.kind, target.id));
    const pending = (window as unknown as { __pendingAlarm?: { kind?: string; id?: string } }).__pendingAlarm;
    if (pending?.id) this.openAlarm(pending.kind === "task" ? "task" : "document", pending.id);
    window.addEventListener("expiry-alarm", (event) => {
      const detail = (event as CustomEvent<{ kind?: string; id?: string }>).detail;
      if (detail?.id) this.openAlarm(detail.kind === "task" ? "task" : "document", detail.id);
    });
    this.maybeShowDueAlarm();
  }

  private applyQueryFlags(): void {
    const q = new URLSearchParams(location.search);
    const today = q.get("today");
    if (today) setToday(today, q.get("time") || "09:00");
    if (q.has("screenshot")) {
      const w = window as unknown as { __eg: App };
      w.__eg = this;
    }
  }

  private async prepareNative(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#1b3d66" });
    } catch {
      /* ignore */
    }
    await requestNotificationPermission();
    CapApp.addListener("backButton", () => {
      void this.handleBack();
    });
    CapApp.addListener("appStateChange", (state) => {
      if (!state.isActive && store.data.settings.appLockEnabled) {
        this.lockOpen = true;
        this.pinBuffer = "";
        this.render();
      }
    });
  }

  private bind(): void {
    this.root.addEventListener("click", (ev) => {
      const target = (ev.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
      if (!target) return;
      if (target.dataset.stop) ev.stopPropagation();
      void this.onAction(target.dataset.act || "", target, ev);
    });
    this.root.addEventListener("input", (ev) => {
      const target = ev.target as HTMLElement;
      const act = target.getAttribute("data-act");
      if (act) void this.onInput(act, target);
    });
    this.root.addEventListener("change", (ev) => {
      const target = ev.target as HTMLElement;
      const act = target.getAttribute("data-act");
      if (act) void this.onInput(act, target);
    });
    this.root.addEventListener("touchstart", (ev) => {
      this.swipeX = ev.changedTouches[0]?.clientX ?? null;
    });
    this.root.addEventListener("touchend", (ev) => {
      if (this.swipeX === null) return;
      const x = ev.changedTouches[0]?.clientX ?? this.swipeX;
      const dx = x - this.swipeX;
      this.swipeX = null;
      if (this.route.name === "tabs" && this.tab === "calendar" && this.cal.mode === "month" && Math.abs(dx) > 50) {
        this.shiftMonth(dx < 0 ? 1 : -1);
      }
    });
  }

  private routeId(): string {
    const route = this.route;
    if (route.name === "doc-detail" || route.name === "task-detail" || route.name === "alarm") return route.id;
    return "";
  }

  private overlayKind(): OverlayKind {
    if (this.lockOpen) return "lock";
    if (this.zoom) return "zoom";
    if (this.picker) return "picker";
    if (this.route.name === "doc-form") return "doc-form";
    if (this.route.name === "task-form") return "task-form";
    if (this.route.name === "doc-detail") return "doc-detail";
    if (this.route.name === "task-detail") return "task-detail";
    if (this.route.name === "alarm") return "alarm";
    return "none";
  }

  private isDirty(): boolean {
    if (this.route.name === "doc-form" && this.docDraft) return snapshotIsDirty(JSON.stringify(this.docDraft), this.docBaseline);
    if (this.route.name === "task-form" && this.taskDraft) return snapshotIsDirty(JSON.stringify(this.taskDraft), this.taskBaseline);
    return false;
  }

  private async handleBack(): Promise<void> {
    const decision = decideBack({
      confirmOpen: Boolean(this.confirm || this.prompt),
      overlay: this.overlayKind(),
      overlayDirty: this.isDirty(),
      lockOpen: this.lockOpen,
    });
    switch (decision.action) {
      case "keep-confirm":
      case "keep-lock":
        return;
      case "close-zoom":
        this.zoom = null;
        this.render();
        return;
      case "close-picker":
        this.picker = false;
        this.render();
        return;
      case "ask-discard":
        this.ask({
          title: "Discard changes?",
          body: "You have unsaved changes. Discard them?",
          confirm: "Discard",
          danger: true,
          onYes: () => this.closeOverlay(),
        });
        return;
      case "close-overlay":
      case "close-alarm":
        this.closeOverlay();
        return;
      case "exit":
        if (Capacitor.isNativePlatform()) {
          await CapApp.exitApp();
        }
        return;
    }
  }

  private closeOverlay(): void {
    this.picker = false;
    this.zoom = null;
    this.prompt = null;
    this.docDraft = null;
    this.taskDraft = null;
    this.pendingPhotos = [];
    this.revokePhotoUrls();
    const prev = this.stack.pop();
    this.route = prev ?? { name: "tabs" };
    this.render();
  }

  private finishToTabs(): void {
    this.stack = [];
    this.route = { name: "tabs" };
    this.picker = false;
    this.zoom = null;
    this.prompt = null;
    this.docDraft = null;
    this.taskDraft = null;
    this.pendingPhotos = [];
    this.revokePhotoUrls();
    this.render();
  }

  private push(route: Route): void {
    if (this.route.name !== route.name) this.stack.push(this.route);
    this.route = route;
    this.render();
  }

  private data(): AppData {
    return store.data;
  }

  private render(): void {
    if (this.lockOpen) {
      this.root.innerHTML = renderLock(this.pinBuffer, store.data.settings.biometricEnabled, this.lockError);
      return;
    }
    let html = "";
    const today = todayISO();
    const route = this.route;
    switch (route.name) {
      case "tabs":
        if (this.tab === "home") html = renderHome(this.data(), today);
        else if (this.tab === "calendar")
          html = renderCalendar({
            data: this.data(),
            today,
            year: this.cal.year,
            monthIndex: this.cal.monthIndex,
            selected: this.cal.selected,
            mode: this.cal.mode,
          });
        else if (this.tab === "monthly") html = renderMonthlyList(this.data(), today);
        else html = renderSettings(this.data());
        break;
      case "doc-form":
        html = renderDocForm({
          draft: this.docDraft!,
          photoUrls: this.photoUrls,
          customOffset: this.customOffset,
          title: route.mode === "renew" ? "Renew document" : route.mode === "edit" ? "Edit document" : "Add document",
        });
        break;
      case "task-form":
        html = renderTaskForm(
          {
            draft: this.taskDraft!,
            title: route.mode === "edit" ? "Edit monthly task" : "Add monthly task",
          },
          store.data.settings.reminderTime,
        );
        break;
      case "doc-detail": {
        const doc = this.data().documents.find((d) => d.id === route.id);
        if (!doc) {
          this.route = { name: "tabs" };
          html = renderHome(this.data(), today);
          break;
        }
        html = renderDocDetail(doc, today, this.photoUrls[0] ?? null, store.data.settings.reminderTime);
        break;
      }
      case "task-detail": {
        const task = this.data().monthlyTasks.find((t) => t.id === route.id);
        if (!task) {
          this.route = { name: "tabs" };
          html = renderMonthlyList(this.data(), today);
          break;
        }
        html = renderTaskDetail(task, today);
        break;
      }
      case "alarm": {
        const item =
          route.kind === "document"
            ? this.data().documents.find((d) => d.id === route.id)
            : this.data().monthlyTasks.find((t) => t.id === route.id);
        const name = item?.name ?? "Item";
        html = renderAlarm({
          time: store.data.settings.reminderTime,
          title: route.kind === "document" ? `${name} expires TODAY` : `${name} is due TODAY`,
          body:
            route.kind === "document"
              ? "Renew today to avoid a late fine."
              : "Mark it done after you pay, or snooze if you need a bit more time.",
        });
        break;
      }
    }
    if (this.picker) html += renderPicker();
    if (this.zoom) html += renderZoom(this.zoom.urls[this.zoom.index], this.zoom.index, this.zoom.urls.length);
    if (this.prompt) html += overlayPrompt(this.prompt.title, this.prompt.html);
    if (this.confirm)
      html += renderConfirm({
        title: this.confirm.title,
        body: this.confirm.body,
        confirm: this.confirm.confirm,
        danger: this.confirm.danger,
      });
    this.root.innerHTML = html;
  }

  private ask(spec: ConfirmSpec): void {
    this.confirm = spec;
    this.render();
  }

  private async onAction(act: string, el: HTMLElement, ev: Event): Promise<void> {
    if (el.dataset.stop) ev.stopPropagation();
    switch (act) {
      case "tab":
        this.tab = (el.dataset.tab as Tab) ?? "home";
        this.route = { name: "tabs" };
        this.render();
        return;
      case "add-pick":
        this.picker = true;
        this.render();
        return;
      case "close-picker":
        this.picker = false;
        this.render();
        return;
      case "add-doc":
        this.picker = false;
        this.beginDocForm("create");
        return;
      case "add-task":
        this.picker = false;
        this.beginTaskForm("create");
        return;
      case "open-doc":
        await this.openDoc(el.dataset.id || "");
        return;
      case "open-task":
        this.openTask(el.dataset.id || "");
        return;
      case "back":
        await this.handleBack();
        return;
      case "save-doc":
        await this.saveDoc();
        return;
      case "save-task":
        await this.saveTask();
        return;
      case "doc-type":
        if (this.docDraft) this.docDraft.type = el.dataset.type as LegalDocument["type"];
        this.render();
        return;
      case "doc-offset": {
        const n = Number(el.dataset.offset);
        this.toggleOffset("doc", n);
        return;
      }
      case "doc-custom-offset":
        this.customOffset = this.customOffset || "14";
        this.render();
        return;
      case "doc-alarm":
        if (this.docDraft) this.docDraft.alarmOnDay = !this.docDraft.alarmOnDay;
        this.render();
        return;
      case "add-photo":
        await this.addPhoto();
        return;
      case "photo-zoom":
        if (this.photoUrls.length) this.zoom = { urls: this.photoUrls, index: Number(el.dataset.index || 0) };
        this.render();
        return;
      case "close-zoom":
        this.zoom = null;
        this.render();
        return;
      case "zoom-prev":
        if (this.zoom) this.zoom.index = Math.max(0, this.zoom.index - 1);
        this.render();
        return;
      case "zoom-next":
        if (this.zoom) this.zoom.index = Math.min(this.zoom.urls.length - 1, this.zoom.index + 1);
        this.render();
        return;
      case "task-type":
        if (this.taskDraft) this.taskDraft.type = el.dataset.type as MonthlyTask["type"];
        this.render();
        return;
      case "task-offset":
        this.toggleOffset("task", Number(el.dataset.offset));
        return;
      case "task-repeat":
        if (this.taskDraft) this.taskDraft.repeat = el.dataset.repeat as MonthlyTask["repeat"];
        this.render();
        return;
      case "task-alarm":
        if (this.taskDraft) this.taskDraft.alarmOnDay = !this.taskDraft.alarmOnDay;
        this.render();
        return;
      case "edit-doc":
        if (this.route.name === "doc-detail") this.beginDocForm("edit", this.routeId());
        return;
      case "renew-doc":
        if (this.route.name === "doc-detail") this.beginDocForm("renew", this.routeId());
        return;
      case "delete-doc":
        this.ask({
          title: "Delete this document?",
          body: "The document, its photos and reminder history will be removed from this phone.",
          confirm: "Delete",
          danger: true,
          onYes: async () => {
            if (this.route.name === "doc-detail") {
              await store.deleteDocument(this.routeId());
              await syncNotifications(store.data);
              this.finishToTabs();
            }
          },
        });
        return;
      case "share-doc":
        await this.shareDoc();
        return;
      case "edit-task":
        if (this.route.name === "task-detail") this.beginTaskForm("edit", this.routeId());
        return;
      case "done-task":
        await this.completeTask();
        return;
      case "skip-task":
        this.ask({
          title: "Skip this month?",
          body: "The next due date will move forward. This month will not be saved as done.",
          confirm: "Skip",
          onYes: async () => {
            if (this.route.name !== "task-detail") return;
            const task = store.data.monthlyTasks.find((t) => t.id === this.routeId());
            if (!task) return;
            await store.saveTask(store.skipTask(task));
            await syncNotifications(store.data);
            this.render();
          },
        });
        return;
      case "delete-task":
        this.ask({
          title: "Delete this task?",
          body: "The monthly task and its history will be removed.",
          confirm: "Delete",
          danger: true,
          onYes: async () => {
            if (this.route.name === "task-detail") {
              await store.deleteTask(this.routeId());
              await syncNotifications(store.data);
              this.finishToTabs();
            }
          },
        });
        return;
      case "cal-mode":
        this.cal.mode = el.dataset.mode === "list" ? "list" : "month";
        this.render();
        return;
      case "cal-prev":
        this.shiftMonth(-1);
        return;
      case "cal-next":
        this.shiftMonth(1);
        return;
      case "cal-day":
        this.cal.selected = el.dataset.iso || this.cal.selected;
        this.render();
        return;
      case "set-alarm":
        store.data.settings.alarmOnExpiryDay = !store.data.settings.alarmOnExpiryDay;
        await store.update(() => undefined);
        this.render();
        return;
      case "set-daily":
        store.data.settings.dailyReminderAfterExpiry = !store.data.settings.dailyReminderAfterExpiry;
        await store.update(() => undefined);
        await syncNotifications(store.data);
        this.render();
        return;
      case "set-summary":
        store.data.settings.monthlySummary = !store.data.settings.monthlySummary;
        await store.update(() => undefined);
        await syncNotifications(store.data);
        this.render();
        return;
      case "set-lock":
        await this.toggleLock();
        return;
      case "edit-lock":
        await this.toggleLock();
        return;
      case "edit-defaults":
        this.openDefaultReminders();
        return;
      case "edit-time":
        this.prompt = {
          title: "Reminder time",
          html: `<input class="input" type="time" data-act="set-time" value="${store.data.settings.reminderTime}">
                 <button class="btn primary" data-act="prompt-cancel">Done</button>`,
        };
        this.render();
        return;
      case "prompt-cancel":
        this.prompt = null;
        this.render();
        return;
      case "backup":
        this.prompt = {
          title: "Backup",
          html: `<p>Save everything to one file, or restore onto this phone.</p>
            <button class="btn primary" data-act="backup-save">Save backup file</button>
            <button class="btn ghost" data-act="backup-restore">Restore from file</button>
            <button class="btn ghost" data-act="prompt-cancel">Cancel</button>
            <input type="file" accept="application/json,.json" data-act="backup-file" hidden>`,
        };
        this.render();
        return;
      case "backup-save":
        this.prompt = null;
        await this.saveBackup();
        return;
      case "backup-restore":
        this.root.querySelector<HTMLInputElement>("[data-act=backup-file]")?.click();
        return;
      case "confirm-yes": {
        const spec = this.confirm;
        this.confirm = null;
        if (spec) await spec.onYes();
        this.render();
        return;
      }
      case "confirm-no":
        this.confirm = null;
        this.render();
        return;
      case "pin-key":
        await this.pinKey(el.dataset.key || "");
        return;
      case "bio":
        await this.unlockBiometric();
        return;
      case "alarm-renewed":
        await this.alarmRenewed();
        return;
      case "alarm-snooze":
        await this.alarmSnooze(1);
        return;
      case "alarm-tomorrow":
        await this.alarmSnooze(24);
        return;
      case "defaults-save":
        await this.saveDefaultReminders();
        return;
      default:
        return;
    }
  }

  private async onInput(act: string, el: HTMLElement): Promise<void> {
    const input = el as HTMLInputElement;
    switch (act) {
      case "doc-name":
        if (this.docDraft) this.docDraft.name = input.value;
        return;
      case "doc-custom-type":
        if (this.docDraft) this.docDraft.customType = input.value;
        return;
      case "doc-expiry":
        if (this.docDraft) this.docDraft.expiryDate = input.value;
        return;
      case "doc-number":
        if (this.docDraft) this.docDraft.documentNumber = input.value;
        return;
      case "doc-cost":
        if (this.docDraft) this.docDraft.renewalCostMilles = parseOMR(input.value);
        return;
      case "doc-note":
        if (this.docDraft) this.docDraft.note = input.value;
        return;
      case "doc-custom-offset-val":
        this.customOffset = input.value;
        {
          const n = Number(input.value);
          if (this.docDraft && Number.isFinite(n) && n >= 0) {
            if (!this.docDraft.reminderOffsets.includes(n)) this.docDraft.reminderOffsets.push(n);
          }
        }
        return;
      case "task-name":
        if (this.taskDraft) this.taskDraft.name = input.value;
        return;
      case "task-custom-type":
        if (this.taskDraft) this.taskDraft.customType = input.value;
        return;
      case "task-amount":
        if (this.taskDraft) this.taskDraft.amountMilles = parseOMR(input.value);
        return;
      case "task-day":
        if (this.taskDraft) {
          this.taskDraft.dueDay = dueDayFromValue(input.value);
          this.taskDraft.nextDue = firstDueOnOrAfter(todayISO(), this.taskDraft.dueDay);
        }
        return;
      case "business-name":
        store.data.settings.businessName = input.value;
        await store.update(() => undefined);
        return;
      case "set-time":
        if (/^\d{2}:\d{2}$/.test(input.value)) {
          store.data.settings.reminderTime = input.value;
          await store.update(() => undefined);
          await syncNotifications(store.data);
        }
        return;
      case "backup-file":
        await this.restoreBackup(input as HTMLInputElement);
        return;
      default:
        return;
    }
  }

  private toggleOffset(kind: "doc" | "task", n: number): void {
    const list = kind === "doc" ? this.docDraft?.reminderOffsets : this.taskDraft?.reminderOffsets;
    if (!list) return;
    const i = list.indexOf(n);
    if (i >= 0) list.splice(i, 1);
    else list.push(n);
    this.render();
  }

  private beginDocForm(mode: "create" | "edit" | "renew", id?: string): void {
    this.revokePhotoUrls();
    this.pendingPhotos = [];
    this.customOffset = "";
    if (mode === "create") {
      this.docDraft = createDocumentDraft(store.data.settings.defaultReminderOffsets);
      this.docDraft.alarmOnDay = store.data.settings.alarmOnExpiryDay;
    } else {
      const existing = store.data.documents.find((d) => d.id === id);
      if (!existing) return;
      this.docDraft = structuredClone(existing);
      if (mode === "renew") {
        this.docDraft.expiryDate = "";
        this.docDraft.photoIds = [];
      }
    }
    this.docBaseline = JSON.stringify(this.docDraft);
    void this.hydratePhotoUrls(this.docDraft.photoIds);
    this.push({ name: "doc-form", mode });
  }

  private beginTaskForm(mode: "create" | "edit", id?: string): void {
    if (mode === "create") this.taskDraft = createTaskDraft(todayISO());
    else {
      const existing = store.data.monthlyTasks.find((t) => t.id === id);
      if (!existing) return;
      this.taskDraft = structuredClone(existing);
    }
    this.taskBaseline = JSON.stringify(this.taskDraft);
    this.push({ name: "task-form", mode });
  }

  private async openDoc(id: string): Promise<void> {
    const doc = store.data.documents.find((d) => d.id === id);
    if (!doc) return;
    await this.hydratePhotoUrls(doc.photoIds);
    this.push({ name: "doc-detail", id });
  }

  private openTask(id: string): void {
    if (!store.data.monthlyTasks.some((t) => t.id === id)) return;
    this.push({ name: "task-detail", id });
  }

  private async hydratePhotoUrls(ids: string[]): Promise<void> {
    this.revokePhotoUrls();
    const urls: string[] = [];
    for (const id of ids) {
      const photo = await store.getPhoto(id);
      if (photo) urls.push(URL.createObjectURL(photo.blob));
    }
    this.photoUrls = urls;
  }

  private revokePhotoUrls(): void {
    for (const url of this.photoUrls) URL.revokeObjectURL(url);
    this.photoUrls = [];
  }

  private async addPhoto(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        promptLabelHeader: "Document photo",
        promptLabelPhoto: "Gallery",
        promptLabelPicture: "Camera",
      });
      const blob = await this.readPhotoBlob(photo.webPath, photo.dataUrl);
      if (!blob) return;
      this.pendingPhotos.push(blob);
      this.photoUrls = [...this.photoUrls, URL.createObjectURL(blob)];
      this.render();
    } catch {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        this.pendingPhotos.push(file);
        this.photoUrls = [...this.photoUrls, URL.createObjectURL(file)];
        this.render();
      };
      input.click();
    }
  }

  private async readPhotoBlob(webPath?: string, dataUrl?: string): Promise<Blob | null> {
    if (webPath) {
      const res = await fetch(webPath);
      return res.blob();
    }
    if (dataUrl) {
      const res = await fetch(dataUrl);
      return res.blob();
    }
    return null;
  }

  private pullDocForm(): void {
    if (!this.docDraft) return;
    const val = (act: string) => this.root.querySelector<HTMLInputElement>(`[data-act=${act}]`)?.value ?? "";
    this.docDraft.name = val("doc-name");
    this.docDraft.customType = val("doc-custom-type");
    this.docDraft.expiryDate = val("doc-expiry");
    this.docDraft.documentNumber = val("doc-number");
    this.docDraft.note = this.root.querySelector<HTMLTextAreaElement>("[data-act=doc-note]")?.value ?? this.docDraft.note;
    this.docDraft.renewalCostMilles = parseOMR(val("doc-cost"));
  }

  private pullTaskForm(): void {
    if (!this.taskDraft) return;
    const val = (act: string) => this.root.querySelector<HTMLInputElement>(`[data-act=${act}]`)?.value ?? "";
    this.taskDraft.name = val("task-name");
    this.taskDraft.customType = val("task-custom-type");
    this.taskDraft.amountMilles = parseOMR(val("task-amount"));
    const day = val("task-day");
    if (day) {
      this.taskDraft.dueDay = dueDayFromValue(day);
    }
  }

  private async saveDoc(): Promise<void> {
    if (!this.docDraft) return;
    this.pullDocForm();
    const route = this.route.name === "doc-form" ? this.route : null;
    if (!this.docDraft.name.trim()) {
      this.ask({ title: "Name needed", body: "Give this document a name.", confirm: "OK", onYes: () => undefined });
      return;
    }
    if (!this.docDraft.expiryDate) {
      this.ask({ title: "Expiry date needed", body: "Pick the expiry date.", confirm: "OK", onYes: () => undefined });
      return;
    }
    const newIds: string[] = [];
    for (const blob of this.pendingPhotos) {
      newIds.push(await store.putPhoto(blob));
    }
    if (route?.mode === "renew") {
      const id = this.docDraft.id;
      await store.renewDocument(id, this.docDraft.expiryDate, [...this.docDraft.photoIds, ...newIds]);
      const saved = store.data.documents.find((d) => d.id === id);
      if (saved) {
        saved.reminderOffsets = this.docDraft.reminderOffsets;
        saved.alarmOnDay = this.docDraft.alarmOnDay;
        saved.documentNumber = this.docDraft.documentNumber;
        saved.renewalCostMilles = this.docDraft.renewalCostMilles;
        saved.note = this.docDraft.note;
        await store.saveDocument(saved);
      }
    } else {
      this.docDraft.photoIds = [...this.docDraft.photoIds, ...newIds];
      await store.saveDocument(this.docDraft);
    }
    await syncNotifications(store.data);
    this.pendingPhotos = [];
    this.docDraft = null;
    this.finishToTabs();
  }

  private async saveTask(): Promise<void> {
    if (!this.taskDraft) return;
    this.pullTaskForm();
    if (!this.taskDraft.name.trim()) {
      this.ask({ title: "Name needed", body: "Give this task a name.", confirm: "OK", onYes: () => undefined });
      return;
    }
    const form = this.route;
    if (form.name === "task-form" && form.mode === "create") {
      this.taskDraft.nextDue = firstDueOnOrAfter(todayISO(), this.taskDraft.dueDay);
    }
    await store.saveTask(this.taskDraft);
    await syncNotifications(store.data);
    this.taskDraft = null;
    this.finishToTabs();
  }

  private async completeTask(): Promise<void> {
    if (this.route.name !== "task-detail") return;
    const task = store.data.monthlyTasks.find((t) => t.id === this.routeId());
    if (!task) return;
    await store.saveTask(store.markTaskDone(task));
    await syncNotifications(store.data);
    this.render();
  }

  private async shareDoc(): Promise<void> {
    if (this.route.name !== "doc-detail") return;
    const doc = store.data.documents.find((d) => d.id === this.routeId());
    if (!doc) return;
    const text = [
      doc.name,
      `Expires ${formatDisplayDate(doc.expiryDate)}`,
      doc.renewalCostMilles !== null ? `Renewal cost ${formatOMR(doc.renewalCostMilles)} OMR` : "",
      doc.documentNumber ? `No. ${doc.documentNumber}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await Share.share({ title: doc.name, text, dialogTitle: "Share document" });
    } catch {
      await navigator.clipboard?.writeText(text);
    }
  }

  private shiftMonth(delta: number): void {
    let { year, monthIndex } = this.cal;
    monthIndex += delta;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
    this.cal.year = year;
    this.cal.monthIndex = monthIndex;
    this.cal.selected = toISODate(new Date(year, monthIndex, 1));
    this.render();
  }

  private openDefaultReminders(): void {
    const selected = new Set(store.data.settings.defaultReminderOffsets);
    const chips = [60, 30, 7, 1, 0]
      .map(
        (n) =>
          `<button class="chip ${selected.has(n) ? "on" : ""}" data-def="${n}">${n === 0 ? "On the day" : `${n} days`}</button>`,
      )
      .join("");
    this.prompt = {
      title: "Default reminders",
      html: `<div class="chips" id="def-chips">${chips}</div>
        <button class="btn primary" data-act="defaults-save">Save</button>
        <button class="btn ghost" data-act="prompt-cancel">Cancel</button>`,
    };
    this.render();
    this.root.querySelector("#def-chips")?.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button[data-def]") as HTMLButtonElement | null;
      if (!btn) return;
      btn.classList.toggle("on");
    });
  }

  private async saveDefaultReminders(): Promise<void> {
    const offsets = [...this.root.querySelectorAll<HTMLButtonElement>("#def-chips .chip.on")].map((b) => Number(b.dataset.def));
    store.data.settings.defaultReminderOffsets = offsets;
    await store.update(() => undefined);
    this.prompt = null;
    this.render();
  }

  private async toggleLock(): Promise<void> {
    if (store.data.settings.appLockEnabled) {
      this.ask({
        title: "Turn off app lock?",
        body: "Anyone with this phone will be able to open Expiry Guard.",
        confirm: "Turn off",
        danger: true,
        onYes: async () => {
          store.data.settings.appLockEnabled = false;
          store.data.settings.biometricEnabled = false;
          store.data.settings.pinHash = "";
          await store.update(() => undefined);
        },
      });
      return;
    }
    this.prompt = {
      title: "Set a PIN",
      html: `<p>4–6 digits. You can also use fingerprint after the PIN is set.</p>
        <input class="input" data-lock-pin inputmode="numeric" maxlength="6" placeholder="PIN">
        <label class="toggle-row" style="margin-top:12px"><div class="t">Fingerprint</div>
          <input type="checkbox" data-lock-bio></label>
        <button class="btn primary" data-lock-save>Save</button>
        <button class="btn ghost" data-act="prompt-cancel">Cancel</button>`,
    };
    this.render();
    this.root.querySelector("[data-lock-save]")?.addEventListener("click", async () => {
      const pin = this.root.querySelector<HTMLInputElement>("[data-lock-pin]")?.value ?? "";
      if (!pinLooksValid(pin)) {
        this.lockError = "Use 4 to 6 digits";
        return;
      }
      store.data.settings.pinHash = await sha256Hex(pin);
      store.data.settings.appLockEnabled = true;
      store.data.settings.biometricEnabled = Boolean(this.root.querySelector<HTMLInputElement>("[data-lock-bio]")?.checked);
      await store.update(() => undefined);
      this.prompt = null;
      this.render();
    });
  }

  private async pinKey(key: string): Promise<void> {
    if (key === "del") this.pinBuffer = this.pinBuffer.slice(0, -1);
    else if (this.pinBuffer.length < 6) this.pinBuffer += key;
    this.render();
    if (this.pinBuffer.length >= 4) {
      const hash = await sha256Hex(this.pinBuffer);
      if (hash === store.data.settings.pinHash) {
        this.lockOpen = false;
        this.pinBuffer = "";
        this.lockError = "";
        this.render();
      } else if (this.pinBuffer.length >= 6) {
        this.lockError = "Wrong PIN";
        this.pinBuffer = "";
        this.render();
      }
    }
  }

  private async unlockBiometric(): Promise<void> {
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Unlock Expiry Guard",
        title: "Unlock",
        subtitle: "Use fingerprint",
      });
      this.lockOpen = false;
      this.render();
    } catch {
      this.lockError = "Fingerprint not available. Use PIN.";
      this.render();
    }
  }

  private openAlarm(kind: "document" | "task", id: string): void {
    this.lockOpen = false;
    this.push({ name: "alarm", kind, id });
  }

  private maybeShowDueAlarm(): void {
    const target = activeAlarmTarget(store.data, now());
    if (target) this.openAlarm(target.kind, target.id);
  }

  private async alarmRenewed(): Promise<void> {
    const route = this.route;
    if (route.name !== "alarm") return;
    if (route.kind === "document") this.beginDocForm("renew", route.id);
    else {
      const task = store.data.monthlyTasks.find((t) => t.id === route.id);
      if (task) {
        await store.saveTask(store.markTaskDone(task));
        await syncNotifications(store.data);
      }
      this.finishToTabs();
    }
  }

  private async alarmSnooze(hours: number): Promise<void> {
    const route = this.route;
    if (route.name !== "alarm") return;
    const until = addHours(now(), hours).toISOString();
    if (route.kind === "document") {
      const doc = store.data.documents.find((d) => d.id === route.id);
      if (doc) {
        doc.snoozeUntil = hours === 24 ? addDaysISO(todayISO(), 1) + "T" + store.data.settings.reminderTime : until;
        await store.saveDocument(doc);
      }
    } else {
      const task = store.data.monthlyTasks.find((t) => t.id === route.id);
      if (task) {
        task.snoozeUntil = hours === 24 ? addDaysISO(todayISO(), 1) + "T" + store.data.settings.reminderTime : until;
        await store.saveTask(task);
      }
    }
    await syncNotifications(store.data);
    this.finishToTabs();
  }

  private async saveBackup(): Promise<void> {
    const backup = await buildBackup(store.data, await store.exportPhotos(), now().toISOString());
    const json = JSON.stringify(backup);
    const filename = `expiry-guard-backup-${todayISO()}.json`;
    try {
      if (Capacitor.isNativePlatform()) {
        const written = await Filesystem.writeFile({
          path: filename,
          data: btoa(unescape(encodeURIComponent(json))),
          directory: Directory.Cache,
        });
        await Share.share({ title: "Expiry Guard backup", files: [written.uri], dialogTitle: "Save backup" });
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      }
    } catch {
      /* ignore cancel */
    }
  }

  private async restoreBackup(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    this.prompt = null;
    if (!file) return;
    let parsed: ReturnType<typeof parseBackup>;
    try {
      parsed = parseBackup(JSON.parse(await file.text()));
    } catch (err) {
      this.ask({
        title: "Could not restore",
        body: err instanceof Error ? err.message : "That file is not an Expiry Guard backup.",
        confirm: "OK",
        onYes: () => undefined,
      });
      return;
    }
    this.ask({
      title: "Replace everything on this phone?",
      body: "Restore overwrites all documents, monthly tasks, photos and settings.",
      confirm: "Restore",
      danger: true,
      onYes: async () => {
        await store.replaceAll(parsed.data, parsed.photos);
        await syncNotifications(store.data);
      },
    });
  }

  async seedDemo(): Promise<void> {
    const today = todayISO();
    store.data.settings.businessName = "Example Trading LLC";
    const docs: Array<Partial<LegalDocument> & { name: string; expiryDate: string; type: LegalDocument["type"] }> = [
      { name: "Vehicle registration", expiryDate: "2026-11-03", type: "vehicle" },
      { name: "Commercial registration", expiryDate: "2026-12-05", type: "company", renewalCostMilles: 50_000_000 },
      { name: "Staff visa · Ravi", expiryDate: "2026-12-18", type: "id_visa" },
      { name: "Shop insurance", expiryDate: "2027-03-02", type: "insurance" },
      { name: "Shop lease", expiryDate: "2027-06-01", type: "lease" },
    ];
    const placeholder = await this.placeholderPhoto();
    for (const row of docs) {
      const d = createDocumentDraft([60, 30, 7, 1, 0]);
      Object.assign(d, row);
      if (row.type === "company") d.photoIds = [await store.putPhoto(placeholder)];
      await store.saveDocument(d);
    }
    const salary = createTaskDraft(today);
    salary.name = "Staff salary deposit";
    salary.type = "salary";
    salary.dueDay = { kind: "day", day: 1 };
    salary.amountMilles = 1_200_000;
    salary.nextDue = "2026-12-01";
    salary.history = [
      { id: "h1", periodDue: "2026-11-01", doneAt: "2026-10-30", daysLate: 0 },
      { id: "h2", periodDue: "2026-10-01", doneAt: "2026-10-01", daysLate: 0 },
      { id: "h3", periodDue: "2026-09-01", doneAt: "2026-09-03", daysLate: 2 },
    ];
    await store.saveTask(salary);
    const rent = createTaskDraft(today);
    rent.name = "Shop rent";
    rent.type = "rent";
    rent.dueDay = { kind: "day", day: 5 };
    rent.amountMilles = 350_000;
    rent.nextDue = "2026-12-05";
    await store.saveTask(rent);
    await this.hydratePhotoUrls([]);
    this.render();
  }

  private async placeholderPhoto(): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new Blob();
    ctx.fillStyle = "#d7e2ee";
    ctx.fillRect(0, 0, 720, 420);
    ctx.fillStyle = "#7b8ea3";
    ctx.font = "28px sans-serif";
    ctx.fillText("Document photo", 230, 210);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", 0.8));
  }

  async showScene(scene: string): Promise<void> {
    this.lockOpen = false;
    this.picker = false;
    this.zoom = null;
    this.confirm = null;
    this.prompt = null;
    this.stack = [];
    switch (scene) {
      case "home":
        this.tab = "home";
        this.route = { name: "tabs" };
        break;
      case "add-doc": {
        this.beginDocForm("create");
        if (this.docDraft) {
          this.docDraft.name = "Commercial registration";
          this.docDraft.type = "company";
          this.docDraft.expiryDate = "2026-12-05";
          this.docDraft.reminderOffsets = [60, 30, 7, 1];
          this.docDraft.alarmOnDay = true;
        }
        break;
      }
      case "doc-detail": {
        const doc = store.data.documents.find((d) => d.name.startsWith("Commercial")) ?? store.data.documents[1];
        if (doc) await this.openDoc(doc.id);
        break;
      }
      case "alarm": {
        const doc = store.data.documents.find((d) => d.name.startsWith("Commercial")) ?? store.data.documents[0];
        if (doc) this.openAlarm("document", doc.id);
        break;
      }
      case "settings":
        this.tab = "settings";
        this.route = { name: "tabs" };
        break;
      case "monthly":
        this.tab = "monthly";
        this.route = { name: "tabs" };
        break;
      case "add-task": {
        this.beginTaskForm("create");
        if (this.taskDraft) {
          this.taskDraft.name = "Staff salary deposit";
          this.taskDraft.type = "salary";
          this.taskDraft.dueDay = { kind: "day", day: 1 };
          this.taskDraft.repeat = "monthly";
          this.taskDraft.amountMilles = 1_200_000;
          this.taskDraft.reminderOffsets = [3, 1, 0];
          this.taskDraft.alarmOnDay = true;
        }
        break;
      }
      case "calendar":
        this.tab = "calendar";
        this.cal = { year: 2026, monthIndex: 11, selected: "2026-12-05", mode: "month" };
        this.route = { name: "tabs" };
        break;
      case "task-detail": {
        const task = store.data.monthlyTasks.find((t) => t.name.startsWith("Staff")) ?? store.data.monthlyTasks[0];
        if (task) this.openTask(task.id);
        break;
      }
      default:
        break;
    }
    this.render();
  }
}
