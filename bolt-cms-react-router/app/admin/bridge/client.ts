/**
 * Admin-side bridge client.
 *
 * Sends `CmsRequest`s to the host and resolves `CmsResponse`s. Two transports:
 *
 *  - postMessage: when framed (inside a Bolt project preview, or /__host in dev).
 *    Responses are only accepted from `window.parent` on an allowlisted origin.
 *  - http: local dev, unframed. POSTs to the Vite middleware at `/__cms`.
 *
 * Outside of both (e.g. the published site opened directly) the admin never
 * renders, so no transport is needed.
 */
import {
  CMS_CLIENT_SOURCE,
  CMS_PROTOCOL_VERSION,
  isCmsResponse,
  type CmsError,
  type CmsOp,
  type CmsRequest,
  type CmsResponse,
} from './protocol';

const REQUEST_TIMEOUT_MS = 15_000;

/** Origins allowed to host the admin. Extend for staging environments. */
const HOST_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/([a-z0-9-]+\.)*bolt\.new$/i,
  /^https:\/\/([a-z0-9-]+\.)*bolt\.host$/i,
  /^https:\/\/([a-z0-9-]+\.)*stackblitz\.(io|com)$/i,
];

if (import.meta.env.DEV) {
  HOST_ORIGIN_PATTERNS.push(
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i
  );
}

export function isAllowedHostOrigin(origin: string): boolean {
  if (
    typeof window !== 'undefined' &&
    origin === window.location.origin &&
    import.meta.env.DEV
  ) {
    return true;
  }
  return HOST_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

export function isFramed(): boolean {
  return typeof window !== 'undefined' && window.parent !== window;
}

/** Mirrors bolt-slides: show the shell when framed, or always in local dev. */
export function isAdminShell(): boolean {
  if (typeof window === 'undefined') return false;
  return isFramed() || import.meta.env.DEV;
}

export class CmsBridgeError extends Error {
  code?: string;
  details?: unknown;
  constructor(error: CmsError) {
    super(error.message);
    this.name = 'CmsBridgeError';
    this.code = error.code;
    this.details = error.details;
  }
}

export interface CmsResult<T = unknown> {
  data: T;
  count?: number | null;
}

type Pending = {
  resolve: (value: CmsResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type Transport = 'postmessage' | 'http' | 'none';

class CmsClient {
  private pending = new Map<string, Pending>();
  private listening = false;
  private hostOrigin: string | null = null;

  get transport(): Transport {
    if (typeof window === 'undefined') return 'none';
    if (isFramed()) return 'postmessage';
    if (import.meta.env.DEV) return 'http';
    return 'none';
  }

  async request<T = unknown>(op: CmsOp): Promise<CmsResult<T>> {
    const transport = this.transport;
    if (transport === 'none') {
      throw new CmsBridgeError({
        code: 'no_host',
        message: 'Bolt CMS admin is only available inside Bolt.',
      });
    }

    const request: CmsRequest = {
      source: CMS_CLIENT_SOURCE,
      version: CMS_PROTOCOL_VERSION,
      id: crypto.randomUUID(),
      op,
    };

    if (transport === 'http') {
      const res = await fetch('/__cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = (await res.json()) as CmsResponse;
      if (!body.ok) throw new CmsBridgeError(body.error);
      return { data: body.data as T, count: body.count };
    }

    this.ensureListening();
    return new Promise<CmsResult<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id);
        reject(
          new CmsBridgeError({
            code: 'timeout',
            message: 'The Bolt host did not respond in time.',
          })
        );
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(request.id, {
        resolve: resolve as (value: CmsResult) => void,
        reject,
        timer,
      });

      window.parent.postMessage(request, this.targetOrigin());
    });
  }

  private targetOrigin(): string {
    if (this.hostOrigin) return this.hostOrigin;
    try {
      const ref = document.referrer ? new URL(document.referrer).origin : '';
      if (ref && isAllowedHostOrigin(ref)) return ref;
    } catch {
      /* ignore */
    }
    // Requests carry no secrets; the host learns our origin from the event.
    return '*';
  }

  private ensureListening() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!isAllowedHostOrigin(event.origin)) return;
      if (!isCmsResponse(event.data)) return;

      this.hostOrigin = event.origin;
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      clearTimeout(pending.timer);

      if (event.data.ok)
        pending.resolve({ data: event.data.data, count: event.data.count });
      else pending.reject(new CmsBridgeError(event.data.error));
    });
  }
}

export const cms = new CmsClient();
