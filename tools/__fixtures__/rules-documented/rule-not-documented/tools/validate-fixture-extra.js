#!/usr/bin/env node
/** Валидатор с правилом, которого нет в реестре песочницы. */
export function validate() {
  return [{ level: 'error', rule: 'fixture-rule-undocumented', message: 'fixture' }];
}
