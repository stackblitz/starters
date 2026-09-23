import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';

import './app.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-site-theme="classic">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return (
    <div className="site" aria-busy="true">
      <div className="site-shell py-16 text-center text-sm text-site-muted">
        Loading…
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let title = 'Something went wrong';
  let detail: string | undefined;

  if (isRouteErrorResponse(error)) {
    title =
      error.status === 404
        ? 'Page not found'
        : `${error.status} ${error.statusText}`;
    detail = typeof error.data === 'string' ? error.data : undefined;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <div className="site">
      <main className="site-shell py-24">
        <div className="site-measure">
          <h1 className="text-3xl">{title}</h1>
          {detail && <p className="mt-4 text-site-muted">{detail}</p>}
          <p className="mt-8">
            <a href="/" className="underline">
              Back to the homepage
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
