/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTALS_BASE_URL: string;
  readonly VITE_PORTALS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 