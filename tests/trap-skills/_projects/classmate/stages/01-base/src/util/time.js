export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export function toUtcIso(date) {
  return new Date(date).toISOString();
}

export function hoursBetween(from, to) {
  return (new Date(to).getTime() - new Date(from).getTime()) / HOUR;
}
