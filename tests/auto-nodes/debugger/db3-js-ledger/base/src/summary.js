import { paidMinor } from './ledger.js'
import { formatMinor } from './money.js'

export function summary(ledger) {
  let invoiced = 0
  let paid = 0
  for (const inv of ledger.invoices.values()) {
    invoiced += inv.totalMinor
    paid += paidMinor(ledger, inv.id)
  }
  return { invoiced: formatMinor(invoiced), paid: formatMinor(paid) }
}
