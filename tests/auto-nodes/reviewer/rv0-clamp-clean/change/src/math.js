export function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

export function clamp(n, min, max) {
  if (min > max) throw new RangeError(`min ${min} > max ${max}`);
  return Math.min(Math.max(n, min), max);
}
