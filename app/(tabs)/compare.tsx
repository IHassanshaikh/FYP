import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { GlowCard } from '@/components/GlowCard';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const p = Colors.palette;

export default function CompareScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>COMPARE SESSIONS</Text>
      
      <View style={styles.selectorRow}>
        <GlowCard 
          style={styles.sessionSelector}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Session A: May 21, 2022, Practice Nets. Tap to change."
        >
          <Text style={styles.selectorLabel}>SESSION A</Text>
          <Text style={styles.selectorValue}>May 21, 2022</Text>
          <Text style={styles.selectorSub}>Practice Nets</Text>
        </GlowCard>
        <View style={styles.vsContainer}>
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>
        <GlowCard 
          style={styles.sessionSelector} 
          glowColor={Colors.secondary}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Session B: May 18, 2022, Open Pitch. Tap to change."
        >
          <Text style={styles.selectorLabel}>SESSION B</Text>
          <Text style={styles.selectorValue}>May 18, 2022</Text>
          <Text style={styles.selectorSub}>Open Pitch</Text>
        </GlowCard>
      </View>

      <GlowCard style={styles.card}>
        <Text style={styles.cardTitle}>KEY METRICS</Text>
        
        <ComparisonRow label="Bat Speed" valA="73 km/h" valB="68 km/h" winner="A" />
        <ComparisonRow label="Impact Speed" valA="65 km/h" valB="60 km/h" winner="A" />
        <ComparisonRow label="Sweet Spot" valA="45%" valB="52%" winner="B" />
        <ComparisonRow label="Timing Index" valA="87%" valB="82%" winner="A" />
        <ComparisonRow label="Hit Rate" valA="81%" valB="78%" winner="A" />
      </GlowCard>

      <GlowCard 
        style={styles.card}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel="AI Insights: Session A shows significantly better bat speed and timing. However, your sweet spot consistency was higher in Session B. Try to maintain the high bat speed while focusing on centering the ball to combine the best of both sessions."
      >
        <Text style={styles.cardTitle}>AI INSIGHTS</Text>
        <View style={styles.insightRow}>
          <View style={styles.insightIconCircle}>
            <Ionicons name="bulb" size={22} color={Colors.secondary} />
          </View>
          <Text style={styles.insightText}>
            Session A shows significantly better bat speed and timing. However, your sweet spot consistency was higher in Session B. Try to maintain the high bat speed while focusing on centering the ball to combine the best of both sessions.
          </Text>
        </View>
      </GlowCard>
    </ScrollView>
  );
}

function ComparisonRow({ label, valA, valB, winner }: { label: string, valA: string, valB: string, winner: 'A' | 'B' | 'Tie' }) {
  const colorA = winner === 'A' ? Colors.primary : p.textMuted;
  const colorB = winner === 'B' ? Colors.secondary : p.textMuted;
  
  return (
    <View 
      style={styles.compRow}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${label}. Session A: ${valA}. Session B: ${valB}. ${winner === 'Tie' ? 'It is a tie.' : `Winner is Session ${winner}.`}`}
    >
      <Text style={[styles.compValue, { color: colorA }]}>{valA}</Text>
      <Text style={styles.compLabel}>{label}</Text>
      <Text style={[styles.compValue, { color: colorB }]}>{valB}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: p.base,
  },
  content: {
    padding: 16,
  },
  headerTitle: {
    color: p.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sessionSelector: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  selectorLabel: {
    color: p.textMuted,
    fontSize: 10,
    marginBottom: 4,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  selectorValue: {
    color: p.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectorSub: {
    color: p.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  vsContainer: {
    paddingHorizontal: 10,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: p.surfaceElevated,
    borderWidth: 1,
    borderColor: p.glassBorderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: p.textMuted,
    fontWeight: 'bold',
    fontSize: 12,
  },
  card: {
    marginBottom: 20,
  },
  cardTitle: {
    color: p.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.divider,
  },
  compLabel: {
    color: p.textSecondary,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  compValue: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 80,
    textAlign: 'center',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary + '12',
    borderWidth: 1,
    borderColor: Colors.secondary + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightText: {
    color: p.textMuted,
    flex: 1,
    lineHeight: 20,
    fontSize: 14,
  }
});
