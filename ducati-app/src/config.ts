/**
 * config.ts — Ducati PRO-I EVO BLE yapılandırması.
 *
 * UUID'ler, komut çerçevesi ve mod komutları üç btsnoop yakalamasından
 * DOĞRULANDI (bkz. ducati-ble/docs/07-tam-cozum.md).
 */

export const BLE_CONFIG = {
  deviceNameFilter: 'DUCATI',
  writeServiceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  writeCharUUID: '0000fff6-0000-1000-8000-00805f9b34fb',
  notifyServiceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  notifyCharUUID: '0000fff7-0000-1000-8000-00805f9b34fb',
  writeWithoutResponse: true,
};

export type ModeId = 1 | 2 | 3;

/**
 * Mod tabanları (komutun B3,B4 alanları). Mutlak durum yansıması.
 * Hız limiti = mod seçimi: ECO en yavaş, SPORT en hızlı.
 *   MOD1 ECO:   ca ac bd 00 00 bd 7a 6a
 *   MOD2:       ca ac bd 00 01 bc 79 6a
 *   MOD3 SPORT: ca ac bd 04 01 b8 79 6a
 */
export const MODES: Record<ModeId, { b3: number; b4: number; label: string }> = {
  1: { b3: 0x00, b4: 0x00, label: 'ECO' },
  2: { b3: 0x00, b4: 0x01, label: 'COMFORT' },
  3: { b3: 0x04, b4: 0x01, label: 'SPORT' },
};

/**
 * Bayrak bitleri (aktif modun ARG'ına OR'lanır).
 * cruise: ARG|0x02, far: ARG|0x18, lock: ARG|0x40 — yakalamadan.
 * Not: far/cruise yalnızca mod3 bağlamında yakalandı; mod1/2'de de aynı
 * bit mantığı beklenir ama replay testiyle doğrula.
 */
export const FLAGS = {
  cruise: 0x02,
  far: 0x18,
  lock: 0x40,
};

/** Doğrulanmış ham komutlar (replay referansı / test için). */
export const KNOWN_COMMANDS: { label: string; b3: number; b4: number }[] = [
  { label: 'ECO', b3: 0x00, b4: 0x00 },
  { label: 'COMFORT', b3: 0x00, b4: 0x01 },
  { label: 'SPORT', b3: 0x04, b4: 0x01 },
  { label: 'KİLİTLE (mod1)', b3: 0x00, b4: 0x40 },
  { label: 'KİLİT AÇ (mod1)', b3: 0x00, b4: 0x00 },
];
