/** Число слов: последовательности символов без пробельных между пробельными. */
export function countWords(text) {
  const parts = String(text).trim().split(/\s+/);
  return parts[0] === '' ? 0 : parts.length;
}
