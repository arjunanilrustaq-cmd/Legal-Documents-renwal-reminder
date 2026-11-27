export type Tab = "home" | "calendar" | "monthly" | "settings";

export type DocumentType =
  | "company"
  | "id_visa"
  | "vehicle"
  | "insurance"
  | "lease"
  | "rop_security"
  | "cctv"
  | "other";

export type MonthlyType = "salary" | "rent" | "bills" | "loan_emi" | "tax_vat" | "other";

export type RepeatRule = "monthly" | "quarterly" | "yearly";

export type DueDay = { kind: "day"; day: number } | { kind: "last" };

export type Urgency = "late" | "soon" | "ok" | "today";

export interface RenewalHistory {
  id: string;
  previousExpiry: string;
  renewedAt: string;
  photoIds: string[];
}

export interface LegalDocument {
  id: string;
  name: string;
  type: DocumentType;
  customType: string;
  expiryDate: string;
  reminderOffsets: number[];
  alarmOnDay: boolean;
  documentNumber: string;
  renewalCostMilles: number | null;
  note: string;
  photoIds: string[];
  history: RenewalHistory[];
  createdAt: string;
  updatedAt: string;
  snoozeUntil: string | null;
}

export interface TaskHistory {
  id: string;
  periodDue: string;
  doneAt: string;
  daysLate: number;
}

export interface MonthlyTask {
  id: string;
  name: string;
  type: MonthlyType;
  customType: string;
  dueDay: DueDay;
  repeat: RepeatRule;
  amountMilles: number | null;
  reminderOffsets: number[];
  alarmOnDay: boolean;
  nextDue: string;
  history: TaskHistory[];
  createdAt: string;
  updatedAt: string;
  snoozeUntil: string | null;
}

export interface Settings {
  businessName: string;
  currency: "OMR";
  defaultReminderOffsets: number[];
  reminderTime: string;
  alarmOnExpiryDay: boolean;
  dailyReminderAfterExpiry: boolean;
  appLockEnabled: boolean;
  pinHash: string;
  biometricEnabled: boolean;
  monthlySummary: boolean;
  lastMonthlySummaryYm: string;
}

export interface AppData {
  documents: LegalDocument[];
  monthlyTasks: MonthlyTask[];
  settings: Settings;
}

export interface StoredPhoto {
  id: string;
  mime: string;
  blob: Blob;
}

export const DOCUMENT_TYPES: { id: DocumentType; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "id_visa", label: "ID / Visa" },
  { id: "vehicle", label: "Vehicle" },
  { id: "insurance", label: "Insurance" },
  { id: "lease", label: "Lease" },
  { id: "rop_security", label: "Security plan approval (ROP)" },
  { id: "cctv", label: "CCTV maintenance contract" },
  { id: "other", label: "Other" },
];

export const MONTHLY_TYPES: { id: MonthlyType; label: string }[] = [
  { id: "salary", label: "Salary" },
  { id: "rent", label: "Rent" },
  { id: "bills", label: "Bills" },
  { id: "loan_emi", label: "Loan / EMI" },
  { id: "tax_vat", label: "Tax / VAT" },
  { id: "other", label: "Other" },
];

export const DOCUMENT_REMINDER_CHIPS = [60, 30, 7, 1, 0];
export const TASK_REMINDER_CHIPS = [7, 3, 1, 0];
export const DEFAULT_DOC_REMINDERS = [60, 30, 7, 1, 0];
export const DEFAULT_TASK_REMINDERS = [3, 1, 0];

export function emptySettings(): Settings {
  return {
    businessName: "",
    currency: "OMR",
    defaultReminderOffsets: [...DEFAULT_DOC_REMINDERS],
    reminderTime: "09:00",
    alarmOnExpiryDay: true,
    dailyReminderAfterExpiry: true,
    appLockEnabled: false,
    pinHash: "",
    biometricEnabled: false,
    monthlySummary: true,
    lastMonthlySummaryYm: "",
  };
}

export function emptyData(): AppData {
  return {
    documents: [],
    monthlyTasks: [],
    settings: emptySettings(),
  };
}
