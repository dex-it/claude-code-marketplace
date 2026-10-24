import { load } from './config/load.js'

export function createService(name, overrides) {
  // Своя копия конфига: сервис меняет его, чужие конфиги трогать не должен.
  const base = load(overrides)
  const cfg = { ...base, tags: [...base.tags] }
  return {
    name,
    cfg,
    addTag(tag) {
      if (!cfg.tags.includes(tag)) cfg.tags.push(tag)
    },
  }
}
