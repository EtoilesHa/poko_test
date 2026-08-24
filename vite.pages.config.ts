import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages publishes project sites under /<repository-name>/.
// Keep local previews at /, then use the repository prefix only in Actions.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/poko_test/' : '/',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: 'dist-pages',
    emptyOutDir: true,
  },
});
