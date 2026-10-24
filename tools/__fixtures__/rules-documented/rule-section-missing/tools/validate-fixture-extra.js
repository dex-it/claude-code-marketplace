#!/usr/bin/env node
/** Второй валидатор с тем же правилом: раздела под него в реестре песочницы нет. */
export function validate() {
  return [{ level: 'error', rule: 'fixture-rule-alpha', message: 'fixture' }];
}
