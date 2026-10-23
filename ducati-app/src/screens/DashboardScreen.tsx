/**
 * DashboardScreen.tsx — Ducati PRO-I EVO kontrol ekranı (koyu tema).
 * Hız kadranı, mod (hız limiti), Zero Start, kilit/far/cruise, canlı telemetri.
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
  StatusBar,
} from 'react-native';
import { ble } from '../ble/bleManager';
import { parseTelemetry, modeLabel, Telemetry } from '../ble/telemetry';
import { buildState, hexToBytes, validateCommand } from '../ble/protocol';
import { MODES, ModeId, ADVANCED_PIN } from '../config';
import { Gauge } from '../components/Gauge';
import { BatteryTestCard } from '../components/BatteryTestCard';

const MODE_IDS: ModeId[] = [1, 2, 3];
const RED = '#E2001A';
const MUTED = '#8A8A8E';

function modeColor(mode: number | null): string {
  if (mode === 1) return '#27C26E';
  if (mode === 2) return '#F5A623';
  if (mode === 3) return RED;
  return MUTED;
}

export default function DashboardScreen() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'connecting' | 'connected'>('idle');
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [mode, setMode] = useState<ModeId>(1);
  const [lock, setLock] = useState(false);
  const [far, setFar] = useState(false);
  const [cruise, setCruise] = useState(false);
  const [zeroStart, setZeroStart] = useState(false);
  const [rawHex, setRawHex] = useState('ca ac bd 04 01 b8 79 6a');
  const [log, setLog] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [advUnlocked, setAdvUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const foundRef = useRef(false);

  useEffect(() => () => void ble.disconnect(), []);

  function addLog(line: string) {
    setLog((l) => [new Date().toLocaleTimeString() + '  ' + line, ...l].slice(0, 40));
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
            if (t.mode === 1 || t.mode === 2 || t.mode === 3) setMode(t.mode as ModeId);
            setLock(t.locked);
            setFar(t.headlightOn);
            setCruise(t.cruiseOn);
            setZeroStart(t.zeroStartOn);
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
      addLog('→ ' + label);
    } catch (e: any) {
      Alert.alert('Gönderim hatası', String(e?.message ?? e));
    }
  }

  function pickMode(m: ModeId) {
    setMode(m);
    send(buildState(m, { lock, far, cruise, zeroStart }), 'MOD ' + MODES[m].label);
  }
  function toggle(kind: 'lock' | 'far' | 'cruise' | 'zeroStart', val: boolean) {
    const next = { lock, far, cruise, zeroStart, [kind]: val };
    if (kind === 'lock') setLock(val);
    if (kind === 'far') setFar(val);
    if (kind === 'cruise') setCruise(val);
    if (kind === 'zeroStart') setZeroStart(val);
    send(buildState(mode, next), kind + (val ? ' açık' : ' kapalı'));
  }
  function sendRaw() {
    const bytes = hexToBytes(rawHex);
    const ok = bytes.length === 8 ? (validateCommand(bytes) ? ' ck✓' : ' ck✗') : '';
    send(bytes, 'ham' + ok);
  }

  const connected = status === 'connected';
  const mColor = modeColor(tele?.mode ?? mode);
  const speed = tele?.speedKmh != null ? Math.round(tele.speedKmh) : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0C" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Marka + durum */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>
              PRO-<Text style={{ color: RED }}>I</Text> EVO
            </Text>
            <Text style={styles.brandSub}>Urban e-Mobility</Text>
          </View>
          <View style={[styles.statusPill, connected ? styles.pillOn : styles.pillOff]}>
            <View style={[styles.dot, { backgroundColor: connected ? '#27C26E' : MUTED }]} />
            <Text style={styles.statusTxt}>{connected ? 'Bağlı' : 'Bağlı değil'}</Text>
          </View>
        </View>

        {/* Kadran */}
        <View style={styles.gaugeCard}>
          <Gauge
            value={speed}
            max={30}
            unit="km/h"
            color={mColor}
            sub={tele ? modeLabel(tele.mode) : '—'}
          />
          <Battery pct={tele?.batteryPct ?? null} />
          <View style={styles.badges}>
            <Badge label="KİLİT" on={!!tele?.locked} onColor={RED} icon="🔒" offIcon="🔓" />
            <Badge label="FAR" on={!!tele?.headlightOn} onColor="#F5A623" icon="💡" offIcon="💡" />
            <Badge label="ZERO" on={!!tele?.zeroStartOn} onColor="#27C26E" icon="🚀" offIcon="🚀" />
            <Badge label="CRUISE" on={!!tele?.cruiseOn} onColor="#3498DB" icon="🛞" offIcon="🛞" />
          </View>
        </View>

        {/* Sürüş süresi + Durum */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>SÜRÜŞ SÜRESİ</Text>
            <Text style={styles.infoValue}>
              {tele?.rideTime ?? '--'}
              <Text style={styles.infoUnit}> dk:sn</Text>
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>DURUM</Text>
            <Text style={[styles.infoHealth, { color: tele?.fault ? RED : '#27C26E' }]}>
              {tele == null ? '—' : tele.fault ? `⚠ Arıza 0x${tele.faultCode.toString(16)}` : '✓ Sorun yok'}
            </Text>
          </View>
        </View>

        {/* Bağlan */}
        {!connected && (
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={handleConnect}
            disabled={status === 'scanning' || status === 'connecting'}
            activeOpacity={0.85}
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
        )}

        {/* Mod */}
        <Text style={styles.section}>SÜRÜŞ MODU — hız limiti</Text>
        <View style={styles.modeRow}>
          {MODE_IDS.map((m) => {
            const active = (tele?.mode ?? mode) === m;
            const c = modeColor(m);
            return (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, active && { backgroundColor: c, borderColor: c }]}
                onPress={() => pickMode(m)}
                activeOpacity={0.85}
              >
                <Text style={[styles.modeTxt, active && styles.modeTxtOn]}>{MODES[m].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Zero Start */}
        <TouchableOpacity
          style={[styles.zeroBtn, zeroStart && styles.zeroOn]}
          onPress={() => toggle('zeroStart', !zeroStart)}
          activeOpacity={0.85}
        >
          <Text style={styles.zeroIcon}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.zeroTitle, zeroStart && { color: '#fff' }]}>ZERO START</Text>
            <Text style={[styles.zeroSub, zeroStart && { color: '#ffffffcc' }]}>
              {zeroStart ? 'İtmeden kalkış aktif · mod değişince korunur' : 'Kalkış için ~3 km/h itmek gerekir'}
            </Text>
          </View>
          <Text style={[styles.zeroState, zeroStart && { color: '#fff' }]}>{zeroStart ? 'AÇIK' : 'KAPALI'}</Text>
        </TouchableOpacity>

        {/* Kontroller */}
        <Text style={styles.section}>KONTROLLER</Text>
        <View style={styles.ctrlRow}>
          <Ctrl label="Kilit" icon="🔒" on={lock} onColor={RED} onPress={() => toggle('lock', !lock)} />
          <Ctrl label="Far" icon="💡" on={far} onColor="#F5A623" onPress={() => toggle('far', !far)} />
          <Ctrl label="Cruise" icon="🛞" on={cruise} onColor="#3498DB" onPress={() => toggle('cruise', !cruise)} />
        </View>

        {/* Batarya testi */}
        <BatteryTestCard tele={tele} connected={connected} />

        {/* Gelişmiş (şifreli) */}
        <TouchableOpacity style={styles.advToggle} onPress={() => setAdvanced((a) => !a)}>
          <Text style={styles.advTxt}>
            {advanced ? '▾ Gelişmiş' : '▸ Gelişmiş'} {advUnlocked ? '🔓' : '🔒'} (ham komut · log)
          </Text>
        </TouchableOpacity>
        {advanced && !advUnlocked && (
          <View style={styles.pinBox}>
            <Text style={styles.pinLabel}>🔒 Bu bölüm şifreli</Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="Şifre"
              placeholderTextColor={MUTED}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (pin === ADVANCED_PIN) {
                  setAdvUnlocked(true);
                  setPin('');
                } else {
                  Alert.alert('Yanlış şifre');
                  setPin('');
                }
              }}
            >
              <Text style={styles.sendTxt}>KİLİDİ AÇ</Text>
            </TouchableOpacity>
          </View>
        )}
        {advanced && advUnlocked && (
          <View>
            <TextInput
              style={styles.input}
              value={rawHex}
              onChangeText={setRawHex}
              autoCapitalize="none"
              placeholderTextColor={MUTED}
              placeholder="ca ac bd 04 01 b8 79 6a"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendRaw} activeOpacity={0.85}>
              <Text style={styles.sendTxt}>HAM KOMUT GÖNDER</Text>
            </TouchableOpacity>
            {tele?.raw ? <Text style={styles.rawLine}>{tele.raw}{tele.stateChecksumOk ? '  ck✓' : ''}</Text> : null}
            <View style={{ height: 8 }} />
            {log.map((l, i) => (
              <Text key={i} style={styles.logLine}>{l}</Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          ECO en düşük hız limiti · SPORT en yüksek. Yasal sınırı aşma — sorumluluk sende.
        </Text>
      </ScrollView>
    </View>
  );
}

function Battery({ pct }: { pct: number | null }) {
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const color = pct == null ? MUTED : v > 50 ? '#27C26E' : v > 20 ? '#F5A623' : RED;
  return (
    <View style={styles.battRow}>
      <Text style={styles.battIcon}>🔋</Text>
      <View style={styles.battTrack}>
        <View style={[styles.battFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.battPct, { color }]}>{pct == null ? '--' : `${v}%`}</Text>
    </View>
  );
}

function Badge({ label, on, onColor, icon, offIcon }: { label: string; on: boolean; onColor: string; icon: string; offIcon: string }) {
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeIcon, { opacity: on ? 1 : 0.3 }]}>{on ? icon : offIcon}</Text>
      <Text style={[styles.badgeLabel, { color: on ? onColor : MUTED }]}>{label}</Text>
    </View>
  );
}

