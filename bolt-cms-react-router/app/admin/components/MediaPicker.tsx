import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { listMedia, uploadMedia } from '@/admin/api';
import { useAsync, useDebounced } from '@/admin/hooks';
import type { Media } from '@/lib/cms/types';
import { mediaUrl } from '@/lib/cms/media';

import {
  Button,
  Dialog,
  EmptyState,
  ErrorNote,
  Input,
  Spinner,
  useToast,
  cx,
} from './ui';

/** Media library dialog: pick an existing file or upload a new one. */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = 'image/*',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: Media) => void;
  accept?: string;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const media = useAsync(
    async () =>
      open ? (await listMedia({ search: debounced, perPage: 60 })).data : [],
    [open, debounced]
  );

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      let last: Media | null = null;
      for (const file of Array.from(files)) last = await uploadMedia(file);
      await media.refetch();
      if (last && files.length === 1) onSelect(last);
      toast(`Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Media library" wide>
      <div className="mb-3 flex items-center gap-2">
        <Input
          placeholder="Search media…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <input
          ref={fileInput}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          variant="primary"
          icon={<Upload size={14} />}
          loading={uploading}
          onClick={() => fileInput.current?.click()}
        >
          Upload
        </Button>
      </div>
      {media.error && <ErrorNote message={media.error} />}
      {media.loading ? (
        <Spinner />
      ) : !media.data?.length ? (
        <EmptyState
          title="No media yet"
          description="Upload an image to get started."
        />
      ) : (
        <MediaGrid items={media.data} onSelect={onSelect} />
      )}
    </Dialog>
  );
}

export function MediaGrid({
  items,
  onSelect,
  selectedId,
}: {
  items: Media[];
  onSelect: (media: Media) => void;
  selectedId?: number | null;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m)}
          className={cx(
            'group relative aspect-square overflow-hidden rounded-md border bg-bolt-ds-bgSecondary text-left focus-visible:outline-2 focus-visible:outline-bolt-ds-brand',
            selectedId === m.id
              ? 'border-bolt-ds-brand ring-2 ring-bolt-ds-brandBorderSubtle'
              : 'border-bolt-ds-borderSecondary'
          )}
          title={m.title ?? undefined}
        >
          <MediaThumb media={m} />
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {m.title || m.local_path || m.source_url}
          </span>
        </button>
      ))}
    </div>
  );
}

export function MediaThumb({
  media,
  className,
}: {
  media: Media;
  className?: string;
}) {
  const url = mediaUrl(media, 'thumbnail') ?? mediaUrl(media);
  if (media.media_type === 'image' && url) {
    return (
      <img
        src={url}
        alt={media.alt_text ?? ''}
        className={cx('h-full w-full object-cover', className)}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={cx(
        'flex h-full w-full items-center justify-center p-2 text-center text-[11px] text-bolt-ds-textTertiary',
        className
      )}
    >
      {media.mime_type || 'file'}
    </span>
  );
}
