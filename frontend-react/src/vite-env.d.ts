/// <reference types="vite/client" />
declare const __BUILD_SHA__: string

interface ImportMetaEnv {
  readonly VITE_AG_GRID_LICENSE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