function Ctrl({ label, icon, on, onColor, onPress }: { label: string; icon: string; on: boolean; onColor: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.ctrl, on && { backgroundColor: onColor, borderColor: onColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.ctrlIcon}>{icon}</Text>
      <Text style={[styles.ctrlLabel, on && { color: '#fff' }]}>{label}</Text>
      <Text style={[styles.ctrlState, on && { color: '#ffffffcc' }]}>{on ? 'açık' : 'kapalı'}</Text>
    </TouchableOpacity>
  );
}

const CARD = '#151518';
const BORDER = '#242428';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0C' },
  content: { padding: 18, paddingBottom: 40 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  brand: { color: '#fff', fontSize: 26, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
  brandSub: { color: MUTED, fontSize: 11, marginTop: 1, letterSpacing: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillOn: { backgroundColor: '#13241a', borderColor: '#27C26E55' },
  pillOff: { backgroundColor: CARD, borderColor: BORDER },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
  gaugeCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, paddingTop: 18, paddingBottom: 16, marginBottom: 14 },
  battRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 2, paddingHorizontal: 22 },
  battIcon: { fontSize: 15, marginRight: 8 },
  battTrack: { flex: 1, height: 10, borderRadius: 6, backgroundColor: '#242428', overflow: 'hidden' },
  battFill: { height: '100%', borderRadius: 6 },
  battPct: { fontSize: 13, fontWeight: '800', marginLeft: 10, width: 44, textAlign: 'right' },
  badges: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingHorizontal: 10 },
  badge: { alignItems: 'center' },
  badgeIcon: { fontSize: 18 },
  badgeLabel: { fontSize: 10, fontWeight: '800', marginTop: 3, letterSpacing: 1 },
  infoRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  infoCard: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  infoLabel: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  infoValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  infoUnit: { color: MUTED, fontSize: 11, fontWeight: '600' },
  infoHealth: { fontSize: 14, fontWeight: '800', marginTop: 7 },
  connectBtn: { backgroundColor: RED, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 14 },
  connectTxt: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  section: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 12, marginBottom: 10 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  modeTxt: { color: '#C9C9CE', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  modeTxtOn: { color: '#fff' },
  zeroBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderWidth: 1.5, borderColor: '#27C26E55', borderRadius: 16, padding: 16, marginTop: 14 },
  zeroOn: { backgroundColor: '#27C26E', borderColor: '#27C26E' },
  zeroIcon: { fontSize: 24, marginRight: 12 },
  zeroTitle: { color: '#27C26E', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  zeroSub: { color: MUTED, fontSize: 11, marginTop: 2 },
  zeroState: { color: '#27C26E', fontWeight: '900', fontSize: 13, marginLeft: 8 },
  ctrlRow: { flexDirection: 'row', gap: 10 },
  ctrl: { flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ctrlIcon: { fontSize: 20 },
  ctrlLabel: { color: '#C9C9CE', fontWeight: '800', fontSize: 13, marginTop: 4 },
  ctrlState: { color: MUTED, fontSize: 10, marginTop: 1 },
  advToggle: { marginTop: 18, paddingVertical: 6 },
  advTxt: { color: MUTED, fontSize: 13, fontWeight: '700' },
  pinBox: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginTop: 6 },
  pinLabel: { color: '#C9C9CE', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  pinInput: { backgroundColor: '#0F0F11', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, color: '#fff', fontSize: 18, letterSpacing: 6, textAlign: 'center' },
  input: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 13, color: '#fff', fontFamily: 'monospace', fontSize: 14, marginTop: 6 },
  sendBtn: { backgroundColor: '#1F1F23', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  sendTxt: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  rawLine: { color: MUTED, fontSize: 10, marginTop: 10, fontFamily: 'monospace', textAlign: 'center' },
  logLine: { color: '#6E6E73', fontSize: 11, fontFamily: 'monospace', paddingVertical: 1 },
  footer: { color: '#55555A', fontSize: 11, marginTop: 22, textAlign: 'center', lineHeight: 16 },
});
