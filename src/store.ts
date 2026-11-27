import { newId, now, todayISO } from "./clock";
import {
  cloneAppData,
  deletePhoto,
  loadData,
  loadPhoto,
  replaceAllPhotos,
  saveData,
  savePhoto,
  allPhotos,
} from "./db";
import { daysLate, firstDueOnOrAfter, rollDueDate } from "./dates";
import type { AppData, LegalDocument, MonthlyTask, RenewalHistory, StoredPhoto, TaskHistory } from "./types";
import { emptyData } from "./types";

export class Store {
  data: AppData = emptyData();

  async init(): Promise<void> {
    this.data = await loadData();
  }

  private async persist(): Promise<void> {
    await saveData(this.data);
  }

  async update(mutator: (data: AppData) => void): Promise<void> {
    mutator(this.data);
    await this.persist();
  }

  snapshot(): AppData {
    return cloneAppData(this.data);
  }

  async putPhoto(blob: Blob, mime = blob.type || "image/jpeg"): Promise<string> {
    const id = newId();
    await savePhoto({ id, mime, blob });
    return id;
  }

  async getPhoto(id: string): Promise<StoredPhoto | null> {
    return loadPhoto(id);
  }

  async saveDocument(doc: LegalDocument): Promise<void> {
    const i = this.data.documents.findIndex((d) => d.id === doc.id);
    const next = { ...doc, updatedAt: now().toISOString() };
    if (i >= 0) this.data.documents[i] = next;
    else this.data.documents.push(next);
    await this.persist();
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = this.data.documents.find((d) => d.id === id);
    this.data.documents = this.data.documents.filter((d) => d.id !== id);
    if (doc) {
      const ids = [...doc.photoIds, ...doc.history.flatMap((h) => h.photoIds)];
      for (const photoId of ids) await deletePhoto(photoId);
    }
    await this.persist();
  }

  async renewDocument(id: string, newExpiry: string, newPhotoIds: string[]): Promise<void> {
    const doc = this.data.documents.find((d) => d.id === id);
    if (!doc) return;
    const entry: RenewalHistory = {
      id: newId(),
      previousExpiry: doc.expiryDate,
      renewedAt: todayISO(),
      photoIds: [...doc.photoIds],
    };
    doc.history.unshift(entry);
    doc.expiryDate = newExpiry;
    doc.photoIds = newPhotoIds;
    doc.snoozeUntil = null;
    doc.updatedAt = now().toISOString();
    await this.persist();
  }

  async saveTask(task: MonthlyTask): Promise<void> {
    const i = this.data.monthlyTasks.findIndex((t) => t.id === task.id);
    const next = { ...task, updatedAt: now().toISOString() };
    if (i >= 0) this.data.monthlyTasks[i] = next;
    else this.data.monthlyTasks.push(next);
    await this.persist();
  }

  async deleteTask(id: string): Promise<void> {
    this.data.monthlyTasks = this.data.monthlyTasks.filter((t) => t.id !== id);
    await this.persist();
  }

  markTaskDone(task: MonthlyTask, doneOn = todayISO()): MonthlyTask {
    const entry: TaskHistory = {
      id: newId(),
      periodDue: task.nextDue,
      doneAt: doneOn,
      daysLate: daysLate(task.nextDue, doneOn),
    };
    return {
      ...task,
      history: [entry, ...task.history],
      nextDue: rollDueDate(task.nextDue, task.dueDay, task.repeat),
      snoozeUntil: null,
      updatedAt: now().toISOString(),
    };
  }

  skipTask(task: MonthlyTask): MonthlyTask {
    return {
      ...task,
      nextDue: rollDueDate(task.nextDue, task.dueDay, task.repeat),
      snoozeUntil: null,
      updatedAt: now().toISOString(),
    };
  }

  async replaceAll(data: AppData, photos: StoredPhoto[]): Promise<void> {
    this.data = cloneAppData(data);
    await replaceAllPhotos(photos);
    await this.persist();
  }

  async exportPhotos(): Promise<StoredPhoto[]> {
    return allPhotos();
  }
}

export function createDocumentDraft(defaults: number[]): LegalDocument {
  const ts = now().toISOString();
  return {
    id: newId(),
    name: "",
    type: "company",
    customType: "",
    expiryDate: "",
    reminderOffsets: [...defaults],
    alarmOnDay: true,
    documentNumber: "",
    renewalCostMilles: null,
    note: "",
    photoIds: [],
    history: [],
    createdAt: ts,
    updatedAt: ts,
    snoozeUntil: null,
  };
}

export function createTaskDraft(today: string): MonthlyTask {
  const ts = now().toISOString();
  const dueDay = { kind: "day" as const, day: 1 };
  return {
    id: newId(),
    name: "",
    type: "salary",
    customType: "",
    dueDay,
    repeat: "monthly",
    amountMilles: null,
    reminderOffsets: [3, 1, 0],
    alarmOnDay: true,
    nextDue: firstDueOnOrAfter(today, dueDay),
    history: [],
    createdAt: ts,
    updatedAt: ts,
    snoozeUntil: null,
  };
}

export const store = new Store();
