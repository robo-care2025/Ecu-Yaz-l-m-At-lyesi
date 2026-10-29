/**
 * BatteryTestCard.tsx — ana ekrandaki "Batarya Testi" kartı.
 * Telemetriyi BatteryTester'a besler, adım adım talimat gösterir,
 * sonucu paylaşılabilir metin olarak verir. Mantık: src/battery/batteryTest.ts
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Telemetry } from '../ble/telemetry';
import {
  BatteryTester,
  Grade,
  Snapshot,
  gradeLabel,
  resultText,
  MIN_DROP_PTS,
  START_MIN_PCT,
  START_MAX_PCT,
} from '../battery/batteryTest';

const RED = '#E2001A';
const MUTED = '#8A8A8E';
const CARD = '#151518';
const BORDER = '#242428';

function gradeColor(g: Grade): string {
  if (g === 'iyi') return '#27C26E';
  if (g === 'orta') return '#F5A623';
  if (g === 'zayif') return RED;
  return MUTED;
}

function num(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

export function BatteryTestCard({ tele, connected }: { tele: Telemetry | null; connected: boolean }) {
  const testerRef = useRef(new BatteryTester());
  const [snap, setSnap] = useState<Snapshot>(() => testerRef.current.snapshot(Date.now()));
  const [refKm, setRefKm] = useState('18');

  // Her telemetri paketini teste ver.
  useEffect(() => {
    if (!tele) return;
    testerRef.current.feed(tele.speedKmh, tele.batteryPct, Date.now());
    setSnap(testerRef.current.snapshot(Date.now()));
  }, [tele]);

  // Paket gelmese de geri sayım ilerlesin.
  useEffect(() => {
    const id = setInterval(() => setSnap(testerRef.current.snapshot(Date.now())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!connected) {
      testerRef.current.abort('bağlantı koptu.');
      setSnap(testerRef.current.snapshot(Date.now()));
    }
  }, [connected]);

  function start() {
    const t = testerRef.current;
    const ref = num(refKm);
    if (ref > 0) t.settings.referenceRangeKm = ref;
    t.start(Date.now());
    setSnap(t.snapshot(Date.now()));
  }

  function cancel() {
    testerRef.current.cancel();
    setSnap(testerRef.current.snapshot(Date.now()));
  }

  function share() {
    if (!snap.result) return;
    Share.share({ message: resultText(snap.result, testerRef.current.settings) });
  }

  const running = snap.phase !== 'idle' && snap.phase !== 'done' && snap.phase !== 'aborted';
  const r = snap.result;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>BATARYA TESTİ</Text>
        <Text style={styles.live}>
          {snap.batteryPct != null ? `%${snap.batteryPct}` : '--'} · {snap.speedKmh.toFixed(1)} km/h
        </Text>
      </View>

      {!running && (
        <>
          <Text style={styles.help}>
            Dururken başlangıç yüzdesi okunur, yüzde {MIN_DROP_PTS} puan düşene kadar normal sürülür (yaklaşık 4 km),
            durup 2 dakika dinlendikten sonra tahmini menzil ve sağlık hesaplanır. Batarya %{START_MIN_PCT}–
            {START_MAX_PCT} arasındayken başlat. Referans menzil, bu scooter'ın yeni bataryayla gerçek menzili olmalı.
          </Text>
          <View style={styles.inputs}>
            <View style={styles.field}>
              <Text style={styles.label}>REFERANS MENZİL (km)</Text>
              <TextInput style={styles.input} value={refKm} onChangeText={setRefKm} keyboardType="decimal-pad" />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, !connected && styles.btnOff]}
            onPress={start}
            disabled={!connected}
            activeOpacity={0.85}
          >
            <Text style={styles.btnTxt}>{connected ? (r ? 'TESTİ TEKRARLA' : 'TESTİ BAŞLAT') : 'ÖNCE BAĞLAN'}</Text>
          </TouchableOpacity>
        </>
      )}

      {(running || snap.phase === 'aborted') && (
        <>
          <Text style={[styles.instruction, snap.phase === 'aborted' && { color: RED }]}>{snap.instruction}</Text>
          {running && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(snap.progress * 100)}%` }]} />
            </View>
          )}
          {running && (
            <TouchableOpacity style={styles.ghost} onPress={cancel}>
              <Text style={styles.ghostTxt}>Testi iptal et</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {snap.phase === 'done' && r && (
        <View style={styles.result}>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.label}>TAHMİNİ SAĞLIK</Text>
              <Text style={[styles.big, { color: gradeColor(r.healthGrade) }]}>%{r.healthPct}</Text>
              <Text style={styles.small}>{gradeLabel(r.healthGrade)}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.label}>TAHMİNİ MENZİL</Text>
              <Text style={styles.big}>{r.rangeKm} km</Text>
              <Text style={styles.small}>
                {r.rangeLowKm}–{r.rangeHighKm} km
              </Text>
            </View>
          </View>
          <Text style={styles.line}>
            %{r.restPctStart} → %{r.restPctEnd} ({r.dropPts} puan) · {r.rideKm.toFixed(2)} km sürüldü
          </Text>
          {r.notes.map((n, i) => (
            <Text key={i} style={styles.note}>
              • {n}
            </Text>
          ))}
          <TouchableOpacity style={styles.btn} onPress={share} activeOpacity={0.85}>
            <Text style={styles.btnTxt}>SONUCU PAYLAŞ</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Tahmini değerlerdir: scooter voltaj göndermiyor, hesap batarya yüzdesinden yapılıyor.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16, marginTop: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  live: { color: MUTED, fontSize: 12, fontWeight: '700' },
  help: { color: '#C9C9CE', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  inputs: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  field: { flex: 1 },
  label: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  input: { backgroundColor: '#0F0F11', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, color: '#fff', fontSize: 16, marginTop: 4 },
  btn: { backgroundColor: RED, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  btnOff: { backgroundColor: '#2A2A2E' },
  btnTxt: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  instruction: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 24, marginVertical: 8 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#242428', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: RED },
  ghost: { alignSelf: 'center', paddingVertical: 10, marginTop: 4 },
  ghostTxt: { color: MUTED, fontSize: 13, fontWeight: '700' },
  result: { marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: { flex: 1, backgroundColor: '#0F0F11', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12 },
  big: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 4 },
  small: { color: MUTED, fontSize: 12, fontWeight: '700' },
  line: { color: '#C9C9CE', fontSize: 13, marginBottom: 3 },
  note: { color: '#F5A623', fontSize: 12, lineHeight: 17, marginTop: 4 },
  disclaimer: { color: '#55555A', fontSize: 11, marginTop: 10, textAlign: 'center' },
});
