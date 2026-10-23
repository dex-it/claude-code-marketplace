// Проверка собранного сайта (site/dist) без сети.
//
// 1. Каждая внутренняя ссылка и ассет (href, src, srcset) ведёт под базовый путь и
//    попадает в существующий файл; якоря (#...) находят свой id на целевой странице.
// 2. У каждой страницы есть canonical под адресом сайта.
// 3. Каталог полон: для каждого плагина из marketplace.json есть страница, лишних нет.
// 4. Индекс Pagefind собран и покрывает все страницы, кроме 404.
//
// Внешние ссылки (https://...) намеренно не ходят в сеть: проверка должна быть
// детерминированной и не падать от чужих сайтов.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const DIST = join(SITE_ROOT, 'dist');
const ORIGIN = 'https://dex-it.github.io';
const BASE = '/claude-code-marketplace';

const errors = [];
const err = (msg) => errors.push(msg);

if (!existsSync(DIST)) {
  console.error('check-dist: нет site/dist, сначала npm run build');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const rel = (f) => f.slice(DIST.length);

// ---------- ссылки и якоря ----------

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeURIComponent(m[1]))));
  }
  return idCache.get(file);
}

function resolveTarget(pathname) {
  // pathname уже без базового пути и без якоря
  const p = decodeURIComponent(pathname);
  const candidates = p.endsWith('/') ? [join(DIST, p, 'index.html')] : [join(DIST, p), join(DIST, p, 'index.html'), join(DIST, `${p}.html`)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

let linkCount = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const here = rel(file);
  const refs = [];
  for (const m of html.matchAll(/<(a|link|img|script|source|use)\b[^>]*>/g)) {
    const tag = m[0];
    for (const a of tag.matchAll(/\s(href|src|xlink:href)="([^"]*)"/g)) refs.push(a[2]);
    for (const a of tag.matchAll(/\ssrcset="([^"]*)"/g)) for (const part of a[1].split(',')) refs.push(part.trim().split(/\s+/)[0]);
  }
  for (let ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(ref)) continue;
    linkCount++;
    if (ref.startsWith('#')) {
      if (ref.length > 1 && ref !== '#_top' && !idsOf(file).has(decodeURIComponent(ref.slice(1)))) err(`${here}: якорь ${ref} не найден на странице`);
      continue;
    }
    if (ref.startsWith('//')) continue;
    // Относительные ссылки (hero главной) разрешаем от адреса страницы.
    const pageUrl = `${BASE}${here.replace(/index\.html$/, '')}`;
    if (!ref.startsWith('/')) ref = new URL(ref, `${ORIGIN}${pageUrl}`).pathname + (ref.includes('#') ? `#${ref.split('#')[1]}` : '');
    if (ref !== BASE && !ref.startsWith(`${BASE}/`) && !ref.startsWith(`${BASE}?`) && !ref.startsWith(`${BASE}#`)) {
      err(`${here}: ссылка ${ref} без базового пути ${BASE}`);
      continue;
    }
    const [noHash, hash] = ref.split('#');
    const pathname = noHash.split('?')[0].slice(BASE.length) || '/';
    const target = resolveTarget(pathname);
    if (!target) {
      err(`${here}: ${ref} -> файла нет в dist`);
      continue;
    }
    if (hash && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(hash))) err(`${here}: ${ref} -> якоря #${hash} нет на целевой странице`);
  }

  if (!/404\.html$/.test(here)) {
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!canon) err(`${here}: нет canonical`);
    else if (!canon[1].startsWith(`${ORIGIN}${BASE}/`)) err(`${here}: canonical ${canon[1]} вне ${ORIGIN}${BASE}/`);
  }
}

// ---------- полнота каталога ----------

const market = JSON.parse(readFileSync(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
const pluginDir = join(DIST, 'catalog', 'plugins');
const built = existsSync(pluginDir) ? readdirSync(pluginDir) : [];
const expected = market.plugins.map((p) => p.name);
for (const name of expected) if (!existsSync(join(pluginDir, name, 'index.html'))) err(`каталог: нет страницы плагина ${name}`);
for (const name of built) if (!expected.includes(name)) err(`каталог: страница ${name} есть, а плагина в marketplace.json нет`);

// Каждый плагин назван и на странице своего раздела (по ссылке на его страницу).
const sectionPages = ['bundles', 'skills', 'commands', 'utilities', 'mods'].map((p) => join(DIST, 'catalog', p, 'index.html'));
const specialistsDir = join(DIST, 'catalog', 'specialists');
if (existsSync(specialistsDir)) for (const d of readdirSync(specialistsDir)) if (existsSync(join(specialistsDir, d, 'index.html'))) sectionPages.push(join(specialistsDir, d, 'index.html'));
const sectionHtml = sectionPages.filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
for (const p of market.plugins) {
  if (p.category === 'bundle' || p.category === 'skill' || p.category === 'utility' || p.category === 'mod' || p.category === 'specialist') {
    if (!sectionHtml.includes(`${BASE}/catalog/plugins/${p.name}/`)) err(`каталог: ${p.name} не упомянут ни в одном разделе каталога`);
  }
}

// ---------- поиск ----------

const entryFile = join(DIST, 'pagefind', 'pagefind-entry.json');
if (!existsSync(entryFile) || !existsSync(join(DIST, 'pagefind', 'pagefind.js'))) {
  err('поиск: нет индекса Pagefind в dist/pagefind');
} else {
  const entry = JSON.parse(readFileSync(entryFile, 'utf8'));
  const langs = Object.keys(entry.languages ?? {});
  if (!langs.includes('ru')) err(`поиск: индекс не русский (языки: ${langs.join(', ') || 'нет'})`);
  const pages = Object.values(entry.languages ?? {}).reduce((n, l) => n + l.page_count, 0);
  const expectedPages = htmlFiles.filter((f) => !/404\.html$/.test(f)).length;
  if (pages !== expectedPages) err(`поиск: в индексе ${pages} страниц, в сборке ${expectedPages}`);
}
if (!files.some((f) => /sitemap-index\.xml$/.test(f))) err('нет sitemap-index.xml');

if (errors.length) {
  console.error(`check-dist: ошибок ${errors.length}`);
  for (const e of errors.slice(0, 80)) console.error(`  - ${e}`);
  if (errors.length > 80) console.error(`  ... и ещё ${errors.length - 80}`);
  process.exit(1);
}
console.log(`check-dist: страниц ${htmlFiles.length}, проверено ссылок и ассетов ${linkCount}, плагинов в каталоге ${expected.length} - ошибок нет`);
