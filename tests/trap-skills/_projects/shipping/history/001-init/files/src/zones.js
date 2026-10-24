// Зона доставки по индексу получателя - по первой цифре, таблица config/zones.json.
import { readConfig } from './config.js';

const ZONES = readConfig('zones.json');

export function zoneFor(postcode, zones = ZONES) {
  return zones.regions[String(postcode)[0]];
}
