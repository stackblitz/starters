import { Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  deleteRow,
  getFields,
  listMedia,
  updateRow,
  uploadMedia,
} from '@/admin/api';
import { FieldGroup } from '@/admin/components/fields/FieldGroup';
import { MediaGrid, MediaThumb } from '@/admin/components/MediaPicker';
import {
  Button,
  confirmAction,
  Dialog,
  EmptyState,
  ErrorNote,
  Input,
  PageHeader,
  Pager,
  Spinner,
  useToast,
} from '@/admin/components/ui';
import { useAsync, useDebounced } from '@/admin/hooks';
import { formatDateTime, mediaUrl, type Media } from '@/lib/cms';

const PER_PAGE = 40;

export default function MediaLibrary() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const media = useAsync(
    () => listMedia({ search: debounced, page, perPage: PER_PAGE }),
    [debounced, page]
  );
  const fields = useAsync(() => getFields('cms_media'), []);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await uploadMedia(file);
      toast(`Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`);
      await media.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const total = media.data?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Media"
        description="Files live in public/wp-content/uploads and deploy with the site."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
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
          </>
        }
      />
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
      {media.error && <ErrorNote message={media.error} />}
      {media.loading && !media.data ? (
        <Spinner />
      ) : !media.data?.data.length ? (
        <EmptyState
          title="No media yet"
          description="Upload images and files, or import them from WordPress."
        />
      ) : (
        <>
          <MediaGrid
            items={media.data.data}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
          <Pager
            page={page}
            pages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
            onChange={setPage}
          />
        </>
      )}

      <MediaDetails
        media={selected}
        fields={fields.data ?? []}
        onClose={() => setSelected(null)}
        onChanged={async () => {
          await media.refetch();
        }}
      />
    </>
  );
}

function MediaDetails({
  media,
  fields,
  onClose,
  onChanged,
}: {
  media: Media | null;
  fields: Awaited<ReturnType<typeof getFields>>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setRow(media ? { ...media } : null);
  }, [media]);

  async function save() {
    if (!media || !row) return;
    setSaving(true);
    try {
      const values: Record<string, unknown> = {};
      for (const f of fields)
        if (!f.options?.readonly) values[f.column_name] = row[f.column_name];
      await updateRow('cms_media', media.id, values);
      toast('Media updated');
      await onChanged();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (
      !media ||
      !confirmAction(
        'Delete this file from the library? Posts referencing it will lose the image.'
      )
    )
      return;
    try {
      await deleteRow('cms_media', media.id);
      toast('Deleted');
      await onChanged();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const url = media ? mediaUrl(media) : null;

  return (
    <Dialog
      open={Boolean(media)}
      onClose={onClose}
      title="Attachment details"
      wide
      footer={
        <>
          <Button variant="ghost" icon={<Trash2 size={14} />} onClick={destroy}>
            Delete permanently
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      {media && row && (
        <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
          <div className="overflow-hidden rounded-md border border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary">
            <MediaThumb media={media} className="max-h-[60vh] object-contain" />
          </div>
          <div className="grid content-start gap-4 text-sm">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-bolt-ds-textTertiary">
              <dt>Uploaded</dt>
              <dd className="m-0">{formatDateTime(media.date)}</dd>
              <dt>Type</dt>
              <dd className="m-0">{media.mime_type ?? '—'}</dd>
              {media.width && (
                <>
                  <dt>Size</dt>
                  <dd className="m-0">
                    {media.width} × {media.height}
                  </dd>
                </>
              )}
              <dt>URL</dt>
              <dd className="m-0 break-all">{url}</dd>
            </dl>
            <FieldGroup
              fields={fields}
              group="main"
              row={row}
              table="cms_media"
              onChange={(c, v) => setRow((r) => (r ? { ...r, [c]: v } : r))}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
