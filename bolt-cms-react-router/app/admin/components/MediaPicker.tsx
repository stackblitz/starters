import { useState } from 'react';

import { countAssets, listAssets } from '@/admin/api';
import { useAsync, useDebounced } from '@/admin/hooks';
import { assetUrl } from '@/lib/cms/media';
import type { Asset } from '@/lib/cms/types';

import { Dialog, EmptyState, ErrorNote, Input, Pager, Spinner, cx } from './ui';

export const MEDIA_NOTE =
  'Media is managed by the WordPress import; to add files, upload them to the `cms-media` bucket in your Bolt Database and insert a `cms_assets` row.';

const PER_PAGE = 40;

/** Searchable, paginated `cms_assets` grid. Bump `version` to reload after an edit. */
export function AssetBrowser({
  onSelect,
  selectedId,
  version = 0,
}: {
  onSelect: (asset: Asset) => void;
  selectedId?: string | null;
  version?: number;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const assets = useAsync(
    () =>
      Promise.all([
        listAssets({ search: debounced, page, perPage: PER_PAGE }),
        countAssets(debounced),
      ]),
    [debounced, page, version]
  );
  const items = assets.data?.[0] ?? [];
  const total = assets.data?.[1] ?? 0;

  return (
    <>
      <div className="mb-3">
        <Input
          placeholder="Search media…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>
      {assets.error && <ErrorNote message={assets.error} />}
      {assets.loading && !assets.data ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState title="No media" description={MEDIA_NOTE} />
      ) : (
        <>
          <MediaGrid
            items={items}
            onSelect={onSelect}
            selectedId={selectedId}
          />
          <Pager
            page={page}
            pages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}

/** Media library dialog: pick an existing asset. */
export function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Media library" wide>
      <AssetBrowser onSelect={onSelect} />
    </Dialog>
  );
}

export function MediaGrid({
  items,
  onSelect,
  selectedId,
}: {
  items: Asset[];
  onSelect: (asset: Asset) => void;
  selectedId?: string | null;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a)}
          className={cx(
            'group relative aspect-square overflow-hidden rounded-md border bg-bolt-ds-bgSecondary text-left focus-visible:outline-2 focus-visible:outline-bolt-ds-brand',
            selectedId === a.id
              ? 'border-bolt-ds-brand ring-2 ring-bolt-ds-brandBorderSubtle'
              : 'border-bolt-ds-borderSecondary'
          )}
          title={a.title || a.filename}
        >
          <MediaThumb asset={a} />
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {a.title || a.filename}
          </span>
        </button>
      ))}
    </div>
  );
}

export function MediaThumb({
  asset,
  className,
}: {
  asset: Asset;
  className?: string;
}) {
  const url = assetUrl(asset);
  if (asset.kind === 'image' && url) {
    return (
      <img
        src={url}
        alt={asset.alt ?? ''}
        className={cx('h-full w-full object-cover', className)}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={cx(
        'flex h-full w-full items-center justify-center break-all p-2 text-center text-[11px] text-bolt-ds-textTertiary',
        className
      )}
    >
      {asset.filename}
    </span>
  );
}
