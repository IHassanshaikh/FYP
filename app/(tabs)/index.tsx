import React from 'react';
import { StyleSheet, ScrollView, View, Text, Pressable, Image, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GlowCard } from '@/components/GlowCard';
import Colors from '@/constants/Colors';
import { useSession } from '@/services/SessionContext';

const p = Colors.palette;

export default function DashboardScreen() {
  const router = useRouter();
  const { sessions, activeSession } = useSession();

  // Get latest completed session
  const latestSession = sessions.length > 0 ? sessions[0] : null;

  // Calculate stats for the latest session
  const totalShots = latestSession ? latestSession.shots.length : 0;
  const hits = latestSession ? latestSession.shots.filter((s) => s.result === 'Hit') : [];
  const misses = latestSession ? latestSession.shots.filter((s) => s.result === 'Miss') : [];

  const avgSweetSpot =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.sweetSpotScore, 0) / hits.length)
      : 0;

  const avgTiming =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.timingIndex, 0) / hits.length)
      : 0;

  const avgSpeed =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.batSpeedKmh, 0) / hits.length)
      : 0;

  const avgImpactSpeed =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.impactSpeedKmh, 0) / hits.length)
      : 0;

  const avgLiftAngle =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.batLiftAngleDeg, 0) / hits.length)
      : 0;

  // Find best shot (highest sweet spot score)
  const bestShot =
    hits.length > 0
      ? [...hits].sort((a, b) => b.sweetSpotScore - a.sweetSpotScore)[0]
      : null;

  const isCameraMode = latestSession?.config.trackingMode === 'sensor_camera';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ═══════ Session in Progress Banner ═══════ */}
      {activeSession && (
        <Pressable
          style={styles.activeBanner}
          onPress={() => router.push('/practice')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Practice session active, tap to view live sensor data"
        >
          <View style={styles.activeBannerInner}>
            <View style={styles.pulseContainer}>
              <View style={styles.pulseDot} />
            </View>
            <Text style={styles.activeBannerText}>
              PRACTICE SESSION ACTIVE — STREAMING LIVE SENSOR DATA
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      )}

      {/* ═══════ Live Swing Telemetry Launch Card ═══════ */}
      <Pressable
        style={{
          backgroundColor: '#0B0F19',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1.5,
          borderColor: 'rgba(0, 201, 123, 0.35)',
          overflow: 'hidden',
          ...(Platform.OS === 'web' ? {
            boxShadow: '0 6px 20px rgba(0, 201, 123, 0.15)',
            cursor: 'pointer',
          } : {}),
        }}
        onPress={() => router.push('/live')}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open live 3D swing telemetry visualizer"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0, 201, 123, 0.15)',
              borderWidth: 1.5,
              borderColor: '#00C97B',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="flash" size={22} color="#00C97B" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.8 }}>
                  LIVE SWING TRACKER
                </Text>
                <View style={{
                  backgroundColor: '#00C97B',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: '#0B0F19' }}>3D LIVE</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: '#A0AEC0', marginTop: 3 }}>
                Swing your bat to see 3D trajectory, impact speed & contact render live
              </Text>
            </View>
          </View>
          <View style={{
            backgroundColor: '#00C97B',
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
          }}>
            <Ionicons name="arrow-forward" size={16} color="#0B0F19" />
          </View>
        </View>
      </Pressable>

      {latestSession ? (
        <>
          {/* ═══════ YOUR SESSION Hero Card ═══════ */}
          <GlowCard style={styles.heroCard} glowColor={Colors.primary}>
            <View style={styles.heroAccent} />
            <View style={styles.heroInner}>
              <View style={styles.heroTextArea}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={styles.heroTitle}>LATEST SESSION</Text>
                  {/* Tracking Mode badge */}
                  <View
                    style={[
                      styles.heroBadge,
                      {
                        borderColor: isCameraMode ? Colors.secondary + '50' : p.glassBorderLight,
                        backgroundColor: isCameraMode ? Colors.secondary + '10' : p.surfaceElevated,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isCameraMode ? 'videocam' : 'hardware-chip-outline'}
                      size={8}
                      color={isCameraMode ? Colors.secondary : p.textMuted}
                    />
                    <Text
                      style={[
                        styles.heroBadgeText,
                        { color: isCameraMode ? Colors.secondary : p.textMuted },
                      ]}
                    >
                      {isCameraMode ? 'Sensor + Camera' : 'Sensor Only'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroSessionId}>{latestSession.id}</Text>
                <Text style={styles.heroSubtitle}>
                  Get detailed insights about your swings on {latestSession.config.pitchType} pitch.
                </Text>
              </View>
              <Image
                source={require('@/assets/images/hero_batsman.jpg')}
                resizeMode="contain"
                style={styles.heroImage}
              />
            </View>
            <Pressable
              style={styles.viewInsightsBtn}
              onPress={() => router.push(`/session/${latestSession.id}` as any)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`View analysis for session ${latestSession.id}`}
            >
              <Text style={styles.viewInsightsText}>VIEW ANALYSIS</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </Pressable>
          </GlowCard>

          {/* ═══════ KPI Row ═══════ */}
          <GlowCard style={styles.kpiCard}>
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <View style={styles.kpiIconCircle}>
                  <MaterialCommunityIcons name="cricket" size={24} color={Colors.primary} />
                </View>
                <Text style={styles.kpiValue}>{totalShots}</Text>
                <Text style={styles.kpiLabel}>Shots</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <View style={[styles.kpiIconCircle, { backgroundColor: p.success + '10', borderColor: p.success + '25' }]}>
                  <Ionicons name="checkmark-circle" size={24} color={p.success} />
                </View>
                <Text style={[styles.kpiValue, { color: p.success }]}>{hits.length}</Text>
                <Text style={styles.kpiLabel}>Hits</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <View style={[styles.kpiIconCircle, { backgroundColor: p.warning + '10', borderColor: p.warning + '25' }]}>
                  <Ionicons name="close-circle" size={24} color={p.warning} />
                </View>
                <Text style={[styles.kpiValue, { color: p.warning }]}>{misses.length}</Text>
                <Text style={styles.kpiLabel}>Misses</Text>
              </View>
            </View>
          </GlowCard>

          {/* ═══════ Action Grid ═══════ */}
          <View style={styles.actionGrid} accessible={true} accessibilityRole="menu">
            <Pressable style={styles.actionCard} onPress={() => router.push(`/session/${latestSession.id}` as any)} accessible={true} accessibilityRole="button" accessibilityLabel="View Highlights">
              <View style={styles.actionIconWrap}>
                <Ionicons name="star" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Highlights</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => router.push(`/session/${latestSession.id}` as any)} accessible={true} accessibilityRole="button" accessibilityLabel="View Analysis">
              <View style={styles.actionIconWrap}>
                <Ionicons name="analytics" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Analysis</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => router.push('/compare')} accessible={true} accessibilityRole="button" accessibilityLabel="Compare Sessions">
              <View style={styles.actionIconWrap}>
                <MaterialCommunityIcons name="fire" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Compare</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => router.push('/profile')} accessible={true} accessibilityRole="button" accessibilityLabel="Hardware Settings">
              <View style={styles.actionIconWrap}>
                <Ionicons name="bar-chart" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Hardware</Text>
            </Pressable>
          </View>

          {/* ═══════ SESSION STATS Header ═══════ */}
          <View style={styles.sectionHeader} accessible={true} accessibilityRole="header">
            <Text style={styles.sectionTitle}>SESSION AVERAGE METRICS</Text>
            <Pressable 
              style={[styles.viewAllBtn, { minWidth: 48, minHeight: 48, justifyContent: 'center' }]} 
              onPress={() => router.push(`/session/${latestSession.id}` as any)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="View detailed session metrics"
            >
              <Text style={styles.viewAllText}>View details</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </Pressable>
          </View>

          {/* ═══════ Sweet Spot + Timing Index Row ═══════ */}
          <View style={styles.statsRow}>
            <GlowCard style={styles.statCardHalf}>
              <View style={styles.statTopRow}>
                <View style={styles.statIconLabel}>
                  <MaterialCommunityIcons name="target" size={18} color={Colors.primary} />
                  <Text style={styles.statLabel}>Sweet Spot</Text>
                </View>
              </View>
              <View style={styles.statBottomRow}>
                <Text style={styles.statBigValue}>{avgSweetSpot}<Text style={styles.statUnit}>%</Text></Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
              </View>
            </GlowCard>
            <GlowCard style={styles.statCardHalf}>
              <View style={styles.statTopRow}>
                <View style={styles.statIconLabel}>
                  <Ionicons name="timer" size={18} color={Colors.primary} />
                  <Text style={styles.statLabel}>Timing Index</Text>
                </View>
              </View>
              <View style={styles.statBottomRow}>
                <Text style={styles.statBigValue}>{avgTiming}<Text style={styles.statUnit}>%</Text></Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
              </View>
            </GlowCard>
          </View>

          {/* ═══════ Bat Speed / Impact Speed / Bat Lift Angle Row ═══════ */}
          <View style={styles.statsRow3}>
            <GlowCard style={styles.statCardThird}>
              <View style={styles.statThirdTop}>
                <MaterialCommunityIcons name="speedometer" size={14} color={Colors.primary} />
                <Text style={styles.statThirdLabel}>Bat Speed</Text>
              </View>
              <View style={styles.statThirdBottom}>
                <Text style={styles.statMedValue}>{avgSpeed} <Text style={styles.statSmUnit}>km/h</Text></Text>
              </View>
            </GlowCard>
            <GlowCard style={styles.statCardThird}>
              <View style={styles.statThirdTop}>
                <MaterialCommunityIcons name="speedometer-medium" size={14} color={Colors.primary} />
                <Text style={styles.statThirdLabel}>Impact Speed</Text>
              </View>
              <View style={styles.statThirdBottom}>
                <Text style={styles.statMedValue}>{avgImpactSpeed} <Text style={styles.statSmUnit}>km/h</Text></Text>
              </View>
            </GlowCard>
            <GlowCard style={styles.statCardThird}>
              <View style={styles.statThirdTop}>
                <MaterialCommunityIcons name="angle-acute" size={14} color={Colors.primary} />
                <Text style={styles.statThirdLabel}>Bat Lift</Text>
              </View>
              <View style={styles.statThirdBottom}>
                <Text style={styles.statMedValue}>{avgLiftAngle}<Text style={styles.statSmUnit}>°</Text></Text>
              </View>
            </GlowCard>
          </View>

          {/* ═══════ BEST SHOT SECTION ═══════ */}
          {bestShot && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>BEST SHOT OF THE SESSION</Text>
                <Pressable
                  style={styles.viewAllBtn}
                  onPress={() => {
                    router.push(`/session/${latestSession.id}` as any);
                  }}
                >
                  <Text style={styles.viewAllText}>View Details</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                </Pressable>
              </View>

              <GlowCard style={styles.shotSummaryCard} glowColor={Colors.secondary}>
                <View style={styles.shotRow}>
                  <View style={styles.shotLeft}>
                    <Text style={styles.shotLabel}>SHOT #{bestShot.shotId}</Text>
                    <Text style={styles.shotBigNum}>{bestShot.shotType}</Text>
                  </View>
                  <View style={styles.shotRight}>
                    <View style={styles.shotMetric}>
                      <Text style={styles.shotMetricValue}>{bestShot.sweetSpotScore}%</Text>
                      <Text style={styles.shotMetricLabel}>Sweet Spot</Text>
                    </View>
                    <View style={styles.shotMetric}>
                      <Text style={styles.shotMetricValue}>{bestShot.timingIndex}%</Text>
                      <Text style={styles.shotMetricLabel}>Timing Index</Text>
                    </View>
                  </View>
                </View>
                {/* Progress bar representing speed */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(bestShot.batSpeedKmh, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.shotSpeedLabel}>Bat Speed: {bestShot.batSpeedKmh} km/h</Text>
              </GlowCard>
            </>
          )}
        </>
      ) : (
        /* ═══════ Welcome State (No Sessions Played) ═══════ */
        <View style={styles.welcomeContainer}>
          <Image
            source={require('@/assets/images/logo.png')}
            resizeMode="contain"
            tintColor={p.textPrimary}
            style={styles.welcomeLogo}
          />
          <GlowCard style={styles.welcomeCard} glowColor={Colors.primary}>
            <MaterialCommunityIcons name="cricket" size={60} color={Colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={styles.welcomeTitle}>Welcome to VectorBat</Text>
            <Text style={styles.welcomeText}>
              VectorBat measures real-time cricket bat telemetry using ESP32 hardware and IMU sensors to provide timing indexes, sweet spot scores, and peak speed telemetry.
            </Text>
            <Pressable
              style={styles.welcomeBtn}
              onPress={() => router.push('/practice')}
            >
              <Text style={styles.welcomeBtnText}>CONFIGURE FIRST SESSION</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </Pressable>
          </GlowCard>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
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

  // Active session banner
  activeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    ...Platform.select({
      web: { boxShadow: `0 4px 16px ${Colors.primary}35` },
    }),
  },
  activeBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pulseContainer: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  activeBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Hero Card
  heroCard: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: p.surface,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  heroInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTextArea: {
    flex: 1,
    paddingRight: 10,
  },
  heroTitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginLeft: 10,
  },
  heroBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  heroSessionId: {
    color: p.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: p.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  heroImage: {
    width: 100,
    height: 100,
  },
  viewInsightsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  viewInsightsText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 4,
  },

  // KPI Row
  kpiCard: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    color: p.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  kpiLabel: {
    color: p.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  kpiDivider: {
    width: 1,
    height: 50,
    backgroundColor: p.divider,
  },

  // Action Grid
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  actionCard: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: p.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    } : {}),
  },
  actionIconWrap: {
    marginBottom: 6,
  },
  actionLabel: {
    color: p.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: p.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 4,
  },

  // Sweet Spot / Timing Index
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCardHalf: {
    width: '48%',
    padding: 14,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  statTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: p.textMuted,
    fontSize: 12,
    marginLeft: 6,
  },
  statBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  statBigValue: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  statUnit: {
    fontSize: 16,
    color: Colors.primary,
  },

  // Thirds Row
  statsRow3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statCardThird: {
    width: '31%',
    padding: 10,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  statThirdTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statThirdLabel: {
    color: p.textMuted,
    fontSize: 10,
    marginLeft: 4,
  },
  statThirdBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  statMedValue: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statSmUnit: {
    fontSize: 11,
    color: Colors.primary,
  },

  // Shot Summary Card
  shotSummaryCard: {
    padding: 16,
    borderWidth: 1.5,
  },
  shotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shotLeft: {
    alignItems: 'flex-start',
    flex: 1,
  },
  shotLabel: {
    color: p.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  shotBigNum: {
    color: p.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
  },
  shotRight: {
    flexDirection: 'row',
  },
  shotMetric: {
    marginLeft: 16,
    alignItems: 'center',
  },
  shotMetricValue: {
    color: p.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  shotMetricLabel: {
    color: p.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: p.surfaceElevated,
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: 2,
  },
  shotSpeedLabel: {
    color: p.textMuted,
    fontSize: 11,
    marginTop: 8,
  },

  // Welcome / Empty State Page
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  welcomeLogo: {
    width: 160,
    height: 60,
    marginBottom: 20,
  },
  welcomeCard: {
    padding: 24,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  welcomeTitle: {
    color: p.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  welcomeText: {
    color: p.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  welcomeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      web: { boxShadow: `0 4px 16px ${Colors.primary}35` },
    }),
  },
  welcomeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
