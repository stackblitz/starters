/* The only thing the routes know about Postgres.

   Everything below this line is one method, which is what lets the same route
   handlers run against the real database in production and against an in-process
   Postgres in the test suite. Add nothing to this interface that a plain client
   cannot do: no transactions, no cursors, no driver types. Writes that must not
   half-happen are written as one statement — see how the routes shift positions
   and insert a slide in a single CTE — because that is the only atomicity a
   single query can promise. */
export interface Sql {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<T[]>;
}

/** The first row, or null. For the many queries that select one row by id. */
export async function one<T = Record<string, unknown>>(
  sql: Sql,
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await sql.query<T>(text, params);
  return rows[0] ?? null;
}
