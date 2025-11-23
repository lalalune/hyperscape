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

// Copy PhysX WASM files to assets/web/ for server-side loading
import fs from 'fs'
const assetsDir = path.join(rootDir, 'assets/web')
fs.mkdirSync(assetsDir, { recursive: true })

// Copy from physx-js-webidl package in workspace
const physxWasm = path.join(rootDir, '../physx-js-webidl/dist/physx-js-webidl.wasm')
const physxJs = path.join(rootDir, '../physx-js-webidl/dist/physx-js-webidl.js')

if (fs.existsSync(physxWasm)) {
  fs.copyFileSync(physxWasm, path.join(assetsDir, 'physx-js-webidl.wasm'))
  fs.copyFileSync(physxJs, path.join(assetsDir, 'physx-js-webidl.js'))
  console.log('✓ PhysX assets copied to assets/web/')
} else {
  console.error('❌ PhysX WASM not found at:', physxWasm)
  throw new Error('PhysX WASM files missing - ensure @hyperscape/physx-js-webidl is built first')
}

console.log('✓ Server built successfully')

