import {
  Brush,
  FileText,
  Files,
  Image,
  LayoutDashboard,
  MessageSquare,
  Navigation,
  Settings,
  Tags,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { hello, isInsideBolt } from '@/admin/bridge/client';
import { cx, ErrorNote, Spinner, ToastProvider } from '@/admin/components/ui';
import { AdminContext, errorMessage } from '@/admin/hooks';

export function meta() {
  return [
    { title: 'Bolt CMS' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

type Connection =
  | { state: 'connecting' }
  | { state: 'ready'; canEdit: boolean }
  | { state: 'error'; message: string };

/**
 * The admin only works inside Bolt's Admin tab, which frames this page and
 * answers bridge requests. `bolt.hello` runs once before any screen renders.
 */
export default function AdminLayout() {
  const [inside, setInside] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<Connection>({
    state: 'connecting',
  });

  useEffect(() => {
    const framed = isInsideBolt();
    setInside(framed);
    if (!framed) return;
    hello().then(
      (h) => setConnection({ state: 'ready', canEdit: h.permissions.canEdit }),
      (e) => setConnection({ state: 'error', message: errorMessage(e) })
    );
  }, []);

  useEffect(() => {
    // Follow the OS/Bolt color scheme for the admin chrome.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (inside === null) return null;
  if (!inside)
    return (
      <div className="flex min-h-screen items-center justify-center bg-bolt-ds-bg px-6 text-bolt-ds-textSecondary">
        <p className="m-0 text-sm">
          Open this page from the Admin tab in Bolt.
        </p>
      </div>
    );

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bolt-ds-bg text-bolt-ds-textPrimary antialiased">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar connection={connection} />
          <main className="flex-1 px-6 py-6">
            {connection.state === 'ready' ? (
              <AdminContext.Provider value={{ canEdit: connection.canEdit }}>
                <Outlet />
              </AdminContext.Provider>
            ) : connection.state === 'error' ? (
              <ErrorNote message={connection.message} />
            ) : (
              <Spinner label="Connecting to Bolt" />
            )}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <BoltMark />
        <span className="text-sm font-semibold">Bolt CMS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-4 text-sm">
        <SideLink to="/bolt-admin" end icon={<LayoutDashboard size={15} />}>
          Dashboard
        </SideLink>

        <SectionLabel>Content</SectionLabel>
        <SideLink to="/bolt-admin/content/post" icon={<FileText size={15} />}>
          Posts
        </SideLink>
        <SideLink to="/bolt-admin/content/page" icon={<Files size={15} />}>
          Pages
        </SideLink>
        <SideLink to="/bolt-admin/comments" icon={<MessageSquare size={15} />}>
          Comments
        </SideLink>
        <SideLink to="/bolt-admin/media" icon={<Image size={15} />}>
          Media
        </SideLink>

        <SectionLabel>Organize</SectionLabel>
        <SideLink to="/bolt-admin/collection/author" icon={<Users size={15} />}>
          Authors
        </SideLink>
        <SideLink
          to="/bolt-admin/collection/category"
          icon={<Tags size={15} />}
        >
          Categories
        </SideLink>
        <SideLink to="/bolt-admin/collection/tag" icon={<Tags size={15} />}>
          Tags
        </SideLink>
        <SideLink to="/bolt-admin/menus" icon={<Navigation size={15} />}>
          Menus
        </SideLink>

        <SectionLabel>Site</SectionLabel>
        <SideLink to="/bolt-admin/appearance" icon={<Brush size={15} />}>
          Appearance
        </SideLink>
        <SideLink to="/bolt-admin/settings" icon={<Settings size={15} />}>
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
  children,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
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
    </NavLink>
  );
}

function TopBar({ connection }: { connection: Connection }) {
  const [status, tone] =
    connection.state === 'connecting'
      ? ['Connecting to Bolt…', 'bg-bolt-ds-warning']
      : connection.state === 'error'
      ? [connection.message, 'bg-bolt-ds-danger']
      : connection.canEdit
      ? ['Connected', 'bg-bolt-ds-success']
      : ['Read-only access', 'bg-bolt-ds-warning'];

  return (
    <header className="flex h-12 items-center justify-between border-b border-bolt-ds-borderSecondary px-6">
      <div className="flex items-center gap-2 text-xs text-bolt-ds-textTertiary">
        <span className={cx('inline-block h-1.5 w-1.5 rounded-full', tone)} />
        <span>{status}</span>
      </div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-bolt-ds-textSecondary hover:text-bolt-ds-textPrimary"
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
