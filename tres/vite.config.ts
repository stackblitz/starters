import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import glsl from 'vite-plugin-glsl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            (tag.startsWith('Tres') && tag !== 'TresCanvas') ||
            tag === 'primitive',
        },
      },
    }),
    glsl(),
  ],
});
