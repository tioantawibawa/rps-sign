const DATE = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const DATETIME = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return DATE.format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return DATETIME.format(new Date(d));
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function fmtPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} mnt`;
  if (hours < 48) return `${hours.toFixed(1)} jam`;
  return `${(hours / 24).toFixed(1)} hari`;
}
