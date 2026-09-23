import type { ThemeName } from '@/lib/cms/types';

export interface ThemeInfo {
  name: ThemeName;
  label: string;
  description: string;
  /** Swatches shown in the Appearance screen. */
  preview: { bg: string; fg: string; accent: string; heading: string };
}

export const THEMES: ThemeInfo[] = [
  {
    name: 'classic',
    label: 'Classic',
    description:
      'Centered banner header, serif headings, blue accent. The familiar blog.',
    preview: {
      bg: '#ffffff',
      fg: '#1a1a1a',
      accent: '#1e5eff',
      heading: 'serif',
    },
  },
  {
    name: 'editorial',
    label: 'Editorial',
    description: 'Warm paper, display serif, oxblood accent. Magazine energy.',
    preview: {
      bg: '#faf6ef',
      fg: '#1f1a17',
      accent: '#8b1e2d',
      heading: 'serif',
    },
  },
  {
    name: 'minimal',
    label: 'Minimal',
    description:
      'Single-line header, sans-serif, near-black accent. Quiet and modern.',
    preview: {
      bg: '#ffffff',
      fg: '#111111',
      accent: '#111111',
      heading: 'sans-serif',
    },
  },
];

export const DEFAULT_THEME: ThemeName = 'classic';

export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.some((t) => t.name === value);
}
