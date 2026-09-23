import { Menu as MenuIcon, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Form, Link, NavLink } from 'react-router';

import type { MenuItemNode, SiteSettings } from '@/lib/cms';
import { resolveMenuUrl } from '@/lib/cms/urls';

export function SiteHeader({
  settings,
  menu,
}: {
  settings: SiteSettings;
  menu: MenuItemNode[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-shell">
        <div className="site-branding">
          <div>
            <p className="site-title m-0">
              <Link to="/" className="no-underline hover:text-site-accent">
                {settings.site_title}
              </Link>
            </p>
            {settings.tagline && (
              <p className="site-tagline m-0 mt-1 text-sm text-site-muted">
                {settings.tagline}
              </p>
            )}
          </div>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-2 rounded-site border border-site-border px-3 py-1.5 text-sm md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-nav"
          >
            {open ? <X size={16} /> : <MenuIcon size={16} />}
            Menu
          </button>
        </div>

        <nav
          id="site-nav"
          className={`site-nav ${
            open ? 'flex' : 'hidden'
          } flex-col gap-1 md:flex md:flex-row md:items-center md:gap-6`}
          aria-label="Primary"
        >
          {menu.map((item) => (
            <NavItem key={item.id} item={item} siteUrl={settings.site_url} />
          ))}
          <Form
            method="get"
            action="/search"
            className="md:ml-auto"
            role="search"
          >
            <label className="flex items-center gap-2 rounded-site border border-site-border px-2.5 py-1 text-sm text-site-muted">
              <Search size={14} aria-hidden />
              <input
                type="search"
                name="s"
                placeholder="Search"
                className="w-28 bg-transparent text-site-fg outline-none placeholder:text-site-muted"
              />
            </label>
          </Form>
        </nav>
      </div>
    </header>
  );
}

function NavItem({ item, siteUrl }: { item: MenuItemNode; siteUrl: string }) {
  const className = ({ isActive }: { isActive: boolean }) =>
    `no-underline py-1 ${isActive ? 'text-site-accent font-semibold' : ''}`;

  return (
    <div className="group relative">
      <MenuLink item={item} siteUrl={siteUrl} className={className} />
      {item.children.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 pl-4 md:absolute md:left-0 md:top-full md:z-10 md:hidden md:min-w-44 md:rounded-site md:border md:border-site-border md:bg-site-bg md:p-2 md:pl-2 md:shadow-lg md:group-hover:flex md:group-focus-within:flex">
          {item.children.map((child) => (
            <MenuLink
              key={child.id}
              item={child}
              siteUrl={siteUrl}
              className={() =>
                'no-underline rounded px-2 py-1 text-sm hover:bg-site-bg-alt'
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  item,
  siteUrl,
  className,
}: {
  item: MenuItemNode;
  siteUrl: string;
  className: (state: { isActive: boolean }) => string;
}) {
  const target = resolveMenuUrl(item.url, siteUrl);
  if (target.external) {
    return (
      <a
        href={target.href}
        target={item.target || undefined}
        rel="noreferrer"
        className={className({ isActive: false })}
      >
        {item.title}
      </a>
    );
  }
  return (
    <NavLink to={target.href} className={className} end={target.href === '/'}>
      {item.title}
    </NavLink>
  );
}
