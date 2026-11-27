import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { hashNoticeId, planAllNotices, type PlannedNotice } from "./schedule";
import type { AppData } from "./types";

const NOTICE_CHANNEL = "expiry-reminders";
const ALARM_CHANNEL = "expiry-alarms";

export interface AlarmOpen {
  kind: "document" | "task";
  id: string;
}

type AlarmPlugin = {
  schedule(options: {
    id: number;
    atMs: number;
    title: string;
    body: string;
    extra: Record<string, string>;
  }): Promise<void>;
  cancel(options: { id: number }): Promise<void>;
  requestExactAlarms(): Promise<{ granted: boolean }>;
};

function nativeAlarm(): AlarmPlugin | null {
  if (!Capacitor.isNativePlatform()) return null;
  return Capacitor.registerPlugin<AlarmPlugin>("ExpiryAlarm");
}

async function ensureChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: NOTICE_CHANNEL,
      name: "Reminders",
      description: "Upcoming document and payment reminders",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL,
      name: "Expiry alarms",
      description: "Full-screen alarm on the due day",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "alarm",
    });
  } catch {
    /* web / unsupported */
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const perm = await LocalNotifications.requestPermissions();
    const alarm = nativeAlarm();
    if (alarm) await alarm.requestExactAlarms();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

export async function syncNotifications(data: AppData): Promise<void> {
  const planned = planAllNotices(data);
  await ensureChannels();
  try {
    const pending = await LocalNotifications.getPending();
    const ids = pending.notifications.map((n) => n.id);
    if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* ignore */
  }

  const alarm = nativeAlarm();
  const notices = planned.filter((p) => p.style === "notice");
  const alarms = planned.filter((p) => p.style === "alarm");

  if (notices.length) {
    try {
      await LocalNotifications.schedule({
        notifications: notices.map((p) => toLocal(p)),
      });
    } catch {
      /* ignore on web */
    }
  }

  if (alarm) {
    for (const item of alarms) {
      try {
        await alarm.schedule({
          id: hashNoticeId(item.key),
          atMs: item.atMs,
          title: item.title,
          body: item.body,
          extra: { kind: item.itemKind, id: item.itemId, style: item.style },
        });
      } catch {
        /* fall through to local */
      }
    }
  } else if (alarms.length) {
    try {
      await LocalNotifications.schedule({
        notifications: alarms.map((p) => toLocal(p)),
      });
    } catch {
      /* ignore */
    }
  }
}

function toLocal(p: PlannedNotice) {
  return {
    id: hashNoticeId(p.key),
    title: p.title,
    body: p.body,
    schedule: { at: new Date(p.atMs), allowWhileIdle: true },
    channelId: p.style === "alarm" ? ALARM_CHANNEL : NOTICE_CHANNEL,
    extra: { kind: p.itemKind, id: p.itemId, style: p.style },
    autoCancel: true,
  };
}

export function listenForAlarmOpen(onOpen: (target: AlarmOpen) => void): () => void {
  const handleExtra = (extra: unknown) => {
    if (!extra || typeof extra !== "object") return;
    const rec = extra as Record<string, unknown>;
    const kind = rec.kind === "task" ? "task" : rec.kind === "document" ? "document" : null;
    const id = typeof rec.id === "string" ? rec.id : "";
    const style = rec.style;
    if (!kind || !id) return;
    if (style === "alarm" || rec.kind === "document" || rec.kind === "task") {
      onOpen({ kind, id });
    }
  };

  const local = LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    handleExtra(event.notification.extra);
  });

  const app = App.addListener("appUrlOpen", (event) => {
    try {
      const url = new URL(event.url);
      const kind = url.searchParams.get("kind") === "task" ? "task" : "document";
      const id = url.searchParams.get("id") ?? "";
      if (id) onOpen({ kind, id });
    } catch {
      /* ignore */
    }
  });

  const launch = App.getLaunchUrl()
    .then((result) => {
      if (!result?.url) return;
      try {
        const url = new URL(result.url);
        const kind = url.searchParams.get("kind") === "task" ? "task" : "document";
        const id = url.searchParams.get("id") ?? "";
        if (id) onOpen({ kind, id });
      } catch {
        /* ignore */
      }
    })
    .catch(() => undefined);

  void launch;
  return () => {
    void local.then((h) => h.remove());
    void app.then((h) => h.remove());
  };
}
