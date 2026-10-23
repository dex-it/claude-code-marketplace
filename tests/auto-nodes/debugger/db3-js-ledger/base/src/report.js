import { remainingMinor, statusOf } from './ledger.js'
import { formatMinor } from './money.js'

export function statusLine(ledger, id) {
  return `${id}: ${statusOf(ledger, id)}, остаток ${formatMinor(remainingMinor(ledger, id))}`
}
