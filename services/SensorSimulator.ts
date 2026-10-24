// services/SensorSimulator.ts

export interface SensorData {
  sessionId: string;
  shotId: number;
  timestamp: number;
  imu: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number; roll: number; pitch: number; yaw: number; qw: number; qx: number; qy: number; qz: number };
  impact: { impactX_g: number; impactY_g: number; impactZ_g: number; peakImpact_g: number };
}

export interface ProcessedShotData {
  shotId: number;
  shotType: string;
  result: 'Hit' | 'Miss';
  batSpeedKmh: number;
  impactSpeedKmh: number;
  batLiftAngleDeg: number;
  impactIntensityG: number;
  sweetSpotScore: number;
  timingIndex: number;
  swingSmoothness: number;
  zone: string;
  boundaryProbability: number;
  catchChance: number;
  aiFeedback: string;
}

export class SensorSimulator {
  private listeners: ((data: SensorData) => void)[] = [];
  private shotListeners: ((shot: ProcessedShotData) => void)[] = [];
  private isSimulating = false;
  private intervalId: any = null;
  private currentShotId = 153;

  public startStream() {
    if (this.isSimulating) return;
    this.isSimulating = true;
    this.intervalId = setInterval(() => {
      const data = this.generateBaselineData();
      this.listeners.forEach((l) => l(data));
    }, 100);
  }

  public stopStream() {
    this.isSimulating = false;
    if (this.intervalId) clearInterval(this.intervalId);
  }

  public simulateSwing(shotType: string = 'Cover Drive') {
    let t = 0;
    const duration = 600; // ms
    const hz = 20; // 50 updates per second for smooth chart
    const steps = duration / hz;

    let batLift = Math.floor(Math.random() * 20) + 50; 
    let maxSpeed = Math.floor(Math.random() * 30) + 60; 
    let impactG = Math.floor(Math.random() * 40) + 20; 
    let sweetSpot = Math.floor(Math.random() * 40) + 50;
    let timing = Math.floor(Math.random() * 20) + 80;

    const swingInterval = setInterval(() => {
      if (t >= steps) {
        clearInterval(swingInterval);
        this.emitProcessedShot({
          shotId: ++this.currentShotId,
          shotType,
          result: 'Hit',
          batSpeedKmh: maxSpeed,
          impactSpeedKmh: maxSpeed - 8,
          batLiftAngleDeg: batLift,
          impactIntensityG: impactG,
          sweetSpotScore: sweetSpot,
          timingIndex: timing,
          swingSmoothness: 88,
          zone: 'Off Side',
          boundaryProbability: 64,
          catchChance: 18,
          aiFeedback: 'Good timing and controlled bat lift. Improve sweet spot consistency.',
        });
        return;
      }

      const progress = t / steps;
      const speedProgress = Math.sin(progress * Math.PI); 
      const currentSpeed = speedProgress * maxSpeed;
      
      const isImpact = progress > 0.45 && progress < 0.55;
      
      const data: SensorData = {
        sessionId: 'VB-S-001',
        shotId: this.currentShotId,
        timestamp: Date.now(),
        imu: {
          ax: Math.random() * 2, ay: Math.random() * 2, az: Math.random() * 2 + 9.8,
          gx: currentSpeed * 10, gy: currentSpeed * 5, gz: currentSpeed * 2,
          roll: progress * 90, pitch: batLift - progress * batLift, yaw: progress * 45,
          qw: 1, qx: 0, qy: progress, qz: 0,
        },
        impact: {
          impactX_g: isImpact ? impactG / 2 : 0,
          impactY_g: isImpact ? impactG : 0,
          impactZ_g: 0,
          peakImpact_g: isImpact ? impactG : 0,
        }
      };

      this.listeners.forEach((l) => l(data));
      t++;
    }, hz);
  }

  private generateBaselineData(): SensorData {
    return {
      sessionId: 'VB-S-001',
      shotId: this.currentShotId,
      timestamp: Date.now(),
      imu: {
        ax: Math.random() * 0.5, ay: Math.random() * 0.5, az: 9.8 + Math.random() * 0.2,
        gx: Math.random() * 5, gy: Math.random() * 5, gz: Math.random() * 5,
        roll: 0, pitch: 45, yaw: 0,
        qw: 1, qx: 0, qy: 0, qz: 0,
      },
      impact: {
        impactX_g: 0, impactY_g: 0, impactZ_g: 0, peakImpact_g: 0,
      }
    };
  }

  public addRawDataListener(listener: (data: SensorData) => void) {
    this.listeners.push(listener);
  }

  public removeRawDataListener(listener: (data: SensorData) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public addShotListener(listener: (shot: ProcessedShotData) => void) {
    this.shotListeners.push(listener);
  }

  public removeShotListener(listener: (shot: ProcessedShotData) => void) {
    this.shotListeners = this.shotListeners.filter(l => l !== listener);
  }

  public emitProcessedShot(shot: ProcessedShotData) {
    this.shotListeners.forEach((l) => l(shot));
  }
}

export const sensorSimulator = new SensorSimulator();
