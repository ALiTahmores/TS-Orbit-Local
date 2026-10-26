type RetryOptions = {
  attempts?: number;
  delaysMs?: number[];
  sleep?: (delayMs: number) => Promise<void>;
  warn?: (message: string) => void;
};

/** Produce a useful operations label without logging connection strings, SQL,
 * hosts, or provider messages that may contain credentials. */
export function cloudFailureLabel(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && /^[A-Z0-9_]{1,40}$/i.test(code)) return code;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : 'ERROR';
}

/** Serverless cold starts can briefly race a pooled provider connection or a
 * schema lock. Retry only the bounded startup unit; every caller is responsible
 * for transactional rollback before rejecting. */
export async function retryCloudStartup<T>(stage: string, task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 4, 6));
  const delays = options.delaysMs ?? [200, 600, 1_500, 3_000, 5_000];
  const sleep = options.sleep ?? (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)));
  const warn = options.warn ?? (message => console.warn(message));
  let failure: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      failure = error;
      if (attempt === attempts) break;
      warn(`Cloud startup ${stage} failed (${cloudFailureLabel(error)}) on attempt ${attempt}/${attempts}; retrying.`);
      await sleep(delays[Math.min(attempt - 1, delays.length - 1)] ?? 1_000);
    }
  }
  throw failure;
}

