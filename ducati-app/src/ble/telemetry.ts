/**
 * telemetry.ts — Ducati PRO-I EVO telemetri çözücü (char 0xFFF7).
 *
 * Çözülen çerçeve (16 byte), üç yakalamadan DOĞRULANDI:
 *   5a b9 [SPL] 00 24 00 00 00 64 [STATE] 00 [F11] [SPH] 00 [CK] 95
 *     idx2  : SPL  hız/rpm düşük byte
 *     idx9  : STATE  durum baytı
 *     idx11 : F11  0x20/0x28 (0x08 biti hareket göstergesi gibi)
 *     idx12 : SPH  hız/rpm yüksek byte
 *     idx14 : CK = (STATE + 0x60) & 0xFF   (STATE kontrolü)
 *
 * STATE baytı:
 *   alt nibble (0x0F) = sürüş modu (1/2/3)
 *   bit 0x04          = CRUISE aktif
 *   bit 0x10          = FAR açık
 *   bit 0x80          = KİLİTLİ
 *
 * HIZ: raw16 = SPL + SPH*256. Ölçek kalibre edilmeli (varsayılan /100).
 */

/** Ham 16-bit hız değerini km/h'ye çeviren ölçek (kalibrasyon gerekebilir). */
export const SPEED_SCALE = 100;

export interface Telemetry {
  state: number | null;
  stateHex: string;
  stateChecksumOk: boolean;
  mode: number | null;
  cruiseOn: boolean;
  headlightOn: boolean;
  locked: boolean;
  speedRaw: number | null;
  speedKmh: number | null;
  moving: boolean;
  raw: string;
}

const MODE_LABEL: Record<number, string> = { 1: 'ECO', 2: 'COMFORT', 3: 'SPORT' };

export function modeLabel(mode: number | null): string {
  if (mode == null) return '--';
  return MODE_LABEL[mode] ?? `MOD ${mode}`;
}

export function parseTelemetry(bytes: Uint8Array): Telemetry {
  if (bytes.length < 16 || bytes[0] !== 0x5a) {
    return {
      state: null,
      stateHex: '--',
      stateChecksumOk: false,
      mode: null,
      cruiseOn: false,
      headlightOn: false,
      locked: false,
      speedRaw: null,
      speedKmh: null,
      moving: false,
      raw: hex(bytes),
    };
  }
  const state = bytes[9];
  const ck = bytes[14];
  const speedRaw = bytes[2] | (bytes[12] << 8);
  return {
    state,
    stateHex: `0x${state.toString(16).padStart(2, '0')}`,
    stateChecksumOk: ((state + 0x60) & 0xff) === ck,
    mode: state & 0x0f,
    cruiseOn: (state & 0x04) !== 0,
    headlightOn: (state & 0x10) !== 0,
    locked: (state & 0x80) !== 0,
    speedRaw,
    speedKmh: +(speedRaw / SPEED_SCALE).toFixed(1),
    moving: (bytes[11] & 0x08) !== 0,
    raw: hex(bytes),
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}
