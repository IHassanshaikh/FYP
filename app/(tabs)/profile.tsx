import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { GlowCard } from '@/components/GlowCard';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/services/AuthContext';

const p = Colors.palette;

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.profileHeader}>
        <View style={styles.avatarRing}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'VB'}
            </Text>
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'Player'}</Text>
          <Text style={styles.profileLevel}>{user?.email || 'player@example.com'}</Text>
        </View>
      </View>

      <GlowCard 
        style={styles.card}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel="Hardware Status: Device Name is VectorBat ESP32. Battery is at 84 percent. Firmware version 1.2.4."
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.cardTitle}>HARDWARE</Text>
        </View>
        <View style={styles.hardwareRow}>
          <Text style={styles.hardwareLabel}>Device Name</Text>
          <Text style={styles.hardwareValue}>VectorBat ESP32</Text>
        </View>
        <View style={styles.hardwareRow}>
          <Text style={styles.hardwareLabel}>Battery</Text>
          <View style={styles.batteryContainer}>
            <Text style={styles.hardwareValue}>84%</Text>
            <Ionicons name="battery-full" size={20} color={p.success} style={{marginLeft: 8}} />
          </View>
        </View>
        <View style={styles.hardwareRow}>
          <Text style={styles.hardwareLabel}>Firmware</Text>
          <Text style={styles.hardwareValue}>v1.2.4</Text>
        </View>
      </GlowCard>

      <GlowCard 
        style={styles.card}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel="Bat Configuration: Bat Length 85 centimeters. Weight 1.15 kilograms. Sensor Position Top Handle."
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="build-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.cardTitle}>BAT CONFIGURATION</Text>
        </View>
        <View style={styles.hardwareRow}>
          <Text style={styles.hardwareLabel}>Bat Length</Text>
          <Text style={styles.hardwareValue}>85 cm</Text>
        </View>
        <View style={styles.hardwareRow}>
          <Text style={styles.hardwareLabel}>Weight</Text>
          <Text style={styles.hardwareValue}>1.15 kg</Text>
        </View>
        <View style={styles.hardwareRow}>
          <Text style={styles.hardwareLabel}>Sensor Position</Text>
          <Text style={styles.hardwareValue}>Top Handle</Text>
        </View>
      </GlowCard>

      <GlowCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="options-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.cardTitle}>CALIBRATION</Text>
        </View>
        <Text style={styles.calibrationText}>
          Keep your bat completely still for 5 seconds to calibrate the precision orientation sensor and high-g shock sensor.
        </Text>
        <Pressable 
          style={styles.calibrateBtn}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Calibrate sensor now"
        >
          <Text style={styles.calibrateBtnText}>CALIBRATE NOW</Text>
        </Pressable>
      </GlowCard>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={p.danger} />
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </Pressable>

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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatarPlaceholder: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  profileInfo: {
    marginLeft: 16,
  },
  profileName: {
    color: p.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileLevel: {
    color: p.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: p.divider,
    paddingBottom: 12,
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    color: p.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  hardwareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hardwareLabel: {
    color: p.textMuted,
    fontSize: 14,
  },
  hardwareValue: {
    color: p.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calibrationText: {
    color: p.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  calibrateBtn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: `0 4px 14px ${Colors.primary}30`,
    } : {}),
  },
  calibrateBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 10,
    backgroundColor: p.danger + '08',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.danger + '18',
  },
  logoutBtnText: {
    color: p.danger,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  }
});
