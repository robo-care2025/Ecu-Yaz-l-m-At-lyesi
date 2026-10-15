/**
 * Gauge.tsx — Hız kadranı (üst yarım daire, SVG) + tick'ler, uç etiketleri, degrade.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

const W = 280;
const H = 184;
const CX = W / 2;
const CY = 160;
const R = 120;
const STROKE = 18;
const START = 270;
const SWEEP = 180;

function pol(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}
function arc(r: number, a0: number, a1: number): string {
  const s = pol(r, a0);
  const e = pol(r, a1);
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
  const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const bg = arc(R, START, START + SWEEP);
  const fg = arc(R, START, START + SWEEP * frac);

  // Tick'ler: 0..max arası her 1/7'de bir (8 çizgi)
  const ticks = Array.from({ length: 8 }, (_, i) => {
    const t = i / 7;
    const ang = START + SWEEP * t;
    const active = t <= frac + 0.001;
    const outer = pol(R + STROKE / 2 + 2, ang);
    const inner = pol(R - STROKE / 2 - 2, ang);
    return { outer, inner, active, major: i % 7 === 0 };
  });

  return (
    <View style={{ width: W, height: H, alignSelf: 'center' }}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.45" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d={bg} stroke="#242428" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        {frac > 0.004 && (
          <Path d={fg} stroke="url(#gaugeFill)" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        )}
        {ticks.map((tk, i) => (
          <Line
            key={i}
            x1={tk.inner.x}
            y1={tk.inner.y}
            x2={tk.outer.x}
            y2={tk.outer.y}
            stroke={tk.active ? '#ffffff' : '#3A3A40'}
            strokeWidth={tk.major ? 3 : 2}
            strokeLinecap="round"
          />
        ))}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
        {sub ? <Text style={[styles.sub, { color }]}>{sub}</Text> : null}
      </View>
      <Text style={[styles.end, { left: 10 }]}>0</Text>
      <Text style={[styles.end, { right: 10 }]}>{max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, top: 64, alignItems: 'center' },
  value: { color: '#fff', fontSize: 58, fontWeight: '900', lineHeight: 60 },
  unit: { color: '#8A8A8E', fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 13, fontWeight: '800', marginTop: 6, letterSpacing: 2 },
  end: { position: 'absolute', top: 150, color: '#6E6E73', fontSize: 12, fontWeight: '700' },
});
