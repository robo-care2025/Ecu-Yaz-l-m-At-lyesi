/**
 * protocol.ts — Komut gövdesini tam pakete çevirir (header + body + checksum).
 *
 * ducati-ble/tools/checksum.py'deki formüllerin TypeScript karşılığı.
 * config.ts'teki PROTOCOL ayarlarına göre doğru checksum'ı ekler.
 */
import { PROTOCOL, COMMANDS, ChecksumMethod } from '../config';

function sum(bytes: number[]): number {
  return bytes.reduce((a, b) => (a + b) & 0xffffffff, 0);
}

function computeChecksum(body: number[], method: ChecksumMethod): number[] {
  switch (method) {
    case 'none':
      return [];
    case 'sum8':
      return [sum(body) & 0xff];
    case 'xor8':
      return [body.reduce((a, b) => a ^ b, 0) & 0xff];
    case 'neg_sum8':
      return [~sum(body) & 0xff];
    case 'twos_sum8':
      return [-sum(body) & 0xff];
    case 'ninebot': {
      const s = ~sum(body) & 0xffff;
      return [s & 0xff, (s >> 8) & 0xff];
    }
    case 'sum16_le': {
      const s = sum(body) & 0xffff;
      return [s & 0xff, (s >> 8) & 0xff];
    }
    default:
      return [];
  }
}

/**
 * Bir komut gövdesini (cmd+arg) tam BLE paketine çevirir.
 * body: config.ts'teki COMMANDS değerleri (header HARİÇ).
 */
export function buildPacket(body: number[]): Uint8Array {
  const withHeader = [...PROTOCOL.header, ...body];
  const csInput = withHeader.slice(PROTOCOL.checksumSkipHeader);
  const checksum = computeChecksum(csInput, PROTOCOL.checksum);
  return Uint8Array.from([...withHeader, ...checksum]);
}

/** Hız limitini (km/h) komuta çevir: speedLimitBase + [limit] */
export function buildSpeedLimit(kmh: number): Uint8Array {
  const clamped = Math.max(0, Math.min(255, Math.round(kmh)));
  return buildPacket([...COMMANDS.speedLimitBase, clamped]);
}

export function buildMode(mode: keyof typeof COMMANDS.mode): Uint8Array {
  return buildPacket(COMMANDS.mode[mode]);
}

export function buildLight(on: boolean): Uint8Array {
  return buildPacket(on ? COMMANDS.light.on : COMMANDS.light.off);
}

export function buildLock(lock: boolean): Uint8Array {
  return buildPacket(lock ? COMMANDS.lock.lock : COMMANDS.lock.unlock);
}

// Bağımsız base64 — RN/Hermes'te btoa/atob/Buffer garanti değil.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64'e çevir — react-native-ble-plx write bunu bekler */
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

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/0x/g, '').replace(/[,\s]+/g, ' ').trim();
  const parts = clean.includes(' ') ? clean.split(' ') : clean.match(/.{1,2}/g) || [];
  return Uint8Array.from(parts.map((p) => parseInt(p, 16)));
}

/** Gelen base64 notify verisini byte dizisine çevir */
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
