/**
 * protocol.ts — Ducati PRO-I EVO komut/telemetri codec'i.
 *
 * Üç btsnoop yakalamasından ÇÖZÜLDÜ (bkz. ducati-ble/docs/07-tam-cozum.md).
 *
 * KOMUT (telefon -> scooter, char 0xFFF6), 8 byte:
 *   ca ac bd [B3] [B4] [CK5] [CK6] 6a
 *     CK5 = (B3 XOR B4 XOR 0xBD) & 0xFF
 *     CK6 = (CK5 + B3 - 0x43) & 0xFF        (mod 256)
 *   7 farklı komutta doğrulandı. Komutlar SABİT -> replay güvenli.
 *
 * Komut bir "mutlak durum yansıması"dır:
 *   (B3, B4) = mod tabanı + bayraklar (ARG'a OR'lanır).
 */
import { MODES, FLAGS, ModeId } from '../config';

const HDR = [0xca, 0xac, 0xbd];
const FTR = 0x6a;

function ck5(b3: number, b4: number): number {
  return (b3 ^ b4 ^ 0xbd) & 0xff;
}
function ck6(b3: number, b4: number): number {
  return (ck5(b3, b4) + b3 - 0x43) & 0xff;
}

/** (b3,b4) -> tam 8 byte komut paketi */
export function buildCommand(b3: number, b4: number): Uint8Array {
  b3 &= 0xff;
  b4 &= 0xff;
  return Uint8Array.from([...HDR, b3, b4, ck5(b3, b4), ck6(b3, b4), FTR]);
}

/** Mod seç (hız limiti): ECO(1) en yavaş, SPORT(3) en hızlı. Bayraklar kapalı. */
export function buildMode(mode: ModeId): Uint8Array {
  const m = MODES[mode];
  return buildCommand(m.b3, m.b4);
}

/**
 * Mod + bayrak durumunu birlikte gönder (komut mutlak durum olduğu için
 * aktif bayraklar ARG'a eklenir). Örn: mod3 + kilit.
 */
export function buildState(
  mode: ModeId,
  flags: { cruise?: boolean; far?: boolean; lock?: boolean } = {},
): Uint8Array {
  const m = MODES[mode];
  let b4 = m.b4;
  if (flags.cruise) b4 |= FLAGS.cruise;
  if (flags.far) b4 |= FLAGS.far;
  if (flags.lock) b4 |= FLAGS.lock;
  return buildCommand(m.b3, b4);
}

/** Ham hex (örn "ca ac bd 04 01 b8 79 6a") -> byte dizisi */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/0x/g, '').replace(/[,\s]+/g, ' ').trim();
  const parts = clean.includes(' ') ? clean.split(' ') : clean.match(/.{1,2}/g) || [];
  return Uint8Array.from(parts.map((p) => parseInt(p, 16)));
}

/** Paketi doğrula (çerçeve + checksum) */
export function validateCommand(pkt: Uint8Array): boolean {
  if (pkt.length !== 8) return false;
  const b3 = pkt[3];
  const b4 = pkt[4];
  return (
    pkt[0] === HDR[0] &&
    pkt[1] === HDR[1] &&
    pkt[2] === HDR[2] &&
    pkt[7] === FTR &&
    pkt[5] === ck5(b3, b4) &&
    pkt[6] === ck6(b3, b4)
  );
}

// ---- base64 (RN/Hermes'te btoa/Buffer garanti değil) ------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n0 = B64.indexOf(clean[i]);
    const n1 = B64.indexOf(clean[i + 1]);
    const n2 = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const n3 = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out.push((n0 << 2) | (n1 >> 4));
    if (n2 >= 0) out.push(((n1 & 15) << 4) | (n2 >> 2));
    if (n3 >= 0) out.push(((n2 & 3) << 6) | n3);
  }
  return Uint8Array.from(out);
}
