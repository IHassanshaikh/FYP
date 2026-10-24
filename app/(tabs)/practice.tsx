import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Platform, Dimensions, Image, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GlowCard } from '@/components/GlowCard';
import Colors from '@/constants/Colors';

const p = Colors.palette;
import { sensorSimulator, SensorData, ProcessedShotData } from '@/services/SensorSimulator';
import { hardwareSensorService, ConnectionInfo } from '@/services/HardwareSensorService';
import { useSession } from '@/services/SessionContext';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

const PITCH_TYPES = ['Grass', 'Concrete', 'Turf', 'Matting', 'Astroturf'];
const GROUND_CONDITIONS = ['Dry', 'Wet', 'Damp', 'Dusty', 'Lush Green'];
const BOUNDARY_SIZES = ['Small', 'Medium', 'Large'];

export default function PracticeScreen() {
  const router = useRouter();
  const { activeSession, startSession, endSession } = useSession();

  // Navigation Steps: 'mode' | 'config' | 'calibrate' | 'active'
  const [setupStep, setSetupStep] = useState<'mode' | 'config' | 'calibrate' | 'active'>('mode');

  // Tracking Mode State
  const [trackingMode, setTrackingMode] = useState<'sensor' | 'sensor_camera'>('sensor_camera');

  // Connection & Telemetry State
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(
    hardwareSensorService.getConnectionInfo()
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [latestShot, setLatestShot] = useState<ProcessedShotData | null>(null);

  // Setup Form State
  const [pitchType, setPitchType] = useState('Turf');
  const [groundCondition, setGroundCondition] = useState('Dry');
  const [boundarySize, setBoundarySize] = useState('Medium');
  const [espIpAddress, setEspIpAddress] = useState('192.168.1.11');

  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(3);

  // Calibration Countdown Timer Hook
  useEffect(() => {
    let intervalId: any;
    if (isCalibrating && calibrationCountdown > 0) {
      intervalId = setInterval(() => {
        setCalibrationCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isCalibrating && calibrationCountdown === 0) {
      setIsCalibrating(false);
      // Run startSession in a setTimeout to ensure it is decoupled from the rendering cycle
      setTimeout(() => {
        handleStartSession();
      }, 0);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCalibrating, calibrationCountdown]);

  // Expo Camera Permissions Hook
  const [permission, requestPermission] = useCameraPermissions();

  // HTML5 Video Ref for Webcam
  const videoRef = useRef<any>(null);

  // Automatically start live stream if activeSession changes
  useEffect(() => {
    if (activeSession) {
      setSetupStep('active');
      // Determine which sensor to use
      if (trackingMode === 'sensor') {
        // We let the connection listener update isConnected
        hardwareSensorService.connect(espIpAddress);
      } else {
        setIsConnected(true); // Simulator is instantly connected
        sensorSimulator.startStream();
      }
      setIsStreaming(true);
    } else {
      setSetupStep('mode');
      setIsStreaming(false);
      setIsConnected(false);
      sensorSimulator.stopStream();
      hardwareSensorService.disconnect();
    }
  }, [activeSession, trackingMode]);

  // Listener to sensor data and connection status
  useEffect(() => {
    const handleData = (data: SensorData) => setLatestData(data);
    const handleShot = (shot: ProcessedShotData) => {
      setLatestShot(shot);
    };
    const handleState = (info: ConnectionInfo) => {
      setConnectionInfo(info);
      if (trackingMode === 'sensor') {
        setIsConnected(info.state === 'connected');
      }
    };

    sensorSimulator.addRawDataListener(handleData);
    sensorSimulator.addShotListener(handleShot);
    hardwareSensorService.addRawDataListener(handleData);
    hardwareSensorService.addShotListener(handleShot);
    hardwareSensorService.addStateListener(handleState);

    return () => {
      sensorSimulator.removeRawDataListener(handleData);
      sensorSimulator.removeShotListener(handleShot);
      hardwareSensorService.removeRawDataListener(handleData);
      hardwareSensorService.removeShotListener(handleShot);
      hardwareSensorService.removeStateListener(handleState);
    };
  }, [trackingMode]);

  // HTML5 Webcam hook
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (Platform.OS === 'web' && setupStep === 'active' && trackingMode === 'sensor_camera' && videoRef.current) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { width: 320, height: 240 } })
          .then((s) => {
            stream = s;
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
          })
          .catch((err) => {
            console.warn('Webcam permission denied or not available.', err);
          });
      } else {
        console.warn('navigator.mediaDevices.getUserMedia is not supported on this browser context (likely insecure HTTP context).');
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [setupStep, trackingMode]);


  const toggleConnection = () => {
    setIsConnected(!isConnected);
    if (isConnected && isStreaming) {
      sensorSimulator.stopStream();
      setIsStreaming(false);
    }
  };

  const toggleStream = () => {
    if (!isStreaming) {
      if (trackingMode === 'sensor') hardwareSensorService.connect(espIpAddress);
      else sensorSimulator.startStream();
      setIsStreaming(true);
    } else {
      if (trackingMode === 'sensor') hardwareSensorService.disconnect();
      else sensorSimulator.stopStream();
      setIsStreaming(false);
    }
  };

  const simulateShot = () => {
    if (!isStreaming) {
      sensorSimulator.startStream();
      setIsStreaming(true);
    }
    const shots = ['Cover Drive', 'Pull', 'Cut', 'Sweep', 'Straight Drive'];
    const randomShot = shots[Math.floor(Math.random() * shots.length)];
    sensorSimulator.simulateSwing(randomShot);
  };

  const handleStartCalibration = () => {
    setSetupStep('calibrate');
    setIsCalibrating(true);
    setCalibrationCountdown(3);
  };

  const handleStartSession = () => {
    startSession({
      pitchType,
      groundCondition,
      boundarySize,
      trackingMode,
    });
  };

  const handleEndSession = () => {
    // Stop stream
    sensorSimulator.stopStream();
    hardwareSensorService.disconnect();
    setIsStreaming(false);
    setIsConnected(false);

    // Save session and redirect
    const completedId = endSession();
    if (completedId) {
      router.push(`/session/${completedId}` as any);
    }
  };

  // Permission handling for Native camera
  const hasPermission = Platform.OS === 'web' || (permission && permission.granted);

  // ═══════ STEP 1: TRACKING MODE SELECTION ═══════
  if (setupStep === 'mode') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.formTitle}>START NEW PRACTICE SESSION</Text>
        <Text style={styles.formSubtitle}>Choose how you want to track your bat swing telemetry today.</Text>

        <Pressable onPress={() => setTrackingMode('sensor_camera')} style={styles.modeCardBtn}>
          <GlowCard
            style={[styles.modeCard, trackingMode === 'sensor_camera' && styles.modeCardSelected]}
            glowColor={trackingMode === 'sensor_camera' ? Colors.primary : 'transparent'}
          >
            <View style={styles.modeRow}>
              <View style={styles.modeIconWrap}>
                <Ionicons name="videocam" size={36} color={Colors.primary} />
              </View>
              <View style={styles.modeTextWrap}>
                <View style={styles.recommendedBadgeHeader}>
                  <Text style={styles.modeName}>Sensor + Camera</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>RECOMMENDED</Text>
                  </View>
                </View>
                <Text style={styles.modeDesc}>
                  Syncs bat sensor hardware with your phone camera. Captures dynamic body skeletal tracking, validates impact points, and records video replays.
                </Text>
              </View>
            </View>
          </GlowCard>
        </Pressable>

        <Pressable onPress={() => setTrackingMode('sensor')} style={styles.modeCardBtn}>
          <GlowCard
            style={[styles.modeCard, trackingMode === 'sensor' && styles.modeCardSelected]}
            glowColor={trackingMode === 'sensor' ? Colors.primary : 'transparent'}
          >
            <View style={styles.modeRow}>
              <View style={styles.modeIconWrap}>
                <Ionicons name="hardware-chip" size={36} color={Colors.light.muted} />
              </View>
              <View style={styles.modeTextWrap}>
                <Text style={styles.modeName}>Sensor Only</Text>
                <Text style={styles.modeDesc}>
                  Tracks swings using just the wireless bat sensors (orientation + impact force). Fast setup, no camera permissions needed. Outputs estimated metrics.
                </Text>
              </View>
            </View>
          </GlowCard>
        </Pressable>

        <Pressable
          style={styles.proceedBtn}
          onPress={() => setSetupStep('config')}
        >
          <Text style={styles.proceedBtnText}>PROCEED TO CONFIGURATION</Text>
          <Ionicons name="arrow-forward" size={18} color="#333333" style={{ marginLeft: 8 }} />
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ═══════ STEP 2: ENVIRONMENT CONFIGURATION & SETUP GUIDE ═══════
  if (setupStep === 'config') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.formBreadcrumb}>
          <Pressable onPress={() => setSetupStep('mode')} style={styles.breadcrumbBackBtn}>
            <Ionicons name="arrow-back" size={16} color={Colors.light.muted} />
            <Text style={styles.breadcrumbBackText}>Change tracking mode</Text>
          </Pressable>
        </View>

        <Text style={styles.formTitle}>ENVIRONMENT CONFIGURATION</Text>
        <Text style={styles.formSubtitle}>Set parameters to calibrate boundaries and impact dynamics.</Text>

        {/* Setup Positioning Guide if Camera Mode selected */}
        {trackingMode === 'sensor_camera' && (
          <GlowCard style={styles.setupGuideCard} glowColor={Colors.secondary + '30'}>
            <View style={styles.guideHeader}>
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.secondary} />
              <Text style={styles.guideTitle}>DEVICE & CAMERA SETUP</Text>
            </View>
            <View style={styles.guideSteps}>
              <View style={styles.guideStepItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                <Text style={styles.guideStepText}>Connect bat sensor (orientation + impact force).</Text>
              </View>
              <View style={styles.guideStepItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                <Text style={styles.guideStepText}>Place phone on a tripod with a side or front-on view.</Text>
              </View>
              <View style={styles.guideStepItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                <Text style={styles.guideStepText}>Ensure the batsman's entire body is visible.</Text>
              </View>
              <View style={styles.guideStepItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                <Text style={styles.guideStepText}>Ensure good lighting in the practice area.</Text>
              </View>
            </View>
          </GlowCard>
        )}

        {/* ESP32 IP Address Input for Sensor Only mode */}
        {trackingMode === 'sensor' && (
          <GlowCard style={styles.formCard}>
            <View style={styles.formSectionHeader}>
              <Ionicons name="wifi-outline" size={20} color={Colors.primary} />
              <Text style={styles.formSectionTitle}>ESP32 IP Address & Connection</Text>
            </View>
            <Text style={[styles.formSubtitle, { marginBottom: 10, paddingHorizontal: 0, textAlign: 'left' }]}>
              Enter your ESP32's IP address (Station Mode) or use direct Access Point mode (192.168.4.1).
            </Text>

            {/* Quick Presets */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <Pressable
                style={{
                  backgroundColor: espIpAddress === '192.168.1.11' ? Colors.primary : p.surfaceElevated,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.glassBorder,
                }}
                onPress={() => setEspIpAddress('192.168.1.11')}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: espIpAddress === '192.168.1.11' ? '#0B0F19' : p.textSecondary }}>
                  Default (192.168.1.11)
                </Text>
              </Pressable>

              <Pressable
                style={{
                  backgroundColor: espIpAddress === '192.168.4.1' ? Colors.primary : p.surfaceElevated,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.glassBorder,
                }}
                onPress={() => setEspIpAddress('192.168.4.1')}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: espIpAddress === '192.168.4.1' ? '#0B0F19' : p.textSecondary }}>
                  ESP32 AP (192.168.4.1)
                </Text>
              </Pressable>

              <Pressable
                style={{
                  backgroundColor: espIpAddress === 'localhost:81' ? Colors.primary : p.surfaceElevated,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.glassBorder,
                }}
                onPress={() => setEspIpAddress('localhost:81')}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: espIpAddress === 'localhost:81' ? '#0B0F19' : p.textSecondary }}>
                  Local Mock (localhost:81)
                </Text>
              </Pressable>
            </View>

            <TextInput 
              style={{
                backgroundColor: p.base,
                borderWidth: 1,
                borderColor: p.glassBorderLight,
                color: p.textPrimary,
                padding: 12,
                borderRadius: 8,
                fontSize: 14,
              }}
              value={espIpAddress}
              onChangeText={setEspIpAddress}
              placeholder="e.g. 192.168.1.11 or 192.168.4.1"
              placeholderTextColor={p.textMuted}
              autoCapitalize="none"
            />

            {/* Test Connection Action Button */}
            <Pressable 
              style={{ 
                marginTop: 12, 
                backgroundColor: isConnected
                  ? '#00C97B'
                  : connectionInfo.state === 'connecting'
                  ? '#FF9F1C'
                  : connectionInfo.state === 'error'
                  ? '#EF4444'
                  : p.surfaceElevated, 
                padding: 12, 
                borderRadius: 8, 
                alignItems: 'center', 
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                borderWidth: 1, 
                borderColor: isConnected ? '#00C97B' : p.glassBorder 
              }}
              onPress={() => {
                if (isConnected) {
                  hardwareSensorService.disconnect();
                } else {
                  hardwareSensorService.connect(espIpAddress);
                }
              }}
            >
              <Ionicons
                name={
                  isConnected
                    ? 'checkmark-circle'
                    : connectionInfo.state === 'connecting'
                    ? 'sync'
                    : connectionInfo.state === 'error'
                    ? 'alert-circle'
                    : 'wifi'
                }
                size={18}
                color={
                  isConnected || connectionInfo.state === 'connecting' || connectionInfo.state === 'error'
                    ? '#FFFFFF'
                    : p.textPrimary
                }
              />
              <Text
                style={{
                  color: isConnected || connectionInfo.state === 'connecting' || connectionInfo.state === 'error'
                    ? '#FFFFFF'
                    : p.textPrimary,
                  fontWeight: 'bold',
                  fontSize: 13,
                }}
              >
                {isConnected
                  ? 'Connected to ESP32! (Tap to Disconnect)'
                  : connectionInfo.state === 'connecting'
                  ? `Connecting to ${connectionInfo.url}...`
                  : connectionInfo.state === 'error'
                  ? 'Connection Failed (Tap to Retry)'
                  : 'Test Connection'}
              </Text>
            </Pressable>

            {/* Live Connection Diagnostics Readout Banner */}
            <View
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                backgroundColor: isConnected
                  ? 'rgba(0, 201, 123, 0.08)'
                  : connectionInfo.state === 'error'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : connectionInfo.state === 'connecting'
                  ? 'rgba(255, 159, 28, 0.08)'
                  : 'rgba(0,0,0,0.03)',
                borderWidth: 1,
                borderColor: isConnected
                  ? '#00C97B'
                  : connectionInfo.state === 'error'
                  ? '#EF4444'
                  : connectionInfo.state === 'connecting'
                  ? '#FF9F1C'
                  : p.glassBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: isConnected
                    ? '#00C97B'
                    : connectionInfo.state === 'error'
                    ? '#EF4444'
                    : connectionInfo.state === 'connecting'
                    ? '#FF9F1C'
                    : p.textMuted,
                }}
              >
                {isConnected
                  ? `ONLINE • Receiving telemetry packets from ${connectionInfo.url}`
                  : connectionInfo.state === 'connecting'
                  ? `Connecting to ${connectionInfo.url}... Handshake in progress.`
                  : connectionInfo.state === 'error'
                  ? `ERROR: ${connectionInfo.error || 'Host unreachable'}`
                  : 'STATUS: Ready to test. Click button above to verify.'}
              </Text>

              {/* Troubleshooting Tips if error */}
              {connectionInfo.state === 'error' && (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(239, 68, 68, 0.15)' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1A1D23', marginBottom: 4 }}>
                    Troubleshooting Steps:
                  </Text>
                  <Text style={{ fontSize: 10, color: '#7C8294', lineHeight: 14 }}>
                    1. Check Arduino IDE Serial Monitor (115200 baud) for ESP32's actual assigned IP.{'\n'}
                    2. Ensure phone and ESP32 are both on 2.4 GHz Wi-Fi.{'\n'}
                    3. If router has AP Isolation enabled, switch to ESP32 AP mode (192.168.4.1) or mobile hotspot.
                  </Text>
                </View>
              )}
            </View>

            {/* Live IMU Data Stream when connected */}
            {isConnected && latestData && (
              <View style={{ marginTop: 10, padding: 10, backgroundColor: '#0B0F19', borderRadius: 8 }}>
                <Text style={{ color: '#00C97B', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                  LIVE ESP32 SENSOR TELEMETRY:
                </Text>
                <Text style={{ color: '#E2F1FF', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  ADXL375 Impact: {latestData.impact.peakImpact_g.toFixed(2)}g
                </Text>
                <Text style={{ color: '#E2F1FF', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  BNO085 IMU: Roll={latestData.imu.roll.toFixed(1)}° Pitch={latestData.imu.pitch.toFixed(1)}° Yaw={latestData.imu.yaw.toFixed(1)}°
                </Text>
              </View>
            )}
          </GlowCard>
        )}

        {/* Pitch Type Selector */}
        <GlowCard style={styles.formCard}>
          <View style={styles.formSectionHeader}>
            <MaterialCommunityIcons name="cricket" size={20} color={Colors.primary} />
            <Text style={styles.formSectionTitle}>Pitch Type</Text>
          </View>
          <View style={styles.selectorRow}>
            {PITCH_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.selectorBtn, pitchType === type && styles.selectorBtnActive]}
                onPress={() => setPitchType(type)}
              >
                <Text style={[styles.selectorBtnText, pitchType === type && styles.selectorBtnTextActive]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        {/* Ground Condition Selector */}
        <GlowCard style={styles.formCard}>
          <View style={styles.formSectionHeader}>
            <Ionicons name="sunny-outline" size={20} color={Colors.primary} />
            <Text style={styles.formSectionTitle}>Ground Condition</Text>
          </View>
          <View style={styles.selectorRow}>
            {GROUND_CONDITIONS.map((cond) => (
              <Pressable
                key={cond}
                style={[styles.selectorBtn, groundCondition === cond && styles.selectorBtnActive]}
                onPress={() => setGroundCondition(cond)}
              >
                <Text style={[styles.selectorBtnText, groundCondition === cond && styles.selectorBtnTextActive]}>
                  {cond}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        {/* Boundary Size Selector */}
        <GlowCard style={styles.formCard}>
          <View style={styles.formSectionHeader}>
            <MaterialCommunityIcons name="circle-double" size={20} color={Colors.primary} />
            <Text style={styles.formSectionTitle}>Boundary Size</Text>
          </View>
          <View style={styles.selectorRow}>
            {BOUNDARY_SIZES.map((size) => (
              <Pressable
                key={size}
                style={[styles.selectorBtn, boundarySize === size && styles.selectorBtnActive]}
                onPress={() => setBoundarySize(size)}
              >
                <Text style={[styles.selectorBtnText, boundarySize === size && styles.selectorBtnTextActive]}>
                  {size}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        <Pressable
          style={styles.proceedBtn}
          onPress={handleStartCalibration}
        >
          <Text style={styles.proceedBtnText}>PROCEED TO CALIBRATION</Text>
          <Ionicons name="speedometer-outline" size={18} color="#333333" style={{ marginLeft: 8 }} />
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ═══════ STEP 3: INTERACTIVE BAT CALIBRATION ═══════
  if (setupStep === 'calibrate') {
    return (
      <View style={styles.calibrateContainer}>
        <GlowCard style={styles.calibrateCard} glowColor={Colors.primary}>
          <Ionicons name="options-outline" size={60} color={Colors.primary} style={{ alignSelf: 'center' }} />
          <Text style={styles.calibrateTitle}>Calibrating Sensors & Camera</Text>
          
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{calibrationCountdown}</Text>
          </View>

          <View style={styles.calibrateInstructions}>
            <View style={styles.instructionRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.instructionText}>Please stand in your standard batting stance.</Text>
            </View>
            <View style={styles.instructionRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.instructionText}>Keep the bat completely still.</Text>
            </View>
            <View style={styles.instructionRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.instructionText}>
                Setting zero-angles for orientation sensor & framing camera origin.
              </Text>
            </View>
          </View>
        </GlowCard>
      </View>
    );
  }

  // Double check that activeSession is not null for Step 4 rendering
  if (!activeSession) return null;

  // ═══════ STEP 4: ACTIVE LIVE SESSION STREAMING ═══════
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Configuration Indicator Summary */}
      <View style={styles.activeMetaSummary}>
        <Text style={styles.activeMetaText}>
          <Text style={styles.activeMetaLabel}>Mode:</Text> {trackingMode === 'sensor_camera' ? 'Sensor + Camera' : 'Sensor Only'}  •  
          <Text style={styles.activeMetaLabel}> Pitch:</Text> {activeSession.config.pitchType}  •  
          <Text style={styles.activeMetaLabel}> Ground:</Text> {activeSession.config.groundCondition}
        </Text>
      </View>

      {/* Live Camera Feed with Skeletal Overlay in Camera tracking mode */}
      {trackingMode === 'sensor_camera' && (
        <View style={styles.cameraFrameWrapper}>
          <View style={styles.cameraFrame}>
            {!hasPermission ? (
              <View style={styles.permissionRequestBlock}>
                <Ionicons name="camera-outline" size={32} color={Colors.primary} />
                <Text style={styles.permissionText}>Camera permission required for motion analysis.</Text>
                <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Grant Permission</Text>
                </Pressable>
              </View>
            ) : Platform.OS === 'web' ? (
              <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={styles.webcamVideo}
                />
              </View>
            ) : (
              <CameraView style={styles.nativeCameraView} facing="back" />
            )}
          </View>
        </View>
      )}

      {/* Hardware / ESP32 Status */}
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#777777' }]} />
        <Text style={styles.statusText}>
          {isConnected ? 'ESP32 Connected' : 'Sensor Disconnected'}
        </Text>
        <Pressable style={styles.connectBtn} onPress={toggleConnection}>
          <Text style={styles.connectBtnText}>{isConnected ? 'Disconnect' : 'Connect'}</Text>
        </Pressable>
      </View>

      {/* Stream & End Session Controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.mainBtn, !isConnected && styles.mainBtnDisabled]}
          disabled={!isConnected}
          onPress={toggleStream}
        >
          <Text style={styles.mainBtnText}>{isStreaming ? 'STOP RECORDING' : 'START RECORDING'}</Text>
        </Pressable>

        <Pressable
          style={[styles.simBtn, (!isConnected || !isStreaming) && styles.mainBtnDisabled]}
          disabled={!isConnected || !isStreaming}
          onPress={simulateShot}
        >
          <Text style={styles.simBtnText}>SIMULATE SWING</Text>
        </Pressable>
      </View>

      {/* Only show stats when NOT streaming (recording is stopped) */}
      {!isStreaming && (
        <>
      {/* Live Data Display */}
      {latestData && (
        <GlowCard style={styles.liveCard} glowColor={Colors.primary}>
          <Text style={styles.liveHeader}>Live Sensor Telemetry</Text>
          <View style={styles.dataRow}>
            <View style={styles.dataCol}>
              <Text style={styles.dataLabel}>Orientation Sensor Pitch / Roll / Yaw</Text>
              <Text style={styles.dataValue}>
                {latestData.imu.pitch.toFixed(0)}° / {latestData.imu.roll.toFixed(0)}° / {latestData.imu.yaw.toFixed(0)}°
              </Text>
            </View>
            <View style={styles.dataCol}>
              <Text style={styles.dataLabel}>Impact Shock Force</Text>
              <Text style={styles.dataValueHighlight}>
                {latestData.impact.peakImpact_g.toFixed(1)} g
              </Text>
            </View>
          </View>
        </GlowCard>
      )}

      {/* Latest Shot Performance Pop-up */}
      {latestShot && (
        <GlowCard style={styles.shotCard} glowColor={Colors.secondary}>
          <View style={styles.shotHeader}>
            <Ionicons name="flash" size={22} color={Colors.secondary} />
            <Text style={styles.shotTitle}>SWING DETECTED</Text>
          </View>
          <Text style={styles.shotType}>{latestShot.shotType}</Text>

          <View style={styles.shotGrid}>
            <View style={styles.shotStat}>
              <Text style={styles.shotStatValue}>
                {latestShot.batSpeedKmh} <Text style={styles.shotStatUnit}>km/h</Text>
              </Text>
              <Text style={styles.shotStatLabel}>Speed</Text>
            </View>
            <View style={styles.shotStat}>
              <Text style={styles.shotStatValue}>
                {latestShot.sweetSpotScore} <Text style={styles.shotStatUnit}>%</Text>
              </Text>
              <Text style={styles.shotStatLabel}>Sweet Spot</Text>
            </View>
            <View style={styles.shotStat}>
              <Text style={styles.shotStatValue}>
                {latestShot.timingIndex} <Text style={styles.shotStatUnit}>%</Text>
              </Text>
              <Text style={styles.shotStatLabel}>Timing</Text>
            </View>
          </View>

          {/* Camera Point of Contact indicators */}
          {trackingMode === 'sensor_camera' && (
            <View style={styles.cameraShotStats}>
              <View style={styles.camStatItem}>
                <Ionicons name="checkmark-circle" size={14} color="#00E676" />
                <Text style={styles.camStatText}>Ball Contact Detected</Text>
              </View>
              <View style={styles.camStatItem}>
                <Ionicons name="time-outline" size={14} color={Colors.secondary} />
                <Text style={styles.camStatText}>Contact Timing: 0.42 sec after downswing</Text>
              </View>
            </View>
          )}

          <Text style={styles.aiFeedback}>{latestShot.aiFeedback}</Text>
        </GlowCard>
      )}

      {/* Shots List in Active Session */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PLAYED SWINGS ({activeSession.shots.length})</Text>
      </View>

      {activeSession.shots.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cricket" size={48} color="#333" />
          <Text style={styles.emptyStateText}>No swings recorded yet.</Text>
          <Text style={styles.emptyStateSub}>Tap "SIMULATE SWING" or take a physical swing to track data.</Text>
        </View>
      ) : (
        activeSession.shots.map((shot, idx) => (
          <GlowCard key={shot.shotId} style={styles.miniShotCard} noPadding={true}>
            <View style={styles.miniShotInner}>
              <View style={styles.miniShotLeft}>
                <Text style={styles.miniShotNum}>#{shot.shotId}</Text>
                <Text style={styles.miniShotType}>{shot.shotType}</Text>
              </View>
              <View style={styles.miniShotRight}>
                <View style={styles.miniMetric}>
                  <Text style={styles.miniMetricValue}>{shot.batSpeedKmh} km/h</Text>
                  <Text style={styles.miniMetricLabel}>Speed</Text>
                </View>
                {trackingMode === 'sensor_camera' && (
                  <View style={styles.miniMetric}>
                    <Text style={styles.miniMetricValue}>0.42s</Text>
                    <Text style={styles.miniMetricLabel}>POC</Text>
                  </View>
                )}
              </View>
            </View>
          </GlowCard>
        ))
      )}

      {/* End Session Button */}
      <Pressable style={styles.endSessionBtn} onPress={handleEndSession}>
        <Text style={styles.endSessionBtnText}>END & SAVE SESSION</Text>
        <Ionicons name="stop-circle" size={20} color="#333333" style={{ marginLeft: 8 }} />
      </Pressable>
      </>
      )}

      {/* Show space below the camera feed if streaming */}
      {isStreaming && <View style={{ height: 100 }} />}

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

  // Configuration Breadcrumb
  formBreadcrumb: {
    marginBottom: 10,
  },
  breadcrumbBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breadcrumbBackText: {
    color: p.textMuted,
    fontSize: 12,
    marginLeft: 6,
  },

  // Setup Form
  formTitle: {
    color: p.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formSubtitle: {
    color: p.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  // Step 1: Mode selectors
  modeCardBtn: {
    marginVertical: 4,
  },
  modeCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: p.glassBorder,
    backgroundColor: p.surface,
  },
  modeCardSelected: {
    borderColor: Colors.primary,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modeIconWrap: {
    marginRight: 16,
    marginTop: 4,
  },
  modeTextWrap: {
    flex: 1,
  },
  recommendedBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  recommendedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 10,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  modeName: {
    color: p.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modeDesc: {
    color: p.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  // Setup Positioning Guide
  setupGuideCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '25',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  guideTitle: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  guideSteps: {
    marginLeft: 4,
  },
  guideStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  guideStepText: {
    color: p.textSecondary,
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
  },

  formCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formSectionTitle: {
    color: p.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.glassBorderLight,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: p.surface,
  },
  selectorBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  selectorBtnText: {
    color: p.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  selectorBtnTextActive: {
    color: Colors.primary,
  },
  proceedBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    ...(Platform.OS === 'web' ? {
      boxShadow: `0 4px 16px ${Colors.primary}35`,
    } : {}),
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Step 3: Interactive Calibration
  calibrateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.base,
    padding: 24,
  },
  calibrateCard: {
    padding: 30,
    alignSelf: 'stretch',
    maxWidth: 450,
  },
  calibrateTitle: {
    color: p.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    backgroundColor: Colors.primary + '10',
  },
  countdownNumber: {
    color: p.textPrimary,
    fontSize: 44,
    fontWeight: 'bold',
  },
  calibrateInstructions: {
    alignItems: 'flex-start',
    width: '100%',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  instructionText: {
    color: p.textMuted,
    fontSize: 13,
    marginLeft: 12,
    flex: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },

  // Active Practice UI
  activeMetaSummary: {
    backgroundColor: p.surfaceElevated,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: 16,
    alignItems: 'center',
  },
  activeMetaText: {
    color: p.textSecondary,
    fontSize: 13,
  },
  activeMetaLabel: {
    color: Colors.primary,
    fontWeight: 'bold',
  },

  // Camera Frame Wrapper & Bounding Box Skeletal overlays
  cameraFrameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    width: '100%',
  },
  cameraFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: p.surface,
    borderWidth: 2,
    borderColor: p.glassBorderLight,
  },
  webcamVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  nativeCameraView: {
    width: '100%',
    height: '100%',
  },

  // Permissions Request Block
  permissionRequestBlock: {
    width: 320,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.surfaceElevated,
    padding: 20,
  },
  permissionText: {
    color: p.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
    lineHeight: 16,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: p.base,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    color: p.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: p.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.glassBorderLight,
  },
  connectBtnText: {
    color: p.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mainBtn: {
    flex: 1.2,
    backgroundColor: p.surface,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: p.glassBorderLight,
  },
  simBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  mainBtnDisabled: {
    opacity: 0.4,
  },
  mainBtnText: {
    color: p.textPrimary,
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  simBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  liveCard: {
    marginBottom: 20,
    borderWidth: 1.5,
  },
  liveHeader: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dataCol: {
    flex: 1,
  },
  dataLabel: {
    color: p.textMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  dataValue: {
    color: p.textPrimary,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dataValueHighlight: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  shotCard: {
    marginBottom: 20,
    borderWidth: 2,
  },
  shotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shotTitle: {
    color: Colors.secondary,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  shotType: {
    color: p.textPrimary,
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  shotGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: p.divider,
    paddingVertical: 12,
  },
  shotStat: {
    alignItems: 'center',
    flex: 1,
  },
  shotStatValue: {
    color: p.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  shotStatUnit: {
    fontSize: 12,
    color: p.textMuted,
  },
  shotStatLabel: {
    color: p.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  cameraShotStats: {
    backgroundColor: p.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  camStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  camStatText: {
    color: p.textSecondary,
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '600',
  },
  aiFeedback: {
    color: p.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    color: p.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: 24,
  },
  emptyStateText: {
    color: p.textSecondary,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptyStateSub: {
    color: p.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  miniShotCard: {
    marginVertical: 4,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  miniShotInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  miniShotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniShotNum: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    width: 45,
  },
  miniShotType: {
    color: p.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  miniShotRight: {
    flexDirection: 'row',
  },
  miniMetric: {
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  miniMetricValue: {
    color: p.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  miniMetricLabel: {
    color: p.textMuted,
    fontSize: 10,
  },
  endSessionBtn: {
    backgroundColor: p.danger,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 24,
    ...(Platform.OS === 'web' ? {
      boxShadow: `0 4px 16px ${p.danger}30`,
    } : {}),
  },
  endSessionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
