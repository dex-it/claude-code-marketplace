#!/usr/bin/env node
/** Валидатор с правилом, у которого нет директории фикстуры. */
export function validate() {
  return [{ level: 'error', rule: 'fixture-rule-beta', message: 'fixture' }];
}
