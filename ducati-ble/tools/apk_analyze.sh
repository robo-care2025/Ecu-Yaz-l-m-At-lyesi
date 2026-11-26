#!/usr/bin/env bash
# apk_analyze.sh — APK içinden BLE/şifreleme ipuçlarını çıkar (kurulum gerektirmez).
#
# APK'yı yüklemene gerek yok; bu script APK'yı yerelinde tarar ve PAYLAŞILABİLİR
# küçük bir rapor üretir (apk_report.txt). O raporu bana gönder.
#
# Kullanım:
#   bash apk_analyze.sh /yol/uygulama.apk
#
# Gereken: unzip, strings (çoğu Linux/macOS'ta hazır). jadx varsa otomatik kullanır.

set -u
APK="${1:-}"
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "Kullanım: bash apk_analyze.sh /yol/uygulama.apk"
  exit 1
fi

OUT="apk_report.txt"
WORK="$(mktemp -d)"
echo "[*] APK: $APK"
echo "[*] Geçici klasör: $WORK"
: > "$OUT"

log() { echo "$@" | tee -a "$OUT"; }

log "===================== APK ANALİZ RAPORU ====================="
log "APK: $(basename "$APK")  boyut: $(du -h "$APK" | cut -f1)"
log ""

# 1) İçerik listesi (dex ve lib sayısı)
log "----- İçerik özeti -----"
unzip -l "$APK" 2>/dev/null | grep -E "classes.*\.dex|\.so$|AndroidManifest" | tee -a "$OUT" >/dev/null
log "$(unzip -l "$APK" 2>/dev/null | grep -cE "classes.*\.dex") adet dex, $(unzip -l "$APK" 2>/dev/null | grep -cE "\.so$") adet native lib"
log ""

# 2) dex'leri çıkar
unzip -o -q "$APK" -d "$WORK" "classes*.dex" 2>/dev/null
unzip -o -q "$APK" -d "$WORK" "lib/*" 2>/dev/null

# 3) Anahtar kelime taraması (string sabitleri — sıklıkla şifre anahtarı/algoritma burada)
KEYWORDS='fff6|fff5|fff7|fff0|AES|DES|Cipher|SecretKey|IvParameter|encrypt|decrypt|Ninebot|ninebot|Segway|scooter|getBytes|BLUETOOTH|GattCharacteristic|writeCharacteristic|SpeedLimit|speedLimit|setSpeed|CRC|checksum|0x5a|handshake|nonce|session'

log "----- String sabiti eşleşmeleri (dex) -----"
for dex in "$WORK"/classes*.dex; do
  [[ -f "$dex" ]] || continue
  log "### $(basename "$dex")"
  strings -n 4 "$dex" 2>/dev/null | grep -aEi "$KEYWORDS" | sort -u | head -200 | tee -a "$OUT" >/dev/null
done
log ""

# 4) Native lib (.so) içinde şifreleme ipucu
log "----- Native lib eşleşmeleri (.so) -----"
for so in $(find "$WORK/lib" -name "*.so" 2>/dev/null); do
  hits=$(strings -n 5 "$so" 2>/dev/null | grep -aEi "AES|Cipher|encrypt|decrypt|key|Ninebot|scooter" | sort -u | head -40)
  if [[ -n "$hits" ]]; then
    log "### $so"
    echo "$hits" | tee -a "$OUT" >/dev/null
  fi
done
log ""

# 5) jadx varsa decompile edip şifreleme sınıfını bul
if command -v jadx >/dev/null 2>&1; then
  log "----- jadx decompile (şifreleme/BLE sınıfları) -----"
  JOUT="$WORK/jadx"
  jadx -q -d "$JOUT" "$APK" >/dev/null 2>&1
  # şifreleme/BLE yapan java dosyalarını bul
  grep -rslEi "Cipher\.getInstance|SecretKeySpec|writeCharacteristic|0000fff6|doFinal" "$JOUT/sources" 2>/dev/null | head -20 | while read -r f; do
    rel="${f#$JOUT/sources/}"
    log ">>> İLGİLİ DOSYA: $rel"
  done
  log ""
  log "[i] jadx çıktısı tam: $JOUT/sources"
  log "[i] Yukarıdaki 'İLGİLİ DOSYA' olarak işaretlenenleri aç ve bana GÖNDER."
else
  log "[i] jadx bulunamadı. Tam kaynak için (opsiyonel):"
  log "    https://github.com/skylot/jadx/releases  →  jadx-gui ile APK'yı aç"
  log "    sonra 'Search' ile: Cipher.getInstance, SecretKeySpec, fff6"
fi

log ""
log "===================== RAPOR SONU ====================="
echo
echo "[+] Rapor yazıldı: $(pwd)/$OUT"
echo "[+] Bu dosyayı (apk_report.txt) bana gönder. jadx kullandıysan işaretli java dosyalarını da ekle."
echo "[*] Geçici klasörü silmek istersen: rm -rf $WORK"
