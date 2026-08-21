/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** the project's Supabase URL — where the deck function lives */
  readonly VITE_SUPABASE_URL?: string;
  /** identifies the project. Worth nothing alone: the schema grants it nothing */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** the deck's editing key, defined only while the dev server is serving
      (vite.config.ts), so it is absent from every published build */
  readonly DECK_OWNER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
