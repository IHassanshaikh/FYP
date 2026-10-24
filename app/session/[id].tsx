import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, ShotData } from '@/services/SessionContext';
import { GlowCard } from '@/components/GlowCard';
import { DonutGauge } from '@/components/SvgCharts';
import { ThreeSwingView } from '@/components/ThreeSwingView';
import Colors from '@/constants/Colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ─── Inline 3D Shot Replay with Playback Controls ───
function ShotReplay3D({ shot }: { shot: ShotData }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seq = shot.quaternionSequence || [];

  const play = useCallback(() => {
    if (seq.length === 0) return;
    setIsPlaying(true);
  }, [seq]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(0);
  }, []);

  useEffect(() => {
    if (isPlaying && seq.length > 0) {
      intervalRef.current = setInterval(() => {
        setFrameIdx(prev => {
          if (prev >= seq.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 50); // ~20 fps for smooth 60-frame playback
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, seq.length]);

  const currentQuat = seq.length > 0 ? seq[frameIdx] : undefined;
  const progress = seq.length > 1 ? frameIdx / (seq.length - 1) : 0;

  // Compute phase from progress (mirrors the Three.js phase system)
  function getPhase(p: number) {
    if (p < 0.08) return { idx: 0, label: 'AT REST',         color: '#9E9E9E' };
    if (p < 0.35) return { idx: 1, label: 'BACKLIFT',        color: '#4CAF50' };
    if (p < 0.62) return { idx: 2, label: 'DOWNSWING',       color: '#FF9800' };
    if (p < 0.68) return { idx: 3, label: '⚡ IMPACT!',       color: '#F44336' };
    return         { idx: 4, label: 'FOLLOW-THROUGH', color: '#4CAF50' };
  }

  function getGyro(p: number) {
    if (p < 0.08) return 0;
    if (p < 0.35) return Math.round(((p - 0.08) / 0.27) * 180);
    if (p < 0.62) { const d = (p - 0.35) / 0.27; return Math.round(180 + d * d * 1570); }
    if (p < 0.68) return 1750;
    return Math.round(1750 * Math.pow(1 - (p - 0.68) / 0.32, 1.5));
  }

  function getImpact(p: number) {
    if (p < 0.62 || p >= 0.68) return 0;
    const t = (p - 0.62) / 0.06;
    const spike = t < 0.35 ? t / 0.35 : (1 - t) / 0.65;
    return Math.round(Math.max(0, spike) * (shot.sweetSpotScore > 0 ? shot.sweetSpotScore * 1.15 : 86));
  }

  function getBatSpeed(p: number) {
    const top = shot.batSpeedKmh || 72;
    if (p < 0.35) return 0;
    if (p < 0.62) return Math.round(top * Math.pow((p - 0.35) / 0.27, 2));
    if (p < 0.68) return top;
    return Math.round(top * Math.max(0.35, 1 - ((p - 0.68) / 0.32) * 0.65));
  }

  const phase = getPhase(progress);
  const gyro = getGyro(progress);
  const impact = getImpact(progress);
  const speed = getBatSpeed(progress);

  const PHASE_SEGMENTS = [
    { label: 'REST',        width: 0.08,   color: '#9E9E9E' },
    { label: 'BACKLIFT',    width: 0.27,   color: '#4CAF50' },
    { label: 'DOWNSWING',   width: 0.27,   color: '#FF9800' },
    { label: 'IMPACT',      width: 0.06,   color: '#F44336' },
    { label: 'FOLLOW',      width: 0.32,   color: '#4CAF50' },
  ];

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.expandedSectionTitle}>3D BAT SWING REPLAY</Text>
      <View style={styles.replayContainer}>
        <View style={styles.threeViewWrapper}>
          <ThreeSwingView
            quaternion={currentQuat}
            shotSpeed={shot.batSpeedKmh}
            shotTiming={shot.timingIndex}
            shotLiftAngle={shot.batLiftAngleDeg}
            shotSweetSpot={shot.sweetSpotScore}
            progress={progress}
          />
        </View>

        {/* Playback Controls */}
        <View style={styles.replayControls}>
          <Pressable style={styles.replayPlayBtn} onPress={isPlaying ? pause : play}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#333333" />
          </Pressable>
          <Text style={styles.replayFrameText}>
            Frame {frameIdx + 1} / {seq.length || 1}
          </Text>
          <Pressable style={styles.replayResetBtn} onPress={reset}>
            <Ionicons name="refresh" size={18} color={Colors.light.muted} />
          </Pressable>
        </View>

        {/* Phase Progress Bar */}
        <View style={styles.phaseBarContainer}>
          <View style={styles.phaseBarTrack}>
            {PHASE_SEGMENTS.map((seg, i) => (
              <View
                key={i}
                style={[styles.phaseBarSegment, {
                  flex: seg.width,
                  backgroundColor: phase.idx === i ? seg.color : `${seg.color}40`,
                  borderRightWidth: i < 4 ? 1 : 0,
                  borderRightColor: '#FFFFFF',
                }]}
              />
            ))}
            {/* Cursor dot */}
            <View style={[styles.phaseCursor, { left: `${progress * 100}%` as any }]} />
          </View>
          <View style={styles.phaseLabels}>
            {PHASE_SEGMENTS.map((seg, i) => (
              <Text
                key={i}
                style={[styles.phaseLabel, {
                  flex: seg.width,
                  color: phase.idx === i ? seg.color : Colors.light.muted,
                  fontWeight: phase.idx === i ? '800' : '400',
                }]}
              >
                {seg.label}
              </Text>
            ))}
          </View>
        </View>

        {/* Live Sensor Readouts */}
        <View style={styles.sensorRow}>
          <View style={[styles.sensorChip, { borderColor: gyro > 500 ? '#FF9800' : Colors.light.border }]}>
            <Text style={styles.sensorLabel}>GYRO (BNO085)</Text>
            <Text style={[styles.sensorValue, { color: gyro > 500 ? '#FF9800' : '#333' }]}>
              {gyro} °/s
            </Text>
          </View>
          <View style={[styles.sensorChip, { borderColor: impact > 0 ? '#F44336' : Colors.light.border }]}>
            <Text style={styles.sensorLabel}>IMPACT (ADXL375)</Text>
            <Text style={[styles.sensorValue, { color: impact > 0 ? '#F44336' : '#333' }]}>
              {impact} g
            </Text>
          </View>
          <View style={[styles.sensorChip, { borderColor: speed > 0 ? '#4CAF50' : Colors.light.border }]}>
            <Text style={styles.sensorLabel}>BAT SPEED</Text>
            <Text style={[styles.sensorValue, { color: speed > 0 ? '#4CAF50' : '#333' }]}>
              {speed > 0 ? `${speed} km/h` : '—'}
            </Text>
          </View>
        </View>

        {/* Current Phase Label */}
        <View style={[styles.phaseBadge, { borderColor: phase.color }]}>
          <Text style={[styles.phaseBadgeText, { color: phase.color }]}>
            {phase.label}
          </Text>
          {shot.shotType ? (
            <Text style={styles.shotTypeLabel}> · {shot.shotType}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions } = useSession();

  // Find target session
  const session = sessions.find((s) => s.id === id);

  // Expanded Shot ID state for accordion list
  const [expandedShotId, setExpandedShotId] = useState<number | null>(null);

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.primary} />
        <Text style={styles.errorTitle}>Session Not Found</Text>
        <Text style={styles.errorSubtitle}>The requested session ID does not exist.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const isCameraMode = session.config.trackingMode === 'sensor_camera';

  // Session stats calculation
  const totalShots = session.shots.length;
  const hits = session.shots.filter((s) => s.result === 'Hit');
  const misses = session.shots.filter((s) => s.result === 'Miss');
  const hitRate = totalShots > 0 ? Math.round((hits.length / totalShots) * 100) : 0;

  const avgSpeed =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.batSpeedKmh, 0) / hits.length)
      : 0;

  const avgTiming =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.timingIndex, 0) / hits.length)
      : 0;

  const avgSweetSpot =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.sweetSpotScore, 0) / hits.length)
      : 0;

  const avgImpact =
    hits.length > 0
      ? Math.round(hits.reduce((acc, s) => acc + s.impactIntensityG, 0) / hits.length)
      : 0;

  const toggleExpandShot = (shotId: number) => {
    if (expandedShotId === shotId) {
      setExpandedShotId(null);
    } else {
      setExpandedShotId(shotId);
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color="#333333" />
        </Pressable>
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>SESSION ANALYSIS</Text>
          <Text style={styles.headerSubtitle}>
            {session.id} — {isCameraMode ? 'Sensor + Camera' : 'Sensor Only'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        


        {/* Config Summary Card */}
        <GlowCard style={styles.configCard}>
          <Text style={styles.sectionTitle}>GROUND ENVIRONMENT</Text>
          <View style={styles.configRow}>
            <View style={styles.configCell}>
              <MaterialCommunityIcons name="cricket" size={20} color={Colors.primary} />
              <Text style={styles.configLabel}>PITCH TYPE</Text>
              <Text style={styles.configValue}>{session.config.pitchType}</Text>
            </View>
            <View style={styles.configDivider} />
            <View style={styles.configCell}>
              <Ionicons name="sunny-outline" size={20} color={Colors.primary} />
              <Text style={styles.configLabel}>GROUND CONDITION</Text>
              <Text style={styles.configValue}>{session.config.groundCondition}</Text>
            </View>
            <View style={styles.configDivider} />
            <View style={styles.configCell}>
              <MaterialCommunityIcons name="circle-double" size={20} color={Colors.primary} />
              <Text style={styles.configLabel}>BOUNDARY SIZE</Text>
              <Text style={styles.configValue}>{session.config.boundarySize}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.light.muted} />
            <Text style={styles.metaText}>Recorded on {session.date} at {session.time}</Text>
          </View>
        </GlowCard>

        {/* Aggregated Performance Dashboard */}
        <GlowCard style={styles.statsCard} glowColor={Colors.primary}>
          <Text style={styles.sectionTitle}>PERFORMANCE DASHBOARD</Text>
          <View style={styles.dashRow}>
            <DonutGauge percentage={hitRate} label="HIT RATE" radius={45} strokeWidth={8} />
            <View style={styles.dashStatsGrid}>
              <View style={styles.dashStatItem}>
                <Text style={styles.dashStatVal}>{totalShots}</Text>
                <Text style={styles.dashStatLbl}>Shots</Text>
              </View>
              <View style={styles.dashStatItem}>
                <Text style={[styles.dashStatVal, { color: '#4CAF50' }]}>{hits.length}</Text>
                <Text style={styles.dashStatLbl}>Hits</Text>
              </View>
              <View style={styles.dashStatItem}>
                <Text style={[styles.dashStatVal, { color: '#FF9800' }]}>{misses.length}</Text>
                <Text style={styles.dashStatLbl}>Misses</Text>
              </View>
            </View>
          </View>

          <View style={styles.averagesGrid}>
            <View style={styles.avgBox}>
              <Text style={styles.avgValue}>{avgSpeed} <Text style={styles.avgUnit}>km/h</Text></Text>
              <Text style={styles.avgLabel}>Avg Bat Speed</Text>
            </View>
            <View style={styles.avgBox}>
              <Text style={styles.avgValue}>{avgTiming}%</Text>
              <Text style={styles.avgLabel}>Avg Timing</Text>
            </View>
            <View style={styles.avgBox}>
              <Text style={styles.avgValue}>{avgSweetSpot}%</Text>
              <Text style={styles.avgLabel}>Avg Sweet Spot</Text>
            </View>
            <View style={styles.avgBox}>
              <Text style={styles.avgValue}>{avgImpact} g</Text>
              <Text style={styles.avgLabel}>Avg Impact</Text>
            </View>
          </View>
        </GlowCard>

        {/* Dynamic Shots List */}
        <Text style={styles.listTitle}>SHOT TELEMETRY LIST ({session.shots.length})</Text>
        <Text style={styles.listSubtitle}>
          {isCameraMode
            ? 'Tap any shot to view point of contact metrics, shock sensor spikes, and AI coaching reports.'
            : 'Tap any shot to view coaching reports, shock sensor graphs, and peak metrics.'}
        </Text>

        {session.shots.length === 0 ? (
          <View style={styles.emptyShots}>
            <MaterialCommunityIcons name="cricket" size={40} color="#333" />
            <Text style={styles.emptyShotsText}>No shots recorded in this session</Text>
          </View>
        ) : (
          session.shots.map((shot) => {
            const isExpanded = expandedShotId === shot.shotId;
            const isHit = shot.result === 'Hit';

            return (
              <GlowCard
                key={shot.shotId}
                style={[
                  styles.shotAccordion,
                  isExpanded && { borderColor: isHit ? Colors.secondary : '#FF9800', borderWidth: 1.5 }
                ]}
                noPadding={true}
              >
                <Pressable style={styles.shotHeaderBtn} onPress={() => toggleExpandShot(shot.shotId)}>
                  <View style={styles.shotHeaderLeft}>
                    <View
                      style={[
                        styles.resultIndicator,
                        { backgroundColor: isHit ? '#4CAF50' + '30' : '#FF9800' + '30' },
                      ]}
                    >
                      <Text style={[styles.resultText, { color: isHit ? '#4CAF50' : '#FF9800' }]}>
                        {isHit ? 'HIT' : 'MISS'}
                      </Text>
                    </View>
                    <View style={styles.shotBriefInfo}>
                      <Text style={styles.shotName}>#{shot.shotId} {shot.shotType}</Text>
                      <Text style={styles.shotBriefStats}>
                        {isHit ? `${shot.batSpeedKmh} km/h  •  Sweet Spot ${shot.sweetSpotScore}%` : 'No contact'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.light.muted}
                  />
                </Pressable>

                {/* Expanded Shot Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>

                    {/* 3D Bat Swing Replay */}
                    {shot.quaternionSequence && shot.quaternionSequence.length > 0 && (
                      <ShotReplay3D shot={shot} />
                    )}

                    {/* Camera Point of Contact indicators */}
                    {isCameraMode && (
                      <View style={styles.contactContainer}>
                        <Text style={styles.expandedSectionTitle}>POINT OF CONTACT ANALYSIS</Text>
                        <View style={styles.contactDetailsBox}>
                          <View style={styles.contactRowItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#00E676" />
                            <Text style={styles.contactText}>
                              Contact Detected (Verified by impact shock sensor spike & Camera skeleton sync)
                            </Text>
                          </View>
                          <View style={styles.contactRowItem}>
                            <Ionicons name="flash-outline" size={16} color={Colors.secondary} />
                            <Text style={styles.contactText}>
                              Impact Acceleration Force: <Text style={{ color: '#333333', fontWeight: 'bold' }}>{shot.impactIntensityG}g</Text>
                            </Text>
                          </View>
                          <View style={styles.contactRowItem}>
                            <Ionicons name="time-outline" size={16} color={Colors.secondary} />
                            <Text style={styles.contactText}>
                              Contact Timing Offset: <Text style={{ color: '#333333', fontWeight: 'bold' }}>{shot.impactTimeSec} seconds</Text> after downswing onset
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Performance details grid */}
                    <Text style={[styles.expandedSectionTitle, { marginTop: 16 }]}>METRIC BREAKDOWN</Text>
                    <View style={styles.metricsDetailGrid}>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailVal}>{shot.batSpeedKmh} <Text style={styles.detailUnit}>km/h</Text></Text>
                        <Text style={styles.detailLbl}>Bat Speed</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailVal}>{shot.impactSpeedKmh} <Text style={styles.detailUnit}>km/h</Text></Text>
                        <Text style={styles.detailLbl}>Impact Speed</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailVal}>{shot.batLiftAngleDeg}°</Text>
                        <Text style={styles.detailLbl}>Lift Angle</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailVal}>{shot.sweetSpotScore}%</Text>
                        <Text style={styles.detailLbl}>Sweet Spot</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailVal}>{shot.timingIndex}%</Text>
                        <Text style={styles.detailLbl}>Timing Index</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailVal}>{shot.impactIntensityG} g</Text>
                        <Text style={styles.detailLbl}>Peak Impact</Text>
                      </View>
                    </View>

                    {/* Extras: Zone, catch chance, boundaries */}
                    {isHit && (
                      <View style={styles.extrasRow}>
                        <View style={styles.extraBadge}>
                          <Text style={styles.extraLabel}>ZONE</Text>
                          <Text style={styles.extraValue}>{shot.zone}</Text>
                        </View>
                        <View style={styles.extraBadge}>
                          <Text style={styles.extraLabel}>BOUNDARY PROB.</Text>
                          <Text style={[styles.extraValue, { color: Colors.secondary }]}>
                            {shot.boundaryProbability}%
                          </Text>
                        </View>
                        <View style={styles.extraBadge}>
                          <Text style={styles.extraLabel}>CATCH CHANCE</Text>
                          <Text style={[styles.extraValue, { color: shot.catchChance > 30 ? '#FF9800' : '#4CAF50' }]}>
                            {shot.catchChance}%
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* AI Feedback */}
                    <View style={styles.aiFeedbackBox}>
                      <View style={styles.aiFeedbackHeader}>
                        <Ionicons name="bulb" size={16} color={Colors.secondary} />
                        <Text style={styles.aiFeedbackTitle}>AI COACHING REPORT</Text>
                      </View>
                      <Text style={styles.aiFeedbackBody}>{shot.aiFeedback}</Text>
                    </View>
                  </View>
                )}
              </GlowCard>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}





const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
    padding: 24,
  },
  errorTitle: {
    color: '#333333',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorSubtitle: {
    color: Colors.light.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#333333',
    fontWeight: 'bold',
  },

  // Custom Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  headerTitleArea: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#333333',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },



  // Config Card
  configCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.light.muted,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 14,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configCell: {
    flex: 1,
    alignItems: 'center',
  },
  configDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.light.border,
  },
  configLabel: {
    color: Colors.light.muted,
    fontSize: 9,
    marginTop: 6,
  },
  configValue: {
    color: '#333333',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 10,
    marginTop: 4,
  },
  metaText: {
    color: Colors.light.muted,
    fontSize: 12,
    marginLeft: 6,
  },

  // Stats Card
  statsCard: {
    marginBottom: 20,
  },
  dashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  dashStatsGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 16,
  },
  dashStatItem: {
    alignItems: 'center',
  },
  dashStatVal: {
    color: '#333333',
    fontSize: 22,
    fontWeight: 'bold',
  },
  dashStatLbl: {
    color: Colors.light.muted,
    fontSize: 11,
    marginTop: 2,
  },
  averagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 14,
  },
  avgBox: {
    width: '50%',
    marginBottom: 12,
  },
  avgValue: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  avgUnit: {
    fontSize: 12,
    color: Colors.light.muted,
  },
  avgLabel: {
    color: Colors.light.muted,
    fontSize: 11,
    marginTop: 2,
  },

  // List Headers
  listTitle: {
    color: '#333333',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  listSubtitle: {
    color: Colors.light.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
  },
  emptyShots: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  emptyShotsText: {
    color: Colors.light.muted,
    fontSize: 14,
    marginTop: 8,
  },

  // Accordion Items
  shotAccordion: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  shotHeaderBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  shotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resultIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
  },
  resultText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  shotBriefInfo: {
    marginLeft: 12,
    flex: 1,
  },
  shotName: {
    color: '#333333',
    fontSize: 14,
    fontWeight: 'bold',
  },
  shotBriefStats: {
    color: Colors.light.muted,
    fontSize: 12,
    marginTop: 2,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    padding: 14,
    backgroundColor: '#F5F5F5',
  },
  expandedSectionTitle: {
    color: '#333333',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
  },

  // 3D Replay Box
  replayContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  threeViewWrapper: {
    position: 'relative',
    height: 260,
  },
  replayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    marginTop: 10,
  },
  replayPlayBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  replayFrameText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  replayResetBtn: {
    padding: 6,
  },

  // Split Video-3D Layout style (Sensor + Camera)
  splitReplayContainer: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 10,
    backgroundColor: '#F0F0F0',
  },
  splitReplayRow: {
    flexDirection: 'row',
  },
  splitCol: {
    flex: 1,
  },
  splitReplayLabelBox: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  splitLabelText: {
    color: Colors.light.muted,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  splitThreeWrapper: {
    height: 180,
    backgroundColor: '#F0F0F0',
  },
  splitVideoWrapper: {
    height: 180,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
  },
  splitVideoCanvas: {
    width: '100%',
    height: 180,
  },

  // Point of Contact Styles
  contactContainer: {
    marginTop: 16,
  },
  contactDetailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
  },
  contactRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  contactText: {
    color: Colors.light.muted,
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
  },

  // Metrics details
  metricsDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailBox: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  detailVal: {
    color: '#333333',
    fontSize: 15,
    fontWeight: 'bold',
  },
  detailUnit: {
    fontSize: 11,
    color: Colors.light.muted,
  },
  detailLbl: {
    color: Colors.light.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },

  // Extras
  extrasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  extraBadge: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  extraLabel: {
    color: Colors.light.muted,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  extraValue: {
    color: '#333333',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // AI Feedback Box
  aiFeedbackBox: {
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 10,
    padding: 12,
  },
  aiFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiFeedbackTitle: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  aiFeedbackBody: {
    color: Colors.light.muted,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // ─── Phase Progress Bar ───
  phaseBarContainer: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  phaseBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#EEEEEE',
  },
  phaseBarSegment: {
    height: '100%',
  },
  phaseCursor: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  phaseLabels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  phaseLabel: {
    fontSize: 7,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ─── Sensor Readout Chips ───
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  sensorChip: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  sensorLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sensorValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  // ─── Phase Badge ───
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    alignSelf: 'center',
  },
  phaseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  shotTypeLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.light.muted,
    letterSpacing: 0.5,
  },
});
