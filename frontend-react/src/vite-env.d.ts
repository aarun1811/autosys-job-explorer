/// <reference types="vite/client" />
declare const __BUILD_SHA__: string

interface ImportMetaEnv {
  readonly VITE_AG_GRID_LICENSE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Fontsource packages are CSS side-effect imports with no JS/types entry point.
declare module '@fontsource-variable/geist'
declare module '@fontsource-variable/geist-mono'
