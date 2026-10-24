import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { GlowCard } from '@/components/GlowCard';
import { DonutGauge } from '@/components/SvgCharts';
import Colors from '@/constants/Colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSession } from '@/services/SessionContext';
import { useRouter } from 'expo-router';

const p = Colors.palette;

export default function SessionsScreen() {
  const { sessions } = useSession();
  const router = useRouter();

  // Collapsible state for the feature comparison matrix
  const [showMatrix, setShowMatrix] = useState(false);

  // Calculate aggregates
  const totalSessions = sessions.length;
  const totalShots = sessions.reduce((acc, s) => acc + s.shots.length, 0);
  const totalHits = sessions.reduce(
    (acc, s) => acc + s.shots.filter((shot) => shot.result === 'Hit').length,
    0
  );
  const averageHitRate = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Aggregate Header Stats */}
      <View style={styles.aggHeader}>
        <GlowCard style={styles.aggCard} glowColor={Colors.primary}>
          <Text style={styles.aggCardTitle}>LIFETIME PRACTICE STATS</Text>
          <View style={styles.aggRow}>
            <View style={styles.aggItem}>
              <Text style={styles.aggValue}>{totalSessions}</Text>
              <Text style={styles.aggLabel}>Sessions</Text>
            </View>
            <View style={styles.aggDivider} />
            <View style={styles.aggItem}>
              <Text style={styles.aggValue}>{totalShots}</Text>
              <Text style={styles.aggLabel}>Shots</Text>
            </View>
            <View style={styles.aggDivider} />
            <View style={styles.aggItem}>
              <Text style={styles.aggValue}>{averageHitRate}%</Text>
              <Text style={styles.aggLabel}>Avg Hit Rate</Text>
            </View>
          </View>
        </GlowCard>
      </View>

      {/* ═══════ Camera Feature Comparison Collapsible ═══════ */}
      <GlowCard style={styles.matrixCard} glowColor={Colors.secondary + '30'}>
        <Pressable style={styles.matrixHeaderBtn} onPress={() => setShowMatrix(!showMatrix)}>
          <View style={styles.matrixHeaderLeft}>
            <Ionicons name="videocam" size={20} color={Colors.secondary} />
            <Text style={styles.matrixTitle}>WHAT CAMERA TRACKING ADDS</Text>
          </View>
          <Ionicons
            name={showMatrix ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={p.textMuted}
          />
        </Pressable>

        {showMatrix && (
          <View style={styles.matrixContent}>
            <Text style={styles.matrixSubtitle}>
              Using the phone camera as a visual support layer improves sensor estimates and enables video replay features.
            </Text>
            
            {/* Custom Comparison Table */}
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.tableCell, styles.tableHeaderCell, styles.featCol]}>Feature</Text>
                <Text style={[styles.tableCell, styles.tableHeaderCell]}>Sensor Only</Text>
                <Text style={[styles.tableCell, styles.tableHeaderCell, { color: Colors.secondary }]}>Sensor + Camera</Text>
              </View>

              <ComparisonRow label="Bat Speed" sOnly="Yes" sCam="Yes" />
              <ComparisonRow label="Backlift Angle" sOnly="Yes" sCam="Yes" />
              <ComparisonRow label="Impact Force" sOnly="Yes" sCam="Yes" />
              <ComparisonRow label="Swing Telemetry" sOnly="Estimated" sCam="Better" isWarn1={false} />
              <ComparisonRow label="Point of Contact" sOnly="Estimated" sCam="Better" isWarn1={true} />
              <ComparisonRow label="Hit/Miss Detection" sOnly="No" sCam="Yes" isNo1={true} />
              <ComparisonRow label="Shot Direction" sOnly="Estimated" sCam="Better" isWarn1={true} />
              <ComparisonRow label="Zone Analysis" sOnly="No" sCam="Yes" isNo1={true} />
              <ComparisonRow label="Video Replay" sOnly="No" sCam="Yes" isNo1={true} />
            </View>
          </View>
        )}
      </GlowCard>

      <Text style={styles.listTitle}>SESSION HISTORY</Text>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={p.textSubtle} />
          <Text style={styles.emptyStateText}>No sessions recorded yet</Text>
          <Text style={styles.emptyStateSub}>
            Go to the Practice tab, configure your ground options, and record your first swings.
          </Text>
        </View>
      ) : (
        sessions.map((session) => {
          const sessionShotsCount = session.shots.length;
          const sessionHitsCount = session.shots.filter((s) => s.result === 'Hit').length;
          const sessionHitRate =
            sessionShotsCount > 0 ? Math.round((sessionHitsCount / sessionShotsCount) * 100) : 0;
          
          const isCameraMode = session.config.trackingMode === 'sensor_camera';

          return (
            <Pressable
              key={session.id}
              onPress={() => router.push(`/session/${session.id}` as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Session ${session.id} recorded on ${session.date} at ${session.time}. Mode: ${isCameraMode ? 'Sensor plus Camera' : 'Sensor Only'}. ${sessionShotsCount} total shots, ${sessionHitsCount} hits. Hit rate ${sessionHitRate} percent.`}
              accessibilityHint="Double tap to view detailed analysis of this session"
            >
              <GlowCard style={styles.sessionCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.sessionId}>{session.id}</Text>
                      {/* Tracking Mode Badge */}
                      <View
                        style={[
                          styles.modeBadge,
                          {
                            borderColor: isCameraMode ? Colors.secondary + '50' : p.glassBorderLight,
                            backgroundColor: isCameraMode ? Colors.secondary + '10' : p.surfaceElevated,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isCameraMode ? 'videocam' : 'hardware-chip-outline'}
                          size={10}
                          color={isCameraMode ? Colors.secondary : p.textMuted}
                        />
                        <Text
                          style={[
                            styles.modeBadgeText,
                            { color: isCameraMode ? Colors.secondary : p.textMuted },
                          ]}
                        >
                          {isCameraMode ? 'Sensor + Camera' : 'Sensor Only'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sessionDateTime}>
                      {session.date}  •  {session.time}
                    </Text>
                  </View>
                  <View style={styles.chevronWrap}>
                    <Text style={styles.viewDetailsText}>View Analysis</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                  </View>
                </View>

                {/* Config Info */}
                <View style={styles.configBadges}>
                  <View style={styles.badge}>
                    <MaterialCommunityIcons name="cricket" size={12} color={Colors.primary} />
                    <Text style={styles.badgeText}>{session.config.pitchType}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Ionicons name="sunny-outline" size={12} color={Colors.primary} />
                    <Text style={styles.badgeText}>{session.config.groundCondition}</Text>
                  </View>
                  <View style={styles.badge}>
                    <MaterialCommunityIcons name="circle-double" size={12} color={Colors.primary} />
                    <Text style={styles.badgeText}>{session.config.boundarySize} Boundary</Text>
                  </View>
                </View>

                {/* Session Quick Metrics */}
                <View style={styles.statsPreviewRow}>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>{sessionShotsCount}</Text>
                    <Text style={styles.previewStatLabel}>Shots</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={[styles.previewStatValue, { color: p.success }]}>{sessionHitsCount}</Text>
                    <Text style={styles.previewStatLabel}>Hits</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={[styles.previewStatValue, { color: p.warning }]}>
                      {sessionShotsCount - sessionHitsCount}
                    </Text>
                    <Text style={styles.previewStatLabel}>Misses</Text>
                  </View>
                  <View style={styles.gaugeContainer}>
                    <DonutGauge percentage={sessionHitRate} radius={20} strokeWidth={4} />
                  </View>
                </View>
              </GlowCard>
            </Pressable>
          );
        })
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Helper component for comparison row
function ComparisonRow({
  label,
  sOnly,
  sCam,
  isWarn1 = false,
  isNo1 = false,
}: {
  label: string;
  sOnly: string;
  sCam: string;
  isWarn1?: boolean;
  isNo1?: boolean;
}) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, styles.featCol, { color: p.textSecondary, fontWeight: 'bold' }]}>{label}</Text>
      
      {/* Sensor Only cell */}
      <View style={[styles.tableCell, styles.centeredCell]}>
        {isNo1 ? (
          <Ionicons name="close" size={16} color={p.warning} />
        ) : isWarn1 ? (
          <View style={styles.cellBadgeWarn}>
            <Text style={styles.cellBadgeText}>Estimated</Text>
          </View>
        ) : (
          <Ionicons name="checkmark" size={16} color={p.success} />
        )}
      </View>

      {/* Sensor + Camera cell */}
      <View style={[styles.tableCell, styles.centeredCell]}>
        <View style={styles.cellBadgeBest}>
          <Text style={styles.cellBadgeTextBest}>{sCam}</Text>
        </View>
      </View>
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

  // Aggregates Header
  aggHeader: {
    marginBottom: 16,
  },
  aggCard: {
    padding: 20,
  },
  aggCardTitle: {
    color: p.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 16,
  },
  aggRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aggItem: {
    flex: 1,
    alignItems: 'center',
  },
  aggValue: {
    color: p.textPrimary,
    fontSize: 26,
    fontWeight: 'bold',
  },
  aggLabel: {
    color: p.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  aggDivider: {
    width: 1,
    height: 40,
    backgroundColor: p.divider,
  },

  // Comparison Matrix Card
  matrixCard: {
    marginBottom: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.secondary + '20',
  },
  matrixHeaderBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matrixHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matrixTitle: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  matrixContent: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: p.divider,
    paddingTop: 12,
  },
  matrixSubtitle: {
    color: p.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: p.glassBorder,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: p.divider,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: p.surface,
  },
  tableHeaderRow: {
    backgroundColor: p.surfaceElevated,
  },
  tableCell: {
    flex: 1,
    fontSize: 11,
    color: p.textMuted,
    textAlign: 'center',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    fontSize: 11,
    color: p.textSecondary,
  },
  featCol: {
    flex: 1.2,
    textAlign: 'left',
    paddingLeft: 4,
  },
  centeredCell: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cellBadgeWarn: {
    backgroundColor: Colors.secondary + '12',
    borderColor: Colors.secondary + '40',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cellBadgeBest: {
    backgroundColor: p.success + '12',
    borderColor: p.success + '40',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cellBadgeText: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: 'bold',
  },
  cellBadgeTextBest: {
    color: p.success,
    fontSize: 9,
    fontWeight: 'bold',
  },

  // Sessions List
  listTitle: {
    color: p.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sessionCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: p.glassBorder,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: p.divider,
    paddingBottom: 10,
    marginBottom: 12,
  },
  sessionId: {
    color: p.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 10,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sessionDateTime: {
    color: p.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  chevronWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },

  // Config Badges
  configBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: p.surfaceElevated,
    borderWidth: 1,
    borderColor: p.glassBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  badgeText: {
    color: p.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },

  // Preview metrics
  statsPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewStat: {
    alignItems: 'center',
    flex: 1,
  },
  previewStatValue: {
    color: p.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewStatLabel: {
    color: p.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  gaugeContainer: {
    paddingLeft: 10,
  },

  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  emptyStateText: {
    color: p.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptyStateSub: {
    color: p.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
