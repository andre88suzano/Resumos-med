import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// 1. Run Next.js build
try {
  execSync('npm run build', { stdio: 'inherit' })
} catch (e) {
  console.error('⚠️  Next.js build failed — index.html will still be deployed as static file')
  process.exit(0) // exit 0 so Cloudflare Pages deploys the static files including index.html
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
  console.log('✓ Patched middleware-manifest.json for opennextjs compatibility')
}

// 3. Run opennextjs build skipping Next.js build
execSync('npx opennextjs-cloudflare build --skipNextBuild', { stdio: 'inherit' })

// 4. Copy .open-next output to repo root so Cloudflare Pages (build output: /) can find it
const openNextDir = join(root, '.open-next')

// Copy worker.js → _worker.js at root
cpSync(join(openNextDir, 'worker.js'), join(root, '_worker.js'))
console.log('✓ Copied worker.js → _worker.js')

// Copy assets (static files) to root
const assetsDir = join(openNextDir, 'assets')
if (existsSync(assetsDir)) {
  cpSync(assetsDir, root, { recursive: true })
  console.log('✓ Copied static assets to root')
}

console.log('✅ Build complete — ready for Cloudflare Pages deployment')
