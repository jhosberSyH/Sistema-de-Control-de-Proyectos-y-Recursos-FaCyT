/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' enciende los datos ficticios de src/testing/mocks (ver plan_frontend.md §3). */
  readonly VITE_ENABLE_API_MOCKING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
