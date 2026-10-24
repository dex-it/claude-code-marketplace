// Адрес сайта и бренд: единственное место, откуда их читают конфиг Astro и проверка сборки.
//
// Адрес GitHub Pages задаёт имя репозитория: https://<организация>.github.io/<репозиторий>/.
// Репозиторий переименуют - меняются REPO_NAME (и, при смене организации, OWNER) в этом файле,
// остальное (base, canonical, sitemap, ссылки, проверка dist) подтягивается отсюда.
// Адрес вида /ai-kit/ возможен только после переименования репозитория (решение владельца)
// либо с собственным доменом в настройках Pages.

export const OWNER = 'dex-it';
export const REPO_NAME = 'claude-code-marketplace';

export const ORIGIN = `https://${OWNER}.github.io`;
export const BASE = `/${REPO_NAME}`;
export const SITE_URL = `${ORIGIN}${BASE}/`;
export const REPO = `https://github.com/${OWNER}/${REPO_NAME}`;

// Название бренда как в README и баннерах: полное в шапке и заголовках, короткое в тексте.
export const BRAND = 'DEX AI KIT';
export const BRAND_SHORT = 'AI KIT';
export const TAGLINE = 'Набор для агентной разработки в Claude Code';
export const DESCRIPTION =
  'Каталог плагинов для Claude Code: памятки по стекам, специалисты с понятными ролями и команды, которые ведут работу по шагам. Ставится набором под роль или по одному плагину.';
