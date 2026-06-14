import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { beasties } from 'vite-plugin-beasties'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Dev-only: load .env.local into process.env so the API middleware can read
// the non-VITE_ vars (Vite only exposes VITE_ prefixed vars to the client).
// Ignored in production builds via `apply: 'serve'` on the plugin below.
function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
  }
}

// Dev-only plugin: serve api/*.js files locally without vercel dev.
// Handles Edge-runtime handlers (fetch-style Request/Response) — Node 18+ has
// everything we need (Request, Response, fetch) built in.
function localApiPlugin() {
  loadEnvLocal()
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const match = req.url.match(/^\/api\/([^?]+)/)
        const name = match?.[1]
        if (!name) return next()

        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          const handler = mod.default
          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.end(JSON.stringify({ error: `no default export in /api/${name}.js` }))
            return
          }

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = chunks.length ? Buffer.concat(chunks) : null

          const url = `http://${req.headers.host || 'localhost:5173'}${req.url}`
          const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: body && req.method !== 'GET' && req.method !== 'HEAD'
              ? new Uint8Array(body)
              : undefined,
            duplex: 'half',
          })

          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          console.error(`[local-api] /api/${name} error:`, e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'dev middleware error', message: String(e?.message || e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localApiPlugin(),
    beasties({
      options: {
        preload: 'swap',
        // pruneSource races Vite's asset emit — inlined critical CSS is enough.
        pruneSource: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  build: {
    // Ship source maps so Lighthouse "valid-source-maps" passes and prod
    // errors stay debuggable. Maps emit as separate .map files — browsers
    // only fetch them when devtools is open, so no user-facing payload cost.
    sourcemap: true,
    // Modern baseline: skips esbuild's legacy down-level transforms/helpers
    // (Lighthouse "legacy JavaScript"). Safe for the evergreen browsers the
    // app targets (macOS Safari/Chrome).
    target: 'es2022',
  },
})
