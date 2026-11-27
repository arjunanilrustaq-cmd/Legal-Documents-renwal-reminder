/** Store OMR as integer milles (1 OMR = 1000 milles). */

export function parseOMR(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{0,3})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const milles = Number(whole) * 1000 + Number(frac.padEnd(3, "0").slice(0, 3));
  if (!Number.isFinite(milles)) return null;
  return cleaned.startsWith("-") && milles > 0 ? -milles : milles;
}

export function formatOMR(milles: number): string {
  const neg = milles < 0;
  const n = Math.abs(Math.round(milles));
  const whole = Math.floor(n / 1000);
  const frac = String(n % 1000).padStart(3, "0");
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}.${frac}`;
}

export function formatOMRInput(milles: number | null): string {
  if (milles === null) return "";
  const n = Math.round(milles);
  const whole = Math.trunc(n / 1000);
  const frac = String(Math.abs(n % 1000)).padStart(3, "0");
  const sign = n < 0 ? "-" : "";
  return `${sign}${whole}.${frac}`;
}
