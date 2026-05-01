/// <reference types="vitest" />
import { defineConfig } from 'vite'
import type { Connect } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { randomBytes } from 'node:crypto'

// One-time nonce generated at dev-server startup.
// Vite injects this into every <script> tag it generates (via html.cspNonce below),
// which lets script-src use 'nonce-...' instead of 'unsafe-inline'.
// This nonce rotates on every server restart, limiting its exposure window.
const DEV_NONCE = randomBytes(16).toString('base64url')

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src 'self' 'nonce-${DEV_NONCE}'`,
    "style-src 'self' 'unsafe-inline'",
    // Specific domains only — no scheme-level wildcards (ZAP: Wildcard Directive)
    // CARTO tiles: https://{s}.basemaps.cartocdn.com
    // QR codes are rendered locally with qrcode.react (security review F-C1)
    "img-src 'self' data: blob: https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com https://c.basemaps.cartocdn.com https://d.basemaps.cartocdn.com",
    // Fonts served from own origin only (no external CDN after removing Google Fonts link)
    "font-src 'self'",
    // ws://localhost:3000 needed for Vite HMR WebSocket (dynamic port via env)
    // 'self' for @vite/client HMR connection
    "connect-src 'self' http://localhost:8000 ws://localhost:3000 ws://localhost:3001 ws://localhost:5173 blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Allow Vite's module loading in development
    "worker-src 'self' blob:"
  ].join('; '),

  /**
   * X-Frame-Options
   * Prevents clickjacking attacks by blocking iframe embedding
   * @see https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html
   */
  'X-Frame-Options': 'DENY',

  /**
   * X-Content-Type-Options
   * Prevents MIME-type sniffing attacks
   * @see https://cheatsheetseries.owasp.org/cheatsheets/Secure_Headers_Cheat_Sheet.html
   */
  'X-Content-Type-Options': 'nosniff',

  /**
   * Strict-Transport-Security (HSTS)
   * Forces HTTPS connections (effective when behind HTTPS proxy)
   */
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  /**
   * Referrer-Policy
   * Controls referrer information sent with requests
   */
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  /**
   * Permissions-Policy (formerly Feature-Policy)
   * Disables unused browser features to reduce attack surface
   */
  // geolocation=(self) — first-party only; required for the SPA's
  // location-tracking feature (App.jsx#updateGeofence) which posts the
  // user's coords to /api/location-audience/geofence/update. Empty
  // parens "geolocation=()" would block first-party use too.
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=(self)',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '),

  /**
   * Cache-Control
   * Prevents caching of sensitive development responses
   */
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',

  /**
   * X-DNS-Prefetch-Control
   * Disables DNS prefetching for privacy
   */
  'X-DNS-Prefetch-Control': 'off',

  /**
   * X-Download-Options
   * Prevents IE from executing downloaded files
   */
  'X-Download-Options': 'noopen',

  /**
   * X-Permitted-Cross-Domain-Policies
   * Restricts Adobe Flash cross-domain policies
   */
  'X-Permitted-Cross-Domain-Policies': 'none',

  /**
   * Cross-Origin Headers
   * Note: COEP/COOP are disabled in development as they require all resources
   * (including third-party scripts, images, fonts) to be served with proper
   * CORS headers. Enable these in production after ensuring all resources comply.
   */
  // 'Cross-Origin-Opener-Policy': 'same-origin',
  // 'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin'
}

/**
 * =============================================================================
 * Blocked Paths Configuration
 * =============================================================================
 * These paths are blocked to prevent information disclosure and attacks.
 * Note: node_modules is NOT blocked here as Vite needs to serve dependencies
 * during development. Instead, we block specific sensitive patterns within it.
 */
const BLOCKED_PATHS = [
  // Version control
  '/.git',
  '/.git/',
  '/.git/config',
  '/.git/HEAD',
  '/.gitignore',
  '/.svn',
  '/.hg',

  // Environment and configuration
  '/.env',
  '/.env.local',
  '/.env.development',
  '/.env.production',
  '/.env.*',

  // IDE and editor files
  '/.vscode',
  '/.vscode/',
  '/.idea',
  '/.idea/',
  '/.DS_Store',
  '/Thumbs.db',

  // Package and dependency files (block specific files, not entire node_modules)
  '/package.json',
  '/package-lock.json',
  '/yarn.lock',
  '/pnpm-lock.yaml',

  // Build and config files
  '/vite.config.js',
  '/vite.config.ts',
  '/tsconfig.json',
  '/.babelrc',
  '/.eslintrc',
  '/.prettierrc',
  '/webpack.config.js',

  // Docker and deployment
  '/Dockerfile',
  '/docker-compose.yml',
  '/docker-compose.yaml',
  '/.dockerignore',
  '/nginx.conf',
  '/.htaccess',
  '/web.config',

  // Cloud and secrets
  '/.aws',
  '/.azure',
  '/.gcp',
  '/.netlify',
  '/.vercel',

  // Other sensitive
  '/server-status',
  '/server-info',
  '/phpinfo.php',
  '/info.php',
  '/wp-config.php',
  '/config.php',
  '/.well-known'
]

/**
 * =============================================================================
 * Blocked Path Patterns (Regex)
 * =============================================================================
 * These patterns block specific sensitive paths within allowed directories.
 * Note: node_modules is generally allowed for Vite to serve dependencies,
 * but we block sensitive files that might exist anywhere in the project.
 */
const BLOCKED_PATH_PATTERNS = [
  // Block sensitive files anywhere in the project
  /\.env(\..+)?$/,                    // .env files
  /\.git(\/.*)?$/,                    // .git directory and contents
  /\/\.DS_Store$/,                    // macOS metadata
  /\/Thumbs\.db$/,                    // Windows thumbnail cache
  /\/package\.json$/,                 // package.json
  /\/package-lock\.json$/,            // lock files
  /\/yarn\.lock$/,
  /\/pnpm-lock\.yaml$/,
]

/**
 * =============================================================================
 * Security Middleware Factory
 * =============================================================================
 * Creates Connect middleware that applies security headers and blocks
 * sensitive paths for the Vite dev server.
 */
function createSecurityMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const rawUrl = req.url || ''
    const urlPath = rawUrl.split('?')[0] || ''

    // =======================================================================
    // Step 1: Apply security headers to EVERY response — including Vite
    // internal paths (/@vite/client, /@react-refresh, /node_modules/.vite/*)
    // and all early-exit 403/400 responses.
    // =======================================================================
    Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
      res.setHeader(header, value)
    })

    // =======================================================================
    // Step 2: Attack pattern detection on the FULL raw URL (path + query).
    // Must run BEFORE the Vite internal path skip — ZAP injects payloads into
    // the ?v= cache-buster parameter on /node_modules/.vite/deps/*.js requests,
    // which would otherwise bypass all checks via the skip below.
    //
    // Attack types detected here (observed in ZAP ajax_spider scan):
    //   • Path traversal       — ../  ..\
    //   • Null byte injection  — %00  \0
    //   • HTTP response split  — %0a  %0d  \r  \n  (raw or encoded newlines)
    //   • SSTI / template inj  — #set(  ${  (Velocity, Freemarker, etc.)
    //   • Format string        — %n%s  %1!s  (Java / Win printf injection)
    //   • Spring4Shell probe   — class.module.classLoader
    // =======================================================================
    const lowerRaw = rawUrl.toLowerCase()

    if (lowerRaw.includes('../') || lowerRaw.includes('..\\')) {
      console.warn(`[SECURITY] Blocked path traversal attempt: ${rawUrl}`)
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain')
      res.end('Bad Request: Path traversal detected')
      return
    }

    if (lowerRaw.includes('%00') || rawUrl.includes('\0')) {
      console.warn(`[SECURITY] Blocked null byte injection attempt: ${rawUrl}`)
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain')
      res.end('Bad Request: Invalid characters detected')
      return
    }

    // HTTP response splitting — newlines injected into query params turn a
    // single response into two, letting an attacker plant arbitrary headers
    // (e.g. Set-Cookie) in the second response. Block %0a/%0d and literal CR/LF.
    if (lowerRaw.includes('%0a') || lowerRaw.includes('%0d') ||
        rawUrl.includes('\r') || rawUrl.includes('\n')) {
      console.warn(`[SECURITY] Blocked HTTP response splitting attempt: ${rawUrl}`)
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain')
      res.end('Bad Request: Invalid characters in request')
      return
    }

    // Server-side template injection — Velocity (#set), generic ${...} expressions
    if (lowerRaw.includes('%23set(') || lowerRaw.includes('#set(') ||
        lowerRaw.includes('${') || lowerRaw.includes('%24{')) {
      console.warn(`[SECURITY] Blocked template injection attempt: ${rawUrl}`)
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain')
      res.end('Bad Request: Invalid request')
      return
    }

    // Format string injection — Java %n/%s sequences and Windows %1!s! printf format
    if (/%[0-9]*n|%[0-9]+!s/i.test(rawUrl)) {
      console.warn(`[SECURITY] Blocked format string injection attempt: ${rawUrl}`)
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain')
      res.end('Bad Request: Invalid request')
      return
    }

    // Spring4Shell / Java classloader probe
    if (lowerRaw.includes('class.module.classloader') ||
        lowerRaw.includes('class%2emodule%2eclassloader')) {
      console.warn(`[SECURITY] Blocked classloader probe attempt: ${rawUrl}`)
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain')
      res.end('Bad Request: Invalid request')
      return
    }

    // =======================================================================
    // Step 3: Skip sensitive-path blocking for Vite internal endpoints.
    // Attack patterns were already checked above; this skip is only to avoid
    // false-positive 403s on Vite's own module-serving paths.
    // =======================================================================
    const viteInternalPaths = [
      '/@vite',
      '/@react-refresh',
      '/node_modules/.vite',
      '/__vite_ping',
      '/__vite_error',
      '/__vite_test'
    ]

    if (viteInternalPaths.some(p => urlPath.startsWith(p))) {
      return next()
    }

    // =======================================================================
    // Step 4: Block access to sensitive paths (explicit list)
    // =======================================================================
    const isBlocked = BLOCKED_PATHS.some(blockedPath => {
      return urlPath === blockedPath ||
             urlPath.startsWith(blockedPath + '/') ||
             (blockedPath.endsWith('*') && urlPath.startsWith(blockedPath.slice(0, -1)))
    })

    if (isBlocked) {
      console.warn(`[SECURITY] Blocked access to sensitive path: ${urlPath}`)
      res.statusCode = 403
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: 'Forbidden',
        message: 'Access to this resource is denied for security reasons',
      }))
      return
    }

    // =======================================================================
    // Step 5: Block access to sensitive path patterns (regex matching)
    // =======================================================================
    for (const pattern of BLOCKED_PATH_PATTERNS) {
      if (pattern.test(urlPath)) {
        console.warn(`[SECURITY] Blocked access matching pattern ${pattern}: ${urlPath}`)
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          error: 'Forbidden',
          message: 'Access to this resource is denied for security reasons',
          timestamp: new Date().toISOString()
        }))
        return
      }
    }

    next()
  }
}

/**
 * =============================================================================
 * Security Middleware Plugin
 * =============================================================================
 * Registers the security middleware via Vite's configureServer plugin API.
 * We apply security headers only to the main app routes, not to Vite's
 * internal endpoints which need to be handled by Vite's own middleware.
 */
function securityPlugin() {
  return {
    name: 'security-headers',
    configureServer(server) {
      // Apply security middleware only to app routes (not Vite internals)
      // This ensures Vite endpoints (/@vite/client, /node_modules/.vite/*, etc.)
      // are handled by Vite's built-in middleware without interference
      server.middlewares.use('/', createSecurityMiddleware())
    },
  }
}

/**
 * =============================================================================
 * Vite Configuration
 * =============================================================================
 */
export default defineConfig({
  plugins: [react(), securityPlugin()],

  // Inject the same nonce into every <script> tag Vite generates (entry module,
  // React Fast Refresh preamble, etc.) so script-src can use the nonce instead
  // of 'unsafe-inline'.  The value must match the one in SECURITY_HEADERS above.
  html: {
    cspNonce: DEV_NONCE,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: 'localhost', // Restrict to localhost only — prevents external network scanning

    /**
     * File system access restrictions
     * Prevents Vite from serving files outside the project root.
     * '.' = project root only (not parent directories).
     * Note: We allow node_modules/.vite/deps for Vite's pre-bundled dependencies.
     */
    fs: {
      strict: true,
      allow: ['.', './node_modules/.vite/deps'],
      deny: ['.git', '.env', '.env.*', '.idea', '.vscode'],
    },

    /**
     * Proxy configuration for API requests
     * Forwards requests to FastAPI backend
     */
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,

        // Forward cookies securely
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers.cookie
            if (cookie) {
              proxyReq.setHeader('Cookie', cookie)
            }
          })
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            const setCookie = proxyRes.headers['set-cookie']
            if (setCookie) {
              res.setHeader('set-cookie', setCookie)
            }
          })
        },
      },
    },
  },

  /**
   * Build configuration for production
   */
  build: {
    // Disable sourcemaps in production for security
    sourcemap: false,

    // Minification with Terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },

    // Output file naming with content hashes
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Chunk size warning limit
    chunkSizeWarningLimit: 500,
  },

  /**
   * Test configuration
   */
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/tests/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ]
    }
  },
})
