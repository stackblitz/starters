/**
 * Bolt admin bridge client (bolt-admin-dashboard skill). The page runs only
 * inside Bolt's Admin tab and may call `bolt.hello` and `db.run`; every query
 * it runs is declared by name in `.bolt/admin.json` (see `../queries.ts`).
 *
 * No timeout: Bolt answers every request, and confirmed queries legitimately
 * wait on the user. No origin allowlist: Bolt replies with this frame's origin
 * as `targetOrigin`, and replies are matched on `event.source`, source and id.
 */
import type { AdminQueryName } from '../queries';

const PAGE_SOURCE = 'bolt-project-admin-page';
const HOST_SOURCE = 'bolt-project-admin-host';

export class BoltBridgeError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export interface BoltHello {
  protocolVersion: number;
  capabilities: string[];
  permissions: { canEdit: boolean };
  queries: string[];
}

export function isInsideBolt() {
  return window.parent !== window;
}

export function boltRequest<T = unknown>(
  method: string,
  params?: unknown
): Promise<T> {
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        event.source !== window.parent ||
        data?.source !== HOST_SOURCE ||
        data.id !== id
      )
        return;
      window.removeEventListener('message', onMessage);
      if ('error' in data)
        reject(new BoltBridgeError(data.error.message, data.error.code));
      else resolve(data.result as T);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ source: PAGE_SOURCE, id, method, params }, '*');
  });
}

export function runQuery<Row = Record<string, unknown>>(
  name: AdminQueryName,
  parameters: unknown[] = []
) {
  return boltRequest<{ rows: Row[] }>('db.run', { name, parameters }).then(
    (r) => r.rows
  );
}

export function hello() {
  return boltRequest<BoltHello>('bolt.hello');
}

/** Postgres array literal for `$n::bigint[]` parameters. */
export function pgArray(values: ReadonlyArray<number | string>) {
  return `{${values.join(',')}}`;
}
