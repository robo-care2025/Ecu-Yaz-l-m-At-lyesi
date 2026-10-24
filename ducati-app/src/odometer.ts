/**
 * odometer.ts — Uygulama içi kilometre sayacı.
 *
 * Scooter'ın telemetri akışında (0xFFF7, 5a b9 çerçevesi) toplam km YOK;
 * üç btsnoop yakalamasında başka karakteristik okuması da yok. Bu yüzden
 * mesafe, batarya testiyle aynı yöntemle (distance.ts) hızın zamana göre
 * integralinden hesaplanır.
 * Toplam km telefonda saklanır (AsyncStorage) ve elle düzeltilebilir.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stepKm } from './distance';

const KEY = 'odometer.totalKm.v1';
const META_KEY = 'odometer.meta.v1';
/** Her 50 m'de bir diske yaz. */
const SAVE_EVERY_KM = 0.05;
/** Elle düzeltmeden sonra bu süre içinde değer geri alınabilir (yazım hatası için). */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;
const HISTORY_MAX = 10;

export interface Correction {
  at: number;
  from: number;
  to: number;
}

export interface OdoMeta {
  /** İlk kurulum yapıldı mı. Yapılmadıysa ilk değer serbestçe girilir. */
  initialized: boolean;
  /** Son elle düzeltmenin zamanı (ms). */
  lastSetAt: number | null;
  history: Correction[];
}

const EMPTY_META: OdoMeta = { initialized: false, lastSetAt: null, history: [] };

/**
 * Elle düzeltme kuralı. null = izinli, string = reddetme nedeni.
 *   - İlk kurulum: her değer serbest.
 *   - Sonrasında artırmak serbest.
 *   - Düşürmek yalnızca son düzeltmeden sonraki UNDO_WINDOW_MS içinde.
 */
export function checkCorrection(current: number, next: number, meta: OdoMeta, now: number): string | null {
  if (!Number.isFinite(next) || next < 0) return 'Geçersiz değer. Örnek: 1234.5';
  if (!meta.initialized || next >= current) return null;
  if (meta.lastSetAt != null && now - meta.lastSetAt <= UNDO_WINDOW_MS) return null;
  return 'Toplam km düşürülemez. Yalnızca son düzeltmeden sonraki 5 dakika içinde geri alınabilir.';
}

export function useOdometer() {
  const [totalKm, setTotalKm] = useState(0);
  const [tripKm, setTripKm] = useState(0);
  const total = useRef(0);
  const trip = useRef(0);
  const savedAt = useRef(0);
  const lastT = useRef<number | null>(null);
  const lastSpeed = useRef(0);
  const [meta, setMeta] = useState<OdoMeta>(EMPTY_META);
  const metaRef = useRef<OdoMeta>(EMPTY_META);

  const save = useCallback(() => {
    savedAt.current = total.current;
    AsyncStorage.setItem(KEY, total.current.toFixed(3)).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const n = v ? parseFloat(v) : 0;
        // Yükleme bitmeden gelen çerçevelerde biriken mesafeyi koru.
        total.current += Number.isFinite(n) ? n : 0;
        savedAt.current = total.current;
        setTotalKm(total.current);
      })
      .catch(() => {});
    AsyncStorage.getItem(META_KEY)
      .then((v) => {
        if (!v) return;
        const m = { ...EMPTY_META, ...JSON.parse(v) } as OdoMeta;
        metaRef.current = m;
        setMeta(m);
      })
      .catch(() => {});
  }, []);

  /** Her telemetri çerçevesinde çağrılır. */
  const feed = useCallback(
    (speedKmh: number) => {
      const now = Date.now();
      const prevT = lastT.current;
      const prevV = lastSpeed.current;
      lastT.current = now;
      lastSpeed.current = speedKmh;
      if (prevT == null) return;
      const km = stepKm(prevV, speedKmh, now - prevT);
      if (km <= 0) return;
      total.current += km;
      trip.current += km;
      setTotalKm(total.current);
      setTripKm(trip.current);
      if (total.current - savedAt.current >= SAVE_EVERY_KM) save();
    },
    [save],
  );

  /** Bağlantı kopunca: sonraki çerçeveyle aradaki boşluğu sayma, kaydet. */
  const pause = useCallback(() => {
    lastT.current = null;
    lastSpeed.current = 0;
    save();
  }, [save]);

  const resetTrip = useCallback(() => {
    trip.current = 0;
    setTripKm(0);
  }, []);

  /**
   * Toplam km'yi scooter ekranındaki değere eşitle (şifre kontrolü çağıranda).
   * Kurala uymazsa değiştirmez ve nedenini döndürür.
   */
  const setTotal = useCallback(
    (km: number): string | null => {
      const now = Date.now();
      const err = checkCorrection(total.current, km, metaRef.current, now);
      if (err) return err;
      const entry: Correction = { at: now, from: +total.current.toFixed(1), to: km };
      const m: OdoMeta = {
        initialized: true,
        lastSetAt: now,
        history: [entry, ...metaRef.current.history].slice(0, HISTORY_MAX),
      };
      metaRef.current = m;
      setMeta(m);
      AsyncStorage.setItem(META_KEY, JSON.stringify(m)).catch(() => {});
      total.current = km;
      setTotalKm(km);
      save();
      return null;
    },
    [save],
  );

  return { totalKm, tripKm, history: meta.history, initialized: meta.initialized, feed, pause, resetTrip, setTotal };
}
