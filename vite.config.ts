import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Long-lived vendor chunks: an application release changes only the app chunks,
// so returning visitors keep these cached (the server marks /assets immutable).
const vendorChunks: [RegExp, string][] = [
  [/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, 'vendor-react'],
  [/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, 'vendor-motion'],
  [/[\\/]node_modules[\\/](socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io[\\/]component-emitter|xmlhttprequest-ssl)[\\/]/, 'vendor-socket'],
];

export default defineConfig(({mode}) => {
  const isVercelBuild = mode === 'vercel';
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      rollupOptions: {
        // Vercel serves this client from the serverless package. Keeping the
        // release in one module prevents a successful sign-in from depending on
        // a separately packaged lazy chunk. Local/standalone builds keep the
        // smaller cache-friendly chunks.
        output: isVercelBuild
          ? { inlineDynamicImports: true }
          : {
              manualChunks(id) {
                return vendorChunks.find(([pattern]) => pattern.test(id))?.[1];
              },
            },
      },
    },
    server: { host: '127.0.0.1' },
  };
});
