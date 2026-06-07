import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Build simples: apenas garante que index.html está no output
// As Pages Functions em functions/ cuidam das rotas /api/*
// Não geramos _worker.js para não interferir com as Pages Functions

const root = process.cwd()
const outDir = join(root, '.cf-static')

// Cloudflare Pages serve static files de "." (root)
// O index.html já está na raiz do repo — nenhum passo extra necessário

console.log('✅ Build complete — Cloudflare Pages will serve index.html + Pages Functions')
