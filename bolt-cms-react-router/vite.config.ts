import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { cmsDevServer } from './dev/cms-dev-server.ts';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), cmsDevServer()],
  resolve: {
    tsconfigPaths: true,
  },
});
