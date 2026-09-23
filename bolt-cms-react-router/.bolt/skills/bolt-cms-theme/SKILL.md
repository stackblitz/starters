---
name: bolt-cms-theme
description: >-
  Change how a Bolt CMS site looks: colors, fonts, spacing, header
  style, or add a new selectable theme. Use for any visual request on
  the public site (not the /bolt-admin UI).
---

# Theming a Bolt CMS site

Visuals derive from a small token contract. Change tokens, not
components, and the whole site (including imported WordPress block
markup) follows.

## The contract

`app/theme/tokens.css` maps Tailwind utilities to `--theme-*` variables:

```
--theme-bg, --theme-bg-alt, --theme-fg, --theme-muted
--theme-accent, --theme-accent-fg, --theme-border
--theme-font-heading, --theme-font-body
--theme-radius, --theme-radius-lg
--theme-measure (reading width), --theme-wide (layout width)
--theme-heading-weight, --theme-heading-tracking
--theme-body-size, --theme-body-leading
```

Components use them through utilities such as `bg-site-bg`,
`text-site-fg`, `text-site-muted`, `border-site-border`,
`bg-site-accent`, `font-site-heading`, `rounded-site`, and the `.site-*`
classes in `tokens.css`. `.entry-content` in the same file styles
WordPress block classes (`wp-block-image`, `wp-block-quote`,
`alignwide`, `has-text-align-*`, …).

## Themes

Each theme is one file in `app/theme/themes/` scoped to
`html[data-site-theme='<name>']` that sets the variables above and may
add a few structural overrides (e.g. the header layout). Existing
themes: `classic`, `editorial`, `minimal`. The active theme is the
`cms_settings` row with key `theme` (a jsonb string), chosen in
**Admin → Appearance**, and applied by `app/routes/site/layout.tsx` on
the `<html>` element. To switch it without the admin, run the same
upsert the admin's `upsertSetting` query does, via `apply_migration`
(or the Database tab's SQL editor):

```sql
insert into public.cms_settings (key, value) values ('theme', '"editorial"')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

Fonts are loaded once in `app/app.css` via Google Fonts; add families
there if a theme needs them.

## Tweaking the current look

Edit the matching theme file (`app/theme/themes/<name>.css`). Prefer
changing token values over adding selectors. If you must style a
component, use the token utilities so other themes still work.

## Adding a theme

1. Create `app/theme/themes/<name>.css` (copy `classic.css`) scoped to
   `html[data-site-theme='<name>']`.
2. Import it in `app/app.css` next to the others.
3. Add the name to the `ThemeName` union in `app/lib/cms/types.ts` and
   an entry in `THEMES` in `app/theme/themes.ts` (label, description,
   preview swatches). Appearance picks it up automatically.
4. Optionally make it active: the upsert above with `'"<name>"'`, or
   pick it in **Admin → Appearance**.

## Dark mode

Site themes are light by default. For dark support, add
`html[data-site-theme='<name>'].dark { … }` overrides; the `dark`
class is not toggled automatically on the public site.

## Don'ts

- Don't use `--color-bolt-ds-*` tokens on the public site; those are
  the Bolt design-system tokens used only by `/bolt-admin`.
- Don't style by `data-theme`; the design system uses that attribute.
  Site themes use `data-site-theme`.
