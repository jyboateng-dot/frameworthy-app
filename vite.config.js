import { defineConfig, loadEnv } from 'vite'
import museumFeeds from './functions/museumFeeds.js'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { setGlobalDispatcher, Agent } from 'undici'
import dns from 'node:dns'

try {
  setGlobalDispatcher(new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        if (hostname === 'api.si.edu') {
          return options?.all
            ? callback(null, [{ address: '40.39.53.91', family: 4 }])
            : callback(null, '40.39.53.91', 4);
        }
        dns.lookup(hostname, options, callback);
      },
    },
  }));
} catch {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'art-institute-image-relay',
      configureServer(server) {
        server.middlewares.use('/api/museum-artworks', async (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
          const params = new URL(req.url || '/', 'http://localhost').searchParams;
          res.setHeader('Content-Type', 'application/json');
          try {
            const env = { ...loadEnv(server.config.mode, server.config.root, ''), ...process.env };
            const data = await museumFeeds.museumFeed(params.get('source'), Number(params.get('page') || 1), env);
            res.end(JSON.stringify(data));
          } catch (error) {
            res.statusCode = error.status || 502;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        server.middlewares.use('/api/archival-artworks', async (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
          const params = new URL(req.url || '/', 'http://localhost').searchParams;
          res.setHeader('Content-Type', 'application/json');
          try {
            const env = { ...loadEnv(server.config.mode, server.config.root, ''), ...process.env };
            const data = await museumFeeds.archivalFeed(params.get('source'), Number(params.get('page') || 1), env);
            res.end(JSON.stringify(data));
          } catch (error) {
            res.statusCode = error.status || 502;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        server.middlewares.use('/api/artic-image', async (req, res) => {
          const params = new URL(req.url || '/', 'http://localhost').searchParams;
          const imageId = params.get('id');
          const width = Math.min(2400, Math.max(240, Number(params.get('width') || 843)));
          if (!/^[a-f0-9-]{20,}$/i.test(imageId || '')) {
            res.statusCode = 400;
            res.end('Invalid Art Institute image id');
            return;
          }
          try {
            const upstream = await fetch(`https://www.artic.edu/iiif/2/${imageId}/full/${width},/0/default.jpg`, {
              headers: { 'User-Agent': 'FrameWorthy/1.0', Referer: 'https://www.artic.edu/' },
            });
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(Buffer.from(await upstream.arrayBuffer()));
          } catch {
            res.statusCode = 502;
            res.end('Art Institute image fetch failed');
          }
        });
      },
    },
  ],
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    // FrameWorthy intentionally ships several large, static catalogue datasets
    // (album artwork, Met archive, movie posters, and frame-strip metadata).
    // Keep them out of route UI chunks so they cache independently and so a
    // change to one catalogue doesn't invalidate the whole app shell.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/src/data/albumsLocal.js')) return 'catalog-albums';
          if (normalized.includes('/src/data/metLocal.js')) return 'catalog-met';
          if (normalized.includes('/src/data/moviesLocal.js')) return 'catalog-movies';
          if (normalized.includes('/src/data/web_met_dims.json')) return 'catalog-met-dimensions';
          if (normalized.includes('/src/data/source_dims.json')) return 'catalog-source-dimensions';
          if (normalized.includes('/src/data/frameStrips.json')) return 'catalog-frame-strips';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // firestore.rules tests need the emulator (see vitest.rules.config.js /
    // `npm run test:rules`) and would hang here without one running.
    // functions/ is its own package with its own emulator-backed test run
    // (`npm --prefix functions test`) — not part of this project's suite.
    exclude: [...configDefaults.exclude, 'src/test/firestore/**', 'functions/**', 'tests/e2e/**', '.claude/**'],
  },
})
