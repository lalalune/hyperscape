import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '../')

// Note: Model bounds extraction is handled by turbo task `extract-bounds`
// which runs before this build script with proper caching based on GLB file changes.
// See turbo.json: server#extract-bounds

// Build the server
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
  external: ['@hyperforge/shared'],
  target: 'node22',
  loader: {
    '.ts': 'ts',
  },
})

await serverCtx.rebuild()
await serverCtx.dispose()

// Build the agent behavior worker as a separate file (loaded by worker_threads)
const workerCtx = await esbuild.context({
  entryPoints: ['src/eliza/worker/agentBehaviorWorker.ts'],
  outfile: 'dist/agentBehaviorWorker.js',
  platform: 'node',
  format: 'esm',
  bundle: true,
  treeShaking: true,
  minify: false,
  sourcemap: true,
  packages: 'external',
  external: ['@hyperforge/shared'],
  target: 'node22',
  loader: {
    '.ts': 'ts',
  },
})

await workerCtx.rebuild()
await workerCtx.dispose()
console.log('✓ Agent behavior worker built')

// Copy PhysX WASM files to assets/web/ for server-side loading
import fs from 'fs'
const assetsDir = path.join(rootDir, 'world/assets/web')
fs.mkdirSync(assetsDir, { recursive: true })

// Copy from physx-js-webidl package in workspace
const physxWasm = path.join(rootDir, '../physx-js-webidl/dist/physx-js-webidl.wasm')
const physxJs = path.join(rootDir, '../physx-js-webidl/dist/physx-js-webidl.js')

if (fs.existsSync(physxWasm)) {
  fs.copyFileSync(physxWasm, path.join(assetsDir, 'physx-js-webidl.wasm'))
  fs.copyFileSync(physxJs, path.join(assetsDir, 'physx-js-webidl.js'))
  console.log('✓ PhysX assets copied to world/assets/web/')
} else {
  console.error('❌ PhysX WASM not found at:', physxWasm)
  throw new Error('PhysX WASM files missing - ensure @hyperforge/physx-js-webidl is built first')
}

console.log('✓ Server built successfully')

