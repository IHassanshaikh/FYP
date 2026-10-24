import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GlowCard } from '@/components/GlowCard';
import Colors from '@/constants/Colors';
import { LiveSwingVisualizer, LiveSwingVisualizerRef } from '@/components/LiveSwingVisualizer';
import { sensorSimulator, SensorData, ProcessedShotData } from '@/services/SensorSimulator';
import { hardwareSensorService, ConnectionInfo } from '@/services/HardwareSensorService';
import { useSession, ShotData, generateMockQuaternionSequence } from '@/services/SessionContext';

const p = Colors.palette;

// Preset Cricket Shots with realistic biomechanical telemetry
const SHOT_PRESETS = [
  { id: 'cover_drive', label: 'Cover Drive', icon: 'baseball-bat', speed: 86, lift: 56, impact: 78, sweet: 92, timing: 95, zone: 'Deep Extra Cover', color: '#FFD700' },
  { id: 'on_drive', label: 'On Drive', icon: 'arrow-down-left', speed: 82, lift: 48, impact: 74, sweet: 88, timing: 93, zone: 'Mid-On', color: '#38BDF8' },
  { id: 'straight_drive', label: 'Straight Drive', icon: 'trending-up', speed: 89, lift: 50, impact: 82, sweet: 94, timing: 96, zone: 'Long-Off / V', color: '#00C97B' },
  { id: 'pull_shot', label: 'Pull Shot', icon: 'redo', speed: 96, lift: 72, impact: 92, sweet: 86, timing: 90, zone: 'Deep Mid-Wicket', color: '#EF4444' },
  { id: 'cut_shot', label: 'Square Cut', icon: 'scissors-cutting', speed: 87, lift: 64, impact: 76, sweet: 82, timing: 88, zone: 'Backward Point', color: '#A855F7' },
  { id: 'forward_defence', label: 'Forward Defence', icon: 'shield-check', speed: 34, lift: 25, impact: 22, sweet: 90, timing: 98, zone: 'Crease Defense', color: '#E2E8F0' },
  { id: 'sweep_shot', label: 'Sweep Shot', icon: 'broom', speed: 78, lift: 40, impact: 70, sweet: 80, timing: 86, zone: 'Fine Leg / Square Leg', color: '#F97316' },
  { id: 'helicopter', label: 'Helicopter Shot', icon: 'fan', speed: 104, lift: 76, impact: 98, sweet: 88, timing: 94, zone: 'Deep Mid-Wicket', color: '#F43F5E' },
];

