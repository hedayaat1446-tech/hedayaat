// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    preview: {
      host: true,
      allowedHosts: ['hedayaat-production.up.railway.app']
    }
  }
});
