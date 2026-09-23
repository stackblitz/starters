import type { SiteSettings } from '@/lib/cms';

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-auto border-t border-site-border">
      <div className="site-shell flex flex-col gap-2 py-8 text-sm text-site-muted md:flex-row md:items-center md:justify-between">
        <p className="m-0">
          © {new Date().getFullYear()} {settings.site_title}
        </p>
        <p className="m-0">
          Powered by{' '}
          <a href="https://bolt.new" className="font-medium" rel="noreferrer">
            Bolt CMS
          </a>
        </p>
      </div>
    </footer>
  );
}
