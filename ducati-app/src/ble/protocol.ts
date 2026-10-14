/**
 * protocol.ts — Ducati PRO-I EVO komut/telemetri codec'i.
 *
 * btsnoop yakalamalarından ÇÖZÜLDÜ (bkz. ducati-ble/docs/06-protokol-cozuldu.md).
 *
 * KOMUT (telefon -> scooter, char 0xFFF6), 8 byte:
 *   ca ac bd [CMD] [ARG] [CK5] [CK6] 6a
 *     CK5 = (sum(byte[0..4]) + 0x8A) & 0xFF
 *     CK6 = (sum(byte[0..4]) + 0x47) & 0xFF
 *   Komutlar SABİT (oturum anahtarı yok) -> replay güvenli.
 */

const HDR = [0xca, 0xac, 0xbd];
const FTR = 0x6a;

function ck5(body5: number[]): number {
  return (body5.reduce((a, b) => a + b, 0) + 0x8a) & 0xff;
}
function ck6(body5: number[]): number {
  return (body5.reduce((a, b) => a + b, 0) + 0x47) & 0xff;
}

/** cmd + arg -> tam 8 byte komut paketi */
export function buildCommand(cmd: number, arg: number): Uint8Array {
  const body = [...HDR, cmd & 0xff, arg & 0xff];
  return Uint8Array.from([...body, ck5(body), ck6(body), FTR]);
}

/** Ham hex (örn "ca ac bd 00 40 fd ba 6a") -> byte dizisi (replay/test için) */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/0x/g, '').replace(/[,\s]+/g, ' ').trim();
  const parts = clean.includes(' ') ? clean.split(' ') : clean.match(/.{1,2}/g) || [];
  return Uint8Array.from(parts.map((p) => parseInt(p, 16)));
}

/** Paketi doğrula (checksum/çerçeve tutuyor mu) */
export function validateCommand(pkt: Uint8Array): boolean {
  if (pkt.length !== 8) return false;
  const body = Array.from(pkt.slice(0, 5));
  return (
    pkt[0] === HDR[0] &&
    pkt[1] === HDR[1] &&
    pkt[2] === HDR[2] &&
    pkt[7] === FTR &&
    pkt[5] === ck5(body) &&
    pkt[6] === ck6(body)
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
