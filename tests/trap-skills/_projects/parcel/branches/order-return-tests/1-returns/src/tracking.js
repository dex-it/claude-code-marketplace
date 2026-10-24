// Алфавит без I, L, O, U - чтобы номер не путали при диктовке
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateTracking(rng = Math.random) {
  let code = 'PX';
  for (let i = 0; i < 8; i += 1) code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return code;
}
