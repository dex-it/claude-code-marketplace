import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import { defineMdastPlugin } from 'satteri';
import { fileURLToPath } from 'node:url';

import { ORIGIN as SITE, BASE, REPO, BRAND, DESCRIPTION } from './site.config.mjs';

const siteRoot = fileURLToPath(new URL('./', import.meta.url));
const siteSrc = fileURLToPath(new URL('./src/', import.meta.url));
const guideRoot = fileURLToPath(new URL('../docs/guide/', import.meta.url));

// Страницы docs/guide лежат вне проекта, и Node-разрешение от них идёт вверх по
// репозиторию, а не в site/node_modules. Голые импорты из них (компоненты Starlight
// в .mdx) разрешаем так, будто файл лежит в site/.
const resolveFromSite = {
  name: 'guide-bare-imports',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !importer.startsWith(guideRoot)) return null;
    if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
    return this.resolve(source, `${siteRoot}package.json`, { ...options, skipSelf: true });
  },
};

// Astro не добавляет base к корневым ссылкам в Markdown. Авторы пишут `/start/install/`,
// плагин дописывает `/claude-code-marketplace` ко всем таким ссылкам и картинкам.
const withBase = (url) =>
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && url !== BASE && !url.startsWith(`${BASE}/`)
    ? `${BASE}${url}`
    : url;
const baseLinks = defineMdastPlugin({
  name: 'base-links',
  link(node, ctx) {
    ctx.setProperty(node, 'url', withBase(node.url));
  },
  image(node, ctx) {
    ctx.setProperty(node, 'url', withBase(node.url));
  },
});

const ogImage = `${SITE}${BASE}/og.png`;

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  markdown: { processor: satteri({ mdastPlugins: [baseLinks] }) },
  vite: { plugins: [resolveFromSite], resolve: { alias: { '@site': siteSrc } } },
  integrations: [
    starlight({
      title: BRAND,
      description: DESCRIPTION,
      defaultLocale: 'root',
      locales: { root: { label: 'Русский', lang: 'ru' } },
      logo: {
        light: './src/generated/brand/dexaikit-banner-light.svg',
        dark: './src/generated/brand/dexaikit-banner-dark.svg',
        alt: BRAND,
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/develop/site/` },
      customCss: ['./src/styles/theme.css'],
      lastUpdated: false,
      // Страницы лежат вне src/content/docs: без этого Starlight не обработает в них
      // врезки (:::tip) и ссылки у заголовков.
      markdown: { processedDirs: ['../docs/guide', './src/generated'] },
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: ogImage } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: `${BRAND}: набор для агентной разработки в Claude Code` } },
        { tag: 'meta', attrs: { property: 'og:locale', content: 'ru_RU' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#16151D' } },
      ],
      sidebar: [
        {
          label: 'Начать',
          items: ['start', 'start/requirements', 'start/install', 'start/first-run', 'start/update-remove'],
        },
        {
          label: 'Сценарии',
          collapsed: true,
          items: [
            { slug: 'scenarios', label: 'Все сценарии' },
            'scenarios/review-before-push',
            'scenarios/review-others',
            'scenarios/handle-review',
            'scenarios/find-bug',
            'scenarios/incident',
            'scenarios/requirements',
            'scenarios/design',
            'scenarios/implement',
            'scenarios/auto',
            'scenarios/diagnostics',
          ],
        },
        {
          label: 'Каталог',
          items: [
            { slug: 'catalog', label: 'Обзор' },
            'catalog/bundles',
            { label: 'Специалисты', collapsed: true, items: [{ autogenerate: { directory: 'catalog/specialists' } }] },
            'catalog/skills',
            'catalog/commands',
            'catalog/utilities',
            'catalog/mods',
          ],
        },
        {
          label: 'Как это устроено',
          items: [
            { slug: 'concepts', label: 'Обзор' },
            'concepts/skills',
            'concepts/specialists',
            'concepts/commands',
            'concepts/bundles',
            'concepts/auto',
            'concepts/mods',
            'concepts/loading',
          ],
        },
        {
          label: 'Участие',
          items: [
            'contributing',
            'contributing/add-plugin',
            'contributing/versions',
            'contributing/checks',
            'contributing/pull-requests',
            'contributing/docs-site',
          ],
        },
        { label: 'Вопросы', items: ['faq', 'faq/troubleshooting'] },
      ],
    }),
  ],
});
