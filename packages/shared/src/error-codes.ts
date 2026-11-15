/** "e 10", "Err10", "hata 10", "10" gibi yazımları "E10" biçimine çevirir. Sayı yoksa null. */
export function normalizeErrorCode(input: string): string | null {
  const m = input.match(/\d+/);
  if (!m) return null;
  return `E${parseInt(m[0], 10)}`;
}
