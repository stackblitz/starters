export function SetupNotice({
  configured,
  error,
}: {
  configured: boolean;
  error?: string;
}) {
  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900">
      <div className="site-shell py-3 text-sm">
        {!configured ? (
          <>
            <strong>Supabase is not configured.</strong> Connect a Bolt Database
            (or import a WordPress site) and add <code>VITE_SUPABASE_URL</code>{' '}
            / <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>.
          </>
        ) : (
          <>
            <strong>Could not load site content.</strong> {error}. Has the
            database schema in <code>supabase/migrations</code> been applied?
          </>
        )}
      </div>
    </div>
  );
}
