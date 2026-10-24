import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Path, Line, Polyline } from 'react-native-svg';
import Colors from '../constants/Colors';

const p = Colors.palette;

interface DonutGaugeProps {
  percentage: number;
  radius?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export function DonutGauge({
  percentage,
  radius = 40,
  strokeWidth = 8,
  color = Colors.primary,
  label,
}: DonutGaugeProps) {
  const size = (radius + strokeWidth) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (circumference * percentage) / 100;

  // Build the arc path manually to avoid G rotation issues on web
  // Start at top (12 o'clock), sweep clockwise
  const startAngle = -90;
  const endAngle = startAngle + (360 * percentage) / 100;

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArcFlag = percentage > 50 ? 1 : 0;

  const arcPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={p.surfaceElevated}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress arc */}
        <Path
          d={arcPath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: p.textPrimary, fontSize: radius * 0.5, fontWeight: 'bold', textAlign: 'center' }}>
          {percentage}%
        </Text>
        {label && <Text style={{ color: p.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>{label}</Text>}
      </View>
    </View>
  );
}

interface TrendChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function TrendChart({ data, width = 300, height = 150, color = Colors.primary }: TrendChartProps) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 100);
  const min = 0;

  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((val - min) / (max - min)) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth="3" />
        {data.map((val, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((val - min) / (max - min)) * height;
          return <Circle key={index} cx={x} cy={y} r="4" fill={color} />;
        })}
      </Svg>
    </View>
  );
}
