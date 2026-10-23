import { load } from './config/load.js'

export function createPlugin(name, overrides) {
  const cfg = load(overrides)
  return {
    name,
    cfg,
    enable(tag) {
      if (!cfg.tags.includes(tag)) cfg.tags.push(tag)
    },
  }
}
