// Polite HTTP for third-party APIs: one request at a time, retries with growing waits,
// a long wait after 429 (Lichess asks for a full minute) and a short in-memory cache.
// Browsers forbid setting User-Agent, so it is not sent from the client.

export type ImportErrorKind =
  "invalid-user" | "not-found" | "no-games" | "rate-limited" | "network" | "bad-response";

export class ImportError extends Error {
  constructor(
    readonly kind: ImportErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export interface HttpOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
  baseDelayMs?: number;
  rateLimitDelayMs?: number;
  cacheTtlMs?: number;
  now?: () => number;
}

export interface HttpResult {
  status: number;
  text: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class PoliteHttp {
  private queue: Promise<unknown> = Promise.resolve();
  private cache = new Map<string, { at: number; result: HttpResult }>();
  private readonly o: Required<HttpOptions>;

  constructor(options: HttpOptions = {}) {
    this.o = {
      fetchImpl: options.fetchImpl ?? ((...a) => fetch(...a)),
      sleep: options.sleep ?? defaultSleep,
      retries: options.retries ?? 3,
      baseDelayMs: options.baseDelayMs ?? 1000,
      rateLimitDelayMs: options.rateLimitDelayMs ?? 60_000,
      cacheTtlMs: options.cacheTtlMs ?? 5 * 60_000,
      now: options.now ?? (() => Date.now()),
    };
  }

  /**
   * GET with retries. Resolves for any final HTTP status (callers decide what 404 means);
   * rejects with ImportError("rate-limited" | "network") when retries run out.
   */
  get(url: string, headers: Record<string, string> = {}): Promise<HttpResult> {
    const cacheKey = `${url}|${JSON.stringify(headers)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.o.now() - cached.at < this.o.cacheTtlMs)
      return Promise.resolve(cached.result);

    const run = this.queue.then(() => this.attempt(url, headers, cacheKey));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async attempt(url: string, headers: Record<string, string>, cacheKey: string) {
    let lastStatus: number | undefined;
    for (let i = 0; i <= this.o.retries; i++) {
      let res: Response;
      try {
        res = await this.o.fetchImpl(url, { headers });
      } catch {
        if (i === this.o.retries) throw new ImportError("network", `Network error: ${url}`);
        await this.o.sleep(this.o.baseDelayMs * 2 ** i);
        continue;
      }
      lastStatus = res.status;
      if (res.status === 429) {
        if (i === this.o.retries) throw new ImportError("rate-limited", "Rate limited", 429);
        await this.o.sleep(this.o.rateLimitDelayMs);
        continue;
      }
      if (res.status >= 500) {
        if (i === this.o.retries)
          throw new ImportError("network", `HTTP ${res.status}`, res.status);
        await this.o.sleep(this.o.baseDelayMs * 2 ** i);
        continue;
      }
      const result = { status: res.status, text: await res.text() };
      if (res.ok) this.cache.set(cacheKey, { at: this.o.now(), result });
      return result;
    }
    throw new ImportError("network", `HTTP ${lastStatus ?? "?"}`, lastStatus);
  }
}

/** Usernames on both sites: letters, digits, "_" and "-". */
export function validUsername(name: string): boolean {
  return /^[A-Za-z0-9_-]{2,30}$/.test(name);
}

export function parseNdjson<T>(text: string): T[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}
