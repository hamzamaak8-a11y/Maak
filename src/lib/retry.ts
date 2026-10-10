/** Runs `fn`, and once more after a short pause when it fails (a dropped connection or a brief 503 should not surface as an error). */
export async function withRetry<T>(fn: () => Promise<T>, opts: { retries?: number; delayMs?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 1;
  const delayMs = opts.delayMs ?? 700;
  let attempt = 0;
  for (;;) {
    try { return await fn(); }
    catch (e) {
      if (attempt >= retries) throw e;
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
