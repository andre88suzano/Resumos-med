import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// 1. Run Next.js build
execSync('npm run build', { stdio: 'inherit' })

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
