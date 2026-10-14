/**
 * DashboardScreen.tsx — Ducati PRO-I EVO kontrol + protokol etiketleme ekranı.
 *
 * Şu an protokolün çözülen kısmını kullanır:
 *  - Canlı telemetri (durum baytı) gösterir.
 *  - DOĞRULANMIŞ komutları (replay güvenli) butonla gönderir.
 *  - Ham hex gönderme kutusu: yeni (cmd,arg) denemelerini etiketlemek için
 *    (scooter sehpada, tekerlek yerden kesik).
 *
 * Mod/hız komutları (cmd,arg) eşleşince KNOWN_COMMANDS'a eklenecek.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ble } from '../ble/bleManager';
import { parseTelemetry, modeLabel, Telemetry } from '../ble/telemetry';
import { buildCommand, hexToBytes, validateCommand } from '../ble/protocol';
import { KNOWN_COMMANDS } from '../config';

export default function DashboardScreen() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'connecting' | 'connected'>('idle');
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [rawHex, setRawHex] = useState('ca ac bd 00 40 fd ba 6a');
  const [log, setLog] = useState<string[]>([]);
  const foundRef = useRef(false);

  useEffect(() => () => void ble.disconnect(), []);

  function addLog(line: string) {
    setLog((l) => [new Date().toLocaleTimeString() + '  ' + line, ...l].slice(0, 30));
  }

  async function handleConnect() {
    const ok = await ble.requestPermissions();
    if (!ok) {
      Alert.alert('İzin gerekli', 'Bluetooth izinleri verilmeden taranamaz.');
      return;
    }
    await ble.waitUntilPoweredOn();
    foundRef.current = false;
    setStatus('scanning');
    ble.scan(
      async (device) => {
        if (foundRef.current) return;
        foundRef.current = true;
        setStatus('connecting');
        try {
          await ble.connect(device.id);
          ble.startTelemetry((bytes) => setTelemetry(parseTelemetry(bytes)));
          ble.onDisconnect(() => {
            setStatus('idle');
            addLog('bağlantı koptu');
          });
          setStatus('connected');
          addLog('bağlandı: ' + (device.name || device.id));
        } catch (e: any) {
          Alert.alert('Bağlantı hatası', String(e?.message ?? e));
          setStatus('idle');
        }
      },
      (err) => {
        Alert.alert('Tarama hatası', err.message);
        setStatus('idle');
      },
    );
    setTimeout(() => {
      if (!foundRef.current) {
        ble.stopScan();
        setStatus('idle');
        Alert.alert('Bulunamadı', 'Scooter açık ve telefon uygulaması kapalı mı?');
      }
    }, 15000);
  }

  async function sendBytes(bytes: Uint8Array, label: string) {
    if (!ble.isConnected) {
      Alert.alert('Bağlı değil', "Önce scooter'a bağlan.");
      return;
    }
    try {
      await ble.sendPacket(bytes);
      addLog('→ ' + label + ' : ' + hex(bytes));
    } catch (e: any) {
      Alert.alert('Gönderim hatası', String(e?.message ?? e));
    }
  }

  function sendRaw() {
    const bytes = hexToBytes(rawHex);
    const okTxt = bytes.length === 8 ? (validateCommand(bytes) ? ' (checksum ✓)' : ' (checksum ✗)') : '';
    sendBytes(bytes, 'ham' + okTxt);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>PRO-I EVO</Text>
        <Text style={styles.sub}>özel kontrol · protokol çözüldü</Text>
      </View>

      {/* Bağlan / durum */}
      {status !== 'connected' ? (
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={handleConnect}
          disabled={status === 'scanning' || status === 'connecting'}
        >
          {status === 'idle' ? (
            <Text style={styles.connectTxt}>BAĞLAN</Text>
          ) : (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.connectTxt}> {status === 'scanning' ? 'Taranıyor…' : 'Bağlanıyor…'}</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.connected}>● Bağlı</Text>
      )}

      {/* Telemetri */}
      <Text style={styles.sectionTitle}>Telemetri (0xFFF7)</Text>
      <View style={styles.teleBox}>
        <View style={styles.teleRow}>
          <Metric label="MOD" value={modeLabel(telemetry?.mode ?? null)} />
          <Metric label="FAR" value={telemetry ? (telemetry.headlightOn ? 'AÇIK' : 'kapalı') : '--'} />
          <Metric label="KİLİT" value={telemetry ? (telemetry.locked ? 'KİLİTLİ 🔒' : 'açık 🔓') : '--'} />
        </View>
        {telemetry?.raw ? <Text style={styles.raw}>{telemetry.raw}{telemetry.checksumOk ? '  ck✓' : '  ck✗'}</Text> : null}
      </View>

      {/* Doğrulanmış komutlar */}
      <Text style={styles.sectionTitle}>Doğrulanmış Komutlar (replay)</Text>
      <View style={styles.cmdGrid}>
        {KNOWN_COMMANDS.map((c) => (
          <TouchableOpacity
            key={c.label}
            style={styles.cmdBtn}
            onPress={() => sendBytes(buildCommand(c.cmd, c.arg), c.label)}
          >
            <Text style={styles.cmdTxt}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ham gönderim (etiketleme için) */}
      <Text style={styles.sectionTitle}>Ham Komut (test / etiketleme)</Text>
      <Text style={styles.hint}>
        Scooter sehpada, tekerlek yerden kesikken dene. 8 byte girersen checksum kontrol edilir.
      </Text>
      <TextInput
        style={styles.input}
        value={rawHex}
        onChangeText={setRawHex}
        autoCapitalize="none"
        placeholder="ca ac bd 00 40 fd ba 6a"
      />
      <TouchableOpacity style={styles.sendBtn} onPress={sendRaw}>
        <Text style={styles.connectTxt}>GÖNDER</Text>
      </TouchableOpacity>

      {/* Log */}
      <Text style={styles.sectionTitle}>Log</Text>
      {log.map((l, i) => (
        <Text key={i} style={styles.logLine}>{l}</Text>
      ))}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  header: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 16 },
  brand: { color: '#fff', fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  sub: { color: '#bbb', fontSize: 12, marginTop: 2 },
  connectBtn: { backgroundColor: '#d32f2f', borderRadius: 28, paddingVertical: 14, alignItems: 'center', marginVertical: 8 },
  sendBtn: { backgroundColor: '#111', borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  connectTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  connected: { color: '#2e7d32', fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 22, marginBottom: 8 },
  teleBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16 },
  teleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { color: '#888', fontSize: 11, letterSpacing: 1 },
  metricValue: { color: '#111', fontSize: 16, fontWeight: '800', marginTop: 4 },
  raw: { color: '#aaa', fontSize: 10, marginTop: 10, fontFamily: 'monospace', textAlign: 'center' },
  cmdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cmdBtn: { flexGrow: 1, flexBasis: '45%', borderWidth: 1.5, borderColor: '#d32f2f', borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  cmdTxt: { fontWeight: '700', color: '#d32f2f', fontSize: 12 },
  hint: { color: '#999', fontSize: 11, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontFamily: 'monospace', fontSize: 14 },
  logLine: { fontSize: 11, color: '#555', fontFamily: 'monospace', paddingVertical: 1 },
});
