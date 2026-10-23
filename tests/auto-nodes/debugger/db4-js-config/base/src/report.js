import { load } from './config/load.js'

export function describe(unit) {
  return `${unit.name}: ${unit.cfg.tags.join(', ')}`
}

export function defaultsLine() {
  return `defaults: ${load().tags.join(', ')}`
}
