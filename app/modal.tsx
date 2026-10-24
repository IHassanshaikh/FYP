import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThreeSwingView } from '@/components/ThreeSwingView';
import { GlowCard } from '@/components/GlowCard';
import Colors from '@/constants/Colors';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333333" />
        </Pressable>
        <Text style={styles.headerTitle}>3D SWING REPLAY</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.viewContainer}>
        <ThreeSwingView />
      </View>

      <GlowCard style={styles.controlsCard} glowColor={Colors.primary}>
        <Text style={styles.controlsTitle}>REPLAY CONTROLS</Text>
        <View style={styles.controlsRow}>
          <Pressable style={styles.controlBtn}>
            <Ionicons name="play-skip-back" size={24} color={Colors.primary} />
          </Pressable>
          <Pressable style={styles.controlBtnMain}>
            <Ionicons name="play" size={32} color="#333333" />
          </Pressable>
          <Pressable style={styles.controlBtn}>
            <Ionicons name="play-skip-forward" size={24} color={Colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.shotInfo}>SHOT #153 — Cover Drive — 73 km/h</Text>
      </GlowCard>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#333333',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  viewContainer: {
    flex: 1,
    marginVertical: 16,
  },
  controlsCard: {
    padding: 20,
    marginBottom: 16,
  },
  controlsTitle: {
    color: Colors.light.muted,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  controlBtnMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotInfo: {
    color: Colors.light.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
