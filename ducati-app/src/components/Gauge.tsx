/**
 * Gauge.tsx — Hız kadranı (üst yarım daire, SVG).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function pol(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const s = pol(cx, cy, r, a0);
  const e = pol(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function Gauge({
  value,
  max,
  unit,
  color,
  sub,
}: {
  value: number;
  max: number;
  unit: string;
  color: string;
  sub?: string;
}) {
  const W = 280;
  const H = 180;
  const cx = W / 2;
  const cy = 158;
  const r = 120;
  const stroke = 18;
  const START = 270;
  const SWEEP = 180;
  const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const bg = arc(cx, cy, r, START, START + SWEEP);
  const fg = arc(cx, cy, r, START, START + SWEEP * frac);
  return (
    <View style={{ width: W, height: H, alignSelf: 'center' }}>
      <Svg width={W} height={H}>
        <Path d={bg} stroke="#242428" strokeWidth={stroke} strokeLinecap="round" fill="none" />
        {frac > 0.004 && (
          <Path d={fg} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        )}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
        {sub ? <Text style={[styles.sub, { color }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, top: 62, alignItems: 'center' },
  value: { color: '#fff', fontSize: 56, fontWeight: '900', lineHeight: 58 },
  unit: { color: '#8A8A8E', fontSize: 13, fontWeight: '600', marginTop: 0 },
  sub: { fontSize: 13, fontWeight: '800', marginTop: 6, letterSpacing: 2 },
});
