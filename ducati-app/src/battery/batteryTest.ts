/**
 * batteryTest.ts — Ducati PRO-I EVO için telemetriden batarya testi.
 *
 * Scooter BLE üzerinden voltaj/hücre/döngü göndermiyor; elimizde yalnızca
 * batarya yüzdesi (idx8, 1 puan çözünürlük, voltajdan) ve hız var.
 *
 * Yöntem (MENZİL): dururken başlangıç yüzdesi okunur, yüzde en az
 * MIN_DROP_PTS puan düşene kadar sürülür, durup batarya dinlendikten sonra
 * yüzde tekrar okunur. km / düşen puan × 100 = tahmini tam şarj menzili;
 * referans menzile oranı = tahmini sağlık.
 *
 * Yanlış "zayıf" sonucunu önlemek için:
 *   - Tam gaz kalkıştaki yükte düşme ölçülmez: yüzde voltajdan geldiği için
 *     sağlam bataryada da gaz açınca birkaç puan düşüyor.
 *   - Yalnızca %40–90 arasında başlanır: dolu ve boşa yakın bataryada yüzde
 *     eğrisi doğrusal değil.
 *   - En az 20 puan düşüş beklenir: 1 puanlık okuma hatası en çok ~%5 olur.
 *   - Not, ölçüm belirsizliğinin batarya lehine olan ucuyla verilir.
 *
 * Bu dosya React Native'e bağlı değildir, Node ile test edilebilir.
 */
import { stepKm } from '../distance';

export type Phase = 'idle' | 'rest1' | 'ride' | 'rest2' | 'done' | 'aborted';

export interface TestSettings {
  /** Yeni bataryayla gerçek kullanım menzili (km). Etiket 25 km; gerçekte ~18. */
  referenceRangeKm: number;
  /** Başlangıçta durarak beklenecek süre (sn). */
  rest1Sec: number;
  /** Sürüşten sonra dinlenme süresi (sn); son REST2_SAMPLE_SEC örneklenir. */
  rest2Sec: number;
}

export const DEFAULT_SETTINGS: TestSettings = {
  referenceRangeKm: 18,
  rest1Sec: 20,
  rest2Sec: 120,
};

/** Güvenilir sonuç için gereken en az düşüş (puan, dinlenmiş yüzdeyle). */
export const MIN_DROP_PTS = 20;
/** Başlangıç yüzdesi bu aralıkta olmalı. */
export const START_MIN_PCT = 40;
export const START_MAX_PCT = 90;
/** Sağlık notu eşikleri (%). */
export const HEALTH_GOOD = 75;
export const HEALTH_FAIR = 55;
const REST2_SAMPLE_SEC = 30;
const STOP_KMH = 0.5;

export type Grade = 'iyi' | 'orta' | 'zayif' | 'belirsiz';

