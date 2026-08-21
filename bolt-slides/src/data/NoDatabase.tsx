/* What the app shows when there is no deck to show.

   This screen is the reason the starter can be honest about where a deck lives.
   A deck is rows in Postgres; with no database there is no deck, and the useful
   thing to say is which of the two missing pieces it is and what fixes it —
   rather than an empty editor that looks like a deck with no slides, or a
   silent failure that looks like a bug in the app. */
import { useStore } from './store';

export default function NoDatabase() {
  const problem = useStore((s) => s.problem);
  const missing = problem === 'no-database';

  return (
    <main className="gate" role="main">
      <div className="gate-card">
        <h1 className="gate-title">
          {missing
            ? 'This project has no database yet'
            : 'The deck is not answering'}
        </h1>
        {missing ? (
          <>
            <p className="gate-body">
              The slides live in a database, so there is nothing to open until
              this project has one. Ask Bolt to create a database for it, and
              this screen becomes the editor.
            </p>
            <p className="gate-body gate-quiet">
              Working outside Bolt? Point <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> at a Supabase project, apply{' '}
              <code>supabase/schema.sql</code>, and deploy the <code>deck</code>{' '}
              function.
            </p>
          </>
        ) : (
          <>
            <p className="gate-body">
              There is a database, but the deck function did not answer. It is
              usually one of two things: the function has not been deployed yet,
              or the project's credentials have changed since this tab was
              opened.
            </p>
            <p className="gate-body gate-quiet">
              Ask Bolt to deploy the <code>deck</code> function, then reload.
            </p>
          </>
        )}
        <button
          className="solid-btn gate-submit"
          onClick={() => location.reload()}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
