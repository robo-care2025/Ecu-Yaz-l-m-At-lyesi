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
/** Her 50 m'de bir diske yaz. */
const SAVE_EVERY_KM = 0.05;

export function useOdometer() {
  const [totalKm, setTotalKm] = useState(0);
  const [tripKm, setTripKm] = useState(0);
  const total = useRef(0);
  const trip = useRef(0);
  const savedAt = useRef(0);
  const lastT = useRef<number | null>(null);
  const lastSpeed = useRef(0);

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

  /** Toplam km'yi scooter ekranındaki değere eşitle. */
  const setTotal = useCallback(
    (km: number) => {
      total.current = km;
      setTotalKm(km);
      save();
    },
    [save],
  );

  return { totalKm, tripKm, feed, pause, resetTrip, setTotal };
}
