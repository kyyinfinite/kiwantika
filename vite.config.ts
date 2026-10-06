import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const publicRoutes = ['/', '/tentang', '/berita', '/kalender', '/galeri', '/daftarkiwantika']

function resolveSite(env: Record<string, string>) {
  const configured = env.VITE_PUBLIC_APP_URL?.trim()
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const raw = configured || (vercel ? `https://${vercel}` : '')
  return raw.replace(/\/+$/, '')
}

function seoPlugin(site: string): Plugin {
  return {
    name: 'kiwantika-seo',
    transformIndexHtml(html) {
      if (site) return html.replaceAll('__SITE_URL__', site)
      return html
        .replace(/\s*<link rel="canonical"[^>]*>/, '')
        .replace(/\s*<meta property="og:url"[^>]*>/, '')
        .replaceAll('__SITE_URL__', '')
    },
    generateBundle() {
      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /dashboard',
        'Disallow: /masuk',
        'Disallow: /absen/',
        ...(site ? ['', `Sitemap: ${site}/sitemap.xml`] : []),
      ].join('\n') + '\n'
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })

      if (!site) {
        console.warn('[kiwantika-seo] VITE_PUBLIC_APP_URL belum diisi: sitemap, canonical, dan og:url dilewati.')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const urls = publicRoutes.map(route => {
        const priority = route === '/' ? '1.0' : '0.7'
        return `  <url><loc>${site}${route}</loc><lastmod>${today}</lastmod><priority>${priority}</priority></url>`
      }).join('\n')
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const site = resolveSite(env)
  return {
    plugins: [react(), seoPlugin(site)],
    server: env.AI_DEV_PROXY
      ? {
          proxy: {
            '/api': {
              target: env.AI_DEV_PROXY,
              changeOrigin: true,
              configure: proxy => {
                proxy.on('proxyReq', (request: { setHeader: (name: string, value: string) => void }) => request.setHeader('origin', env.AI_DEV_PROXY))
              },
            },
          },
        }
      : undefined,
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('xlsx')) return 'vendor-xlsx'
            if (id.includes('gsap')) return 'vendor-gsap'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('qrcode')) return 'vendor-qrcode'
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
            return undefined
          },
        },
      },
    },
  }
})
