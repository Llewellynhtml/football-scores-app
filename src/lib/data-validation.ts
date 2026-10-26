export type ValidationDiagnostics = {
  received: number;
  accepted: number;
  rejected: number;
  reasons: Record<string, number>;
};

export function createDiagnostics(received: number): ValidationDiagnostics {
  return { received, accepted: 0, rejected: 0, reasons: {} };
}

export function reject(diagnostics: ValidationDiagnostics, reason: string) {
  diagnostics.rejected += 1;
  diagnostics.reasons[reason] = (diagnostics.reasons[reason] ?? 0) + 1;
}

export function accept(diagnostics: ValidationDiagnostics) {
  diagnostics.accepted += 1;
}

export function validPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validName(value: unknown) {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 160;
}

export function validDateLike(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  return !Number.isNaN(Date.parse(value));
}

export function validNullableScore(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric >= 0;
  }
  return false;
}

export function safeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "media.api-sports.io"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
