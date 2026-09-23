/**
 * Generates `.bolt/admin.json` from `app/admin/queries.ts`.
 *   npm run manifest            writes the file
 *   npm run manifest -- --check exits 1 when the committed file is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ADMIN_QUERIES, type AdminQuery } from '../app/admin/queries.ts';

const target = new URL('../.bolt/admin.json', import.meta.url);

// Mirrors the rules Bolt applies to the manifest (bolt-admin-dashboard skill).
for (const [name, query] of Object.entries(ADMIN_QUERIES) as Array<
  [string, AdminQuery]
>) {
  const fail = (reason: string) => {
    throw new Error(`.bolt/admin.json query "${name}": ${reason}`);
  };

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    fail('name must be letters, digits and underscores');

  const used = [...query.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const count = Math.max(0, ...used);

  for (let n = 1; n <= count; n++) {
    const pattern = new RegExp(`\\$${n}(?!\\d)`);
    if (!pattern.test(query.sql)) fail(`sql skips $${n}`);
    // Postgres rejects a parameter the preview never uses; Bolt sends it every parameter
    if (query.preview !== undefined && !pattern.test(query.preview))
      fail(`preview must reference $${n}`);
  }

  if (query.confirm) {
    if (!query.description) fail('confirm requires a description');
    if (query.readOnly !== false) fail('confirm requires readOnly: false');
  }

  if (query.description && query.description.length > 200)
    fail('description is longer than 200 characters');
  if (query.readOnly === false && /^select\b/i.test(query.sql))
    fail('readOnly: false on a select');
}

const json = JSON.stringify({ queries: ADMIN_QUERIES }, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    // missing file is stale too
  }
  if (current !== json) {
    console.error('.bolt/admin.json is stale — run `npm run manifest`');
    process.exit(1);
  }
} else {
  writeFileSync(target, json);
  console.log(
    `wrote .bolt/admin.json (${Object.keys(ADMIN_QUERIES).length} queries)`
  );
}
