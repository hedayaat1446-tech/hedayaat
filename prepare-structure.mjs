import { mkdir, copyFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('./', import.meta.url);
const maps = [
  ['BaseLayout.astro', 'src/layouts/BaseLayout.astro'],
  ['index.astro', 'src/pages/index.astro'],
  ['thank.astro', 'src/pages/thank.astro'],
  ['site.json', 'src/content/site.json'],
  ['site.css', 'public/styles/site.css'],
  ['config.yml', 'public/admin/config.yml'],
  ['index.html', 'public/admin/index.html'],
  ['1.png', 'public/1.png'],
  ['2.png', 'public/2.png'],
  ['hero_image1.jpeg', 'public/hero_image1.jpeg'],
  ['favicon.ico', 'public/favicon.ico'],
  ['favicon.svg', 'public/favicon.svg'],
  ['logo1.png', 'public/logo1.png'],
  ['national-center-logo.png', 'public/national-center-logo.png'],
  ['OYMandisa.ttf', 'public/fonts/OYMandisa.ttf']
];

// Always rebuild src/public from the flat root files so stale GitHub folders cannot override the report design.
await rm(new URL('src/', root), { recursive: true, force: true });
await rm(new URL('public/', root), { recursive: true, force: true });

for (const [from, to] of maps) {
  const src = new URL(from, root);
  await access(src, constants.R_OK);
  const dst = new URL(to, root);
  const parent = new URL('./', dst);
  await mkdir(parent, { recursive: true });
  await copyFile(src, dst);
}

console.log('Prepared exact report structure.');
