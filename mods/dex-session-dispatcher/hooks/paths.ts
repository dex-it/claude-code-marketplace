// Где лежит транскрипт сессии. Формат и путь внутренние для Claude Code, и
// документация просит на них не опираться; мод читает их ради статистики,
// которой больше негде взять, и каждый промах переводит в «данных нет», а не в
// ошибку.

/**
 * Имя папки проекта: путь рабочего каталога, в котором всё, кроме букв и
 * цифр, заменено на `-`. У длинных путей (больше 200 знаков) Claude Code
 * обрезает имя и добавляет хеш: такой путь здесь не восстановить, его ищут
 * перебором папок проектов.
 */
export const projectSlug = (cwd: string): string => cwd.replace(/[^A-Za-z0-9]/g, '-')

export const SLUG_LIMIT = 200

export const projectsRoot = (configDir: string): string => `${configDir.replace(/\/+$/, '')}/projects`

/** Вероятный путь транскрипта; `null`, когда имя папки обрезано хешем. */
export function transcriptPath(configDir: string, cwd: string, sessionId: string): string | null {
  const slug = projectSlug(cwd)

  if (slug.length > SLUG_LIMIT) return null

  return `${projectsRoot(configDir)}/${slug}/${sessionId}.jsonl`
}

/** Папка субагентов сессии рядом с транскриптом. */
export const subagentsDir = (transcript: string): string =>
  `${transcript.replace(/\.jsonl$/, '')}/subagents`

/** Лежит ли `path` в каталоге `root` (или он сам): префикс берётся по границе имени, а не по знакам. */
export function isInside(path: string, root: string): boolean {
  if (root === '') return false

  const base = root.replace(/\/+$/, '')

  return base === '' || path === base || path.startsWith(`${base}/`)
}

/** Не нашли транскрипт: перебор папок проектов повторяется не чаще раза в минуту. */
export const MISS_RETRY_MS = 60_000

export type Miss = { at: number; cwd: string }

/**
 * Нужно ли перебирать папки проектов. Сессия без транскрипта (окно до первого
 * сообщения) в каждом опросе заставляла бы обходить все папки `projects`;
 * провал помнится до смены каталога сессии либо `MISS_RETRY_MS`.
 */
export const needsScan = (miss: Miss | undefined, now: number, cwd: string): boolean =>
  miss === undefined || miss.cwd !== cwd || now - miss.at >= MISS_RETRY_MS
