// Срок доставки в рабочих днях по зоне.
const DAYS = {
  A: { min: 1, max: 1 },
  B: { min: 1, max: 2 },
  C: { min: 2, max: 3 },
};

export function deliveryDays(zone) {
  const d = DAYS[zone];
  return d.min === d.max ? `${d.min}` : `${d.min}-${d.max}`;
}
