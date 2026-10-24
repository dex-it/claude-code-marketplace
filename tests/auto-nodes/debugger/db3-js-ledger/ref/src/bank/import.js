// Выписка банка: строки «счёт;дата;сумма», сумма в рублях с запятой.
export function parseAmount(text) {
  return Math.round(Number(text.trim().replace(',', '.')) * 100)
}

export function importPayments(csv) {
  return csv.trim().split('\n').map(line => {
    const [invoiceId, date, amount] = line.split(';')
    return { invoiceId: invoiceId.trim(), date: date.trim(), minor: parseAmount(amount) }
  })
}
