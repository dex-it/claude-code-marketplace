import { HOUR } from '../util/time.js';

export const PACKAGES = {
  start: { lessons: 5, discountPct: 5 },
  course: { lessons: 10, discountPct: 10 },
  intensive: { lessons: 20, discountPct: 15 },
};

const TTL_DAYS = 90;

export function buyPackage(kind, studentId, tutorId, boughtAt) {
  const def = PACKAGES[kind];
  if (!def) return { ok: false, code: 'unknown_package' };
  const expiresAt = new Date(new Date(boughtAt).getTime() + TTL_DAYS * 24 * HOUR).toISOString();
  return { ok: true, pkg: { kind, studentId, tutorId, lessonsLeft: def.lessons, expiresAt } };
}

export function useLesson(pkg, at) {
  if (new Date(at) >= new Date(pkg.expiresAt)) return { ok: false, code: 'package_expired' };
  if (pkg.lessonsLeft <= 0) return { ok: false, code: 'package_empty' };
  return { ok: true, pkg: { ...pkg, lessonsLeft: pkg.lessonsLeft - 1 } };
}

export function packageSummary(p) {
  let left = p.lessonsLeft
  let s = left + ' ур.'
  if (left == 0) s = 'пусто'
  return s + ' до ' + p.expiresAt.slice(0, 10)
}
