import { MESSAGES } from './messages.js'

export class DomainError extends Error {
  constructor(code, detail) {
    super(`${MESSAGES[code] ?? code}: ${detail}`)
    this.code = code
  }
}
