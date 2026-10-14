/**
 * telemetry.ts — Ducati PRO-I EVO telemetri çözücü (char 0xFFF7).
 *
 * Çözülen çerçeve (16 byte), btsnoop'tan:
 *   5a b9 00 00 24 00 00 00 64 [STATE] 00 20 00 00 [CK] 95
 *     idx0-1 : 5a b9  başlık
 *     idx9   : STATE  durum/mod baytı
 *     idx14  : CK = (STATE + 0x60) & 0xFF  (checksum)
 *     idx15  : 95  sabit son
 *
 * Yakalamada görülen STATE değerleri: 0x01, 0x02, 0x03, 0x13, 0x81.
 * 0x01/0x02/0x03 = üç mod gibi; üst bitler (0x10, 0x80) bir bayrak (far/kilit?).
 * Anlamlar etiketli yakalama ile kesinleşecek.
 */

export interface Telemetry {
  state: number | null;
  stateHex: string;
  checksumOk: boolean;
  modeGuess: string;
  flags: string[];
  raw: string;
}

export function parseTelemetry(bytes: Uint8Array): Telemetry {
  if (bytes.length < 16 || bytes[0] !== 0x5a) {
    return {
      state: null,
      stateHex: '--',
      checksumOk: false,
      modeGuess: '--',
      flags: [],
      raw: hex(bytes),
    };
  }
  const state = bytes[9];
  const ck = bytes[14];
  const low = state & 0x0f;
  const high = state & 0xf0;

  const MODE: Record<number, string> = { 1: 'MOD 1', 2: 'MOD 2', 3: 'MOD 3' };
  const flags: string[] = [];
  if (high & 0x10) flags.push('bayrak 0x10');
  if (high & 0x80) flags.push('bayrak 0x80');

  return {
    state,
    stateHex: `0x${state.toString(16).padStart(2, '0')}`,
    checksumOk: ((state + 0x60) & 0xff) === ck,
    modeGuess: MODE[low] ?? `0x${low.toString(16)}`,
    flags,
    raw: hex(bytes),
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}
