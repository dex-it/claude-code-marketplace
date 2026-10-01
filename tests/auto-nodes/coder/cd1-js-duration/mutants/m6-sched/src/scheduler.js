import { parseDuration } from './duration.js'

export function scheduleIn(text, fn) {
  return setTimeout(fn, parseDuration(text) * 1000)
}