export interface TestResult {
  restPctStart: number;
  restPctEnd: number;
  rideKm: number;
  dropPts: number;
  /** Tahmini tam şarj menzili (km) ve olası aralığı (yüzde 1 puan çözünürlükten). */
  rangeKm: number;
  rangeLowKm: number;
  rangeHighKm: number;
  /** Tahmini sağlık (%), belirsizliğin batarya lehine ucu (rangeHighKm) ile. */
  healthPct: number;
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
  private restSamples: number[] = [];
  private restPctStart: number | null = null;
  /** Son dinlenmede toparlanmış ama yetersiz kalan düşüş (bilgi için). */
  private lastRestDrop: number | null = null;
  /** Sürüşte canlı düşüş hedefe ulaştı: "DUR" talimatı sabit kalsın. */
  private stopAsked = false;
  /**
   * Sürüşte "DUR" denecek canlı düşüş. Canlı yüzde yükte sarktığı için
   * dinlenince toparlanabilir; o zaman hedef eksik kalan puan kadar artar.
   */
  private liveTarget = MIN_DROP_PTS;
  private liveAtStop = 0;
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
    this.restSamples = [];
    this.restPctStart = null;
    this.lastRestDrop = null;
    this.stopAsked = false;
    this.liveTarget = MIN_DROP_PTS;
    this.liveAtStop = 0;
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
    if (this.phase === 'idle' || this.phase === 'done' || this.phase === 'aborted') return;
    this.phase = 'aborted';
    this.abortReason = reason;
  }

  /** Canlı düşüş (yükte okunan yüzdeyle, dinlenmiş değerden fazla olabilir). */
  private liveDrop(): number | null {
    return this.restPctStart != null && this.lastPct != null ? this.restPctStart - this.lastPct : null;
  }

  /** Her telemetri paketinde çağır. */
  feed(speedKmh: number | null, batteryPct: number | null, now: number): void {
    const v = speedKmh ?? 0;
    const pctValid = batteryPct != null && batteryPct >= 0 && batteryPct <= 100;
    if (pctValid) this.lastPct = batteryPct;

    // Mesafe: yamuk kuralıyla hız × zaman. Bağlantı boşlukları atlanır.
    if (this.lastT != null && (this.phase === 'ride' || this.phase === 'rest2')) {
      this.rideKm += stepKm(this.lastSpeed, v, now - this.lastT);
    }
    this.lastT = now;
    this.lastSpeed = v;
    const still = v < STOP_KMH;

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
          const start = median(this.restSamples);
          if (start < START_MIN_PCT || start > START_MAX_PCT) {
            this.phase = 'aborted';
            this.abortReason =
              `batarya %${start}. Test yalnızca %${START_MIN_PCT}–${START_MAX_PCT} arasında başlar` +
              (start > START_MAX_PCT ? '; biraz sürüp tekrar dene.' : '; önce şarj et.');
            break;
          }
          this.restPctStart = start;
          this.phase = 'ride';
          this.phaseStart = now;
          this.rideKm = 0;
        }
        break;
      }
      case 'ride': {
        const d = this.liveDrop();
        if (!this.stopAsked && d != null && d >= this.liveTarget) {
          this.stopAsked = true;
          this.liveAtStop = d;
        }
        if (this.stopAsked && still) {
          this.phase = 'rest2';
          this.phaseStart = now;
          this.restSamples = [];
        }
        break;
      }
      case 'rest2': {
        if (!still) {
          // Yeniden hareket etti: sürüş devam ediyor say.
          this.phase = 'ride';
          this.phaseStart = now;
          this.restSamples = [];
          break;
        }
        const elapsed = now - this.phaseStart;
        // Son 30 saniyenin örneklerini topla (voltaj toparlanmış olsun).
        if (pctValid && elapsed >= (this.settings.rest2Sec - REST2_SAMPLE_SEC) * 1000) this.restSamples.push(batteryPct as number);
        if (elapsed >= this.settings.rest2Sec * 1000 && this.restSamples.length >= 3) {
          const end = median(this.restSamples);
          const drop = (this.restPctStart as number) - end;
          if (drop >= MIN_DROP_PTS) {
            this.finish(end);
          } else {
            // Dinlenince yüzde toparlandı: biraz daha sür.
            this.lastRestDrop = drop;
            this.stopAsked = false;
            this.liveTarget = this.liveAtStop + (MIN_DROP_PTS - drop);
            this.phase = 'ride';
            this.phaseStart = now;
            this.restSamples = [];
          }
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
    const drop = start - restPctEnd;
    const notes: string[] = [];

    const rangeKm = (this.rideKm / drop) * 100;
    // Yüzde 1 puanlık adımlarla geliyor: gerçek düşüş (drop-1, drop+1) arasında olabilir.
    const rangeHighKm = (this.rideKm / (drop - 1)) * 100;
    const rangeLowKm = (this.rideKm / (drop + 1)) * 100;
    const healthPct = Math.min(120, (rangeHighKm / s.referenceRangeKm) * 100);
    const healthGrade: Grade = healthPct >= HEALTH_GOOD ? 'iyi' : healthPct >= HEALTH_FAIR ? 'orta' : 'zayif';

    if (restPctEnd < 20) notes.push('Test %20 altında bitti. Boşa yakın bataryada yüzde hızlı düşer, menzil olduğundan düşük çıkabilir.');
    if (healthGrade !== 'iyi') {
      notes.push(
        `Sağlık, referans menzile (${s.referenceRangeKm} km) göre hesaplanır. Bu senin scooter'ının yeni bataryayla gerçek menzili değilse sonuç yanlış olur; referansı düzeltip tekrarla.`,
      );
      notes.push('Soğuk hava, yüksek hız, yokuş ve ağır yük menzili düşürür. Normal koşullarda tekrarla.');
    }

    this.result = {
      restPctStart: start,
      restPctEnd,
      rideKm: Math.round(this.rideKm * 100) / 100,
      dropPts: drop,
      rangeKm: round1(rangeKm),
      rangeLowKm: round1(rangeLowKm),
      rangeHighKm: round1(rangeHighKm),
      healthPct: Math.round(healthPct),
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
        instruction = "Scooter dururken TESTİ BAŞLAT'a bas.";
        break;
      case 'rest1': {
        const left = Math.max(0, s.rest1Sec - Math.floor((now - this.phaseStart) / 1000));
        instruction = `Dur, kıpırdama. Başlangıç yüzdesi okunuyor… ${left} sn`;
        progress = Math.min(1, (now - this.phaseStart) / (s.rest1Sec * 1000));
        break;
      }
      case 'ride': {
        const d = Math.max(0, this.liveDrop() ?? 0);
        const again = this.lastRestDrop != null ? `Dinlenince ${this.lastRestDrop} puanda kaldı. ` : '';
        instruction =
          this.stopAsked
            ? `${again}Yüzde ${MIN_DROP_PTS} puan düştü. Güvenli bir yerde DUR ve bekle.`
            : `${again}Normal sürüşe devam et. Düşüş: ${d} / ${this.liveTarget} puan · ${this.rideKm.toFixed(2)} km`;
        progress = this.stopAsked ? 1 : Math.min(1, d / this.liveTarget);
        break;
      }
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
        instruction = 'Test yapılamadı: ' + this.abortReason;
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
    `Başlangıç / bitiş yüzdesi (dinlenmiş): %${r.restPctStart} / %${r.restPctEnd}`,
    `Sürülen mesafe: ${r.rideKm.toFixed(2)} km, düşüş: ${r.dropPts} puan`,
    `Tahmini tam şarj menzili: ${r.rangeKm} km (olası aralık ${r.rangeLowKm}–${r.rangeHighKm} km)`,
    `Tahmini sağlık: %${r.healthPct} (${gradeLabel(r.healthGrade)}), referans ${settings.referenceRangeKm} km`,
    ...r.notes.map((n) => 'Not: ' + n),
  ];
  return lines.join('\n');
}
