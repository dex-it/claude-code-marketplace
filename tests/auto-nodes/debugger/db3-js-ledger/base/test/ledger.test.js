import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLedger, addInvoice, applyPayments, statusOf } from '../src/ledger.js'
import { importPayments } from '../src/bank/import.js'
import { statusLine } from '../src/report.js'
import { summary } from '../src/summary.js'

function ledgerWith(totalMinor, csv) {
  const ledger = createLedger()
  addInvoice(ledger, 'inv-1', totalMinor)
  applyPayments(ledger, importPayments(csv))
  return ledger
}

test('полная оплата - paid', () => {
  assert.equal(statusOf(ledgerWith(2550, 'inv-1;2026-03-02;25,50'), 'inv-1'), 'paid')
})

test('недоплата - partial, остаток в строке отчёта', () => {
  const ledger = ledgerWith(1000, 'inv-1;2026-03-02;7,00')
  assert.equal(statusLine(ledger, 'inv-1'), 'inv-1: partial, остаток 3,00')
})

test('переплата - overpaid', () => {
  assert.equal(statusOf(ledgerWith(1000, 'inv-1;2026-03-02;12,34'), 'inv-1'), 'overpaid')
})

test('два платежа складываются', () => {
  const ledger = ledgerWith(10025, 'inv-1;2026-03-02;100,00\ninv-1;2026-03-03;0,25')
  assert.equal(statusOf(ledger, 'inv-1'), 'paid')
  assert.equal(summary(ledger).paid, '100,25')
})
