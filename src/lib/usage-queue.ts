import type { ProviderAttemptOutcome } from "@/lib/api-usage";

export type UsageEvent = {
  attemptId: string;
  quotaScope: string;
  attemptedAt: string;
  outcome: ProviderAttemptOutcome;
  status: number | null;
  providerLimit: number | null;
  providerRemaining: number | null;
  providerMinuteLimit: number | null;
  providerMinuteRemaining: number | null;
  quotaObservedAt: string | null;
};

export function createUsageQueue(
  persist: (event: UsageEvent) => Promise<void>,
  options: { maxSize?: number; maxAttempts?: number; baseDelayMs?: number; random?: () => number; onChange?: (pending: number, dropped: number) => void } = {},
) {
  const maxSize = options.maxSize ?? 100;
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const random = options.random ?? Math.random;
  const pending: Array<{ event: UsageEvent; attempts: number; nextAt: number }> = [];
  let dropped = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  const report = () => options.onChange?.(pending.length, dropped);
  const schedule = () => {
    if (timer || pending.length === 0) return;
    const delay = Math.max(0, pending[0].nextAt - Date.now());
    timer = setTimeout(() => { timer = null; void flush(); }, delay);
    timer.unref?.();
  };
  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (pending[0] && pending[0].nextAt <= Date.now()) {
        const item = pending.shift()!;
        try { await persist(item.event); }
        catch {
          item.attempts += 1;
          if (item.attempts >= maxAttempts) dropped += 1;
          else {
            const backoff = baseDelayMs * (2 ** (item.attempts - 1));
            item.nextAt = Date.now() + backoff + Math.floor(backoff * 0.25 * random());
            pending.push(item);
            pending.sort((a, b) => a.nextAt - b.nextAt);
          }
        }
        report();
      }
    } finally { flushing = false; schedule(); }
  }
  function enqueue(event: UsageEvent) {
    if (pending.length >= maxSize) { dropped += 1; report(); return false; }
    pending.push({ event, attempts: 0, nextAt: Date.now() });
    report(); schedule();
    return true;
  }
  return { enqueue, flush, diagnostics: () => ({ pending: pending.length, dropped }) };
}
