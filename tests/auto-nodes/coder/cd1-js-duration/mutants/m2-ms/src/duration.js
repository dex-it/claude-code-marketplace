const UNITS = { ms: 1000, s: 1000, m: 60000, h: 3600000 }

export function parseDuration(text) {
  const m = /^(\d+)(ms|s|m|h)$/.exec(text)
  if (!m) throw new RangeError(`bad duration: ${text}`)
  return Number(m[1]) * UNITS[m[2]]
}
