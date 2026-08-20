/* The deck function: the only way into the deck.

   The app in the browser holds the anon key, which by itself can read and write
   nothing (the schema enables row level security and defines no policies). This
   function holds the connection that can, and applies the rules in access.ts
   before touching anything. That is what keeps a published deck's own bundle
   from being able to rewrite the deck or read its speaker notes.

   Deploy it with `mcp__supabase__deploy_edge_function` (slug: `deck`). It reads
   `SUPABASE_DB_URL`, which Supabase populates for every project — nothing to
   configure and no secret to pass.

   Routing and rules live in routes.ts and access.ts, which know nothing about
   Deno, so the test suite runs the same handlers against an in-process Postgres. */
import postgres from 'npm:postgres@3.4.5';
import { handle } from './routes.ts';
import type { Sql } from './sql.ts';

/* One pool for the isolate, reused across requests it serves. Small on purpose:
   a project's connection budget is shared with everything else it runs, and this
   function's queries are short.

   `prepare: false` because Supabase's pooler hands out connections per
   transaction, so a statement prepared on one is not there on the next. */
const client = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});

const sql: Sql = {
  async query<T>(text: string, params: unknown[] = []) {
    // deno-lint-ignore no-explicit-any
    return (await client.unsafe(text, params as any[])) as unknown as T[];
  },
};

Deno.serve(async (req: Request) => {
  try {
    return await handle(req, sql);
  } catch (error) {
    /* Never leak a database error to a caller who might be a stranger holding a
       link: log the detail, answer with the fact that it failed. */
    console.error('deck function failed', error);
    return new Response(JSON.stringify({ error: 'deck-unavailable' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
