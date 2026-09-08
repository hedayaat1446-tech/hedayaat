import { mkdir, copyFile, access, rm, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// The repository is intentionally flat for easy GitHub upload.
// Before every Astro build we recreate the exact runtime structure required by the project report.
await rm(path.join(root, 'src'), { recursive: true, force: true });
await rm(path.join(root, 'public'), { recursive: true, force: true });

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
  ['identity-lockup.png', 'public/identity-lockup.png'],
  ['identity-photo-layout.jpg', 'public/identity-photo-layout.jpg'],
  ['logo1.png', 'public/logo1.png'],
  ['logo-black.png', 'public/logo-black.png'],
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

async function copyTree(fromDir, toDir) {
  try {
    const entries = await readdir(fromDir, { withFileTypes: true });
    await mkdir(toDir, { recursive: true });
    for (const entry of entries) {
      const from = path.join(fromDir, entry.name);
      const to = path.join(toDir, entry.name);
      if (entry.isDirectory()) await copyTree(from, to);
      else if (entry.isFile()) await copyFile(from, to);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

// Decap CMS stores uploaded PDFs/images in root /uploads in the flat repository.
// Copy them to public/uploads so /uploads/... URLs work in the built site.
await copyTree(path.join(root, 'uploads'), path.join(root, 'public', 'uploads'));

console.log('Hedayaat project structure prepared for Astro build.');
