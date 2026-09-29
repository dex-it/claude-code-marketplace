// Длительность вида '<целое><единица>', единицы s, m, h; результат - секунды.
const UNITS = { s: 1, m: 60, h: 3600 }

export function parseDuration(text) {
  const m = /^(\d+)([smh])$/.exec(text)
  if (!m) throw new RangeError(`bad duration: ${text}`)
  return Number(m[1]) * UNITS[m[2]]
}
