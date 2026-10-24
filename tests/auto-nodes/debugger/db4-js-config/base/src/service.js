import { load } from './config/load.js'

export function createService(name, overrides) {
  // Своя копия конфига: сервис меняет его, чужие конфиги трогать не должен.
  const cfg = { ...load(overrides) }
  return {
    name,
    cfg,
    addTag(tag) {
      if (!cfg.tags.includes(tag)) cfg.tags.push(tag)
    },
  }
}
