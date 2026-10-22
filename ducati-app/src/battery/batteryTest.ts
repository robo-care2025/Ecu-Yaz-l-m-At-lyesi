/**
 * batteryTest.ts — Ducati PRO-I EVO için telemetriden batarya testi.
 *
 * Scooter BLE üzerinden voltaj/hücre/döngü göndermiyor; elimizde yalnızca
 * batarya yüzdesi (idx8) ve hız var. Yüzde voltajdan hesaplandığı için iki
 * dolaylı ölçüm yapılabilir:
 *
 *   1) YÜKTE DÜŞME: dururken okunan yüzde ile tam gaz kalkıştaki en düşük
 *      yüzde arasındaki fark. Yıpranmış (iç direnci yüksek) batarya daha
 *      çok düşer.
 *   2) MİNİ MENZİL: belli bir mesafe sürülür (mesafe hız × zamandan
 *      hesaplanır), dinlendikten sonra yüzde tekrar okunur.
 *      km / düşen puan × 100 = tahmini tam şarj menzili.
 *      Bunun referans menzile oranı = tahmini sağlık.
 *
 * Eşikler başlangıç değerleridir; sağlam bataryalarla kalibre edilecek.
 * Bu dosya React Native'e bağlı değildir, Node ile test edilebilir.
 */

export type Phase = 'idle' | 'rest1' | 'launch' | 'ride' | 'rest2' | 'done' | 'aborted';

export interface TestSettings {
  /** Sürülecek mesafe (km). */
  rideKm: number;
  /** Yeni bataryayla gerçek kullanım menzili (km). Etiket 25 km; gerçekte ~18. */
  referenceRangeKm: number;
  /** Başlangıç ve bitişte durarak beklenecek süre (sn). */
  rest1Sec: number;
  rest2Sec: number;
}

export const DEFAULT_SETTINGS: TestSettings = {
  rideKm: 2,
  referenceRangeKm: 18,
  rest1Sec: 10,
  rest2Sec: 60,
};

/** Yükte düşme eşikleri (yüzde puanı). Başlangıç değerleri. */
export const SAG_GOOD = 2;
export const SAG_BAD = 6;

/** Menzil testinde güvenilir sonuç için gereken en az düşüş (puan). */
export const MIN_DROP_PTS = 4;

export type Grade = 'iyi' | 'orta' | 'zayif' | 'belirsiz';

export interface TestResult {
  restPctStart: number;
  restPctEnd: number | null;
  sagPts: number | null;
  sagGrade: Grade;
  rideKm: number;
  dropPts: number | null;
  /** Tahmini tam şarj menzili (km) ve olası aralığı (yüzde 1 puan çözünürlükten). */
  rangeKm: number | null;
  rangeLowKm: number | null;
  rangeHighKm: number | null;
  /** Tahmini sağlık (%) = menzil / referans menzil. */
  healthPct: number | null;
  healthGrade: Grade;
  notes: string[];
}

export interface Snapshot {
  phase: Phase;
  /** Ekranda gösterilecek talimat. */
  instruction: string;
  /** Aşamanın ilerlemesi 0..1 (gösterge çubuğu için). */
  progress: number;
  speedKmh: number;
  batteryPct: number | null;
  rideKm: number;
  result: TestResult | null;
}

