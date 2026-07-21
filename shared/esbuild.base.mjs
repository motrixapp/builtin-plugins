import { build } from 'esbuild'

// Shared build for all builtin plugins. NOTE: minifyWhitespace+minifySyntax
// only — full `minify` renames identifiers and breaks the host-side
// prepareBundle regex that rewrites `import ... from 'motrix:plugin-api'`.
export async function buildPlugin({ entry = 'src/index.ts' } = {}) {
  await build({
    entryPoints: [entry],
    outfile: 'dist/plugin.js',
    bundle: true,
    format: 'esm',
    target: 'es2020',
    platform: 'neutral',
    external: ['motrix:plugin-api'],
    minifyWhitespace: true,
    minifySyntax: true,
    treeShaking: true,
    legalComments: 'none',
    logLevel: 'info',
  })
}
