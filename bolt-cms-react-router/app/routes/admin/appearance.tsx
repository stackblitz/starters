import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getAdminSettings, saveSettings } from '@/admin/api';
import {
  Button,
  Card,
  cx,
  ErrorNote,
  PageHeader,
  Spinner,
  useToast,
} from '@/admin/components/ui';
import { errorMessage, isRejectedByUser, useAsync, useCanEdit } from '@/admin/hooks';
import { invalidateSettings, type ThemeName } from '@/lib/cms';
import { THEMES } from '@/theme/themes';

export default function Appearance() {
  const settings = useAsync(getAdminSettings, []);
  const [theme, setTheme] = useState<ThemeName>('classic');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const canEdit = useCanEdit();

  useEffect(() => {
    if (settings.data) setTheme(settings.data.theme);
  }, [settings.data]);

  async function save() {
    setSaving(true);
    try {
      await saveSettings({ theme });
      invalidateSettings();
      toast('Theme updated');
      await settings.refetch();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const changed = settings.data && settings.data.theme !== theme;

  return (
    <>
      <PageHeader
        title="Appearance"
        description="Pick the theme your site renders with. Every theme is a set of tokens in app/theme/themes; ask Bolt to tweak colors, type, or layout."
        actions={
          <Button
            variant="primary"
            loading={saving}
            disabled={!canEdit || !changed}
            onClick={save}
          >
            Save
          </Button>
        }
      />
      {settings.error && <ErrorNote message={settings.error} />}
      {settings.loading && !settings.data ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {THEMES.map((t) => {
            const active = theme === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => setTheme(t.name)}
                className={cx(
                  'group overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-bolt-ds-brand',
                  active
                    ? 'border-bolt-ds-brand ring-2 ring-bolt-ds-brandBorderSubtle'
                    : 'border-bolt-ds-borderSecondary'
                )}
                aria-pressed={active}
              >
                <ThemePreview theme={t.preview} />
                <div className="flex items-start justify-between gap-2 bg-bolt-ds-bgAlt p-3">
                  <div>
                    <p className="m-0 text-sm font-semibold">{t.label}</p>
                    <p className="m-0 mt-0.5 text-xs text-bolt-ds-textTertiary">
                      {t.description}
                    </p>
                  </div>
                  {active && (
                    <Check size={16} className="shrink-0 text-bolt-ds-brand" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Card title="Site identity" className="mt-6">
        <p className="m-0 text-sm text-bolt-ds-textSecondary">
          Site title and tagline live under <strong>Settings → General</strong>.
          Menus are under <strong>Menus</strong>.
        </p>
      </Card>
    </>
  );
}

function ThemePreview({
  theme,
}: {
  theme: { bg: string; fg: string; accent: string; heading: string };
}) {
  return (
    <div
      className="aspect-[4/3] p-4"
      style={{ background: theme.bg, color: theme.fg }}
    >
      <div
        className="mb-3 h-2 w-16 rounded"
        style={{ background: theme.fg, opacity: 0.85 }}
      />
      <div className="mb-4 flex gap-2">
        <span
          className="h-1 w-6 rounded"
          style={{ background: theme.fg, opacity: 0.4 }}
        />
        <span
          className="h-1 w-6 rounded"
          style={{ background: theme.fg, opacity: 0.4 }}
        />
        <span
          className="h-1 w-6 rounded"
          style={{ background: theme.fg, opacity: 0.4 }}
        />
      </div>
      <div
        className="mb-2 h-3 w-3/4 rounded"
        style={{ background: theme.fg, fontFamily: theme.heading }}
      />
      <div
        className="mb-1 h-1.5 w-full rounded"
        style={{ background: theme.fg, opacity: 0.25 }}
      />
      <div
        className="mb-1 h-1.5 w-11/12 rounded"
        style={{ background: theme.fg, opacity: 0.25 }}
      />
      <div
        className="mb-3 h-1.5 w-2/3 rounded"
        style={{ background: theme.fg, opacity: 0.25 }}
      />
      <div className="h-2 w-14 rounded" style={{ background: theme.accent }} />
    </div>
  );
}
