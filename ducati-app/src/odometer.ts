/**
 * odometer.ts — TRIP (bu sürüşte gidilen mesafe).
 *
 * Toplam km scooter'dan okunur (telemetry.ts, odoKm). TRIP ise scooter'da
 * yok; batarya testiyle aynı yöntemle (distance.ts) hızın zamana göre
 * integralinden hesaplanır.
 */
import { useCallback, useRef, useState } from 'react';
import { stepKm } from './distance';

export function useTripMeter() {
  const [tripKm, setTripKm] = useState(0);
  const trip = useRef(0);
  const lastT = useRef<number | null>(null);
  const lastSpeed = useRef(0);

  /** Her telemetri çerçevesinde çağrılır. */
  const feed = useCallback((speedKmh: number) => {
    const now = Date.now();
    const prevT = lastT.current;
    const prevV = lastSpeed.current;
    lastT.current = now;
    lastSpeed.current = speedKmh;
    if (prevT == null) return;
    const km = stepKm(prevV, speedKmh, now - prevT);
    if (km <= 0) return;
    trip.current += km;
    setTripKm(trip.current);
  }, []);

  /** Bağlantı kopunca: sonraki çerçeveyle aradaki boşluğu sayma. */
  const pause = useCallback(() => {
    lastT.current = null;
    lastSpeed.current = 0;
  }, []);

  const resetTrip = useCallback(() => {
    trip.current = 0;
    setTripKm(0);
  }, []);

  return { tripKm, feed, pause, resetTrip };
}
