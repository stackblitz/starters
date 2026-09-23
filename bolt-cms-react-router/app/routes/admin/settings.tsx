import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { getAdminSettings, listContentOptions, saveSettings } from '@/admin/api';
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from '@/admin/components/ui';
import { errorMessage, isRejectedByUser, useAsync, useCanEdit } from '@/admin/hooks';
import { invalidateSettings, type SiteSettings } from '@/lib/cms';

type Tab = 'general' | 'reading' | 'seo';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'reading', label: 'Reading' },
  { value: 'seo', label: 'SEO' },
];

/** Mirrors WordPress' Settings screens. Everything writes to `cms_settings`. */
export default function Settings() {
  const { tab = 'general' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canEdit = useCanEdit();

  const remote = useAsync(getAdminSettings, []);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (remote.data) setDraft(remote.data);
  }, [remote.data]);

  const pages = useAsync(() => listContentOptions('page'), []);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function save() {
    if (!draft || !remote.data) return;
    const changed: Partial<Record<keyof SiteSettings, unknown>> = {};
    for (const key of Object.keys(draft) as Array<keyof SiteSettings>) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(remote.data[key]))
        changed[key] = draft[key];
    }
    if (Object.keys(changed).length === 0) return;
    setSaving(true);
    try {
      await saveSettings(changed);
      invalidateSettings();
      toast('Settings saved');
      await remote.refetch();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    draft &&
    remote.data &&
    JSON.stringify(draft) !== JSON.stringify(remote.data);

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          <Button
            variant="primary"
            loading={saving}
            disabled={!canEdit || !dirty}
            onClick={save}
          >
            Save changes
          </Button>
        }
      />
      <Tabs
        value={tab as Tab}
        onChange={(v) => navigate(`/bolt-admin/settings/${v}`)}
        items={TABS}
      />
      {remote.error && <ErrorNote message={remote.error} />}
      {!draft ? (
        <Spinner />
      ) : (
        <div className="max-w-2xl">
          {tab === 'general' && (
            <Card>
              <div className="grid gap-4">
                <Field label="Site title">
                  <Input
                    value={draft.site_title}
                    onChange={(e) => set('site_title', e.target.value)}
                  />
                </Field>
                <Field
                  label="Tagline"
                  hint="In a few words, explain what this site is about."
                >
                  <Input
                    value={draft.tagline}
                    onChange={(e) => set('tagline', e.target.value)}
                  />
                </Field>
                <Field
                  label="Site URL"
                  hint="The public address of the site. Imported sites start with their WordPress address."
                >
                  <Input
                    value={draft.site_url}
                    onChange={(e) => set('site_url', e.target.value)}
                    placeholder="https://example.com"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Language">
                    <Input
                      value={draft.language}
                      onChange={(e) => set('language', e.target.value)}
                    />
                  </Field>
                  <Field label="Timezone">
                    <Input
                      value={draft.timezone}
                      onChange={(e) => set('timezone', e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Date format" hint="PHP-style, as in WordPress (e.g. F j, Y).">
                  <Input
                    value={draft.date_format}
                    onChange={(e) => set('date_format', e.target.value)}
                    className="max-w-48 font-mono text-xs"
                  />
                </Field>
              </div>
            </Card>
          )}

          {tab === 'reading' && (
            <Card>
              <div className="grid gap-4">
                <Field label="Your homepage displays">
                  <Select
                    value={draft.show_on_front}
                    onChange={(e) =>
                      set('show_on_front', e.target.value as 'posts' | 'page')
                    }
                  >
                    <option value="posts">Your latest posts</option>
                    <option value="page">A static page</option>
                  </Select>
                </Field>
                {draft.show_on_front === 'page' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Homepage">
                      <Select
                        value={draft.page_on_front ?? ''}
                        onChange={(e) =>
                          set(
                            'page_on_front',
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">— Select —</option>
                        {pages.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Posts page">
                      <Select
                        value={draft.page_for_posts ?? ''}
                        onChange={(e) =>
                          set(
                            'page_for_posts',
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">— Select —</option>
                        {pages.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}
                <Field label="Blog pages show at most">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.posts_per_page}
                    onChange={(e) =>
                      set(
                        'posts_per_page',
                        Math.max(1, Number(e.target.value) || 10)
                      )
                    }
                    className="max-w-32"
                  />
                </Field>
              </div>
            </Card>
          )}

          {tab === 'seo' && (
            <Card>
              <div className="grid gap-4">
                <Field
                  label="Title template"
                  hint="Placeholders: %title%, %site_title%, %tagline%"
                >
                  <Input
                    value={draft.seo.title_template}
                    onChange={(e) =>
                      set('seo', {
                        ...draft.seo,
                        title_template: e.target.value,
                      })
                    }
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label="Default meta description">
                  <Textarea
                    value={draft.seo.description}
                    rows={3}
                    onChange={(e) =>
                      set('seo', { ...draft.seo, description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Default social image URL">
                  <Input
                    type="url"
                    value={draft.seo.og_image ?? ''}
                    onChange={(e) =>
                      set('seo', { ...draft.seo, og_image: e.target.value || null })
                    }
                    placeholder="https://"
                  />
                </Field>
                <Field label="Twitter / X handle">
                  <Input
                    value={draft.seo.twitter}
                    onChange={(e) =>
                      set('seo', { ...draft.seo, twitter: e.target.value })
                    }
                    placeholder="@yoursite"
                  />
                </Field>
                <Toggle
                  checked={draft.seo.noindex}
                  onChange={(v) => set('seo', { ...draft.seo, noindex: v })}
                  label="Discourage search engines from indexing this site"
                  description="Adds a noindex robots tag to every page."
                />
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
