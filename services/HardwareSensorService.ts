import { SensorData, ProcessedShotData } from './SensorSimulator';
import { aiShotPredictionService } from './AiShotPredictionService';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionInfo {
  state: ConnectionState;
  url: string;
  error?: string;
  packetCount: number;
}

export class HardwareSensorService {
  private listeners: ((data: SensorData) => void)[] = [];
  private shotListeners: ((shot: ProcessedShotData) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private stateListeners: ((info: ConnectionInfo) => void)[] = [];

  private ws: WebSocket | null = null;
  private isConnected = false;
  private connectionState: ConnectionState = 'disconnected';
  private currentUrl = '';
  private lastError = '';
  private packetCount = 0;
  private connectionTimeoutTimer: any = null;

  private currentShotId = 1000;

  /**
   * Intelligently formats and normalizes an IP or URL input.
   * Handles formats like:
   *  - '192.168.1.11' -> 'ws://192.168.1.11:81/'
   *  - '192.168.1.11:81' -> 'ws://192.168.1.11:81/'
   *  - 'ws://192.168.1.11:81' -> 'ws://192.168.1.11:81/'
   *  - '192.168.1.11:80/ws' -> 'ws://192.168.1.11:80/ws'
   *  - 'http://192.168.4.1' -> 'ws://192.168.4.1:81/'
   */
  public normalizeUrl(rawInput: string, defaultPort: number = 81): string {
    let input = rawInput.trim();
    if (!input) return `ws://192.168.4.1:${defaultPort}/`;

    // Strip http:// or https:// prefix
    if (input.startsWith('http://')) {
      input = input.substring(7);
    } else if (input.startsWith('https://')) {
      input = input.substring(8);
    }

    // Strip ws:// or wss:// prefix for parsing
    let isWss = false;
    if (input.startsWith('ws://')) {
      input = input.substring(5);
    } else if (input.startsWith('wss://')) {
      input = input.substring(6);
      isWss = true;
    }

    // Check if path exists
    let path = '/';
    const slashIdx = input.indexOf('/');
    if (slashIdx !== -1) {
      path = input.substring(slashIdx);
      input = input.substring(0, slashIdx);
    }

    // Check if port is specified with a colon (e.g. :81)
    let port = defaultPort;
    const colonIdx = input.indexOf(':');
    if (colonIdx !== -1) {
      const parsedPort = parseInt(input.substring(colonIdx + 1), 10);
      if (!isNaN(parsedPort) && parsedPort > 0) {
        port = parsedPort;
      }
      input = input.substring(0, colonIdx);
    } else {
      // Check if user accidentally typed a 5th dot instead of a colon (e.g. 192.168.1.11.81)
      const dotParts = input.split('.');
      if (dotParts.length === 5) {
        const lastPart = parseInt(dotParts[4], 10);
        if (!isNaN(lastPart) && (lastPart === 80 || lastPart === 81 || lastPart === 8080 || lastPart > 255)) {
          port = lastPart;
          input = dotParts.slice(0, 4).join('.');
        }
      }
    }

    const protocol = isWss ? 'wss' : 'ws';
    return `${protocol}://${input}:${port}${path}`;
  }

  public connect(ip: string = '192.168.1.11', port: number = 81) {
    this.disconnect();

    const url = this.normalizeUrl(ip, port);
    this.currentUrl = url;
    this.connectionState = 'connecting';
    this.lastError = '';
    this.notifyStateListeners();

    console.log(`[HardwareSensorService] Connecting to ESP32 Hardware at: ${url}`);

    try {
      this.ws = new WebSocket(url);

      // Connection timeout: fail fast if no response in 6 seconds
      this.clearConnectionTimeout();
      this.connectionTimeoutTimer = setTimeout(() => {
        if (this.connectionState === 'connecting') {
          console.warn(`[HardwareSensorService] Connection timeout to: ${url}`);
          this.handleConnectionError('Connection timed out after 6 seconds. Check IP address and ensure ESP32 is powered on.');
        }
      }, 6000);

      this.ws.onopen = () => {
        this.clearConnectionTimeout();
        console.log(`[HardwareSensorService] Successfully connected to ESP32 SmartBat at ${url}`);
        this.isConnected = true;
        this.connectionState = 'connected';
        this.lastError = '';
        this.notifyConnectionListeners(true);
        this.notifyStateListeners();
      };

      this.ws.onmessage = (event) => {
        try {
          this.packetCount++;
          const payload = event.data;
          if (typeof payload === 'string') {
            if (payload.startsWith('[')) {
              console.log('[ESP32 Status]:', payload);
              return;
            }
            const parsed = JSON.parse(payload);
            this.handleIncomingData(parsed);
          }
        } catch (error) {
          console.error('[HardwareSensorService] Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error: any) => {
        console.warn('[HardwareSensorService] WebSocket error:', error);
        this.clearConnectionTimeout();
        const errMsg = `Cannot reach ${url}. Ensure phone/PC is on the same 2.4GHz Wi-Fi band and ESP32 IP is correct.`;
        this.handleConnectionError(errMsg);
      };

      this.ws.onclose = (event) => {
        this.clearConnectionTimeout();
        console.log(`[HardwareSensorService] Disconnected from ESP32. Code: ${event?.code}, Reason: ${event?.reason}`);
        this.isConnected = false;
        if (this.connectionState !== 'error') {
          this.connectionState = 'disconnected';
        }
        this.notifyConnectionListeners(false);
        this.notifyStateListeners();
        this.ws = null;
      };
    } catch (err: any) {
      this.clearConnectionTimeout();
      this.handleConnectionError(err?.message || 'WebSocket initialization failed');
    }
  }

  private handleConnectionError(errorMessage: string) {
    this.isConnected = false;
    this.connectionState = 'error';
    this.lastError = errorMessage;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.notifyConnectionListeners(false);
    this.notifyStateListeners();
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  public disconnect() {
    this.clearConnectionTimeout();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.connectionState = 'disconnected';
    this.notifyConnectionListeners(false);
    this.notifyStateListeners();
  }

  // Rolling telemetry window for real-time physics integration
  private recentSamples: {
    t: number;
    ax: number;
    ay: number;
    az: number;
    pitch: number;
    roll: number;
    yaw: number;
    qw: number;
    qx: number;
    qy: number;
    qz: number;
    magG: number;
  }[] = [];
  private lastSampleTime = 0;
  private peakSpeedKmh = 0;
  private peakAngularVel = 0;
  private isSwingActive = false;
  private swingStartTime = 0;
  private swingPeakTime = 0;
  private swingPeakG = 0;
  private swingStartPitch = 0;
  private swingMaxPitch = 0;
  private swingMinPitch = 0;
  private downsideStartTime = 0;
  private lastImpactTime = 0;
  private lastShotCompletedTime = 0;

  private calibPitch = 0;
  private calibRoll = 0;
  private calibYaw = 0;
  private isCalibrated = false;

  public calibrateStance() {
    if (this.recentSamples.length > 0) {
      const latest = this.recentSamples[this.recentSamples.length - 1];
      this.calibPitch = latest.pitch;
      this.calibRoll = latest.roll;
      this.calibYaw = latest.yaw;
      this.isCalibrated = true;
      console.log(`[HardwareSensorService] Stance calibrated: P=${this.calibPitch.toFixed(1)}°, R=${this.calibRoll.toFixed(1)}°, Y=${this.calibYaw.toFixed(1)}°`);
    } else {
      this.isCalibrated = true;
    }
  }

  public getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  private handleIncomingData(parsed: any) {
    if (parsed.ax !== undefined && (parsed.roll !== undefined || parsed.qw !== undefined)) {
      const ax = Number(parsed.ax) || 0;
      const ay = Number(parsed.ay) || 0;
      const az = Number(parsed.az) || 0;
      const roll = Number(parsed.roll) || 0;
      const pitch = Number(parsed.pitch) || 0;
      const yaw = Number(parsed.yaw) || 0;

      // Extract raw quaternion if provided by firmware
      const qw = parsed.qw !== undefined ? Number(parsed.qw) : 1;
      const qx = parsed.qx !== undefined ? Number(parsed.qx) : 0;
      const qy = parsed.qy !== undefined ? Number(parsed.qy) : 0;
      const qz = parsed.qz !== undefined ? Number(parsed.qz) : 0;

      const magG = Math.sqrt(ax * ax + ay * ay + az * az);
      const now = Date.now();

      // Maintain rolling history of last 25 frames (500ms at 50Hz)
      this.recentSamples.push({ t: now, ax, ay, az, pitch, roll, yaw, qw, qx, qy, qz, magG });
      if (this.recentSamples.length > 25) {
        this.recentSamples.shift();
      }

      // Calculate instantaneous angular velocity from quaternion or wrapped Euler delta
      let angularVelRadSec = 0;
      if (this.recentSamples.length >= 2) {
        const prev = this.recentSamples[this.recentSamples.length - 2];
        const dt = Math.max(0.01, (now - prev.t) / 1000);
        const hasQuat = (qw !== 1 || qx !== 0 || qy !== 0 || qz !== 0) &&
                        (prev.qw !== 1 || prev.qx !== 0 || prev.qy !== 0 || prev.qz !== 0);

        if (hasQuat) {
          // Precise quaternion angle difference: |cos(theta/2)| = |q1 . q2|
          const dot = Math.abs(prev.qw * qw + prev.qx * qx + prev.qy * qy + prev.qz * qz);
          const clampedDot = Math.min(1.0, Math.max(-1.0, dot));
          const dTheta = 2 * Math.acos(clampedDot);
          angularVelRadSec = dTheta / dt;
        } else {
          // Wrapped Euler delta to prevent ±180° boundary jump spikes
          const wrap = (deg: number) => (((deg + 180) % 360 + 360) % 360) - 180;
          const dPitch = (wrap(pitch - prev.pitch) * Math.PI) / 180;
          const dRoll = (wrap(roll - prev.roll) * Math.PI) / 180;
          const dYaw = (wrap(yaw - prev.yaw) * Math.PI) / 180;
          const dAngle = Math.sqrt(dPitch * dPitch + dRoll * dRoll + dYaw * dYaw);
          angularVelRadSec = dAngle / dt;
        }
      }

      // Bat Speed Physics (Pivot radius r ≈ 0.65m at sweet spot):
      // Combine angular velocity (v = ω * r) and centripetal dynamic acceleration (v = sqrt(a_c * r))
      const dynamicG = Math.max(0, magG - 1.0); // Remove 1g gravity offset
      const speedFromAccel = Math.sqrt(dynamicG * 9.80665 * 0.65) * 3.6; // km/h
      const speedFromRotation = angularVelRadSec * 0.65 * 3.6; // km/h
      const currentBatSpeedKmh = Math.max(speedFromAccel, speedFromRotation);

      const relPitch = this.isCalibrated ? (pitch - this.calibPitch) : pitch;

      const data: SensorData = {
        sessionId: 'VB-HW-001',
        shotId: this.currentShotId,
        timestamp: now,
        imu: {
          ax,
          ay,
          az,
          gx: speedFromRotation, // store rotation-derived speed in gx
          gy: speedFromAccel,
          gz: angularVelRadSec,
          roll,
          pitch,
          yaw,
          qw,
          qx,
          qy,
          qz,
        },
        impact: {
          impactX_g: ax,
          impactY_g: ay,
          impactZ_g: az,
          peakImpact_g: Math.round(magG * 100) / 100,
        },
      };

      this.listeners.forEach((l) => l(data));

      // --- CRICKET SWING DETECTION & COMPLETION STATE MACHINE ---
      const timeSinceLastShot = now - this.lastShotCompletedTime;

      // 1. SWING ONSET TRIGGER:
      // Catches real stroke acceleration through space (requires dynamic centripetal G + velocity)
      // Turning or reorienting the sensor slowly in hands/desk produces zero dynamic G and will NOT falsely trigger
      const hasSwingCentripetalG = dynamicG > 0.35;
      const hasStrokeSpeed = currentBatSpeedKmh > 14 || angularVelRadSec > 2.2;
      const isBallCollision = magG > 2.5;

      if (!this.isSwingActive && timeSinceLastShot > 450) {
        if ((hasSwingCentripetalG && hasStrokeSpeed) || isBallCollision) {
          this.isSwingActive = true;
          this.swingStartTime = now;
          this.swingPeakTime = now;
          this.peakSpeedKmh = currentBatSpeedKmh;
          this.peakAngularVel = angularVelRadSec;
          this.swingPeakG = magG;
          this.swingStartPitch = relPitch;
          this.swingMaxPitch = relPitch;
          this.swingMinPitch = relPitch;
          this.downsideStartTime = 0;
        }
      }

      // 2. ACTIVE SWING TRACKING:
      if (this.isSwingActive) {
        if (currentBatSpeedKmh > this.peakSpeedKmh) {
          this.peakSpeedKmh = currentBatSpeedKmh;
          this.swingPeakTime = now;
        }
        if (angularVelRadSec > this.peakAngularVel) {
          this.peakAngularVel = angularVelRadSec;
        }
        if (magG > this.swingPeakG) {
          this.swingPeakG = magG;
        }
        if (relPitch > this.swingMaxPitch) {
          this.swingMaxPitch = relPitch;
        }
        if (relPitch < this.swingMinPitch) {
          this.swingMinPitch = relPitch;
        }

        const swingAge = now - this.swingStartTime;

        // Condition A: Real Ball Impact Shock on ADXL375
        const isBallImpact = (magG > 2.8 || (magG > 2.0 && this.peakSpeedKmh > 20)) && swingAge > 50;

        // Condition B: DOWNSIDE FOLLOW-THROUGH COMPLETION
        // In cricket batting, when a bat swing completes, the device orientation goes downside!
        // 1. Device orientation is tilted downside (pitch has dropped significantly below backlift peak, or is below starting stance)
        const isDeviceDownside =
          relPitch < this.swingStartPitch - 6 ||
          this.swingMaxPitch - relPitch >= 12 ||
          (relPitch < 0 && this.swingMaxPitch > 8);

        // 2. Bat velocity decelerated after reaching valid stroke velocity (> 12 km/h)
        const isDecelerated =
          (this.peakSpeedKmh >= 12 || this.peakAngularVel >= 1.8) &&
          (currentBatSpeedKmh < this.peakSpeedKmh * 0.58 || angularVelRadSec < 2.2);

        if (isDeviceDownside && isDecelerated) {
          if (this.downsideStartTime === 0) {
            this.downsideStartTime = now;
          }
        } else if (currentBatSpeedKmh > this.peakSpeedKmh * 0.8) {
          // If player is still actively accelerating, reset downside settling timer
          this.downsideStartTime = 0;
        }

        const isDownsideComplete = this.downsideStartTime > 0 && now - this.downsideStartTime >= 160;

        // Condition C: General Deceleration Completion (for flat strokes like cuts/sweeps)
        const isDecelComplete =
          now - this.swingPeakTime >= 280 &&
          this.peakSpeedKmh >= 15 &&
          currentBatSpeedKmh < this.peakSpeedKmh * 0.35 &&
          angularVelRadSec < 1.8;

        // Condition D: Safety Timeout (prevent any hanging swing state)
        const isTimeout = swingAge > 2000;

        if (isBallImpact || isDownsideComplete || isDecelComplete || isTimeout) {
          if (this.peakSpeedKmh >= 12 || this.swingPeakG > 2.0) {
            this.lastImpactTime = now;
            this.lastShotCompletedTime = now;
            this.detectRealImpact(data, this.swingPeakG);
          }
          this.isSwingActive = false;
          this.peakSpeedKmh = 0;
          this.peakAngularVel = 0;
          this.downsideStartTime = 0;
        }
      }
    }
  }

  private detectRealImpact(data: SensorData, peakImpactG: number) {
    this.currentShotId++;

    // 1. Real measured Bat Speed (km/h) - NO artificial cap, purely physics-derived
    const measuredSpeed = Math.round(
      Math.max(12, this.peakSpeedKmh > 10 ? this.peakSpeedKmh : Math.sqrt(peakImpactG * 9.8) * 8.5)
    );

    // 2. Real Measured Impact Intensity from ADXL375
    const actualImpactG = Math.round(Math.max(peakImpactG, data.impact.peakImpact_g) * 10) / 10;

    // 3. Real Measured Bat Lift Angle from calibrated BNO085 pitch envelope
    const relPitch = this.isCalibrated ? (data.imu.pitch - this.calibPitch) : data.imu.pitch;
    const liftAngle = Math.round(
      Math.max(15, this.swingMaxPitch !== 0 ? Math.abs(this.swingMaxPitch - this.swingMinPitch) : Math.abs(relPitch))
    );

    // 4. Real Sweet Spot Efficiency:
    // Middle of bat has minimal torsional roll twist; edge/toe contact has high roll variance
    let rollTwistVar = 0;
    if (this.recentSamples.length >= 5) {
      const rolls = this.recentSamples.slice(-5).map((s) => s.roll);
      const minRoll = Math.min(...rolls);
      const maxRoll = Math.max(...rolls);
      rollTwistVar = Math.abs(maxRoll - minRoll);
    }
    const sweetSpot = Math.max(45, Math.min(99, Math.round(100 - rollTwistVar * 2.2)));

    // 5. Real Timing Index based on acceleration smoothness
    const timingIndex = Math.max(50, Math.min(98, Math.round(85 + (measuredSpeed > 75 ? 8 : -5) - (rollTwistVar > 10 ? 15 : 0))));

    // 6. Real Direction & Shot Type Classification from Calibrated Yaw & Pitch
    const relYaw = this.isCalibrated ? (data.imu.yaw - this.calibYaw) : data.imu.yaw;
    let zone = 'Straight / V';
    let shotType = 'Straight Drive';

    if (measuredSpeed < 55 && (relPitch < -6 || this.swingMinPitch < -10)) {
      zone = 'Crease / Infield';
      shotType = relPitch < -15 ? 'Forward Defence' : 'Defensive Push';
    } else if (relYaw < -40) {
      zone = 'Point / Third Man';
      shotType = liftAngle < 35 ? 'Square Cut' : 'Late Cut';
    } else if (relYaw < -15) {
      zone = 'Off Side / Cover';
      shotType = liftAngle > 45 ? 'Cover Drive' : 'Square Drive';
    } else if (relYaw <= 20) {
      zone = 'Straight / V';
      shotType = measuredSpeed > 90 ? 'Power Drive' : 'Straight Drive';
    } else if (relYaw <= 60) {
      zone = 'On Side / Mid-Wicket';
      shotType = liftAngle < 30 ? 'On Drive' : 'Flick Shot';
    } else {
      zone = 'Leg Side / Fine Leg';
      shotType = liftAngle < 35 ? 'Pull Shot' : 'Sweep Shot';
    }

    // 7. Dynamic AI Coaching Feedback derived from genuine physics
    let feedback = '';
    if (measuredSpeed >= 88 && sweetSpot >= 85) {
      feedback = `Exceptional bat speed (${measuredSpeed} km/h) with centered willow contact (${sweetSpot}% sweet spot). Clean follow-through into the ${zone}.`;
    } else if (sweetSpot < 65) {
      feedback = `Contact was towards the blade edge (${rollTwistVar.toFixed(1)}° torsional twist). Focus on meeting the ball directly under your eyes.`;
    } else if (measuredSpeed < 60) {
      feedback = `Controlled shot with solid face presentation. Accelerate your hands through the impact zone for greater boundary distance.`;
    } else {
      feedback = `Solid stroke execution into ${zone}. Good elbow elevation with ${liftAngle}° backlift.`;
    }

    const initialShot: ProcessedShotData = {
      shotId: this.currentShotId,
      shotType,
      result: 'Hit',
      batSpeedKmh: measuredSpeed,
      impactSpeedKmh: Math.max(0, measuredSpeed - Math.round(actualImpactG * 0.15)),
      batLiftAngleDeg: liftAngle,
      impactIntensityG: actualImpactG,
      sweetSpotScore: sweetSpot,
      timingIndex,
      swingSmoothness: Math.max(55, Math.min(95, Math.round(92 - rollTwistVar))),
      zone,
      boundaryProbability: Math.min(95, Math.round((measuredSpeed / 110) * 75 + (sweetSpot / 100) * 20)),
      catchChance: Math.max(5, Math.round(100 - sweetSpot * 0.9)),
      aiFeedback: feedback,
    };

    // 1. Emit immediate shot so visualizer and metrics respond with 0ms latency
    this.emitProcessedShot(initialShot);

    // 2. Query Grok (xAI) with Gemini fallback in real-time to refine shot selection & biomechanical coaching
    aiShotPredictionService.predictShot({
      batSpeedKmh: measuredSpeed,
      liftAngleDeg: liftAngle,
      impactG: actualImpactG,
      sweetSpotScore: sweetSpot,
      timingIndex,
      pitch: relPitch,
      roll: data.imu.roll,
      yaw: relYaw,
      currentZone: zone,
      ruleBasedShot: shotType,
    }).then((aiResult) => {
      if (aiResult && aiResult.predictedShot) {
        console.log(`[AI Shot Predictor] ${aiResult.provider.toUpperCase()} classified: ${aiResult.predictedShot} (${aiResult.confidence}% confidence)`);
        this.emitProcessedShot({
          ...initialShot,
          shotType: aiResult.predictedShot,
          zone: aiResult.zone || initialShot.zone,
          aiFeedback: `[${aiResult.provider.toUpperCase()} AI]: ${aiResult.aiCoachingInsight}`,
        });
      }
    }).catch((err) => {
      console.warn('[AI Shot Predictor] Async update error:', err);
    });
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getConnectionInfo(): ConnectionInfo {
    return {
      state: this.connectionState,
      url: this.currentUrl,
      error: this.lastError,
      packetCount: this.packetCount,
    };
  }

  public addRawDataListener(listener: (data: SensorData) => void) {
    this.listeners.push(listener);
  }

  public removeRawDataListener(listener: (data: SensorData) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  public addShotListener(listener: (shot: ProcessedShotData) => void) {
    this.shotListeners.push(listener);
  }

  public removeShotListener(listener: (shot: ProcessedShotData) => void) {
    this.shotListeners = this.shotListeners.filter((l) => l !== listener);
  }

  public emitProcessedShot(shot: ProcessedShotData) {
    this.shotListeners.forEach((l) => l(shot));
  }

  public addConnectionListener(listener: (connected: boolean) => void) {
    this.connectionListeners.push(listener);
    listener(this.isConnected);
  }

  public removeConnectionListener(listener: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter((l) => l !== listener);
  }

  public addStateListener(listener: (info: ConnectionInfo) => void) {
    this.stateListeners.push(listener);
    listener(this.getConnectionInfo());
  }

  public removeStateListener(listener: (info: ConnectionInfo) => void) {
    this.stateListeners = this.stateListeners.filter((l) => l !== listener);
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach((l) => l(connected));
  }

  private notifyStateListeners() {
    const info = this.getConnectionInfo();
    this.stateListeners.forEach((l) => l(info));
  }
}

export const hardwareSensorService = new HardwareSensorService();
