export function parseDuration(s) {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(s);
  console.log('parseDuration', s, m);
  if (!m) throw new RangeError(`bad duration: ${s}`);
  return (Number(m[1] || 0) * 60 + Number(m[2] || 0)) * 60000;
}
