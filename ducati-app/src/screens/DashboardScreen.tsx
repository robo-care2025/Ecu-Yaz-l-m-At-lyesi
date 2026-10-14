/**
 * DashboardScreen.tsx — Ana kontrol ekranı.
 *
 * Orijinal uygulamayı karşılar: bağlan, mod seç (PEDESTRIAN/ECO/COMFORT/SPORT),
 * hız limiti ayarla, far ve kilit. Telemetri (hız/batarya/mod) üstte gösterilir.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { ble } from '../ble/bleManager';
import { parseTelemetry, Telemetry } from '../ble/telemetry';
import {
  buildMode,
  buildSpeedLimit,
  buildLight,
  buildLock,
} from '../ble/protocol';

type Mode = 'pedestrian' | 'eco' | 'comfort' | 'sport';
const MODES: Mode[] = ['pedestrian', 'eco', 'comfort', 'sport'];
const MODE_LABEL: Record<Mode, string> = {
  pedestrian: 'PEDESTRIAN',
  eco: 'ECO',
  comfort: 'COMFORT',
  sport: 'SPORT',
};

export default function DashboardScreen() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'connecting' | 'connected'>('idle');
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [mode, setMode] = useState<Mode>('eco');
  const [speedLimit, setSpeedLimit] = useState(25);
  const [light, setLight] = useState(false);
  const [locked, setLocked] = useState(false);
  const foundRef = useRef(false);

  useEffect(() => () => void ble.disconnect(), []);

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
            setTelemetry(null);
          });
          setStatus('connected');
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
    // 15 sn içinde bulunamazsa durdur
    setTimeout(() => {
      if (!foundRef.current) {
        ble.stopScan();
        setStatus('idle');
        Alert.alert('Bulunamadı', 'Scooter açık ve telefon uygulaması kapalı mı?');
      }
    }, 15000);
  }

  async function send(fn: () => Promise<void>) {
    try {
      if (!ble.isConnected) {
        Alert.alert('Bağlı değil', 'Önce scooter\'a bağlan.');
        return;
      }
      await fn();
    } catch (e: any) {
      Alert.alert('Gönderim hatası', String(e?.message ?? e));
    }
  }

  const onPickMode = (m: Mode) => {
    setMode(m);
    send(() => ble.sendPacket(buildMode(m)));
  };
  const onSetSpeed = (v: number) => send(() => ble.sendPacket(buildSpeedLimit(v)));
  const onToggleLight = (v: boolean) => {
    setLight(v);
    send(() => ble.sendPacket(buildLight(v)));
  };
  const onToggleLock = (v: boolean) => {
    setLocked(v);
    send(() => ble.sendPacket(buildLock(v)));
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>PRO-I EVO</Text>
        <Text style={styles.sub}>Urban e-Mobility · özel kontrol</Text>
      </View>

      {/* Telemetri */}
      <View style={styles.telemetry}>
        <Metric label="HIZ" value={telemetry?.speedKmh != null ? `${telemetry.speedKmh}` : '--'} unit="km/h" />
        <Metric label="BATARYA" value={telemetry?.batteryPct != null ? `${telemetry.batteryPct}` : '--'} unit="%" />
        <Metric label="MOD" value={telemetry?.mode ? MODE_LABEL[telemetry.mode] : '--'} unit="" />
      </View>
      {telemetry?.errorCode ? (
        <Text style={styles.error}>⚠ Hata kodu: {telemetry.errorCode}</Text>
      ) : null}

      {/* Bağlan */}
      {status !== 'connected' ? (
        <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={status === 'scanning' || status === 'connecting'}>
          {status === 'idle' ? (
            <Text style={styles.connectTxt}>BAĞLAN</Text>
          ) : (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.connectTxt}>  {status === 'scanning' ? 'Taranıyor…' : 'Bağlanıyor…'}</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.connected}>● Bağlı</Text>
      )}

      {/* Mod seçimi */}
      <Text style={styles.sectionTitle}>Sürüş Modu</Text>
      <View style={styles.modeGrid}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => onPickMode(m)}
          >
            <Text style={[styles.modeTxt, mode === m && styles.modeTxtActive]}>{MODE_LABEL[m]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hız limiti */}
      <Text style={styles.sectionTitle}>Hız Limiti: {speedLimit} km/h</Text>
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={6}
        maximumValue={30}
        step={1}
        value={speedLimit}
        onValueChange={setSpeedLimit}
        onSlidingComplete={onSetSpeed}
        minimumTrackTintColor="#d32f2f"
        maximumTrackTintColor="#ccc"
      />
      <Text style={styles.hint}>
        Kaydırıcıyı bırakınca scooter'a yazılır. Yasal sınırları aşma — sorumluluk sana ait.
      </Text>

      {/* Far & Kilit */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Far</Text>
        <Switch value={light} onValueChange={onToggleLight} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Kilit</Text>
        <Switch value={locked} onValueChange={onToggleLock} />
      </View>

      {telemetry?.raw ? <Text style={styles.raw}>raw: {telemetry.raw}</Text> : null}
    </ScrollView>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  header: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 16 },
  brand: { color: '#fff', fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  sub: { color: '#bbb', fontSize: 12, marginTop: 2 },
  telemetry: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { color: '#888', fontSize: 11, letterSpacing: 1 },
  metricValue: { color: '#111', fontSize: 24, fontWeight: '800', marginTop: 4 },
  metricUnit: { fontSize: 12, color: '#888', fontWeight: '400' },
  error: { color: '#d32f2f', fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  connectBtn: { backgroundColor: '#d32f2f', borderRadius: 28, paddingVertical: 14, alignItems: 'center', marginVertical: 8 },
  connectTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  connected: { color: '#2e7d32', fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 20, marginBottom: 8 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeBtn: { flexGrow: 1, flexBasis: '45%', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#d32f2f', borderColor: '#d32f2f' },
  modeTxt: { fontWeight: '800', color: '#555' },
  modeTxtActive: { color: '#fff' },
  hint: { color: '#999', fontSize: 11, marginTop: 4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  raw: { color: '#bbb', fontSize: 10, marginTop: 16, fontFamily: 'monospace' },
});
