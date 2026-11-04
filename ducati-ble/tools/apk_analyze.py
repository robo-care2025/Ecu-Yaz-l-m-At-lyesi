#!/usr/bin/env python3
"""
apk_analyze.py — APK'yı tarayıp BLE/şifreleme ipuçlarını çıkarır (SAF PYTHON).

Windows/macOS/Linux'ta sadece Python 3 ile çalışır (ek kurulum yok). APK'yı
yüklemene gerek yok; bu script APK'yı yerelinde tarar ve paylaşılabilir küçük
bir rapor üretir: apk_report.txt. O dosyayı bana gönder.

Kullanım (Windows):
    python apk_analyze.py "C:\\Users\\emree\\OneDrive\\Masaustu\\OneDrive\\E-mobility.apk"

Kullanım (macOS/Linux):
    python3 apk_analyze.py /yol/E-mobility.apk
"""
import re
import sys
import zipfile

KEYWORDS = [
    r"0000fff[0-9a-f]", r"fff6", r"fff5", r"fff7", r"fff1", r"fff2", r"fff3",
    r"AES", r"DES", r"Cipher", r"SecretKey", r"IvParameter", r"encrypt", r"decrypt",
    r"Ninebot", r"ninebot", r"Segway", r"scooter", r"getInstance",
    r"writeCharacteristic", r"BluetoothGatt", r"SpeedLimit", r"speedLimit",
    r"setSpeed", r"CRC", r"checksum", r"handshake", r"nonce", r"session",
    r"doFinal", r"ECB", r"CBC", r"NoPadding", r"PKCS",
]
KEY_RE = re.compile("|".join(KEYWORDS), re.IGNORECASE)

# yazdırılabilir ASCII dizileri (strings komutunun yaptığı iş)
PRINTABLE = re.compile(rb"[\x20-\x7e]{4,}")


def strings_of(data: bytes):
    for m in PRINTABLE.finditer(data):
        yield m.group().decode("ascii", "ignore")


def scan_blob(name: str, data: bytes, out, limit: int = 300):
    hits = []
    seen = set()
    for s in strings_of(data):
        if KEY_RE.search(s) and s not in seen:
            seen.add(s)
            hits.append(s)
            if len(hits) >= limit:
                break
    out.append(f"### {name}  ({len(hits)} eşleşme)")
    out.extend("    " + h for h in hits)
    out.append("")
    return len(hits)


def main(apk_path: str):
    try:
        z = zipfile.ZipFile(apk_path)
    except Exception as e:
        print(f"[!] APK açılamadı: {e}")
        sys.exit(1)

    names = z.namelist()
    dex = [n for n in names if re.fullmatch(r"classes\d*\.dex", n)]
    so = [n for n in names if n.endswith(".so")]

    out = []
    out.append("===================== APK ANALİZ RAPORU =====================")
    out.append(f"APK: {apk_path}")
    out.append(f"dex dosyaları: {len(dex)}  |  native lib (.so): {len(so)}")
    out.append("")

    # bazen paket adı / imza ipucu AndroidManifest'te
    if "AndroidManifest.xml" in names:
        try:
            mf = z.read("AndroidManifest.xml")
            pkg = re.findall(rb"[\x20-\x7e]{5,}", mf)
            cand = [p.decode("ascii", "ignore") for p in pkg if b"." in p and (b"com" in p or b"ble" in p.lower())]
            out.append("----- AndroidManifest ipuçları (paket/izin) -----")
            out.extend("    " + c for c in sorted(set(cand))[:40])
            out.append("")
        except Exception:
            pass

    out.append("----- dex string sabiti eşleşmeleri -----")
    for d in dex:
        scan_blob(d, z.read(d), out)

    if so:
        out.append("----- native lib (.so) eşleşmeleri -----")
        for s in so:
            scan_blob(s, z.read(s), out, limit=60)

    # özellikle AES anahtarı adaylarını vurgula: Cipher/SecretKey çevresindeki kısa hex/base64
    out.append("----- OLASI ANAHTAR/ALGORITMA ADAYLARI -----")
    key_hints = []
    for d in dex:
        data = z.read(d)
        for s in strings_of(data):
            if re.search(r"AES/|/ECB|/CBC|NoPadding|PKCS5", s):
                key_hints.append(f"[algoritma] {s}")
            # 16/32 byte gibi görünen saf hex ya da base64 sabitler
            if re.fullmatch(r"[0-9a-fA-F]{16,64}", s):
                key_hints.append(f"[hex-sabit?] {s}")
    for h in sorted(set(key_hints))[:60]:
        out.append("    " + h)
    out.append("")
    out.append("===================== RAPOR SONU =====================")

    report = "\n".join(out)
    with open("apk_report.txt", "w", encoding="utf-8") as f:
        f.write(report)

    print(report[:2000])
    print("\n...")
    print("[+] Tam rapor yazıldı: apk_report.txt")
    print("[+] Bu dosyayı bana gönder (küçük bir metin dosyası).")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Kullanım: python apk_analyze.py "APK_YOLU"')
        sys.exit(1)
    main(sys.argv[1])
