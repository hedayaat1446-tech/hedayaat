// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    preview: {
      allowedHosts: ['hedayaat-production.up.railway.app']
    }
  }
});
