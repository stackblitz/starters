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
            <strong>Supabase is not configured.</strong> Add{' '}
            <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>, then apply
            the migrations in <code>supabase/migrations</code>. Bolt does this
            for you in a project.
          </>
        ) : (
          <>
            <strong>Could not load site content.</strong> {error}. Have the{' '}
            <code>supabase/migrations</code> been applied?
          </>
        )}
      </div>
    </div>
  );
}
