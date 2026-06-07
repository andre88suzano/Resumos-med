import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// 1. Run Next.js build
try {
  execSync('npm run build', { stdio: 'inherit' })
} catch (e) {
  console.warn('⚠️  Next.js build failed — deploying index.html as static file only')
  process.exit(0)
}

// 2. Patch middleware-manifest.json
const manifestPath = join(root, '.next/server/middleware-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

if (!manifest.middleware?.['/']) {
  manifest.middleware = manifest.middleware ?? {}
  manifest.middleware['/'] = {
    files: [], name: 'middleware', page: '/',
    matchers: [{ regexp: '^/(?!_next/static|_next/image|favicon\\.ico|api).*' }],
    wasm: [], assets: [], regions: 'auto',
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✓ Patched middleware-manifest.json')
}

// 3. Run opennextjs build
execSync('npx opennextjs-cloudflare build --skipNextBuild', { stdio: 'inherit' })

const openNextDir = join(root, '.open-next')

// 4. Rename worker.js → _worker.js inside .open-next
const workerSrc = join(openNextDir, 'worker.js')
const workerDst = join(openNextDir, '_worker.js')
if (existsSync(workerSrc)) {
  renameSync(workerSrc, workerDst)
  console.log('✓ Renamed worker.js → _worker.js')
}

// 5. Copy index.html into .open-next
const indexSrc = join(root, 'index.html')
const indexDst = join(openNextDir, 'index.html')
if (existsSync(indexSrc)) {
  copyFileSync(indexSrc, indexDst)
  console.log('✓ Copied index.html → .open-next/index.html')
}

// 6. Create _routes.json so Cloudflare knows which paths go to the worker
//    and which serve static files (index.html)
const routes = {
  version: 1,
  description: 'Route Next.js app paths to worker, serve index.html for root',
  include: [
    '/admin/*', '/api/*', '/dashboard/*', '/login/*', '/register/*',
    '/resumos/*', '/comprar/*', '/obrigado/*', '/pending/*', '/_next/*'
  ],
  exclude: ['/', '/index.html'],
}
writeFileSync(join(openNextDir, '_routes.json'), JSON.stringify(routes, null, 2))
console.log('✓ Created _routes.json')

console.log('✅ Build complete — ready for Cloudflare Pages deployment')
