import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// 1. Run Next.js build
try {
  execSync('npm run build', { stdio: 'inherit' })
} catch (e) {
  console.warn('⚠️  Next.js build failed — deploying index.html as static file only')
  process.exit(0)
}

// 2. Patch middleware-manifest.json so opennextjs thinks there's an edge middleware
const manifestPath = join(root, '.next/server/middleware-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

if (!manifest.middleware?.['/']) {
  manifest.middleware = manifest.middleware ?? {}
  manifest.middleware['/'] = {
    files: [],
    name: 'middleware',
    page: '/',
    matchers: [{ regexp: '^/(?!_next/static|_next/image|favicon\\.ico|api).*' }],
    wasm: [],
    assets: [],
    regions: 'auto',
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✓ Patched middleware-manifest.json')
}

// 3. Run opennextjs build
execSync('npx opennextjs-cloudflare build --skipNextBuild', { stdio: 'inherit' })

// 4. Rename worker.js → _worker.js INSIDE .open-next
//    (relative imports in worker.js point to other files inside .open-next)
const openNextDir = join(root, '.open-next')
const workerSrc = join(openNextDir, 'worker.js')
const workerDst = join(openNextDir, '_worker.js')

if (existsSync(workerSrc)) {
  renameSync(workerSrc, workerDst)
  console.log('✓ Renamed .open-next/worker.js → .open-next/_worker.js')
}

// 5. Also copy index.html into .open-next so it gets deployed as static file
const { copyFileSync } = await import('node:fs')
const indexSrc = join(root, 'index.html')
const indexDst = join(openNextDir, 'index.html')
if (existsSync(indexSrc)) {
  copyFileSync(indexSrc, indexDst)
  console.log('✓ Copied index.html → .open-next/index.html')
}

console.log('✅ Build complete — ready for Cloudflare Pages deployment')
