/**
 * Bolt CMS admin <-> host protocol.
 *
 * The admin UI never talks to Supabase directly. It posts `CmsRequest`
 * messages to its host (the Bolt UI when framed in a Bolt project; the Vite
 * dev middleware when developing locally) and receives `CmsResponse`s back.
 *
 * The operation set is a deliberately narrow, PostgREST-shaped DSL so the host
 * can map each op onto a supabase-js call with no CMS knowledge. Hosts MUST
 * refuse tables outside the `cms_` prefix.
 *
 * Keep this file self-contained (types + constants only): it is imported by
 * both the browser bundle and the Node dev server.
 */

export const CMS_CLIENT_SOURCE = 'bolt-cms' as const;
export const CMS_HOST_SOURCE = 'bolt-cms-host' as const;
export const CMS_PROTOCOL_VERSION = 1 as const;
export const CMS_TABLE_PREFIX = 'cms_' as const;

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'is'
  | 'ilike'
  | 'like';

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface Order {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

export type Row = Record<string, unknown>;

export interface SelectOp {
  kind: 'select';
  table: string;
  /** PostgREST select string, e.g. `"*, author:cms_authors(name)"`. Defaults to `*`. */
  columns?: string;
  filters?: Filter[];
  order?: Order[];
  range?: { from: number; to: number };
  /** Resolve to a single row (or null) instead of an array. */
  single?: boolean;
  /** Ask for an exact total count (returned as `count`). */
  count?: boolean;
}

export interface InsertOp {
  kind: 'insert';
  table: string;
  values: Row | Row[];
  returning?: string;
}

export interface UpsertOp {
  kind: 'upsert';
  table: string;
  values: Row | Row[];
  onConflict?: string;
  returning?: string;
}

export interface UpdateOp {
  kind: 'update';
  table: string;
  values: Row;
  filters: Filter[];
  returning?: string;
}

export interface DeleteOp {
  kind: 'delete';
  table: string;
  filters: Filter[];
}

/**
 * Write a binary asset into the project at `public/wp-content/uploads/<path>`.
 * Resolves to `{ url }`, the public URL the site can render.
 */
export interface UploadOp {
  kind: 'upload';
  path: string;
  contentType: string;
  dataBase64: string;
}

/** Handshake. Resolves to `{ host: string; version: number }`. */
export interface HelloOp {
  kind: 'hello';
}

export type CmsOp =
  | SelectOp
  | InsertOp
  | UpsertOp
  | UpdateOp
  | DeleteOp
  | UploadOp
  | HelloOp;

export interface CmsRequest {
  source: typeof CMS_CLIENT_SOURCE;
  version: typeof CMS_PROTOCOL_VERSION;
  id: string;
  op: CmsOp;
}

export interface CmsError {
  message: string;
  code?: string;
  details?: unknown;
}

export type CmsResponse =
  | {
      source: typeof CMS_HOST_SOURCE;
      id: string;
      ok: true;
      data: unknown;
      count?: number | null;
    }
  | {
      source: typeof CMS_HOST_SOURCE;
      id: string;
      ok: false;
      error: CmsError;
    };

export function isCmsRequest(value: unknown): value is CmsRequest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === CMS_CLIENT_SOURCE &&
    typeof v.id === 'string' &&
    typeof v.op === 'object' &&
    v.op !== null &&
    typeof (v.op as Record<string, unknown>).kind === 'string'
  );
}

export function isCmsResponse(value: unknown): value is CmsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === CMS_HOST_SOURCE &&
    typeof v.id === 'string' &&
    typeof v.ok === 'boolean'
  );
}

export function isCmsTable(table: string): boolean {
  return /^cms_[a-z0-9_]+$/.test(table);
}
