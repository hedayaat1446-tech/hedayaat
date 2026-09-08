import { mkdir, copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const mappings = [
  ['BaseLayout.astro', 'src/layouts/BaseLayout.astro'],
  ['index.astro', 'src/pages/index.astro'],
  ['thank.astro', 'src/pages/thank.astro'],
  ['site.json', 'src/content/site.json'],
  ['site.css', 'public/styles/site.css'],
  ['config.yml', 'public/admin/config.yml'],
  ['index.html', 'public/admin/index.html'],
  ['1.png', 'public/1.png'],
  ['2.png', 'public/2.png'],
  ['favicon.ico', 'public/favicon.ico'],
  ['favicon.svg', 'public/favicon.svg'],
  ['hero_image1.jpeg', 'public/hero_image1.jpeg'],
  ['identity-corner.png', 'public/identity-corner.png'],
  ['identity-grid.png', 'public/identity-grid.png'],
  ['logo1.png', 'public/logo1.png'],
  ['national-center-logo.png', 'public/national-center-logo.png'],
];

for (const [from, to] of mappings) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  try {
    await access(src, constants.R_OK);
  } catch {
    throw new Error(`Missing required project file: ${from}`);
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

console.log('Hedayaat project structure prepared for Astro build.');
