/**
 * config.ts — Protokolü çözdükten sonra burayı doldur.
 *
 * ducati-ble/ araçlarıyla (scan/enumerate/monitor/checksum) öğrendiğin
 * değerleri buraya gir; uygulamanın geri kalanı bunları kullanır.
 */

export const BLE_CONFIG = {
  /** scan.py ile bulduğun cihaz adının içinde geçen ifade (reklamdan filtre) */
  deviceNameFilter: 'DUCATI',

  /** enumerate.py: [write] / [write-without-response] olan karakteristik */
  writeServiceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb', // TODO: gerçek değer
  writeCharUUID: '0000ffe1-0000-1000-8000-00805f9b34fb', // TODO: gerçek değer

  /** enumerate.py: [notify] olan karakteristik (telemetri buradan gelir) */
  notifyServiceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb', // TODO
  notifyCharUUID: '0000ffe1-0000-1000-8000-00805f9b34fb', // TODO

  /** write-without-response ise true yap (enumerate.py özelliklerine bak) */
  writeWithoutResponse: false,
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
 * Komut gövdeleri (checksum HARİÇ, header DAHİL ya da protocol.ts'e göre).
 * Yakaladığın paketlerden değişen CMD/ARG byte'larını buraya göre eşle.
 * Aşağıdakiler ÖRNEKTİR — gerçek değerleri HCI snoop'tan çıkar.
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