const STOP_KMH = 0.5;
/** Kalkış penceresi: hız 1 km/h'yi geçtikten sonra bu kadar süre en düşük yüzde aranır. */
const LAUNCH_WINDOW_MS = 6000;
/** İki telemetri paketi arası bu süreden uzunsa (bağlantı boşluğu) mesafeye eklenmez. */
const MAX_GAP_MS = 2000;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export class BatteryTester {
  settings: TestSettings;
  private phase: Phase = 'idle';
  private phaseStart = 0;
  private stillSince: number | null = null;
  private restSamples: number[] = [];
  private restPctStart: number | null = null;
  private launchStart: number | null = null;
  private launchMinPct: number | null = null;
  private sagPts: number | null = null;
  private rideKm = 0;
  private lastT: number | null = null;
  private lastSpeed = 0;
  private lastPct: number | null = null;
  private result: TestResult | null = null;
  private abortReason = '';

  constructor(settings: Partial<TestSettings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  start(now: number): void {
    this.phase = 'rest1';
    this.phaseStart = now;
    this.stillSince = null;
    this.restSamples = [];
    this.restPctStart = null;
    this.launchStart = null;
    this.launchMinPct = null;
    this.sagPts = null;
    this.rideKm = 0;
    this.lastT = null;
    this.result = null;
    this.abortReason = '';
  }

  cancel(): void {
    this.phase = 'idle';
  }

  /** Bağlantı koptuğunda testi geçersiz say. */
  abort(reason: string): void {
    if (this.phase === 'idle' || this.phase === 'done') return;
    this.phase = 'aborted';
    this.abortReason = reason;
  }

  /** Her telemetri paketinde çağır. */
  feed(speedKmh: number | null, batteryPct: number | null, now: number): void {
    const v = speedKmh ?? 0;
    const pctValid = batteryPct != null && batteryPct >= 0 && batteryPct <= 100;
    if (pctValid) this.lastPct = batteryPct;

    // Mesafe: yamuk kuralıyla hız × zaman. Bağlantı boşlukları atlanır.
    if (this.lastT != null && (this.phase === 'launch' || this.phase === 'ride')) {
      const dt = now - this.lastT;
      if (dt > 0 && dt <= MAX_GAP_MS) this.rideKm += ((this.lastSpeed + v) / 2) * (dt / 3_600_000);
    }
    this.lastT = now;
    this.lastSpeed = v;

    const still = v < STOP_KMH;
    if (still) {
      if (this.stillSince == null) this.stillSince = now;
    } else {
      this.stillSince = null;
    }

    switch (this.phase) {
      case 'rest1': {
        if (!still) {
          // Bekleme bitmeden hareket edildi: beklemeyi baştan başlat.
          this.restSamples = [];
          this.phaseStart = now;
          break;
        }
        if (pctValid) this.restSamples.push(batteryPct as number);
        if (now - this.phaseStart >= this.settings.rest1Sec * 1000 && this.restSamples.length >= 3) {
          this.restPctStart = median(this.restSamples);
          this.phase = 'launch';
          this.phaseStart = now;
          this.rideKm = 0;
        }
        break;
      }
      case 'launch': {
        if (this.launchStart == null && v > 1) this.launchStart = now;
        if (this.launchStart != null && pctValid) {
          this.launchMinPct = this.launchMinPct == null ? (batteryPct as number) : Math.min(this.launchMinPct, batteryPct as number);
        }
        if (this.launchStart != null && now - this.launchStart >= LAUNCH_WINDOW_MS) {
          this.sagPts = this.launchMinPct != null && this.restPctStart != null ? Math.max(0, this.restPctStart - this.launchMinPct) : null;
          this.phase = 'ride';
          this.phaseStart = now;
        }
        break;
      }
      case 'ride': {
        if (this.rideKm >= this.settings.rideKm && still) {
          this.phase = 'rest2';
          this.phaseStart = now;
          this.restSamples = [];
        }
        break;
      }
      case 'rest2': {
        if (!still) {
          // Henüz durmadı ya da yeniden hareket etti: sürüş devam ediyor say.
          this.phase = 'ride';
          this.phaseStart = now;
          this.restSamples = [];
          break;
        }
        const elapsed = now - this.phaseStart;
        // Son 15 saniyenin örneklerini topla (voltaj toparlanmış olsun).
        if (pctValid && elapsed >= (this.settings.rest2Sec - 15) * 1000) this.restSamples.push(batteryPct as number);
        if (elapsed >= this.settings.rest2Sec * 1000 && this.restSamples.length >= 3) {
          this.finish(median(this.restSamples));
        }
        break;
      }
      default:
        break;
    }
  }

  private finish(restPctEnd: number): void {
    const s = this.settings;
    const start = this.restPctStart as number;
    const notes: string[] = [];

    const sagGrade: Grade =
      this.sagPts == null ? 'belirsiz' : this.sagPts <= SAG_GOOD ? 'iyi' : this.sagPts >= SAG_BAD ? 'zayif' : 'orta';
    if (this.sagPts == null) notes.push('Kalkışta yüzde okunamadı.');

    const drop = start - restPctEnd;
    let rangeKm: number | null = null;
    let rangeLowKm: number | null = null;
    let rangeHighKm: number | null = null;
    let healthPct: number | null = null;
    let healthGrade: Grade = 'belirsiz';

    if (drop <= 0) {
      notes.push('Sürüşten sonra yüzde düşmedi. Menzil hesaplanamadı; daha uzun sürüşle tekrarla.');
    } else {
      rangeKm = (this.rideKm / drop) * 100;
      // Yüzde 1 puanlık adımlarla geliyor: gerçek düşüş (drop-1, drop+1) arasında olabilir.
      rangeHighKm = drop > 1 ? (this.rideKm / (drop - 1)) * 100 : null;
      rangeLowKm = (this.rideKm / (drop + 1)) * 100;
      healthPct = Math.min(120, (rangeKm / s.referenceRangeKm) * 100);
      if (drop < MIN_DROP_PTS) {
        notes.push(`Yüzde yalnızca ${drop} puan düştü. Sonuç kaba bir tahmin; daha isabetli sonuç için en az ${MIN_DROP_PTS} puan düşecek kadar sür.`);
        healthGrade = 'belirsiz';
      } else {
        healthGrade = healthPct >= 80 ? 'iyi' : healthPct >= 60 ? 'orta' : 'zayif';
      }
    }
    if (start >= 95) notes.push('Test %95 üstünde başladı. Dolu bataryada yüzde ilk başta yavaş düşer, menzil olduğundan yüksek çıkabilir.');
    if (start <= 25) notes.push('Test %25 altında başladı. Boşa yakın bataryada yüzde hızlı düşer, menzil olduğundan düşük çıkabilir.');

    this.result = {
      restPctStart: start,
      restPctEnd,
      sagPts: this.sagPts,
      sagGrade,
      rideKm: round1(this.rideKm * 100) / 100,
      dropPts: drop,
      rangeKm: rangeKm == null ? null : round1(rangeKm),
      rangeLowKm: rangeLowKm == null ? null : round1(rangeLowKm),
      rangeHighKm: rangeHighKm == null ? null : round1(rangeHighKm),
      healthPct: healthPct == null ? null : Math.round(healthPct),
      healthGrade,
      notes,
    };
    this.phase = 'done';
  }

  snapshot(now: number): Snapshot {
    const s = this.settings;
    let instruction = '';
    let progress = 0;
    switch (this.phase) {
      case 'idle':
        instruction = 'Scooter dururken TESTİ BAŞLAT\'a bas.';
        break;
      case 'rest1': {
        const left = Math.max(0, s.rest1Sec - Math.floor((now - this.phaseStart) / 1000));
        instruction = this.stillSince == null ? 'Dur ve kıpırdama. Başlangıç yüzdesi okunuyor.' : `Dur, kıpırdama. Başlangıç yüzdesi okunuyor… ${left} sn`;
        progress = Math.min(1, (now - this.phaseStart) / (s.rest1Sec * 1000));
        break;
      }
      case 'launch':
        instruction = this.launchStart == null ? 'Şimdi TAM GAZ kalk. Gazı birkaç saniye tam açık tut.' : 'Gaz tam açık, devam et…';
        progress = this.launchStart == null ? 0 : Math.min(1, (now - this.launchStart) / LAUNCH_WINDOW_MS);
        break;
      case 'ride':
        instruction =
          this.rideKm >= s.rideKm
            ? 'Mesafe tamam. Güvenli bir yerde DUR ve bekle.'
            : `Normal sürüşe devam et: ${this.rideKm.toFixed(2)} / ${s.rideKm} km`;
        progress = Math.min(1, this.rideKm / s.rideKm);
        break;
      case 'rest2': {
        const left = Math.max(0, s.rest2Sec - Math.floor((now - this.phaseStart) / 1000));
        instruction = `Dur ve bekle, batarya dinleniyor… ${left} sn`;
        progress = Math.min(1, (now - this.phaseStart) / (s.rest2Sec * 1000));
        break;
      }
      case 'done':
        instruction = 'Test tamamlandı.';
        progress = 1;
        break;
      case 'aborted':
        instruction = 'Test yarıda kaldı: ' + this.abortReason;
        break;
    }
    return {
      phase: this.phase,
      instruction,
      progress,
      speedKmh: this.lastSpeed,
      batteryPct: this.lastPct,
      rideKm: this.rideKm,
      result: this.result,
    };
  }
}

const GRADE_TR: Record<Grade, string> = { iyi: 'İyi', orta: 'Orta', zayif: 'Zayıf', belirsiz: 'Belirsiz' };

export function gradeLabel(g: Grade): string {
  return GRADE_TR[g];
}

/** Ekspertiz kaydına yapıştırılacak / paylaşılacak düz metin özet. */
export function resultText(r: TestResult, settings: TestSettings): string {
  const lines = [
    'Ducati PRO-I batarya testi (Bluetooth)',
    `Başlangıç / bitiş yüzdesi: %${r.restPctStart} / %${r.restPctEnd ?? '-'}`,
    `Yükte düşme: ${r.sagPts ?? '-'} puan (${gradeLabel(r.sagGrade)})`,
    `Sürülen mesafe: ${r.rideKm.toFixed(2)} km, düşüş: ${r.dropPts ?? '-'} puan`,
    r.rangeKm != null
      ? `Tahmini tam şarj menzili: ${r.rangeKm} km` +
        (r.rangeLowKm != null && r.rangeHighKm != null ? ` (olası aralık ${r.rangeLowKm}–${r.rangeHighKm} km)` : '')
      : 'Tahmini menzil: hesaplanamadı',
    r.healthPct != null
      ? `Tahmini sağlık: %${r.healthPct} (${gradeLabel(r.healthGrade)}), referans ${settings.referenceRangeKm} km`
      : 'Tahmini sağlık: hesaplanamadı',
    ...r.notes.map((n) => 'Not: ' + n),
  ];
  return lines.join('\n');
}