export default function LiveSwingScreen() {
  const visualizerRef = useRef<LiveSwingVisualizerRef>(null);
  const { addShot, activeSession, startSession } = useSession();

  // ESP32 Hardware State & Advanced Diagnostics
  const [espIp, setEspIp] = useState('192.168.1.11');
  const [selectedPort, setSelectedPort] = useState(81);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(
    hardwareSensorService.getConnectionInfo()
  );
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [streamSource, setStreamSource] = useState<'simulator' | 'hardware'>('hardware');

  // Visualizer settings
  const [cameraView, setCameraView] = useState<'side' | 'bowler' | 'top' | 'batsman'>('side');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedShotPreset, setSelectedShotPreset] = useState(SHOT_PRESETS[0]);

  // Live Telemetry State
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [packetCount, setPacketCount] = useState(0);

  // Latest Swing Record
  const [lastSwing, setLastSwing] = useState<{
    id: number;
    shotType: string;
    speed: number;
    liftAngle: number;
    impactG: number;
    sweetSpot: number;
    timing: number;
    zone: string;
    timestamp: string;
    feedback: string;
  } | null>(null);

  // Session Swings History
  const [sessionSwings, setSessionSwings] = useState<NonNullable<typeof lastSwing>[]>([]);

  // Auto Pitching Machine State
  const [autoPitcher, setAutoPitcher] = useState(false);
  const autoPitcherTimerRef = useRef<any>(null);

  // Visualizer Display Mode ('virat' rigged 3D cricketer vs 'batsman' in crease vs 'free_bat' 360 unconstrained)
  const [displayMode, setDisplayMode] = useState<'virat' | 'batsman' | 'free_bat'>('virat');

  // Stance Calibration & Sensor Mounting State (Device mounted on back spine of bat)
  const [isStanceCalibrated, setIsStanceCalibrated] = useState(false);
  const [mountingMode, setMountingMode] = useState<'spine_up' | 'spine_down' | 'horizontal'>('spine_up');
  const [invertPitch, setInvertPitch] = useState(false);
  const [invertRoll, setInvertRoll] = useState(false);
  const [invertYaw, setInvertYaw] = useState(false);

  const triggerCalibration = useCallback(() => {
    visualizerRef.current?.calibrateStance();
    hardwareSensorService.calibrateStance();
    setIsStanceCalibrated(true);
  }, []);

  const updateMounting = useCallback(
    (key: string, val: any) => {
      let nextMounting = mountingMode;
      let nextIp = invertPitch;
      let nextIr = invertRoll;
      let nextIy = invertYaw;

      if (key === 'mountingMode') {
        nextMounting = val;
        setMountingMode(val);
      } else if (key === 'invertPitch') {
        nextIp = val;
        setInvertPitch(val);
      } else if (key === 'invertRoll') {
        nextIr = val;
        setInvertRoll(val);
      } else if (key === 'invertYaw') {
        nextIy = val;
        setInvertYaw(val);
      }

      visualizerRef.current?.setMountingConfig?.({
        mountingMode: nextMounting,
        invertPitch: nextIp,
        invertRoll: nextIr,
        invertYaw: nextIy,
      });
    },
    [mountingMode, invertPitch, invertRoll, invertYaw]
  );

  // Auto-connect to ESP32 on mount
  useEffect(() => {
    if (!hardwareSensorService.getIsConnected()) {
      hardwareSensorService.connect('192.168.1.11', 81);
    }
  }, []);

  // Subscribe to hardware sensor events
  useEffect(() => {
    const handleRawData = (data: SensorData) => {
      setLatestData(data);
      setPacketCount((c) => c + 1);

      // Real-time stance orientation update to visualizer with quaternions & acceleration
      if (visualizerRef.current && data.imu) {
        // gx = rotation-derived speed, gy = accel-derived speed, peakImpact_g = magnitude
        const liveSpeed = Math.max(data.imu.gx || 0, data.imu.gy || 0);
        const liveAccelG = data.impact.peakImpact_g || 0;

        visualizerRef.current.updateLiveOrientation(
          data.imu.pitch,
          data.imu.roll,
          data.imu.yaw,
          {
            qw: data.imu.qw ?? 1,
            qx: data.imu.qx ?? 0,
            qy: data.imu.qy ?? 0,
            qz: data.imu.qz ?? 0,
          },
          {
            ax: data.imu.ax,
            ay: data.imu.ay,
            az: data.imu.az,
          },
          liveSpeed,
          liveAccelG
        );
      }
    };

    const handleHardwareShot = (shot: ProcessedShotData) => {
      // Physical swing detected by ESP32 sensors!
      executeLiveSwing({
        shotType: shot.shotType,
        speed: shot.batSpeedKmh,
        liftAngle: shot.batLiftAngleDeg,
        impactG: shot.impactIntensityG,
        sweetSpot: shot.sweetSpotScore,
        timing: shot.timingIndex,
        zone: shot.zone,
        feedback: shot.aiFeedback,
      });
    };

    const handleState = (info: ConnectionInfo) => {
      setConnectionInfo(info);
      const isConn = info.state === 'connected';
      setIsHardwareConnected(isConn);
      if (isConn) {
        setStreamSource('hardware');
      }
    };

    hardwareSensorService.addRawDataListener(handleRawData);
    hardwareSensorService.addShotListener(handleHardwareShot);
    hardwareSensorService.addStateListener(handleState);

    const handleSimData = (data: SensorData) => {
      if (streamSource === 'simulator') {
        handleRawData(data);
      }
    };
    sensorSimulator.addRawDataListener(handleSimData);

    return () => {
      hardwareSensorService.removeRawDataListener(handleRawData);
      hardwareSensorService.removeShotListener(handleHardwareShot);
      hardwareSensorService.removeStateListener(handleState);
      sensorSimulator.removeRawDataListener(handleSimData);
    };
  }, [streamSource]);

  // Simulator stream toggle
  useEffect(() => {
    if (streamSource === 'simulator') {
      sensorSimulator.startStream();
    } else {
      sensorSimulator.stopStream();
    }
    return () => {
      sensorSimulator.stopStream();
    };
  }, [streamSource]);

  // Auto-pitching machine interval
  useEffect(() => {
    if (autoPitcher) {
      autoPitcherTimerRef.current = setInterval(() => {
        // Pick a natural variation
        const randomPreset = SHOT_PRESETS[Math.floor(Math.random() * SHOT_PRESETS.length)];
        const speedVar = randomPreset.speed + Math.floor(Math.random() * 10 - 5);
        const impactVar = randomPreset.impact + Math.floor(Math.random() * 12 - 6);
        const sweetVar = Math.min(98, Math.max(65, randomPreset.sweet + Math.floor(Math.random() * 8 - 4)));
        const timingVar = Math.min(99, Math.max(70, randomPreset.timing + Math.floor(Math.random() * 6 - 3)));

        executeLiveSwing({
          shotType: randomPreset.label,
          speed: speedVar,
          liftAngle: randomPreset.lift,
          impactG: impactVar,
          sweetSpot: sweetVar,
          timing: timingVar,
          zone: randomPreset.zone,
        });
      }, 3800);
    } else {
      if (autoPitcherTimerRef.current) clearInterval(autoPitcherTimerRef.current);
    }
    return () => {
      if (autoPitcherTimerRef.current) clearInterval(autoPitcherTimerRef.current);
    };
  }, [autoPitcher]);

  // Execute swing function (called when user clicks, swings bat, or gesture)
  const executeLiveSwing = useCallback(
    (customParams?: {
      shotType?: string;
      speed?: number;
      liftAngle?: number;
      impactG?: number;
      sweetSpot?: number;
      timing?: number;
      zone?: string;
      feedback?: string;
      forceAnimation?: boolean;
    }) => {
      const preset = selectedShotPreset;
      const speed = customParams?.speed !== undefined ? customParams.speed : preset.speed + Math.floor(Math.random() * 8 - 4);
      const lift = customParams?.liftAngle !== undefined ? customParams.liftAngle : preset.lift + Math.floor(Math.random() * 6 - 3);
      const impact = customParams?.impactG !== undefined ? customParams.impactG : preset.impact + Math.floor(Math.random() * 10 - 5);
      const sweet = customParams?.sweetSpot !== undefined ? customParams.sweetSpot : preset.sweet + Math.floor(Math.random() * 6 - 3);
      const timing = customParams?.timing !== undefined ? customParams.timing : preset.timing + Math.floor(Math.random() * 6 - 3);
      const type = customParams?.shotType || preset.label;
      const zone = customParams?.zone || preset.zone;
      const forceAnimation = customParams?.forceAnimation ?? false;

      // Trigger 3D Visualizer animation with dynamic parameters!
      visualizerRef.current?.triggerSwing({
        shotType: type,
        batSpeed: speed,
        liftAngle: lift,
        sweetSpot: sweet,
        impactG: impact,
        timingIndex: timing,
        zone: zone,
        forceAnimation: forceAnimation,
      });

      // Generate AI feedback coaching note
      let feedback = customParams?.feedback;
      if (!feedback) {
        if (speed > 92 && sweet > 88) {
          feedback = 'Exceptional downswing velocity! Middle of the willow contact with outstanding follow-through.';
        } else if (speed > 85) {
          feedback = 'Great bat speed with high elbow backlift. Solid balance at impact.';
        } else if (sweet < 75) {
          feedback = 'Bat face slightly misaligned at impact. Work on keeping the head still.';
        } else {
          feedback = 'Consistent timing. Good weight transfer through the shot.';
        }
      }

      const newRecord = {
        id: Date.now(),
        shotType: type,
        speed,
        liftAngle: lift,
        impactG: impact,
        sweetSpot: sweet,
        timing,
        zone,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        feedback,
      };

      setLastSwing(newRecord);
      setSessionSwings((prev) => [newRecord, ...prev].slice(0, 15));

      // Also persist shot into global SessionContext if an active session exists
      try {
        const shotForContext: ShotData = {
          shotId: newRecord.id,
          shotType: type,
          result: 'Hit',
          batSpeedKmh: speed,
          impactSpeedKmh: Math.max(0, speed - 8),
          batLiftAngleDeg: lift,
          impactIntensityG: impact,
          sweetSpotScore: sweet,
          timingIndex: timing,
          swingSmoothness: 88,
          zone: zone,
          boundaryProbability: Math.min(95, Math.round((speed / 100) * 80)),
          catchChance: Math.max(5, Math.round(100 - sweet)),
          aiFeedback: feedback,
          quaternionSequence: generateMockQuaternionSequence(lift),
          impactTimeSec: 0.38,
        };
        addShot(shotForContext);
      } catch (err) {
        // Safe fallback
      }
    },
    [selectedShotPreset, addShot]
  );

  const toggleHardwareConnection = () => {
    if (isHardwareConnected) {
      hardwareSensorService.disconnect();
    } else {
      hardwareSensorService.connect(espIp.trim(), selectedPort);
    }
  };

  const handleApplyPreset = (ip: string, port: number = 81) => {
    setEspIp(ip);
    setSelectedPort(port);
    hardwareSensorService.connect(ip, port);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ═══════ TOP HEADER & HARDWARE SENSOR STATUS ═══════ */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>LIVE SWING TELEMETRY</Text>
            <View style={styles.livePulse}>
              <View
                style={[
                  styles.pulseDot,
                  isHardwareConnected
                    ? { backgroundColor: '#00C97B' }
                    : connectionInfo.state === 'connecting'
                    ? { backgroundColor: '#FF9F1C' }
                    : { backgroundColor: '#EF4444' },
                ]}
              />
              <Text
                style={[
                  styles.liveTagText,
                  isHardwareConnected
                    ? { color: '#00C97B' }
                    : connectionInfo.state === 'connecting'
                    ? { color: '#FF9F1C' }
                    : { color: '#EF4444' },
                ]}
              >
                {isHardwareConnected
                  ? 'ESP32 ONLINE'
                  : connectionInfo.state === 'connecting'
                  ? 'CONNECTING'
                  : streamSource === 'simulator'
                  ? 'SIMULATOR'
                  : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitleText}>
            Physical bat swings render live on-screen in real time
          </Text>
        </View>

        <Pressable
          style={[
            styles.hwBtn,
            isHardwareConnected && styles.hwBtnConnected,
            connectionInfo.state === 'error' && styles.hwBtnError,
            connectionInfo.state === 'connecting' && styles.hwBtnConnecting,
          ]}
          onPress={() => setShowConfig(!showConfig)}
          accessible={true}
          accessibilityLabel="ESP32 hardware connection settings and diagnostics"
        >
          <Ionicons
            name={
              isHardwareConnected
                ? 'hardware-chip'
                : connectionInfo.state === 'error'
                ? 'alert-circle'
                : 'hardware-chip-outline'
            }
            size={16}
            color={
              isHardwareConnected
                ? '#00C97B'
                : connectionInfo.state === 'error'
                ? '#EF4444'
                : connectionInfo.state === 'connecting'
                ? '#FF9F1C'
                : p.textSecondary
            }
          />
          <Text
            style={[
              styles.hwBtnText,
              isHardwareConnected && styles.hwBtnTextConnected,
              connectionInfo.state === 'error' && { color: '#EF4444' },
              connectionInfo.state === 'connecting' && { color: '#FF9F1C' },
            ]}
          >
            {isHardwareConnected
              ? 'ESP32 LINKED'
              : connectionInfo.state === 'connecting'
              ? 'CONNECTING...'
              : connectionInfo.state === 'error'
              ? 'LINK FAILED'
              : 'ESP32 CONFIG'}
          </Text>
        </Pressable>
      </View>

      {/* ═══════ ESP32 CONNECTION CONFIG & DIAGNOSTICS DRAWER ═══════ */}
      {showConfig && (
        <GlowCard style={styles.configDrawer} glowColor={isHardwareConnected ? '#00C97B' : connectionInfo.state === 'error' ? '#EF4444' : Colors.primary}>
          <View style={styles.drawerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name="wifi-outline"
                size={18}
                color={isHardwareConnected ? '#00C97B' : connectionInfo.state === 'error' ? '#EF4444' : Colors.primary}
              />
              <Text style={styles.drawerTitle}>ESP32 SmartBat Hardware Link</Text>
            </View>
            <Pressable onPress={() => setShowConfig(false)}>
              <Ionicons name="close-circle-outline" size={20} color={p.textMuted} />
            </Pressable>
          </View>

          {/* Connection Status Banner */}
          <View
            style={[
              styles.statusBanner,
              connectionInfo.state === 'connected' && styles.statusBannerConnected,
              connectionInfo.state === 'connecting' && styles.statusBannerConnecting,
              connectionInfo.state === 'error' && styles.statusBannerError,
            ]}
          >
            <Ionicons
              name={
                connectionInfo.state === 'connected'
                  ? 'checkmark-circle'
                  : connectionInfo.state === 'connecting'
                  ? 'sync'
                  : connectionInfo.state === 'error'
                  ? 'alert-circle'
                  : 'radio-outline'
              }
              size={16}
              color={
                connectionInfo.state === 'connected'
                  ? '#00C97B'
                  : connectionInfo.state === 'connecting'
                  ? '#FF9F1C'
                  : connectionInfo.state === 'error'
                  ? '#EF4444'
                  : '#7C8294'
              }
            />
            <Text
              style={[
                styles.statusBannerText,
                connectionInfo.state === 'connected' && { color: '#00C97B' },
                connectionInfo.state === 'connecting' && { color: '#FF9F1C' },
                connectionInfo.state === 'error' && { color: '#EF4444' },
              ]}
            >
              {connectionInfo.state === 'connected'
                ? `ONLINE • Connected to ${connectionInfo.url} (${connectionInfo.packetCount} packets)`
                : connectionInfo.state === 'connecting'
                ? `Attempting WebSocket connection to ${connectionInfo.url}...`
                : connectionInfo.state === 'error'
                ? `Connection Failed: ${connectionInfo.error || 'Cannot reach ESP32'}`
                : 'DISCONNECTED • Enter ESP32 IP or choose a preset below'}
            </Text>
          </View>

          {/* IP & Port Input Controls */}
          <View style={styles.ipInputRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>ESP32 IP ADDRESS</Text>
              <TextInput
                value={espIp}
                onChangeText={setEspIp}
                style={styles.textInput}
                placeholder="e.g. 192.168.1.11 or 192.168.4.1"
                placeholderTextColor={p.textMuted}
                autoCapitalize="none"
              />
            </View>

            <View style={{ width: 85 }}>
              <Text style={styles.inputLabel}>PORT</Text>
              <TextInput
                value={String(selectedPort)}
                onChangeText={(t) => setSelectedPort(parseInt(t, 10) || 81)}
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="81"
                placeholderTextColor={p.textMuted}
              />
            </View>

            <Pressable
              style={[
                styles.connectActionBtn,
                isHardwareConnected && styles.connectActionBtnActive,
                connectionInfo.state === 'connecting' && { backgroundColor: '#FF9F1C' },
              ]}
              onPress={toggleHardwareConnection}
            >
              <Text style={styles.connectActionBtnText}>
                {isHardwareConnected
                  ? 'DISCONNECT'
                  : connectionInfo.state === 'connecting'
                  ? 'CONNECTING'
                  : 'CONNECT'}
              </Text>
            </Pressable>
          </View>

          {/* Quick Preset Buttons */}
          <View style={styles.presetsRow}>
            <Text style={styles.quickPresetsLabel}>Quick Presets:</Text>
            <View style={styles.quickPresetsList}>
              <Pressable
                style={[styles.quickPresetChip, espIp === '192.168.1.11' && styles.quickPresetChipActive]}
                onPress={() => handleApplyPreset('192.168.1.11', 81)}
              >
                <Text style={styles.quickPresetChipText}>Default (192.168.1.11:81)</Text>
              </Pressable>
              <Pressable
                style={[styles.quickPresetChip, espIp === '192.168.4.1' && styles.quickPresetChipActive]}
                onPress={() => handleApplyPreset('192.168.4.1', 81)}
              >
                <Text style={styles.quickPresetChipText}>ESP32 AP (192.168.4.1:81)</Text>
              </Pressable>
              <Pressable
                style={[styles.quickPresetChip, selectedPort === 80 && styles.quickPresetChipActive]}
                onPress={() => handleApplyPreset(espIp, 80)}
              >
                <Text style={styles.quickPresetChipText}>Port 80 (/ws)</Text>
              </Pressable>
            </View>
          </View>

          {/* Interactive Wi-Fi Diagnostics & Troubleshooting Guide */}
          <View style={styles.troubleshootBox}>
            <View style={styles.troubleshootHeader}>
              <Ionicons name="help-buoy-outline" size={16} color={Colors.secondary} />
              <Text style={styles.troubleshootTitle}>Why is my ESP32 not connecting on the same Wi-Fi?</Text>
            </View>

            <View style={styles.troubleshootSteps}>
              <View style={styles.stepItem}>
                <Text style={styles.stepNum}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepHeading}>Find the ESP32's Exact Assigned IP</Text>
                  <Text style={styles.stepDesc}>
                    When the ESP32 joins your Wi-Fi, your router assigns it a dynamic IP via DHCP. To see it, open the Arduino IDE Serial Monitor (115200 baud) and press the RST button on the ESP32. It prints: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#00C97B' }}>WiFi connected! IP address: 192.168.X.X</Text>.
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <Text style={styles.stepNum}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepHeading}>2.4 GHz Band vs 5 GHz Band</Text>
                  <Text style={styles.stepDesc}>
                    ESP32 chips only have 2.4 GHz Wi-Fi radios. If your mobile phone or laptop is on a 5 GHz band, make sure both devices are connected to the same 2.4 GHz network name.
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <Text style={styles.stepNum}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepHeading}>Router "AP Isolation" / Firewall</Text>
                  <Text style={styles.stepDesc}>
                    Many Wi-Fi routers have Client/AP Isolation turned ON by default, which blocks devices from communicating with each other. If your router blocks local sockets, use a mobile hotspot or ESP32 AP mode.
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <Text style={styles.stepNum}>4</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepHeading}>Direct ESP32 Hotspot Mode (192.168.4.1)</Text>
                  <Text style={styles.stepDesc}>
                    If your router Wi-Fi keeps failing, configure the ESP32 in Access Point (AP) mode. Connect your phone directly to the ESP32's Wi-Fi network and connect to <Text style={{ fontWeight: '700', color: '#1A1D23' }}>192.168.4.1:81</Text> with zero router interference.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Active Stream Selector */}
          <View style={styles.sourceToggleRow}>
            <Text style={styles.sourceLabel}>Active Telemetry Feed:</Text>
            <View style={styles.togglePillGroup}>
              <Pressable
                style={[styles.togglePill, streamSource === 'simulator' && styles.togglePillActive]}
                onPress={() => setStreamSource('simulator')}
              >
                <Text style={[styles.togglePillText, streamSource === 'simulator' && styles.togglePillTextActive]}>
                  Simulator Stream
                </Text>
              </Pressable>
              <Pressable
                style={[styles.togglePill, streamSource === 'hardware' && styles.togglePillActive]}
                onPress={() => setStreamSource('hardware')}
              >
                <Text style={[styles.togglePillText, streamSource === 'hardware' && styles.togglePillTextActive]}>
                  ESP32 Stream
                </Text>
              </Pressable>
            </View>
          </View>
        </GlowCard>
      )}

      {/* ═══════ 3D LIVE SWING VISUALIZER STAGE ═══════ */}
      <View style={styles.stageCard}>
        {/* Stage Header Controls */}
        <View style={styles.stageControlsBar}>
          {/* Camera View Switcher */}
          <View style={styles.cameraPills}>
            {(['side', 'bowler', 'top', 'batsman'] as const).map((view) => (
              <Pressable
                key={view}
                style={[styles.camPill, cameraView === view && styles.camPillActive]}
                onPress={() => {
                  setCameraView(view);
                  visualizerRef.current?.setCameraView(view);
                }}
              >
                <Text style={[styles.camPillText, cameraView === view && styles.camPillTextActive]}>
                  {view === 'side' ? 'SIDE' : view === 'bowler' ? 'BOWLER' : view === 'top' ? 'TOP-DOWN' : 'POV'}
                </Text>
              </Pressable>
            ))}

            {/* 3D Mode Toggle: Virat Kohli / Procedural Batsman / Free 3D Bat */}
            <Pressable
              style={[
                styles.camPill,
                displayMode !== 'batsman' && styles.camPillActive,
                { borderColor: displayMode === 'virat' ? '#F59E0B' : displayMode === 'free_bat' ? '#00C97B' : '#38BDF8' }
              ]}
              onPress={() => {
                const next = displayMode === 'virat' ? 'batsman' : displayMode === 'batsman' ? 'free_bat' : 'virat';
                setDisplayMode(next);
                visualizerRef.current?.setDisplayMode?.(next);
              }}
            >
              <Text style={[styles.camPillText, styles.camPillTextActive, { color: displayMode === 'virat' ? '#F59E0B' : displayMode === 'free_bat' ? '#00C97B' : '#38BDF8' }]}>
                {displayMode === 'virat' ? '👑 VIRAT' : displayMode === 'free_bat' ? '🪄 360° BAT' : '🏏 CREASE'}
              </Text>
            </Pressable>

            {/* Stance Calibration Button */}
            <Pressable
              style={[
                styles.camPill,
                {
                  borderColor: '#00C97B',
                  backgroundColor: isStanceCalibrated ? 'rgba(0, 201, 123, 0.22)' : 'rgba(0, 201, 123, 0.12)',
                },
              ]}
              onPress={triggerCalibration}
              accessible={true}
              accessibilityLabel="Calibrate sensor to cricket batting stance"
            >
              <Ionicons name="compass" size={13} color="#00C97B" style={{ marginRight: 4 }} />
              <Text style={[styles.camPillText, { color: '#00C97B', fontWeight: '800' }]}>
                {isStanceCalibrated ? 'CALIBRATED' : '🎯 CALIBRATE'}
              </Text>
            </Pressable>
          </View>

          {/* Sound & Fullscreen Controls */}
          <View style={styles.toolIcons}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                visualizerRef.current?.setSoundEnabled(next);
              }}
              accessible={true}
              accessibilityLabel={soundEnabled ? 'Mute bat sound' : 'Unmute bat sound'}
            >
              <Ionicons
                name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
                size={18}
                color={soundEnabled ? '#00C97B' : p.textMuted}
              />
            </Pressable>

            <Pressable
              style={[styles.autoPitchBtn, autoPitcher && styles.autoPitchBtnActive]}
              onPress={() => setAutoPitcher(!autoPitcher)}
              accessible={true}
              accessibilityLabel="Toggle auto bowling machine"
            >
              <MaterialCommunityIcons
                name="robot"
                size={16}
                color={autoPitcher ? '#FFFFFF' : Colors.secondary}
              />
              <Text style={[styles.autoPitchText, autoPitcher && styles.autoPitchTextActive]}>
                {autoPitcher ? 'PITCHER ON' : 'AUTO PITCH'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 3D Visualizer Canvas Container */}
        <View style={styles.canvasContainer}>
          <LiveSwingVisualizer
            ref={visualizerRef}
            soundEnabled={soundEnabled}
            cameraView={cameraView}
            onStanceCalibrated={() => setIsStanceCalibrated(true)}
          />
        </View>
      </View>

      {/* ═══════ PRIMARY SWING ACTION TRIGGER ═══════ */}
      <View style={styles.actionSection}>
        {isHardwareConnected ? (
          <View style={{ gap: 8 }}>
            <Pressable
              style={[styles.bigSwingBtn, { borderColor: '#00C97B', backgroundColor: '#00C97B', marginBottom: 0 }]}
              onPress={triggerCalibration}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Calibrate sensor to cricket batting stance"
            >
              <View style={styles.bigSwingBtnContent}>
                <View style={[styles.swingBtnIconBg, { backgroundColor: '#0B0F19' }]}>
                  <Ionicons name="compass" size={26} color="#00C97B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bigSwingBtnTitle, { color: '#0B0F19' }]}>
                    {isStanceCalibrated ? '🎯 RE-CALIBRATE BAT STANCE' : '🎯 ZERO / CALIBRATE BAT STANCE'}
                  </Text>
                  <Text style={[styles.bigSwingBtnSub, { color: 'rgba(11, 15, 25, 0.85)' }]}>
                    Hold bat in stance & tap • Sensors drive 3D bat in 100% real-time
                  </Text>
                </View>
                <View style={[styles.swingChevron, { backgroundColor: '#0B0F19' }]}>
                  <Ionicons name="checkmark-circle" size={22} color="#00C97B" />
                </View>
              </View>
            </Pressable>

            {/* Play Built-in Swing Demo button */}
            <Pressable
              style={[styles.playDemoBtn, { borderColor: selectedShotPreset.color || '#00C97B' }]}
              onPress={() => executeLiveSwing({
                shotType: selectedShotPreset.label,
                speed: selectedShotPreset.speed,
                liftAngle: selectedShotPreset.lift,
                impactG: selectedShotPreset.impact,
                sweetSpot: selectedShotPreset.sweet,
                timing: selectedShotPreset.timing,
                zone: selectedShotPreset.zone,
                forceAnimation: true,
              })}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Play built-in ${selectedShotPreset.label} 3D swing`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.playDemoIconBg, { backgroundColor: selectedShotPreset.color || '#00C97B' }]}>
                  <Ionicons name="play" size={18} color="#0B0F19" />
                </View>
                <View>
                  <Text style={[styles.playDemoBtnText, { color: selectedShotPreset.color || '#00C97B' }]}>
                    ▶ PLAY {selectedShotPreset.label.toUpperCase()} DEMO
                  </Text>
                  <Text style={styles.playDemoBtnSub}>
                    3D Trajectory • {selectedShotPreset.speed} km/h • {selectedShotPreset.zone}
                  </Text>
                </View>
              </View>
              <Ionicons name="flash-outline" size={20} color={selectedShotPreset.color || '#00C97B'} />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable
              style={[styles.bigSwingBtn, { marginBottom: 0 }]}
              onPress={() => executeLiveSwing({ forceAnimation: true })}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Execute bat swing now"
            >
              <View style={styles.bigSwingBtnContent}>
                <View style={styles.swingBtnIconBg}>
                  <MaterialCommunityIcons name="cricket" size={28} color="#0B0F19" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigSwingBtnTitle}>SWING BAT NOW</Text>
                  <Text style={styles.bigSwingBtnSub}>
                    Tap or press Spacebar • Swings dynamically across 3D screen
                  </Text>
                </View>
                <View style={styles.swingChevron}>
                  <Ionicons name="flash" size={22} color="#0B0F19" />
                </View>
              </View>
            </Pressable>

            {/* Play Built-in Swing Demo button */}
            <Pressable
              style={[styles.playDemoBtn, { borderColor: selectedShotPreset.color || '#00C97B' }]}
              onPress={() => executeLiveSwing({
                shotType: selectedShotPreset.label,
                speed: selectedShotPreset.speed,
                liftAngle: selectedShotPreset.lift,
                impactG: selectedShotPreset.impact,
                sweetSpot: selectedShotPreset.sweet,
                timing: selectedShotPreset.timing,
                zone: selectedShotPreset.zone,
                forceAnimation: true,
              })}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Play built-in ${selectedShotPreset.label} 3D swing`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.playDemoIconBg, { backgroundColor: selectedShotPreset.color || '#00C97B' }]}>
                  <Ionicons name="play" size={18} color="#0B0F19" />
                </View>
                <View>
                  <Text style={[styles.playDemoBtnText, { color: selectedShotPreset.color || '#00C97B' }]}>
                    ▶ PLAY {selectedShotPreset.label.toUpperCase()} DEMO
                  </Text>
                  <Text style={styles.playDemoBtnSub}>
                    3D Trajectory • {selectedShotPreset.speed} km/h • {selectedShotPreset.zone}
                  </Text>
                </View>
              </View>
              <Ionicons name="flash-outline" size={20} color={selectedShotPreset.color || '#00C97B'} />
            </Pressable>
          </View>
        )}

        {/* Shot Style Selector Chips */}
        <View style={styles.presetsWrapper}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.presetsHeader}>🏏 Built-in Cricket Swings (Tap to Play 3D Demo):</Text>
            <Text style={{ fontSize: 10, color: '#00C97B', fontWeight: '700' }}>8 PRO STROKES</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsList}>
            {SHOT_PRESETS.map((item) => {
              const isSelected = selectedShotPreset.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.presetChip,
                    isSelected && [styles.presetChipSelected, { borderColor: item.color || '#00C97B' }],
                  ]}
                  onPress={() => {
                    setSelectedShotPreset(item);
                    executeLiveSwing({
                      shotType: item.label,
                      speed: item.speed,
                      liftAngle: item.lift,
                      impactG: item.impact,
                      sweetSpot: item.sweet,
                      timing: item.timing,
                      zone: item.zone,
                      forceAnimation: true,
                    });
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <MaterialCommunityIcons
                      name={(item.icon as any) || 'cricket'}
                      size={15}
                      color={isSelected ? (item.color || '#00C97B') : '#64748B'}
                    />
                    <Text style={[styles.presetChipText, isSelected && { color: item.color || '#00C97B' }]}>
                      {item.label}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.presetSpeedTag, isSelected && styles.presetSpeedTagSelected]}>
                      {item.speed} km/h
                    </Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: isSelected ? (item.color || '#00C97B') : '#94A3B8' }}>
                      • ▶ PLAY
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* ═══════ LIVE TELEMETRY DASHBOARD METRICS ═══════ */}
      <View style={styles.metricsGrid}>
        {/* Metric 1: Bat Speed */}
        <GlowCard style={styles.metricCard} glowColor={Colors.primary}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.metricLabel}>
              {latestData && isHardwareConnected && Math.max(latestData.imu.gx || 0, latestData.imu.gy || 0) > 5 ? '🔴 LIVE SPEED' : 'BAT SPEED'}
            </Text>
            <Ionicons name="speedometer-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.metricBigValue}>
              {latestData && isHardwareConnected
                ? Math.round(Math.max(latestData.imu.gx || 0, latestData.imu.gy || 0))
                : lastSwing ? lastSwing.speed : 0}
            </Text>
            <Text style={styles.metricUnit}>KM/H</Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(
                    100,
                    (((latestData && isHardwareConnected
                      ? Math.round(Math.max(latestData.imu.gx || 0, latestData.imu.gy || 0))
                      : lastSwing ? lastSwing.speed : 0) /
                      130) *
                      100)
                  )}%`,
                  backgroundColor: '#00C97B',
                },
              ]}
            />
          </View>
          <Text style={styles.meterSubtext}>
            {isHardwareConnected
              ? (latestData ? `⚡ ${Math.round(Math.max(latestData?.imu.gx || 0, latestData?.imu.gy || 0))} km/h live` : 'Ready for downswing')
              : lastSwing
              ? (lastSwing.speed >= 90 ? '⚡ Elite Pro Velocity' : 'Solid Club Speed')
              : 'Awaiting swing'}
          </Text>
        </GlowCard>

        {/* Metric 2: Impact Force */}
        <GlowCard style={styles.metricCard} glowColor={Colors.secondary}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.metricLabel}>
              {isHardwareConnected ? 'LIVE G-FORCE' : 'IMPACT SHOCK'}
            </Text>
            <MaterialCommunityIcons name="lightning-bolt" size={18} color={Colors.secondary} />
          </View>
          <View style={styles.valueRow}>
            <Text style={[styles.metricBigValue, { color: Colors.secondary }]}>
              {latestData && isHardwareConnected ? latestData.impact.peakImpact_g.toFixed(1) : (lastSwing ? lastSwing.impactG : 0)}
            </Text>
            <Text style={styles.metricUnit}>G-FORCE</Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(
                    100,
                    (((latestData && isHardwareConnected ? latestData.impact.peakImpact_g : (lastSwing ? lastSwing.impactG : 0)) / 30) * 100)
                  )}%`,
                  backgroundColor: Colors.secondary,
                },
              ]}
            />
          </View>
          <Text style={styles.meterSubtext}>
            {isHardwareConnected ? 'ADXL375 high-G accelerometer' : 'Peak ADXL375 sensor spike'}
          </Text>
        </GlowCard>

        {/* Metric 3: Sweet Spot */}
        <GlowCard style={styles.metricCard} glowColor={Colors.primary}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.metricLabel}>SWEET SPOT</Text>
            <MaterialCommunityIcons name="target" size={18} color={Colors.primary} />
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.metricBigValue}>{lastSwing ? `${lastSwing.sweetSpot}%` : '--'}</Text>
            <Text style={styles.metricUnit}>RATING</Text>
          </View>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${lastSwing ? lastSwing.sweetSpot : 0}%`, backgroundColor: '#00C97B' }]} />
          </View>
          <Text style={styles.meterSubtext}>
            {isHardwareConnected ? 'Impact torsional stability' : 'Center-blade middle contact'}
          </Text>
        </GlowCard>

        {/* Metric 4: Backlift Angle */}
        <GlowCard style={styles.metricCard} glowColor={p.gradientEnd}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.metricLabel}>
              {isHardwareConnected ? 'LIVE ELEVATION' : 'BAT LIFT ANGLE'}
            </Text>
            <Ionicons name="compass-outline" size={18} color={p.gradientEnd} />
          </View>
          <View style={styles.valueRow}>
            <Text style={[styles.metricBigValue, { color: p.gradientEnd }]}>
              {latestData && isHardwareConnected ? Math.abs(Math.round(latestData.imu.pitch)) : (lastSwing ? lastSwing.liftAngle : 0)}
            </Text>
            <Text style={styles.metricUnit}>DEG</Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(
                    100,
                    (((latestData && isHardwareConnected ? Math.abs(Math.round(latestData.imu.pitch)) : (lastSwing ? lastSwing.liftAngle : 0)) / 90) * 100)
                  )}%`,
                  backgroundColor: p.gradientEnd,
                },
              ]}
            />
          </View>
          <Text style={styles.meterSubtext}>
            {isHardwareConnected ? 'BNO085 live pitch tracking' : 'Stance to apex elevation'}
          </Text>
        </GlowCard>
      </View>

      {/* ═══════ AI COACH FEEDBACK BANNER ═══════ */}
      <GlowCard style={styles.coachCard} glowColor={Colors.primary}>
        <View style={styles.coachHeader}>
          <View style={styles.coachAvatar}>
            <Ionicons name="analytics" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.coachTitle}>VECTORBAT AI COACH</Text>
              <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38BDF8', borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#38BDF8' }}>GROK + GEMINI LIVE</Text>
              </View>
            </View>
            <Text style={styles.coachSub}>
              {lastSwing ? `${lastSwing.shotType} • Zone: ${lastSwing.zone}` : 'Ready for your first shot'}
            </Text>
          </View>
          {lastSwing && (
            <View style={styles.timingBadge}>
              <Text style={styles.timingBadgeText}>{lastSwing.timing}% TIMING</Text>
            </View>
          )}
        </View>
        <Text style={styles.coachBody}>
          {lastSwing
            ? `"${lastSwing.feedback}"`
            : '"Swing the bat or connect your ESP32 hardware to see real-time stroke analysis and AI feedback."'}
        </Text>
      </GlowCard>

      {/* ═══════ RAW SENSOR STREAM TICKER ═══════ */}
      <View style={styles.sensorTicker}>
        <View style={styles.tickerHeader}>
          <Ionicons name="pulse" size={14} color="#00C97B" />
          <Text style={styles.tickerTitle}>6-AXIS IMU LIVE SENSOR STREAM (50 HZ)</Text>
          <Text style={styles.tickerPackets}>Packets: {packetCount}</Text>
        </View>

        <View style={styles.tickerGrid}>
          <View style={styles.tickerItem}>
            <Text style={styles.tickerLabel}>PITCH</Text>
            <Text style={styles.tickerVal}>
              {latestData && isHardwareConnected ? `${latestData.imu.pitch.toFixed(1)}°` : '--'}
            </Text>
          </View>
          <View style={styles.tickerItem}>
            <Text style={styles.tickerLabel}>ROLL</Text>
            <Text style={styles.tickerVal}>
              {latestData && isHardwareConnected ? `${latestData.imu.roll.toFixed(1)}°` : '--'}
            </Text>
          </View>
          <View style={styles.tickerItem}>
            <Text style={styles.tickerLabel}>YAW</Text>
            <Text style={styles.tickerVal}>
              {latestData && isHardwareConnected ? `${latestData.imu.yaw.toFixed(1)}°` : '--'}
            </Text>
          </View>
          <View style={styles.tickerItem}>
            <Text style={styles.tickerLabel}>ACCEL X</Text>
            <Text style={styles.tickerVal}>
              {latestData && isHardwareConnected ? `${latestData.imu.ax.toFixed(2)} g` : '--'}
            </Text>
          </View>
          <View style={styles.tickerItem}>
            <Text style={styles.tickerLabel}>ACCEL Y</Text>
            <Text style={styles.tickerVal}>
              {latestData && isHardwareConnected ? `${latestData.imu.ay.toFixed(2)} g` : '--'}
            </Text>
          </View>
          <View style={styles.tickerItem}>
            <Text style={styles.tickerLabel}>ACCEL Z</Text>
            <Text style={styles.tickerVal}>
              {latestData && isHardwareConnected ? `${latestData.imu.az.toFixed(2)} g` : '--'}
            </Text>
          </View>
        </View>
      </View>

      {/* ═══════ LIVE SWINGS HISTORY FEED ═══════ */}
      {sessionSwings.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeaderRow}>
            <Text style={styles.historyTitle}>SWINGS RECORDED THIS SESSION</Text>
            <Text style={styles.historyCount}>{sessionSwings.length} SWINGS</Text>
          </View>

          {sessionSwings.map((swing, idx) => (
            <Pressable
              key={swing.id}
              style={styles.historyItem}
              onPress={() => executeLiveSwing(swing)}
              accessible={true}
              accessibilityLabel={`Replay ${swing.shotType} at ${swing.speed} km/h`}
            >
              <View style={styles.historyItemLeft}>
                <View style={styles.historyIndexCircle}>
                  <Text style={styles.historyIndexText}>#{sessionSwings.length - idx}</Text>
                </View>
                <View>
                  <Text style={styles.historyShotName}>{swing.shotType}</Text>
                  <Text style={styles.historyMeta}>
                    {swing.timestamp} • {swing.zone}
                  </Text>
                </View>
              </View>

              <View style={styles.historyItemRight}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.historySpeed}>{swing.speed} km/h</Text>
                  <Text style={styles.historyImpact}>{swing.impactG}g force</Text>
                </View>
                <View style={styles.replayBadge}>
                  <Ionicons name="play" size={12} color="#00C97B" />
                  <Text style={styles.replayBadgeText}>REPLAY</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1D23',
    letterSpacing: 0.8,
  },
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 201, 123, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C97B',
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00C97B',
    letterSpacing: 0.8,
  },
  subtitleText: {
    fontSize: 12,
    color: '#7C8294',
    marginTop: 2,
  },
  hwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 6px rgba(0,0,0,0.04)' } : {}),
  },
  hwBtnConnected: {
    backgroundColor: 'rgba(0, 201, 123, 0.08)',
    borderColor: '#00C97B',
  },
  hwBtnError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#EF4444',
  },
  hwBtnConnecting: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderColor: '#FF9F1C',
  },
  hwBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D4350',
    letterSpacing: 0.5,
  },
  hwBtnTextConnected: {
    color: '#00C97B',
  },

  // Config Drawer
  configDrawer: {
    padding: 16,
    marginBottom: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  drawerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1D23',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statusBannerConnected: {
    backgroundColor: 'rgba(0, 201, 123, 0.08)',
    borderColor: '#00C97B',
  },
  statusBannerConnecting: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderColor: '#FF9F1C',
  },
  statusBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#EF4444',
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C8294',
    flex: 1,
  },
  presetsRow: {
    marginBottom: 12,
  },
  quickPresetsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C8294',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  quickPresetsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPresetChip: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  quickPresetChipActive: {
    backgroundColor: '#00C97B',
    borderColor: '#00C97B',
  },
  quickPresetChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3D4350',
  },
  troubleshootBox: {
    backgroundColor: '#FAFBFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  troubleshootHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingBottom: 6,
  },
  troubleshootTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A1D23',
    letterSpacing: 0.3,
  },
  troubleshootSteps: {
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.secondary,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 1,
  },
  stepHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1D23',
  },
  stepDesc: {
    fontSize: 10,
    color: '#7C8294',
    lineHeight: 15,
    marginTop: 2,
  },
  ipInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  inputWrap: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C8294',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1A1D23',
    fontWeight: '600',
  },
  connectActionBtn: {
    backgroundColor: '#00C97B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectActionBtnActive: {
    backgroundColor: '#EF4444',
  },
  connectActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sourceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10,
  },
  sourceLabel: {
    fontSize: 12,
    color: '#3D4350',
    fontWeight: '600',
  },
  togglePillGroup: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    padding: 2,
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  togglePillActive: {
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : {}),
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C8294',
  },
  togglePillTextActive: {
    color: '#00C97B',
    fontWeight: '700',
  },

  // Stage Card (Visualizer Container)
  stageCard: {
    backgroundColor: '#0B0F19',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 201, 123, 0.25)',
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 28px rgba(0,0,0,0.18)' } : {}),
  },
  stageControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cameraPills: {
    flexDirection: 'row',
    gap: 4,
  },
  camPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  camPillActive: {
    backgroundColor: '#00C97B',
  },
  camPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  camPillTextActive: {
    color: '#0B0F19',
  },
  toolIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoPitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  autoPitchBtnActive: {
    backgroundColor: Colors.secondary,
  },
  autoPitchText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 0.5,
  },
  autoPitchTextActive: {
    color: '#FFFFFF',
  },
  canvasContainer: {
    width: '100%',
    height: 380,
    backgroundColor: '#0B0F19',
  },

  // Primary Action Section
  actionSection: {
    marginBottom: 16,
  },
  bigSwingBtn: {
    backgroundColor: '#00C97B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#34D399',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 6px 20px rgba(0, 201, 123, 0.35)',
      cursor: 'pointer',
      transition: 'transform 0.1s ease',
    } : {}),
  },
  bigSwingBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  swingBtnIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigSwingBtnTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0B0F19',
    letterSpacing: 1.2,
  },
  bigSwingBtnSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(11, 15, 25, 0.75)',
    marginTop: 2,
  },
  swingChevron: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDemoBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#00C97B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
      cursor: 'pointer',
    } : {}),
  },
  playDemoIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00C97B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDemoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00C97B',
    letterSpacing: 0.8,
  },
  playDemoBtnSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },

  // Stroke Presets Chips
  presetsWrapper: {
    marginTop: 6,
  },
  presetsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C8294',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  presetsList: {
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    minWidth: 105,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 4px rgba(0,0,0,0.03)' } : {}),
  },
  presetChipSelected: {
    backgroundColor: '#0B0F19',
    borderColor: '#00C97B',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1D23',
  },
  presetChipTextSelected: {
    color: '#00C97B',
  },
  presetSpeedTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C8294',
    marginTop: 2,
  },
  presetSpeedTagSelected: {
    color: '#FFFFFF',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C8294',
    letterSpacing: 0.8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  metricBigValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1D23',
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C8294',
  },
  meterTrack: {
    height: 5,
    backgroundColor: '#E8EBF0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  meterSubtext: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C8294',
  },

  // Coach Card
  coachCard: {
    padding: 16,
    marginBottom: 16,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00C97B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A1D23',
    letterSpacing: 0.8,
  },
  coachSub: {
    fontSize: 11,
    color: '#7C8294',
  },
  timingBadge: {
    backgroundColor: 'rgba(0, 201, 123, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00C97B',
  },
  coachBody: {
    fontSize: 13,
    color: '#3D4350',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Raw IMU Ticker
  sensorTicker: {
    backgroundColor: '#0B0F19',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 6,
  },
  tickerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00C97B',
    letterSpacing: 1,
    flex: 1,
  },
  tickerPackets: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  tickerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  tickerItem: {
    flexBasis: '30%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 8,
    borderRadius: 8,
  },
  tickerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  tickerVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // History Section
  historySection: {
    marginTop: 4,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A1D23',
    letterSpacing: 0.8,
  },
  historyCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00C97B',
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.03)' } : {}),
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyIndexCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C8294',
  },
  historyShotName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1D23',
  },
  historyMeta: {
    fontSize: 11,
    color: '#7C8294',
    marginTop: 2,
  },
  historyItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historySpeed: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1D23',
  },
  historyImpact: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.secondary,
  },
  replayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 201, 123, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  replayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00C97B',
  },
});
