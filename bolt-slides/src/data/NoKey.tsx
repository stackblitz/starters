/* What the editor shows when the deck is there but will not take an edit.

   The deck function answers questions from anyone who can reach it; editing
   takes the deck's own key, which the dev server reads out of .env
   (vite.config.ts). If the key is missing, the honest answer is "you may look
   at this deck but not change it" — and the wrong answer is to send the person
   to /present, because / would send them straight back and there is no way to
   ask again. So: say which piece is missing, and watch for it arriving. */
import { useEffect } from 'react';
import { config, forget } from './backend';
import { withShare } from './share';

export default function NoKey() {
  /* The key is usually seconds away: the agent is applying the schema right
     now, and writing it into .env when that finishes. The dev server serves
     .env per request, so asking again is enough to notice — and once the key is
     there, this screen has no reason to keep existing. */
  useEffect(() => {
    const timer = setInterval(async () => {
      forget();
      if ((await config()).ownerKey) location.reload();
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="gate" role="main">
      <div className="gate-card">
        <h1 className="gate-title">This deck has no editing key yet</h1>
        <p className="gate-body">
          The slides are in the database and can be presented. Changing them
          takes the deck's own key, which this project does not have on hand —
          so the editor would have nowhere to save to.
        </p>
        <p className="gate-body gate-quiet">
          Ask Bolt to finish setting up the deck: the key is created by{' '}
          <code>supabase/schema.sql</code> and belongs in <code>.env</code> as{' '}
          <code>DECK_OWNER_KEY</code>. This screen becomes the editor on its own
          once it is there.
        </p>
        <p className="gate-body gate-quiet">
          Doing it yourself? <code>select owner_key from deck;</code> — put the
          value in <code>.env</code>.
        </p>
        <a className="solid-btn gate-submit" href={withShare('/present')}>
          Present the deck
        </a>
      </div>
    </main>
  );
}
