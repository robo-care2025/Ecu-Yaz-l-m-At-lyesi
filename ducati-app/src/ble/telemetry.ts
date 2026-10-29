/**
 * telemetry.ts — Ducati PRO-I EVO telemetri çözücü (char 0xFFF7).
 *
 * Çözülen çerçeve (16 byte), üç yakalamadan DOĞRULANDI:
 *   5a b9 [SPL] 00 24 00 00 00 64 [STATE] 00 [F11] [SPH] 00 [CK] 95
 *     idx2  : SPL  hız/rpm düşük byte
 *     idx9  : STATE  durum baytı
 *     idx11 : F11  0x20/0x28 (0x08 biti hareket göstergesi gibi)
 *     idx12 : SPH  hız/rpm yüksek byte
 *     idx14 : CK = idx2 ^ idx3 ^ ... ^ idx13  (XOR; 4 kayıtta 3534 paketin hepsinde doğru)
 *
 * STATE baytı:
 *   bit 0x01/0x02 (& 0x03) = sürüş modu (1/2/3)
 *   bit 0x04          = CRUISE aktif
 *   bit 0x08          = ZERO START aktif (duran yerden kalkış)
 *   bit 0x10          = FAR açık
 *   bit 0x80          = KİLİTLİ
 *
 * HIZ: 16-bit = idx2 + idx3*256, km/h = deger / 10.
 *      20 km/h -> idx2=200,idx3=0 (=200); 30 km/h -> idx2=0x2c,idx3=1 (=300).
 *      idx12 hıza DAHİL DEĞİL (sürüş süresi).
 * TOPLAM KM: idx4 + idx5*256 (km). Orijinal uygulama scooter'dan yalnızca bu
 *      çerçeveyi alıyor; günler arasında artan tek açıklanmamış bayt idx4
 *      (13.10: 5, 13.10 akşam: 17, 14.10: 36; şarjda sıfırlanmıyor).
 *      Scooter ekranı / orijinal uygulama ile karşılaştırıp doğrula.
 * BATARYA: idx8 = yüzde (tüm kaptürlerde 0x64=100, şarjda). Düşük şarjda doğrula.
 */

/** 16-bit hız -> km/h böleni (idx2+idx3*256)/10. Ölçümle kalibre edildi. */
export const SPEED_SCALE = 10;

/**
 * idx12+idx13 = SÜRÜŞ SÜRESİ (saniye). Scooter başında doğrulandı:
 * cihaz hareket edince saniye gibi artıyor (mesafe değil, süre).
 */

export interface Telemetry {
  state: number | null;
  stateHex: string;
  stateChecksumOk: boolean;
  mode: number | null;
  batteryPct: number | null;
  cruiseOn: boolean;
  zeroStartOn: boolean;
  headlightOn: boolean;
  locked: boolean;
  speedRaw: number | null;
  speedKmh: number | null;
  moving: boolean;
  rideSeconds: number | null;
  rideTime: string;
  odoKm: number | null;
  fault: boolean;
  faultCode: number;
  raw: string;
}

/** Saniye -> "d:ss" (ör. 506 -> "8:26"). */
export function formatRideTime(sec: number | null): string {
  if (sec == null) return '--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
      batteryPct: null,
      cruiseOn: false,
      zeroStartOn: false,
      headlightOn: false,
      locked: false,
      speedRaw: null,
      speedKmh: null,
      moving: false,
      rideSeconds: null,
      rideTime: '--',
      odoKm: null,
      fault: false,
      faultCode: 0,
      raw: hex(bytes),
    };
  }
  const rideSeconds = bytes[12] | (bytes[13] << 8);
  const state = bytes[9];
  let xor = 0;
  for (let i = 2; i <= 13; i++) xor ^= bytes[i];
  const speedRaw = bytes[2] | (bytes[3] << 8);
  return {
    state,
    stateHex: `0x${state.toString(16).padStart(2, '0')}`,
    stateChecksumOk: xor === bytes[14],
    mode: state & 0x03,
    batteryPct: bytes[8],
    cruiseOn: (state & 0x04) !== 0,
    zeroStartOn: (state & 0x08) !== 0,
    headlightOn: (state & 0x10) !== 0,
    locked: (state & 0x80) !== 0,
    speedRaw,
    speedKmh: +(speedRaw / SPEED_SCALE).toFixed(1),
    moving: (bytes[11] & 0x08) !== 0,
    rideSeconds,
    rideTime: formatRideTime(rideSeconds),
    odoKm: bytes[4] | (bytes[5] << 8),
    // Arıza tespiti: doğrulanmış kod eşlemesi yok. Önceki sezgisel
    // (bytes[5]||[7]||[10]) sağlam scooter'da yanlış "Arıza 0x3d" veriyordu.
    // Gerçek arıza durumu yakalanıp kodu doğrulanana kadar devre dışı.
    fault: false,
    faultCode: 0,
    raw: hex(bytes),
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}
