/**
 * config.ts — Ducati PRO-I EVO BLE yapılandırması.
 *
 * UUID'ler ve komut çerçevesi btsnoop yakalamalarından DOĞRULANDI
 * (bkz. ducati-ble/docs/06-protokol-cozuldu.md).
 */

export const BLE_CONFIG = {
  deviceNameFilter: 'DUCATI',

  // Servis 0xFFF0, komut 0xFFF6, telemetri 0xFFF7 (yakalamadan kesin)
  writeServiceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  writeCharUUID: '0000fff6-0000-1000-8000-00805f9b34fb',
  notifyServiceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  notifyCharUUID: '0000fff7-0000-1000-8000-00805f9b34fb',

  // Orijinal uygulama komutu Write Command (write-without-response) ile yazdı
  writeWithoutResponse: true,
};

/**
 * DOĞRULANMIŞ komutlar (etiketli yakalama ile kesinleşti, replay güvenli).
 * cmd=0x00: KİLİT fonksiyonu. arg 0x40 = kilitle, 0x00 = kilit aç.
 * Telemetride STATE bit 0x80 kilit durumunu yansıtır.
 */
export const COMMANDS = {
  lock: { cmd: 0x00, arg: 0x40 }, // ca ac bd 00 40 fd ba 6a
  unlock: { cmd: 0x00, arg: 0x00 }, // ca ac bd 00 00 bd 7a 6a
};

export const KNOWN_COMMANDS: { label: string; cmd: number; arg: number }[] = [
  { label: 'KİLİTLE 🔒', cmd: COMMANDS.lock.cmd, arg: COMMANDS.lock.arg },
  { label: 'KİLİT AÇ 🔓', cmd: COMMANDS.unlock.cmd, arg: COMMANDS.unlock.arg },
];

/**
 * HENÜZ EŞLEŞMEMİŞ aksiyonlar — HIZ LİMİTİ dahil.
 * Son yakalamada mod (ECO/COMFORT/SPORT) ve far değişimi BLE yazması ÜRETMEDİ;
 * bunlar scooter üzerinden fiziksel yapıldı (uygulama sadece okuyor).
 * Hız limiti / mod komutlarını yakalamak için: uygulamanın EKRAN butonlarına
 * (ECO/COMFORT/SPORT) ve CRUISE/UNIT ayarlarına bas, yeni btsnoop al.
 * Çözülen (cmd,arg) çiftleri buraya eklenecek:
 *   eco:        { cmd: 0x??, arg: 0x?? },
 *   comfort:    { cmd: 0x??, arg: 0x?? },
 *   sport:      { cmd: 0x??, arg: 0x?? },
 *   speedLimit: (kmh: number) => ({ cmd: 0x??, arg: kmh }),
 */
