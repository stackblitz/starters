import { useEffect } from 'react';
import { Outlet, useRouteLoaderData } from 'react-router';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SetupNotice } from '@/components/site/SetupNotice';
import {
  DEFAULT_SETTINGS,
  getMenu,
  getSettings,
  type MenuItemNode,
  type SiteSettings,
} from '@/lib/cms';
import { hasSupabaseConfig } from '@/lib/supabase';
import { isThemeName } from '@/theme/themes';

import type { Route } from './+types/layout';

export interface SiteLayoutData {
  settings: SiteSettings;
  menu: MenuItemNode[];
  configured: boolean;
  error?: string;
}

export async function clientLoader(): Promise<SiteLayoutData> {
  if (!hasSupabaseConfig()) {
    return { settings: DEFAULT_SETTINGS, menu: [], configured: false };
  }
  try {
    const [settings, { items }] = await Promise.all([
      getSettings(),
      getMenu('primary'),
    ]);
    return { settings, menu: items, configured: true };
  } catch (error) {
    return {
      settings: DEFAULT_SETTINGS,
      menu: [],
      configured: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Read site settings from any child route's `meta({ matches })`. */
export function settingsFromMatches(
  matches: Array<{ id: string; loaderData?: unknown } | undefined>
): SiteSettings {
  const match = matches.find((m) => m?.id === 'routes/site/layout');
  return (
    (match?.loaderData as SiteLayoutData | undefined)?.settings ??
    DEFAULT_SETTINGS
  );
}

export function useSiteData(): SiteLayoutData {
  return (
    (useRouteLoaderData('routes/site/layout') as
      | SiteLayoutData
      | undefined) ?? {
      settings: DEFAULT_SETTINGS,
      menu: [],
      configured: false,
    }
  );
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { settings, menu, configured, error } = loaderData;

  useEffect(() => {
    const theme = isThemeName(settings.theme) ? settings.theme : 'classic';
    document.documentElement.setAttribute('data-site-theme', theme);
    document.documentElement.lang = settings.language?.split('-')[0] || 'en';
  }, [settings.theme, settings.language]);

  return (
    <div className="site">
      <SiteHeader settings={settings} menu={menu} />
      {(!configured || error) && (
        <SetupNotice configured={configured} error={error} />
      )}
      <main className="site-shell flex-1 py-10 md:py-14">
        <Outlet />
      </main>
      <SiteFooter settings={settings} />
    </div>
  );
}
