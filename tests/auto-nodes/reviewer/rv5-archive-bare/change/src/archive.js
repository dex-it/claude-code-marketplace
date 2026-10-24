import { execSync } from 'node:child_process'

export function archive(name) {
  execSync(`tar czf ${name}.tgz ${name}`)
  return `${name}.tgz`
}
