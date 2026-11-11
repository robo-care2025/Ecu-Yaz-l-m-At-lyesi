/*
  Batarya Ölçer - ESP32 + INA226
  --------------------------------
  Batarya paketinin voltajını, akımını ve sıcaklığını ölçer; saniyede 5 kez
  hem USB'den hem Bluetooth'tan (BLE) şu biçimde bir satır yollar:

      {"t":12345,"v":38.21,"i":-3.42,"tc":24.5}

  t  = milisaniye, v = Volt, i = Amper (ARTI: şarj, EKSİ: deşarj), tc = °C

  Arduino IDE: Kart = "ESP32 Dev Module". Ek kütüphane GEREKMEZ.
  Bağlantı şeması: docs/DONANIM.md

  DURUM: Bu kod henüz gerçek kartta denenmedi. İlk yüklemede Seri Monitör'den
  (115200) değerleri multimetre ile karşılaştırıp aşağıdaki ayarları düzeltin.
*/

#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------------------------------------------------------------- AYARLAR
// Şönt direnci (Ohm). 20 A / 75 mV şönt = 0.00375 Ω. INA226 modülünün
// üstündeki R100 (0.1 Ω) direnç SÖKÜLMELİ; o en fazla 0.8 A ölçer.
const float SONT_OHM = 0.00375;

// Voltaj bölücü oranı. 30k + 10k dirençle teorik 4.0; INA226 girişinin kendi
// direnci yüzünden gerçekte ~4.04 çıkar. Multimetre ile ölçüp düzeltin:
//   yeni oran = eski oran x (multimetre voltajı / ekrandaki voltaj)
const float VOLTAJ_BOLUCU = 4.04;

// Akım yönü ters çıkarsa (gaza basınca ARTI görüyorsanız) -1 yapın.
const float AKIM_YONU = 1.0;

// Sıcaklık sensörü: 10k NTC (B=3950), 3.3V - [10k direnç] - GPIO34 - [NTC] - GND
const int NTC_PIN = 34;       // sensör takılı değilse -1 yapın
const float NTC_B = 3950.0;

const int OLCUM_ARALIGI_MS = 200;
const char *BLE_ADI = "BataryaOlcer";
// ------------------------------------------------------------------------

const uint8_t INA226_ADRES = 0x40;
// BLE "Nordic UART" servisi - telefon uygulamaları bunu hazır tanır
#define NUS_SERVIS "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_TX     "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLECharacteristic *bleTx = nullptr;
bool bleBagli = false;
bool inaVar = false;

class BaglantiOlaylari : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { bleBagli = true; }
  void onDisconnect(BLEServer *s) override {
    bleBagli = false;
    s->startAdvertising();  // bağlantı kopunca tekrar görünür ol
  }
};

void inaYaz(uint8_t reg, uint16_t deger) {
  Wire.beginTransmission(INA226_ADRES);
  Wire.write(reg);
  Wire.write(deger >> 8);
  Wire.write(deger & 0xFF);
  Wire.endTransmission();
}

int16_t inaOku(uint8_t reg) {
  Wire.beginTransmission(INA226_ADRES);
  Wire.write(reg);
  Wire.endTransmission();
  Wire.requestFrom(INA226_ADRES, (uint8_t)2);
  if (Wire.available() < 2) return 0;
  uint16_t ust = Wire.read();
  return (int16_t)((ust << 8) | Wire.read());
}

float sicaklikOku() {
  if (NTC_PIN < 0) return NAN;
  uint32_t mv = analogReadMilliVolts(NTC_PIN);
  if (mv < 50 || mv > 3200) return NAN;            // sensör takılı değil / kısa devre
  float r = 10000.0 * mv / (3300.0 - mv);          // NTC direnci
  float kelvin = 1.0 / (1.0 / 298.15 + log(r / 10000.0) / NTC_B);
  return kelvin - 273.15;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);  // SDA = GPIO21, SCL = GPIO22

  Wire.beginTransmission(INA226_ADRES);
  inaVar = (Wire.endTransmission() == 0);
  // 0x4527: 16 ölçüm ortalaması, 1.1 ms çevrim, sürekli ölçüm (~35 ms'de bir yeni değer)
  if (inaVar) inaYaz(0x00, 0x4527);

  BLEDevice::init(BLE_ADI);
  BLEServer *sunucu = BLEDevice::createServer();
  sunucu->setCallbacks(new BaglantiOlaylari());
  BLEService *servis = sunucu->createService(NUS_SERVIS);
  bleTx = servis->createCharacteristic(NUS_TX, BLECharacteristic::PROPERTY_NOTIFY);
  bleTx->addDescriptor(new BLE2902());
  servis->start();
  sunucu->getAdvertising()->addServiceUUID(NUS_SERVIS);
  sunucu->getAdvertising()->start();

  Serial.println(inaVar ? "Batarya olcer basladi" : "HATA: INA226 bulunamadi (kablolari kontrol edin)");
}

void loop() {
  static uint32_t sonraki = 0;
  uint32_t simdi = millis();
  if ((int32_t)(simdi - sonraki) < 0) return;
  sonraki = simdi + OLCUM_ARALIGI_MS;

  if (!inaVar) {
    Serial.println("HATA: INA226 bulunamadi");
    delay(2000);
    return;
  }

  float sontVolt = inaOku(0x01) * 2.5e-6;                 // 1 adım = 2.5 µV
  float voltaj = (uint16_t)inaOku(0x02) * 1.25e-3 * VOLTAJ_BOLUCU;  // 1 adım = 1.25 mV
  float akim = AKIM_YONU * sontVolt / SONT_OHM;
  float tc = sicaklikOku();

  char satir[96];
  if (isnan(tc)) {
    snprintf(satir, sizeof(satir), "{\"t\":%lu,\"v\":%.2f,\"i\":%.3f}\n",
             (unsigned long)simdi, voltaj, akim);
  } else {
    snprintf(satir, sizeof(satir), "{\"t\":%lu,\"v\":%.2f,\"i\":%.3f,\"tc\":%.1f}\n",
             (unsigned long)simdi, voltaj, akim, tc);
  }

  Serial.print(satir);
  if (bleBagli) {
    bleTx->setValue((uint8_t *)satir, strlen(satir));
    bleTx->notify();
  }
}
