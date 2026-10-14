/**
 * telemetry.ts — Scooter'dan gelen notify paketini okunur veriye çevir.
 *
 * Byte indeksleri ve ölçekler DONANIMA GÖRE değişir. monitor.py ile çözüp
 * docs/02-komut-haritasi.md'ye yazdığın değerleri buraya gir.
 * Aşağısı ÖRNEK bir şablondur.
 */

export interface Telemetry {
  speedKmh: number | null;
  batteryPct: number | null;
  mode: 'pedestrian' | 'eco' | 'comfort' | 'sport' | null;
  errorCode: number | null;
  raw: string; // hex, debug için
}

/** monitor.py ile çözdüğün indeksleri buraya yaz */
const MAP = {
  speedIndex: 4, // TODO: gerçek indeks
  speedScale: 100, // değer/100 = km/h (TODO)
  batteryIndex: 6, // TODO
  modeIndex: 8, // TODO
  errorIndex: 10, // TODO
};

const MODE_LOOKUP: Record<number, Telemetry['mode']> = {
  0: 'pedestrian',
  1: 'eco',
  2: 'comfort',
  3: 'sport',
};

export function parseTelemetry(bytes: Uint8Array): Telemetry {
  const at = (i: number): number | null => (i < bytes.length ? bytes[i] : null);
  const speedRaw = at(MAP.speedIndex);
  const modeRaw = at(MAP.modeIndex);
  return {
    speedKmh: speedRaw === null ? null : +(speedRaw / MAP.speedScale).toFixed(1),
    batteryPct: at(MAP.batteryIndex),
    mode: modeRaw === null ? null : MODE_LOOKUP[modeRaw] ?? null,
    errorCode: at(MAP.errorIndex),
    raw: Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' '),
  };
}
