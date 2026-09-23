import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { getAdminSettings, listContent, saveSettings } from '@/admin/api';
import { FieldInput } from '@/admin/components/fields/FieldInput';
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
import { useAsync } from '@/admin/hooks';
import { invalidateSettings, type SiteSettings } from '@/lib/cms';

type Tab = 'general' | 'reading' | 'discussion' | 'permalinks' | 'seo';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'reading', label: 'Reading' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'permalinks', label: 'Permalinks' },
  { value: 'seo', label: 'SEO' },
];

/** Mirrors WordPress' Settings screens. Everything writes to `cms_settings`. */
export default function Settings() {
  const { tab = 'general' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const remote = useAsync(getAdminSettings, []);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (remote.data) setDraft(remote.data);
  }, [remote.data]);

  const pages = useAsync(
    async () =>
      (await listContent({ type: 'page', status: 'publish', perPage: 200 }))
        .data,
    []
  );

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
      toast(
        e instanceof Error ? e.message : 'Could not save settings',
        'error'
      );
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
            disabled={!dirty}
            onClick={save}
          >
            Save changes
          </Button>
        }
      />
      <Tabs
        value={tab as Tab}
        onChange={(v) => navigate(`/admin/settings/${v}`)}
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
                  label="Original site URL"
                  hint="The WordPress address this site was imported from. Used to rewrite old links."
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

          {tab === 'discussion' && (
            <Card>
              <div className="grid gap-5">
                <Toggle
                  checked={draft.comments_enabled}
                  onChange={(v) => set('comments_enabled', v)}
                  label="Allow people to submit comments"
                  description="New comments always wait for moderation."
                />
                <Field label="Default comment status for new posts">
                  <Select
                    value={draft.default_comment_status}
                    onChange={(e) =>
                      set(
                        'default_comment_status',
                        e.target.value as 'open' | 'closed'
                      )
                    }
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {tab === 'permalinks' && (
            <Card>
              <div className="grid gap-4">
                <Field
                  label="Imported permalink structure"
                  hint="Kept for reference. Posts resolve by slug and pages by path; old URLs redirect via the cms_redirects table."
                >
                  <Input
                    value={draft.permalink_structure}
                    onChange={(e) => set('permalink_structure', e.target.value)}
                    className="font-mono text-xs"
                  />
                </Field>
                <p className="m-0 text-sm text-bolt-ds-textSecondary">
                  Post URLs: <code className="text-xs">/&lt;slug&gt;</code> ·
                  Page URLs:{' '}
                  <code className="text-xs">/&lt;parent&gt;/&lt;slug&gt;</code>{' '}
                  · Archives:{' '}
                  <code className="text-xs">/category/&lt;slug&gt;</code>,{' '}
                  <code className="text-xs">/tag/&lt;slug&gt;</code>,{' '}
                  <code className="text-xs">/author/&lt;slug&gt;</code>
                </p>
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
                <FieldInput
                  field={{
                    table_name: 'cms_settings',
                    column_name: 'seo.og_image',
                    label: 'Default social image',
                    type: 'image',
                    options: { value: 'url' },
                    group_name: 'main',
                    position: 0,
                  }}
                  value={draft.seo.og_image}
                  onChange={(v) =>
                    set('seo', {
                      ...draft.seo,
                      og_image: (v as string | null) ?? null,
                    })
                  }
                  context={{ row: {}, table: 'cms_settings' }}
                />
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
