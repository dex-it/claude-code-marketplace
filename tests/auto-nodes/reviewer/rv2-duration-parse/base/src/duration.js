export function parseDuration(s) {
  const m = /^(\d+)h(\d+)m$/.exec(s);
  if (!m) throw new RangeError(`bad duration: ${s}`);
  return (Number(m[1]) * 60 + Number(m[2])) * 60000;
}
