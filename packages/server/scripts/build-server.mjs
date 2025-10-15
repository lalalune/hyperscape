import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '../')

const serverCtx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  platform: 'node',
  format: 'esm',
  bundle: true,
  treeShaking: true,
  minify: false,
  sourcemap: true,
  packages: 'external',
  external: ['@hyperscape/shared'],
  target: 'node22',
  loader: {
    '.ts': 'ts',
  },
})

await serverCtx.rebuild()
await serverCtx.dispose()
console.log('✓ Server built successfully')

