/**
 * telemetry.ts — Ducati PRO-I EVO telemetri çözücü (char 0xFFF7).
 *
 * Çözülen çerçeve (16 byte), btsnoop'tan DOĞRULANDI:
 *   5a b9 00 00 24 00 00 00 64 [STATE] 00 20 00 00 [CK] 95
 *     idx9   : STATE  durum baytı
 *     idx14  : CK = (STATE + 0x60) & 0xFF
 *
 * STATE baytı (etiketli yakalama ile doğrulandı):
 *   alt nibble (0x0F) = sürüş modu (1/2/3)
 *   bit 0x10          = FAR açık
 *   bit 0x80          = KİLİTLİ
 */

export interface Telemetry {
  state: number | null;
  stateHex: string;
  checksumOk: boolean;
  mode: number | null;
  headlightOn: boolean;
  locked: boolean;
  raw: string;
}

const MODE_LABEL: Record<number, string> = { 1: 'MOD 1', 2: 'MOD 2', 3: 'MOD 3' };

export function modeLabel(mode: number | null): string {
  if (mode == null) return '--';
  return MODE_LABEL[mode] ?? `MOD ${mode}`;
}

export function parseTelemetry(bytes: Uint8Array): Telemetry {
  if (bytes.length < 16 || bytes[0] !== 0x5a) {
    return {
      state: null,
      stateHex: '--',
      checksumOk: false,
      mode: null,
      headlightOn: false,
      locked: false,
      raw: hex(bytes),
    };
  }
  const state = bytes[9];
  const ck = bytes[14];
  return {
    state,
    stateHex: `0x${state.toString(16).padStart(2, '0')}`,
    checksumOk: ((state + 0x60) & 0xff) === ck,
    mode: state & 0x0f,
    headlightOn: (state & 0x10) !== 0,
    locked: (state & 0x80) !== 0,
    raw: hex(bytes),
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}
