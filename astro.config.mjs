// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://syncra.ai.kr',
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
});
