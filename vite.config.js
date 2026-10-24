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
} catch {
  // The custom dispatcher is an optional local-development optimisation.
}

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
          const width = Math.min(16000, Math.max(240, Number(params.get('width') || 843)));
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
        server.middlewares.use('/api/proxy-artwork', async (req, res) => {
          const params = new URL(req.url || '/', 'http://localhost').searchParams;
          const target = params.get('url');
          const allowedHosts = new Set([
            'bymuseum.com',
            'www.bymuseum.com',
            'openaccess-cdn.clevelandart.org',
            'parismuseescollections.paris.fr',
            'www.parismuseescollections.paris.fr',
          ]);
          let parsed;
          try {
            parsed = new URL(target || '');
          } catch {
            res.statusCode = 400;
            res.end('Invalid url parameter');
            return;
          }
          if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
            res.statusCode = 403;
            res.end('Host not allowed');
            return;
          }
          try {
            const upstream = await fetch(parsed.toString());
            res.statusCode = upstream.status;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(Buffer.from(await upstream.arrayBuffer()));
          } catch {
            res.statusCode = 502;
            res.end('Upstream fetch failed');
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
          // Vendor libraries barely change between deploys, but they were
          // landing in the app shell — so every app change forced a fresh
          // re-download of React, Firebase and the whole icon set. Split
          // out, they stay cached across deploys and load in parallel.
          const nodeModule = normalized.includes('/node_modules/')
            ? normalized.split('/node_modules/').pop()
            : '';
          if (nodeModule) {
            const pkg = nodeModule.split('/')[0];
            if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(pkg)) return 'vendor-react';
            if (pkg === 'firebase' || pkg === '@firebase') return 'vendor-firebase';
            if (pkg === 'lucide-react') return 'vendor-icons';
          }
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
    // src/services/firebase.js calls getAuth() at import time, which throws
    // auth/invalid-api-key when CI has no Firebase config. Placeholder values
    // let any test that imports it load; no test talks to a real project.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-test',
      VITE_FIREBASE_APP_ID: '1:1:web:1',
    },
    // firestore.rules tests need the emulator (see vitest.rules.config.js /
    // `npm run test:rules`) and would hang here without one running.
    // functions/ is its own package with its own emulator-backed test run
    // (`npm --prefix functions test`) — not part of this project's suite.
    exclude: [...configDefaults.exclude, 'src/test/firestore/**', 'functions/**', 'tests/e2e/**', '.claude/**'],
  },
})
