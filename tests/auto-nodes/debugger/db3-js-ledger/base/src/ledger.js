export function createLedger() {
  return { invoices: new Map(), payments: [] }
}

export function addInvoice(ledger, id, totalMinor) {
  ledger.invoices.set(id, { id, totalMinor })
}

export function applyPayments(ledger, payments) {
  for (const p of payments) ledger.payments.push(p)
}

export function paidMinor(ledger, id) {
  return ledger.payments.filter(p => p.invoiceId === id).reduce((sum, p) => sum + p.minor, 0)
}

export function remainingMinor(ledger, id) {
  return ledger.invoices.get(id).totalMinor - paidMinor(ledger, id)
}

export function statusOf(ledger, id) {
  const rest = remainingMinor(ledger, id)
  if (rest === 0) return 'paid'
  return rest > 0 ? 'partial' : 'overpaid'
}
