/**
 * distance.ts — Hızdan mesafe hesabı (batarya testi ve km sayacı ortak kullanır).
 *
 * Scooter mesafe göndermez; mesafe, telemetrideki hızın zamana göre
 * integrali ile bulunur (yamuk kuralı).
 */

/** İki telemetri paketi arası bu süreden uzunsa (bağlantı boşluğu) mesafeye eklenmez. */
export const MAX_GAP_MS = 2000;

/** İki ardışık hız örneği arasında gidilen km. Boşluk varsa 0. */
export function stepKm(prevKmh: number, kmh: number, dtMs: number): number {
  if (dtMs <= 0 || dtMs > MAX_GAP_MS) return 0;
  return ((prevKmh + kmh) / 2) * (dtMs / 3_600_000);
}
