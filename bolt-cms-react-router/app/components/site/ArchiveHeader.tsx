export function ArchiveHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string | null;
}) {
  return (
    <header className="mb-12 border-b border-site-border pb-8">
      {kicker && (
        <p className="m-0 text-xs uppercase tracking-wide text-site-muted">
          {kicker}
        </p>
      )}
      <h1 className="mt-1 text-4xl">{title}</h1>
      {description && (
        <p className="mt-3 max-w-prose text-site-muted">{description}</p>
      )}
    </header>
  );
}
