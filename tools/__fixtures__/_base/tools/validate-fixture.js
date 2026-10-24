#!/usr/bin/env node
/**
 * Валидатор-пустышка песочницы: даёт мета-правилу rules-documented предмет
 * проверки, не завися от живых валидаторов каталога.
 */
export function validate() {
  return [{ level: 'error', rule: 'fixture-rule-alpha', message: 'fixture' }];
}
