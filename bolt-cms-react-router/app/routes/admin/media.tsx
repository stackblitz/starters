import { useEffect, useState } from 'react';

import { updateAsset } from '@/admin/api';
import {
  AssetBrowser,
  MEDIA_NOTE,
  MediaThumb,
} from '@/admin/components/MediaPicker';
import {
  Button,
  Dialog,
  Field,
  Input,
  PageHeader,
  Textarea,
  useToast,
} from '@/admin/components/ui';
import { errorMessage, isRejectedByUser, useCanEdit } from '@/admin/hooks';
import { assetUrl, type Asset } from '@/lib/cms';

export default function MediaLibrary() {
  const [selected, setSelected] = useState<Asset | null>(null);
  const [version, setVersion] = useState(0);

  return (
    <>
      <PageHeader title="Media" description={MEDIA_NOTE} />
      <AssetBrowser
        onSelect={setSelected}
        selectedId={selected?.id}
        version={version}
      />
      <MediaDetails
        asset={selected}
        onClose={() => setSelected(null)}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </>
  );
}

function MediaDetails({
  asset,
  onClose,
  onSaved,
}: {
  asset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [meta, setMeta] = useState({ title: '', alt: '', caption: '' });
  const [saving, setSaving] = useState(false);
  const canEdit = useCanEdit();
  const toast = useToast();

  useEffect(() => {
    setMeta({
      title: asset?.title ?? '',
      alt: asset?.alt ?? '',
      caption: asset?.caption ?? '',
    });
  }, [asset]);

  async function save() {
    if (!asset) return;
    setSaving(true);
    try {
      await updateAsset(asset.id, {
        title: meta.title || null,
        alt: meta.alt || null,
        caption: meta.caption || null,
      });
      toast('Media updated');
      onSaved();
      onClose();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const url = assetUrl(asset);

  return (
    <Dialog
      open={Boolean(asset)}
      onClose={onClose}
      title="Attachment details"
      wide
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!canEdit}
          onClick={save}
        >
          Save
        </Button>
      }
    >
      {asset && (
        <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
          <div className="overflow-hidden rounded-md border border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary">
            <MediaThumb asset={asset} className="max-h-[60vh] object-contain" />
          </div>
          <div className="grid content-start gap-4 text-sm">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-bolt-ds-textTertiary">
              <dt>File</dt>
              <dd className="m-0 break-all">{asset.filename}</dd>
              <dt>Type</dt>
              <dd className="m-0">{asset.mime_type ?? '—'}</dd>
              {asset.width && (
                <>
                  <dt>Size</dt>
                  <dd className="m-0">
                    {asset.width} × {asset.height}
                  </dd>
                </>
              )}
              <dt>URL</dt>
              <dd className="m-0 break-all">{url}</dd>
              {asset.upload_error && (
                <>
                  <dt>Upload</dt>
                  <dd className="m-0">Failed, served from the original URL</dd>
                </>
              )}
            </dl>
            <Field label="Title">
              <Input
                value={meta.title}
                disabled={!canEdit}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, title: e.target.value }))
                }
              />
            </Field>
            <Field label="Alternative text">
              <Input
                value={meta.alt}
                disabled={!canEdit}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, alt: e.target.value }))
                }
              />
            </Field>
            <Field label="Caption">
              <Textarea
                rows={3}
                value={meta.caption}
                disabled={!canEdit}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, caption: e.target.value }))
                }
              />
            </Field>
          </div>
        </div>
      )}
    </Dialog>
  );
}
