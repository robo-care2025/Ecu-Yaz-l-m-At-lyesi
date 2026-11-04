/**
 * Gauge.tsx — Hız kadranı (üst yarım daire, SVG) + tick'ler, sayılar, degrade.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const W = 280;
const H = 188;
const CX = W / 2;
const CY = 162;
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

  // Her 5 birimde tick, her 10'da büyük + sayı
  const tickVals: number[] = [];
  for (let v = 0; v <= max; v += 5) tickVals.push(v);

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
        {tickVals.map((v) => {
          const ang = START + SWEEP * (v / max);
          const active = v / max <= frac + 0.001;
          const major = v % 10 === 0;
          const outer = pol(R + STROKE / 2 + 2, ang);
          const inner = pol(R - STROKE / 2 - 2, ang);
          const lbl = pol(R - STROKE / 2 - 13, ang);
          return (
            <React.Fragment key={v}>
              <Line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={active ? '#ffffff' : '#3A3A40'}
                strokeWidth={major ? 3 : 2}
                strokeLinecap="round"
              />
              {major && (
                <SvgText
                  x={lbl.x}
                  y={lbl.y + 4}
                  fill="#7A7A80"
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {v}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
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
  center: { position: 'absolute', left: 0, right: 0, top: 66, alignItems: 'center' },
  value: { color: '#fff', fontSize: 58, fontWeight: '900', lineHeight: 60 },
  unit: { color: '#8A8A8E', fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 13, fontWeight: '800', marginTop: 6, letterSpacing: 2 },
});
