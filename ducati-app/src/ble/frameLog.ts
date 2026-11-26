/**
 * frameLog.ts — Scooter'ın FFF7 üzerinden gönderdiği HER ham çerçeveyi
 * tipine göre toplayan salt-okuma kaydedici.
 *
 * Amaç: Ducati'nin yalnızca `5a b9` telemetri çerçevesini mi, yoksa KCQ
 * kontrolcülerindeki gibi başka tip çerçeveler (ayar/limit) de gönderip
 * göndermediğini görmek. Hiçbir şey YAZMAZ, sadece gelen baytları dinler.
 *
 * Çerçeveler ilk iki bayta göre gruplanır (ör. "5a b9"); her grup için
 * sayaç, son görülen tam hex ve uzunluk tutulur.
 */
import { useCallback, useRef, useState } from 'react';

export interface FrameKind {
  key: string;
  count: number;
  len: number;
  lastHex: string;
  firstAt: number;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export function useFrameLog() {
  const [kinds, setKinds] = useState<FrameKind[]>([]);
  const map = useRef<Map<string, FrameKind>>(new Map());

  const feed = useCallback((bytes: Uint8Array) => {
    if (bytes.length === 0) return;
    const key =
      bytes.length >= 2
        ? `${bytes[0].toString(16).padStart(2, '0')} ${bytes[1].toString(16).padStart(2, '0')}`
        : bytes[0].toString(16).padStart(2, '0');
    const prev = map.current.get(key);
    map.current.set(key, {
      key,
      count: (prev?.count ?? 0) + 1,
      len: bytes.length,
      lastHex: hex(bytes),
      firstAt: prev?.firstAt ?? Date.now(),
    });
    // Tipe göre, ilk görülme sırasıyla sabit sırala.
    setKinds([...map.current.values()].sort((a, b) => a.firstAt - b.firstAt));
  }, []);

  const reset = useCallback(() => {
    map.current.clear();
    setKinds([]);
  }, []);

  /** Paylaşılacak / kopyalanacak düz metin özet. */
  const asText = useCallback((): string => {
    const lines = ['Ducati ham çerçeve kaydı (FFF7)'];
    for (const k of kinds) lines.push(`${k.key}  (${k.len} bayt, ${k.count} kez)  ${k.lastHex}`);
    return lines.join('\n');
  }, [kinds]);

  return { kinds, feed, reset, asText };
}
