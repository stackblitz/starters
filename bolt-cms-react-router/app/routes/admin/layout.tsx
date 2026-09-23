import {
  Brush,
  FileText,
  Files,
  Image,
  LayoutDashboard,
  MessageSquare,
  Navigation,
  Plug,
  Settings,
  Tags,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import {
  getTaxonomies,
  getPostTypeCounts,
  hello,
  summarizeTypes,
} from '@/admin/api';
import { isAdminShell } from '@/admin/bridge/client';
import { cx, ToastProvider } from '@/admin/components/ui';
import { useAsync } from '@/admin/hooks';
import { typeLabel, taxonomyLabel } from '@/admin/labels';

export function meta() {
  return [
    { title: 'Bolt CMS' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

/**
 * The admin only renders inside a Bolt project (framed by the Bolt UI) or in
 * local dev. Opened directly on the published site it is a blank page.
 */
export default function AdminLayout() {
  const [shell, setShell] = useState<boolean | null>(null);

  useEffect(() => {
    setShell(isAdminShell());
    // Follow the OS/Bolt color scheme for the admin chrome.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Not framed by Bolt and not local dev: render nothing.
  if (shell === null || !shell) return null;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bolt-ds-bg text-bolt-ds-textPrimary antialiased">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function Sidebar() {
  const types = useAsync(
    async () => summarizeTypes(await getPostTypeCounts()),
    []
  );
  const taxonomies = useAsync(getTaxonomies, []);

  const contentTypes = types.data ?? [
    { type: 'post', total: 0, byStatus: {} },
    { type: 'page', total: 0, byStatus: {} },
  ];
  const known = new Set(contentTypes.map((t) => t.type));
  if (!known.has('post'))
    contentTypes.unshift({ type: 'post', total: 0, byStatus: {} });
  if (!known.has('page'))
    contentTypes.splice(1, 0, { type: 'page', total: 0, byStatus: {} });

  const taxList = taxonomies.data ?? [
    { taxonomy: 'category', count: 0 },
    { taxonomy: 'post_tag', count: 0 },
  ];

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <BoltMark />
        <span className="text-sm font-semibold">Bolt CMS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-4 text-sm">
        <SideLink to="/admin" end icon={<LayoutDashboard size={15} />}>
          Dashboard
        </SideLink>

        <SectionLabel>Content</SectionLabel>
        {contentTypes.map((t) => (
          <SideLink
            key={t.type}
            to={`/admin/content/${t.type}`}
            icon={
              t.type === 'page' ? (
                <Files size={15} />
              ) : t.type === 'post' ? (
                <FileText size={15} />
              ) : (
                <Plug size={15} />
              )
            }
            count={t.total}
          >
            {typeLabel(t.type, true)}
          </SideLink>
        ))}
        <SideLink to="/admin/media" icon={<Image size={15} />}>
          Media
        </SideLink>
        <SideLink to="/admin/comments" icon={<MessageSquare size={15} />}>
          Comments
        </SideLink>

        <SectionLabel>Organize</SectionLabel>
        {taxList.map((t) => (
          <SideLink
            key={t.taxonomy}
            to={`/admin/terms/${t.taxonomy}`}
            icon={<Tags size={15} />}
            count={t.count}
          >
            {taxonomyLabel(t.taxonomy, true)}
          </SideLink>
        ))}
        <SideLink to="/admin/menus" icon={<Navigation size={15} />}>
          Menus
        </SideLink>

        <SectionLabel>Site</SectionLabel>
        <SideLink to="/admin/appearance" icon={<Brush size={15} />}>
          Appearance
        </SideLink>
        <SideLink to="/admin/settings" icon={<Settings size={15} />}>
          Settings
        </SideLink>
      </nav>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-1 mt-4 px-2 text-[11px] font-medium uppercase tracking-wider text-bolt-ds-textTertiary">
      {children}
    </p>
  );
}

function SideLink({
  to,
  end,
  icon,
  count,
  children,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-bolt-ds-textSecondary transition-colors hover:bg-bolt-ds-utilHover hover:text-bolt-ds-textPrimary',
          isActive && 'bg-bolt-ds-bgTertiary text-bolt-ds-textPrimary'
        )
      }
    >
      <span className="text-bolt-ds-iconSecondary">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] text-bolt-ds-textTertiary">{count}</span>
      )}
    </NavLink>
  );
}

function TopBar() {
  const location = useLocation();
  const host = useAsync(hello, []);

  const status = host.loading
    ? 'Connecting to Bolt…'
    : host.error
    ? 'Host unavailable'
    : `Connected · ${host.data?.host}`;
  const tone = host.loading
    ? 'bg-bolt-ds-warning'
    : host.error
    ? 'bg-bolt-ds-danger'
    : 'bg-bolt-ds-success';

  return (
    <header className="flex h-12 items-center justify-between border-b border-bolt-ds-borderSecondary px-6">
      <div className="flex items-center gap-2 text-xs text-bolt-ds-textTertiary">
        <span className={cx('inline-block h-1.5 w-1.5 rounded-full', tone)} />
        <span title={host.error ?? undefined}>{status}</span>
      </div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-bolt-ds-textSecondary hover:text-bolt-ds-textPrimary"
        data-path={location.pathname}
      >
        View site <ExternalLink size={12} />
      </a>
    </header>
  );
}

function BoltMark() {
  return (
    <svg viewBox="0 0 178 227" className="h-4 w-4" aria-hidden>
      <path
        fill="#1688FC"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M103.267 198.762C87.1743 198.762 71.3565 192.914 62.2897 180.315L59.0909 195.151L0 226.551L6.37813 195.151L49.3961 0H102.089L86.8603 68.7856C99.1455 55.3229 110.567 50.3381 125.208 50.3381C156.823 50.3381 177.901 71.121 177.901 109.174C177.901 147.227 153.605 198.742 103.247 198.742L103.267 198.762ZM123.461 120.321C123.461 138.474 110.587 152.231 93.9056 152.231C84.5445 152.231 76.0469 148.718 70.493 142.576L78.6963 106.564C84.8389 100.421 91.8646 96.9083 100.068 96.9083C112.647 96.9083 123.48 106.269 123.48 120.321H123.461Z"
      />
    </svg>
  );
}
