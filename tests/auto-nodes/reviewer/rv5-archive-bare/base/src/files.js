import { readdirSync } from 'node:fs'

export function listFiles(dir) {
  return readdirSync(dir)
}
