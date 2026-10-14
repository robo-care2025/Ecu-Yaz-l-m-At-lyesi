/**
 * config.ts — Protokolü çözdükten sonra burayı doldur.
 *
 * ducati-ble/ araçlarıyla (scan/enumerate/monitor/checksum) öğrendiğin
 * değerleri buraya gir; uygulamanın geri kalanı bunları kullanır.
 */

// NOT: UUID'ler btsnoop_hci.log analizinden DOĞRULANDI (docs/03-bulgular.md).
// Servis 0xFFF0, telemetri 0xFFF7, komut 0xFFF6.
export const BLE_CONFIG = {
  /** scan.py ile bulduğun cihaz adının içinde geçen ifade (reklamdan filtre) */
  deviceNameFilter: 'DUCATI',

  /** Komut yazılan karakteristik: 0xFFF6 (read/write/write-no-resp) */
  writeServiceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  writeCharUUID: '0000fff6-0000-1000-8000-00805f9b34fb',

  /** Telemetri (notify) karakteristiği: 0xFFF7 */
  notifyServiceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  notifyCharUUID: '0000fff7-0000-1000-8000-00805f9b34fb',

  /** 0xFFF6 hem write hem write-no-resp destekliyor; orijinal uygulama
   *  Write Command (write-without-response) kullandı. */
  writeWithoutResponse: true,
};

/**
 * Protokol parametreleri — docs/02-komut-haritasi.md'den.
 * Header + checksum yöntemini çözünce protocol.ts bunları kullanır.
 */
export const PROTOCOL = {
  /** Her paketin başındaki sabit önek (örn [0x5a, 0xa5]) */
  header: [0x5a, 0xa5] as number[],

  /** checksum.py --verify sonucu: 'sum8' | 'xor8' | 'neg_sum8' | 'twos_sum8' | 'ninebot' | 'sum16_le' | 'none' */
  checksum: 'sum8' as ChecksumMethod,

  /** checksum hesabında header'ı dahil etme (checksum.py "ilk N byte hariç" tuttuysa) */
  checksumSkipHeader: 0,
};

export type ChecksumMethod =
  | 'sum8'
  | 'xor8'
  | 'neg_sum8'
  | 'twos_sum8'
  | 'ninebot'
  | 'sum16_le'
  | 'none';

/**
 * ⚠️ DİKKAT — ŞİFRELEME UYARISI (docs/03-bulgular.md):
 * İlk yakalamada komut kanalına (0xFFF6) yazılan tek paket
 * `ca ac bd 04 01 b8 79 6a` idi; telemetrinin aksine `5a` başlığı YOK, yani
 * komutlar büyük olasılıkla ŞİFRELİ. Aşağıdaki header/checksum/COMMANDS
 * değerleri yalnızca ŞİFRE OLMAYAN protokoller için ÖRNEK şablondur.
 *
 * Komutları göndermeden önce ya (a) çok sayıda yakalamayla şemanın sabit
 * olduğunu doğrula ve byte'ları buraya gir, ya da (b) APK analizinden
 * çıkan şifreleme fonksiyonunu protocol.ts içine ekle (buildPacket'i
 * şifreleyecek şekilde değiştir).
 *
 * Komut gövdeleri (checksum HARİÇ). Aşağıdakiler ÖRNEKTİR.
 */
export const COMMANDS = {
  mode: {
    // [cmd, arg] — arg: hangi mod
    pedestrian: [0x01, 0x20, 0x01, 0x00],
    eco: [0x01, 0x20, 0x01, 0x01],
    comfort: [0x01, 0x20, 0x01, 0x02],
    sport: [0x01, 0x20, 0x01, 0x03],
  },
  /** Hız limiti: son byte km/h değeridir (protocol.ts setSpeedLimit ile) */
  speedLimitBase: [0x01, 0x20, 0x02],
  light: {
    on: [0x01, 0x21, 0x01, 0x01],
    off: [0x01, 0x21, 0x01, 0x00],
  },
  lock: {
    lock: [0x01, 0x22, 0x01, 0x01],
    unlock: [0x01, 0x22, 0x01, 0x00],
  },
};
