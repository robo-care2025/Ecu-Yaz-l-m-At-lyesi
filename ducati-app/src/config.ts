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
 * DOĞRULANMIŞ komutlar (replay güvenli — birebir yakalanmış paketler).
 * cmd=0x00 ile bir fonksiyon açılıp kapanıyor (arg 0x40=açık, 0x00=kapalı).
 * Bu fonksiyonun ADI henüz etiketlenmedi (kilit mi? far mı? cruise mı?) —
 * replay testiyle (scooter sehpada) belirlenecek.
 */
export const KNOWN_COMMANDS: { label: string; cmd: number; arg: number }[] = [
  { label: 'cmd00 arg40 (açık?)', cmd: 0x00, arg: 0x40 },
  { label: 'cmd00 arg00 (kapalı?)', cmd: 0x00, arg: 0x00 },
];

/**
 * HENÜZ EŞLEŞMEMİŞ aksiyonlar.
 * Mod (ECO/COMFORT/SPORT) ve hız limiti komutları bu yakalamada BLE yazması
 * olarak GÖRÜNMEDİ — ya scooter üzerinden fiziksel değişiyor ya da ayrı bir
 * komutla. Her aksiyonu tek tek yapan etiketli bir yakalama ile (cmd,arg)
 * çiftleri buraya eklenecek.
 *
 * Örn (çözülünce):
 *   eco:   { cmd: 0x??, arg: 0x?? },
 *   sport: { cmd: 0x??, arg: 0x?? },
 *   speedLimit: (kmh) => ({ cmd: 0x??, arg: kmh }),
 */
