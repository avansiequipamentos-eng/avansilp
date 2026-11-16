import { copyFile, lstat, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const output = new URL('./dist/', import.meta.url);
const maxBytes = 25 * 1024 * 1024;
const entryFiles = [
  'index.html', 'styles.css', 'hero.css', 'app.js', 'content.js', 'hero.js',
  'robots.txt', 'sitemap.xml'
];
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const context = { window: {} };
runInNewContext(await readFile(new URL('./content.js', import.meta.url), 'utf8'), context);

const paths = new Set(entryFiles);
for (const [, path] of html.matchAll(/\b(?:href|src|poster)="(assets\/[^"]+)"/g)) {
  paths.add(path.split('?')[0]);
}
const canonical = new URL(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]);
const shareImage = new URL(html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]);
if (shareImage.origin !== canonical.origin) throw new Error('Imagem de compartilhamento fora do site');
paths.add(shareImage.pathname.slice(1));
for (const item of context.window.AVANSI_CONTENT.equipment) {
  for (const path of [item.image, item.hero?.image, item.hero?.poster, item.hero?.video,
    ...item.gallery.map(photo => photo.src)]) {
    if (path) paths.add(path.split('?')[0]);
  }
}

// Mantém o endereço de fallback do HTML, usando a cópia leve já aprovada para a web.
const sourceFor = new Map([['assets/videos/Aradinhoemacao.mp4', 'assets/videos/Aradinhoemacao-mobile.mp4']]);
const files = [];
for (const path of [...paths].sort()) {
  if (!entryFiles.includes(path) && (!/^assets\/(?:[\w .-]+\/)*[\w .-]+$/.test(path)
    || path.split('/').some(part => part === '.' || part === '..'))) {
    throw new Error(`Caminho não permitido no build: ${path}`);
  }
  const source = new URL(sourceFor.get(path) ?? path, import.meta.url);
  const { size } = await stat(source);
  if (size >= maxBytes) throw new Error(`${path} ultrapassa o limite de 25 MiB do projeto`);
  files.push({ path, source, size });
}

const existing = await lstat(output).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (existing) {
  const expected = resolve(await realpath(new URL('./', import.meta.url)), 'dist');
  if (!existing.isDirectory() || resolve(await realpath(output)) !== expected
    || resolve(fileURLToPath(output)) !== expected) throw new Error('Pasta dist inesperada');
  await rm(expected, { recursive: true });
}
for (const { path, source, size } of files) {
  const dest = new URL(path, output);
  await mkdir(new URL('./', dest), { recursive: true });
  await copyFile(source, dest);
  console.log(`${(size / 1024 / 1024).toFixed(2).padStart(6)} MiB  ${path}`);
}
console.log(`${files.length} arquivos em dist/.`);
