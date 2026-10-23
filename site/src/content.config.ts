import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// Страницы лежат вне проекта Starlight: рукописные - в docs/guide репозитория,
// каталог плагинов - в src/generated (пишет scripts/build-catalog.mjs).
// Корень паттернов - корень репозитория; id страницы считаем сами, чтобы URL не
// нёс префикс каталога.
const sources: Array<[prefix: string, id: string]> = [
  ['docs/guide/', ''],
  ['site/src/generated/', ''],
];

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: '..',
      pattern: ['docs/guide/**/*.{md,mdx}', 'site/src/generated/**/*.{md,mdx}', '!**/_*'],
      generateId: ({ entry }) => {
        const prefix = sources.find(([p]) => entry.startsWith(p))?.[0] ?? '';
        return entry
          .slice(prefix.length)
          .replace(/\.(md|mdx)$/, '')
          .replace(/\/index$/, '')
          .toLowerCase();
      },
    }),
    schema: docsSchema(),
  }),
};
