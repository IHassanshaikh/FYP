import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { sensorSimulator, ProcessedShotData } from './SensorSimulator';
import { hardwareSensorService } from './HardwareSensorService';

export interface SessionConfig {
  pitchType: string;
  groundCondition: string;
  boundarySize: string;
  trackingMode: 'sensor' | 'sensor_camera';
}

export interface ShotData extends ProcessedShotData {
  quaternionSequence?: { x: number; y: number; z: number; w: number }[];
  impactTimeSec?: number;
  contactDetails?: string;
  hasVideoReplay?: boolean;
}

export interface Session {
  id: string;
  date: string;
  time: string;
  config: SessionConfig;
  shots: ShotData[];
  isActive: boolean;
}

interface SessionContextType {
  sessions: Session[];
  activeSession: Session | null;
  startSession: (config: SessionConfig) => void;
  addShot: (shot: ShotData) => void;
  endSession: () => string | null;
  deleteSession: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Helper to generate a mock swing quaternion sequence for 3D replay
export function generateMockQuaternionSequence(batLift: number): { x: number; y: number; z: number; w: number }[] {
  const sequence = [];
  const steps = 60; // 60 frames for detailed, smooth playback
  const liftRad = (batLift * Math.PI) / 180;
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    
    // Model a realistic 3-phase cricket swing:
    // Phase 1: Backlift (0.0 to 0.25) - Bat rises from stance to backlift height
    // Phase 2: Downswing (0.25 to 0.65) - Bat accelerates down to impact and forward
    // Phase 3: Follow-through (0.65 to 1.0) - Bat decelerates and wraps around shoulder
    let pitch, yaw, roll;
    
    if (progress < 0.25) {
      const t = progress / 0.25;
      pitch = 0.3 + t * (liftRad - 0.3);
      yaw = t * 0.15;
      roll = t * 0.05;
    } else if (progress < 0.65) {
      const t = (progress - 0.25) / 0.40;
      pitch = liftRad - t * (liftRad + 1.2); // Swing down and through past vertical
      yaw = 0.15 - Math.sin(t * Math.PI) * 0.7;
      roll = 0.05 + t * 0.4;
    } else {
      const t = (progress - 0.65) / 0.35;
      pitch = -1.2 - t * 0.6; // Wrap high around left shoulder
      yaw = -0.55 + t * 1.1;  // Pivot behind back
      roll = 0.45 + t * 0.5;
    }

    // Convert Euler angles to quaternion
    const c1 = Math.cos(roll / 2);
    const s1 = Math.sin(roll / 2);
    const c2 = Math.cos(pitch / 2);
    const s2 = Math.sin(pitch / 2);
    const c3 = Math.cos(yaw / 2);
    const s3 = Math.sin(yaw / 2);

    sequence.push({
      w: c1 * c2 * c3 - s1 * s2 * s3,
      x: s1 * c2 * c3 + c1 * s2 * s3,
      y: c1 * s2 * c3 - s1 * c2 * s3,
      z: c1 * c2 * s3 + s1 * s2 * c3,
    });
  }
  return sequence;
}

