import type { Config } from '@react-router/dev/config';

/**
 * SPA mode: Bolt publishes the static `build/client` directory, so there is no
 * runtime server. Data is loaded in `clientLoader`s against Supabase.
 *
 * Stretch: add `prerender` (querying published slugs from Supabase at build
 * time) for crawler-ready HTML. See README "Pre-rendering".
 */
export default {
  ssr: false,
  appDirectory: 'app',
} satisfies Config;
