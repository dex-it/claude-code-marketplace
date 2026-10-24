import { DEFAULTS } from './defaults.js'

// Конфиг сервиса или плагина: умолчания, поверх них переопределения.
export function load(overrides = {}) {
  return { ...DEFAULTS, ...overrides }
}