// Initial mock completed sessions
const INITIAL_MOCK_SESSIONS: Session[] = [
  {
    id: 'VB-S-001',
    date: 'Jun 16, 2026',
    time: '18:30',
    config: {
      pitchType: 'Grass',
      groundCondition: 'Lush Green',
      boundarySize: 'Medium',
      trackingMode: 'sensor_camera', // Sensor + Camera
    },
    isActive: false,
    shots: [
      {
        shotId: 101,
        shotType: 'Cover Drive',
        result: 'Hit',
        batSpeedKmh: 75,
        impactSpeedKmh: 68,
        batLiftAngleDeg: 62,
        impactIntensityG: 28,
        sweetSpotScore: 88,
        timingIndex: 92,
        swingSmoothness: 90,
        zone: 'Off Side',
        boundaryProbability: 78,
        catchChance: 5,
        aiFeedback: 'Excellent timing and face control. Kept the ball on the ground.',
        quaternionSequence: generateMockQuaternionSequence(62),
        impactTimeSec: 0.42,
        contactDetails: 'Contact Detected\nImpact Force: 28g\nContact Timing: 0.42 sec after downswing',
        hasVideoReplay: true,
      },
      {
        shotId: 102,
        shotType: 'Pull',
        result: 'Hit',
        batSpeedKmh: 82,
        impactSpeedKmh: 74,
        batLiftAngleDeg: 45,
        impactIntensityG: 38,
        sweetSpotScore: 82,
        timingIndex: 85,
        swingSmoothness: 86,
        zone: 'On Side',
        boundaryProbability: 85,
        catchChance: 15,
        aiFeedback: 'Strong wrist action. Clean connection out of the sweet spot.',
        quaternionSequence: generateMockQuaternionSequence(45),
        impactTimeSec: 0.38,
        contactDetails: 'Contact Detected\nImpact Force: 38g\nContact Timing: 0.38 sec after downswing',
        hasVideoReplay: true,
      },
      {
        shotId: 103,
        shotType: 'Straight Drive',
        result: 'Hit',
        batSpeedKmh: 70,
        impactSpeedKmh: 62,
        batLiftAngleDeg: 65,
        impactIntensityG: 22,
        sweetSpotScore: 78,
        timingIndex: 95,
        swingSmoothness: 94,
        zone: 'Straight',
        boundaryProbability: 60,
        catchChance: 2,
        aiFeedback: 'Perfect presentation of the full face of the bat. Excellent defense.',
        quaternionSequence: generateMockQuaternionSequence(65),
        impactTimeSec: 0.45,
        contactDetails: 'Contact Detected\nImpact Force: 22g\nContact Timing: 0.45 sec after downswing',
        hasVideoReplay: true,
      },
    ],
  },
  {
    id: 'VB-S-002',
    date: 'Jun 14, 2026',
    time: '16:00',
    config: {
      pitchType: 'Concrete',
      groundCondition: 'Dry',
      boundarySize: 'Large',
      trackingMode: 'sensor', // Sensor Only
    },
    isActive: false,
    shots: [
      {
        shotId: 201,
        shotType: 'Cut',
        result: 'Hit',
        batSpeedKmh: 78,
        impactSpeedKmh: 70,
        batLiftAngleDeg: 55,
        impactIntensityG: 32,
        sweetSpotScore: 85,
        timingIndex: 88,
        swingSmoothness: 89,
        zone: 'Off Side',
        boundaryProbability: 70,
        catchChance: 10,
        aiFeedback: 'Well controlled horizontal bat shot. Found the gap.',
        quaternionSequence: generateMockQuaternionSequence(55),
      },
      {
        shotId: 202,
        shotType: 'Sweep',
        result: 'Hit',
        batSpeedKmh: 68,
        impactSpeedKmh: 60,
        batLiftAngleDeg: 40,
        impactIntensityG: 18,
        sweetSpotScore: 65,
        timingIndex: 78,
        swingSmoothness: 80,
        zone: 'On Side',
        boundaryProbability: 55,
        catchChance: 25,
        aiFeedback: 'Timing slightly early. Ball taken a bit off the toe end.',
        quaternionSequence: generateMockQuaternionSequence(40),
      },
      {
        shotId: 203,
        shotType: 'Cover Drive',
        result: 'Miss',
        batSpeedKmh: 72,
        impactSpeedKmh: 0,
        batLiftAngleDeg: 60,
        impactIntensityG: 0,
        sweetSpotScore: 0,
        timingIndex: 30,
        swingSmoothness: 72,
        zone: 'None',
        boundaryProbability: 0,
        catchChance: 0,
        aiFeedback: 'Beaten by flight. Foot movement was limited. Seek earlier ball tracking.',
        quaternionSequence: generateMockQuaternionSequence(60),
      },
    ],
  },
  // ─── Session from example data.txt ───
  // Frames recorded at 10ms intervals from BNO085 + ADXL375.
  // Matches the exact swing table in example data.txt:
  // 0ms=AT REST | 10-40ms=DOWNSWING (gyro 120→980°/s) | 50ms=IMPACT 86g | 60-70ms=FOLLOW-THROUGH
  {
    id: 'VB-S-003',
    date: 'Aug 3, 2026',
    time: '17:45',
    config: {
      pitchType: 'Grass',
      groundCondition: 'Firm',
      boundarySize: 'Medium',
      trackingMode: 'sensor',
    },
    isActive: false,
    shots: [
      {
        shotId: 301,
        shotType: 'Cover Drive',
        result: 'Hit',
        batSpeedKmh: 72,
        impactSpeedKmh: 65,
        batLiftAngleDeg: 22,
        impactIntensityG: 86,
        sweetSpotScore: 82,
        timingIndex: 96,
        swingSmoothness: 88,
        zone: 'Off Side',
        boundaryProbability: 74,
        catchChance: 8,
        aiFeedback: 'Strong downswing acceleration (0→1750°/s). Impact detected at 50ms. Clean sweet spot contact at 86g.',
        // 8 frames × 10ms = 70ms full swing (from example data.txt)
        // Frame Q values derived from real BNO085 quaternion signature:
        // AT REST: qw≈1.0 | BACKLIFT: qx+, qy- | DOWNSWING: qx++, qz+ | IMPACT: peak | FOLLOW: roll-through
        quaternionSequence: [
          // 0ms  — AT REST  (Quaternion identity, gyro=0)
          { x: 0.00,  y: 0.00,  z: 0.00,  w: 1.00 },
          // 10ms — early downswing  (gyro 120°/s, BNO085 qx rises)
          { x: 0.08,  y: -0.04, z: 0.12,  w: 0.99 },
          // 20ms — downswing accel  (gyro 250°/s)
          { x: 0.18,  y: -0.07, z: 0.26,  w: 0.95 },
          // 30ms — rapid downswing  (gyro 510°/s, qx=0.31 qy=-0.08 signature)
          { x: 0.31,  y: -0.08, z: 0.45,  w: 0.83 },
          // 40ms — peak downswing   (gyro 980°/s)
          { x: 0.43,  y: -0.08, z: 0.61,  w: 0.66 },
          // 50ms — IMPACT           (gyro 1700°/s, ADXL375=86g ← Ball hit)
          { x: 0.50,  y: -0.10, z: 0.71,  w: 0.49 },
          // 60ms — follow-through   (gyro decays to 1100°/s)
          { x: 0.60,  y: -0.11, z: 0.71,  w: 0.34 },
          // 70ms — follow-through   (gyro 600°/s, bat wraps over shoulder)
          { x: 0.68,  y: -0.11, z: 0.68,  w: 0.26 },
        ],
        impactTimeSec: 0.05,
        contactDetails: 'Contact Detected\nImpact Force: 86g (ADXL375)\nContact Timing: 50ms after downswing\nAngular Speed at Impact: 1700°/s',
        hasVideoReplay: false,
      },
      {
        shotId: 302,
        shotType: 'Pull',
        result: 'Hit',
        batSpeedKmh: 79,
        impactSpeedKmh: 71,
        batLiftAngleDeg: 18,
        impactIntensityG: 74,
        sweetSpotScore: 78,
        timingIndex: 88,
        swingSmoothness: 85,
        zone: 'On Side',
        boundaryProbability: 80,
        catchChance: 12,
        aiFeedback: 'Excellent horizontal bat swing. Impact timing was 2ms early but still within optimal window.',
        quaternionSequence: generateMockQuaternionSequence(18),
        impactTimeSec: 0.048,
        contactDetails: 'Contact Detected\nImpact Force: 74g (ADXL375)\nContact Timing: 48ms after downswing\nAngular Speed at Impact: 1550°/s',
        hasVideoReplay: false,
      },
      {
        shotId: 303,
        shotType: 'Straight Drive',
        result: 'Miss',
        batSpeedKmh: 68,
        impactSpeedKmh: 0,
        batLiftAngleDeg: 25,
        impactIntensityG: 0,
        sweetSpotScore: 0,
        timingIndex: 42,
        swingSmoothness: 80,
        zone: 'None',
        boundaryProbability: 0,
        catchChance: 0,
        aiFeedback: 'No impact detected (ADXL375 < threshold). Gyro reached 1200°/s. Ball beat the bat — front foot movement too late.',
        quaternionSequence: generateMockQuaternionSequence(25),
        hasVideoReplay: false,
      },
    ],
  },
];

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  // Load user sessions from AsyncStorage
  useEffect(() => {
    const loadSessions = async () => {
      if (!user) {
        setSessions([]);
        return;
      }
      try {
        const storedSessions = await AsyncStorage.getItem(`@vb_sessions_${user.id}`);
        if (storedSessions) {
          setSessions(JSON.parse(storedSessions));
        } else {
          // Initialize new users with the mock sessions as a tutorial/example
          setSessions(INITIAL_MOCK_SESSIONS);
          await AsyncStorage.setItem(`@vb_sessions_${user.id}`, JSON.stringify(INITIAL_MOCK_SESSIONS));
        }
      } catch (error) {
        console.error('Failed to load sessions', error);
      }
    };
    loadSessions();
  }, [user]);

  // Save sessions whenever they change
  const saveSessions = async (newSessions: Session[]) => {
    setSessions(newSessions);
    if (user) {
      try {
        await AsyncStorage.setItem(`@vb_sessions_${user.id}`, JSON.stringify(newSessions));
      } catch (error) {
        console.error('Failed to save sessions', error);
      }
    }
  };

  // Sync shot events from SensorSimulator with our active session
  useEffect(() => {
    const handleShotEvent = (shot: ProcessedShotData) => {
      setActiveSession((prev) => {
        if (!prev) return null;

        const isCameraMode = prev.config.trackingMode === 'sensor_camera';
        const impactTime = isCameraMode ? parseFloat((0.35 + Math.random() * 0.15).toFixed(2)) : undefined;
        const details = isCameraMode
          ? `Contact Detected\nImpact Force: ${shot.impactIntensityG}g\nContact Timing: ${impactTime} sec after downswing`
          : undefined;

        const shotWithSequence: ShotData = {
          ...shot,
          quaternionSequence: generateMockQuaternionSequence(shot.batLiftAngleDeg),
          impactTimeSec: impactTime,
          contactDetails: details,
          hasVideoReplay: isCameraMode,
        };
        return {
          ...prev,
          shots: [...prev.shots, shotWithSequence],
        };
      });
    };

    sensorSimulator.addShotListener(handleShotEvent);
    hardwareSensorService.addShotListener(handleShotEvent);
    return () => {
      sensorSimulator.removeShotListener(handleShotEvent);
      hardwareSensorService.removeShotListener(handleShotEvent);
    };
  }, []);

  const startSession = (config: SessionConfig) => {
    const dateObj = new Date();
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const newSession: Session = {
      id: `VB-S-${Date.now().toString().slice(-6)}`,
      date: formattedDate,
      time: formattedTime,
      config,
      shots: [],
      isActive: true,
    };
    setActiveSession(newSession);
  };

  const addShot = (shot: ShotData) => {
    if (!activeSession) return;
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        shots: [...prev.shots, shot],
      };
    });
  };

  const endSession = (): string | null => {
    if (!activeSession) return null;

    const completedSession: Session = {
      ...activeSession,
      isActive: false,
    };

    saveSessions([completedSession, ...sessions]);
    setActiveSession(null);
    return completedSession.id;
  };

  const deleteSession = (id: string) => {
    saveSessions(sessions.filter((s) => s.id !== id));
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSession,
        startSession,
        addShot,
        endSession,
        deleteSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
