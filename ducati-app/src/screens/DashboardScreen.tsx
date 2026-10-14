/**
 * DashboardScreen.tsx — Ducati PRO-I EVO kontrol ekranı.
 *
 * Çözülen protokolle: mod (= hız limiti) seçimi, kilit, far, cruise,
 * canlı telemetri (mod/hız/kilit/far). Ayrıca ham komut test kutusu.
 *
 * Komutlar mutlak durum yansıması olduğundan bayraklar (far/kilit/cruise)
 * seçili moda OR'lanarak gönderilir.
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
import { buildMode, buildState, hexToBytes, validateCommand } from '../ble/protocol';
import { MODES, ModeId } from '../config';

const MODE_IDS: ModeId[] = [1, 2, 3];

export default function DashboardScreen() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'connecting' | 'connected'>('idle');
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [mode, setMode] = useState<ModeId>(1);
  const [lock, setLock] = useState(false);
  const [far, setFar] = useState(false);
  const [cruise, setCruise] = useState(false);
  const [rawHex, setRawHex] = useState('ca ac bd 04 01 b8 79 6a');
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
          ble.startTelemetry((bytes) => {
            const t = parseTelemetry(bytes);
            setTele(t);
            if (t.mode && (t.mode === 1 || t.mode === 2 || t.mode === 3)) setMode(t.mode as ModeId);
            setLock(t.locked);
            setFar(t.headlightOn);
            setCruise(t.cruiseOn);
          });
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

  async function send(bytes: Uint8Array, label: string) {
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

  // Mod seç (hız limiti). Aktif bayraklarla birlikte gönderilir.
  function pickMode(m: ModeId) {
    setMode(m);
    send(buildState(m, { lock, far, cruise }), 'MOD ' + MODES[m].label);
  }
  function toggle(kind: 'lock' | 'far' | 'cruise', val: boolean) {
    const next = { lock, far, cruise, [kind]: val };
    if (kind === 'lock') setLock(val);
    if (kind === 'far') setFar(val);
    if (kind === 'cruise') setCruise(val);
    send(buildState(mode, next), kind + (val ? ' açık' : ' kapalı'));
  }

  function sendRaw() {
    const bytes = hexToBytes(rawHex);
    const ok = bytes.length === 8 ? (validateCommand(bytes) ? ' (ck✓)' : ' (ck✗)') : '';
    send(bytes, 'ham' + ok);
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
      <View style={styles.teleBox}>
        <View style={styles.teleRow}>
          <Metric label="HIZ" value={tele?.speedKmh != null ? String(tele.speedKmh) : '--'} unit="km/h*" />
          <Metric label="MOD" value={modeLabel(tele?.mode ?? null)} />
          <Metric label="KİLİT" value={tele ? (tele.locked ? '🔒' : '🔓') : '--'} />
        </View>
        <Text style={styles.calib}>*hız ölçeği kalibre edilmeli (telemetry.ts SPEED_SCALE)</Text>
        {tele?.raw ? <Text style={styles.raw}>{tele.raw}</Text> : null}
      </View>

      {/* Mod = hız limiti */}
      <Text style={styles.sectionTitle}>Sürüş Modu (hız limiti)</Text>
      <View style={styles.modeRow}>
        {MODE_IDS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => pickMode(m)}
          >
            <Text style={[styles.modeTxt, mode === m && styles.modeTxtActive]}>{MODES[m].label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>ECO en düşük hız limiti · SPORT en yüksek. Yasal sınırı aşma — sorumluluk sende.</Text>

      {/* Bayraklar */}
      <Text style={styles.sectionTitle}>Kontroller</Text>
      <View style={styles.toggleRow}>
        <Toggle label="🔒 Kilit" on={lock} onPress={() => toggle('lock', !lock)} />
        <Toggle label="💡 Far" on={far} onPress={() => toggle('far', !far)} />
        <Toggle label="🛞 Cruise" on={cruise} onPress={() => toggle('cruise', !cruise)} />
      </View>

      {/* Ham gönderim */}
      <Text style={styles.sectionTitle}>Ham Komut (test)</Text>
      <TextInput
        style={styles.input}
        value={rawHex}
        onChangeText={setRawHex}
        autoCapitalize="none"
        placeholder="ca ac bd 04 01 b8 79 6a"
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

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value}
        {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.toggleBtn, on && styles.toggleOn]} onPress={onPress}>
      <Text style={[styles.toggleTxt, on && styles.toggleTxtOn]}>{label}</Text>
      <Text style={[styles.toggleState, on && styles.toggleTxtOn]}>{on ? 'AÇIK' : 'kapalı'}</Text>
    </TouchableOpacity>
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
  metricValue: { color: '#111', fontSize: 20, fontWeight: '800', marginTop: 4 },
  metricUnit: { fontSize: 11, color: '#888', fontWeight: '400' },
  calib: { color: '#bbb', fontSize: 9, textAlign: 'center', marginTop: 6 },
  raw: { color: '#aaa', fontSize: 10, marginTop: 6, fontFamily: 'monospace', textAlign: 'center' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 24, paddingVertical: 16, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#d32f2f', borderColor: '#d32f2f' },
  modeTxt: { fontWeight: '800', color: '#555', fontSize: 13 },
  modeTxtActive: { color: '#fff' },
  hint: { color: '#999', fontSize: 11, marginTop: 6 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  toggleOn: { backgroundColor: '#111', borderColor: '#111' },
  toggleTxt: { fontWeight: '700', color: '#555', fontSize: 13 },
  toggleTxtOn: { color: '#fff' },
  toggleState: { fontSize: 10, color: '#999', marginTop: 2 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontFamily: 'monospace', fontSize: 14 },
  logLine: { fontSize: 11, color: '#555', fontFamily: 'monospace', paddingVertical: 1 },
});
