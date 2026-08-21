import { defineConfig } from 'tsdown'

/** Specifiers answered by the DSH browser module table (kept as require calls). */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
]

export default defineConfig([
  {
    name: 'dsh-websearch-custom/host',
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'node',
    dts: true,
    external: [/^@deepseek-ai\//u],
    outDir: 'dist',
  },
  {
    name: 'dsh-websearch-custom/client',
    entry: { client: 'lib/types/client/index.js' },
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    outDir: 'dist',
    external: CLIENT_EXTERNALS,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-websearch-custom", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
