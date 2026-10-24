import React, { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export interface LiveSwingTriggerOptions {
  shotType?: string;
  batSpeed?: number;
  liftAngle?: number;
  sweetSpot?: number;
  impactG?: number;
  timingIndex?: number;
  zone?: string;
  forceAnimation?: boolean;
}

export interface LiveSwingVisualizerRef {
  triggerSwing: (options?: LiveSwingTriggerOptions) => void;
  setCameraView: (view: 'side' | 'bowler' | 'top' | 'batsman') => void;
  updateLiveOrientation: (
    pitch: number,
    roll: number,
    yaw: number,
    quat?: { qw: number; qx: number; qy: number; qz: number },
    accel?: { ax: number; ay: number; az: number },
    liveSpeed?: number,
    liveAccelG?: number
  ) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDisplayMode?: (mode: 'batsman' | 'free_bat') => void;
  calibrateStance: () => void;
  setMountingConfig?: (config: {
    mountingMode?: 'spine_up' | 'spine_down' | 'horizontal';
    invertPitch?: boolean;
    invertRoll?: boolean;
    invertYaw?: boolean;
  }) => void;
}

interface LiveSwingVisualizerProps {
  onSwingImpact?: (data: any) => void;
  onSwingComplete?: (data: any) => void;
  onStanceCalibrated?: (data: any) => void;
  soundEnabled?: boolean;
  cameraView?: 'side' | 'bowler' | 'top' | 'batsman';
}

const VISUALIZER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0B0F19; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    canvas { display: block; width: 100vw; height: 100vh; }
    
    #overlay-hud {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
      z-index: 10;
    }

    .hud-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hud-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge-pill {
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 201, 123, 0.35);
      border-radius: 20px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 4px;
      background: #00C97B;
      box-shadow: 0 0 8px #00C97B;
      animation: pulse 1.4s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.6; }
    }
    .badge-text {
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .hud-btn {
      background: rgba(0, 201, 123, 0.20);
      border: 1.5px solid #00C97B;
      color: #00C97B;
      border-radius: 20px;
      padding: 7px 16px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 4px 16px rgba(0, 201, 123, 0.3);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hud-btn:hover, .hud-btn:active {
      background: #00C97B;
      color: #0B0F19;
      transform: scale(1.04);
      box-shadow: 0 0 22px rgba(0, 201, 123, 0.7);
    }
    .hud-btn.calibrated {
      background: rgba(56, 189, 248, 0.25);
      border-color: #38BDF8;
      color: #38BDF8;
    }

    #calib-banner {
      position: absolute;
      top: 58px;
      left: 50%;
      transform: translateX(-50%) translateY(-15px) scale(0.9);
      background: rgba(11, 15, 25, 0.94);
      backdrop-filter: blur(14px);
      border: 1.5px solid #00C97B;
      border-radius: 16px;
      padding: 10px 22px;
      text-align: center;
      opacity: 0;
      pointer-events: none;
      transition: all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 30;
      box-shadow: 0 8px 30px rgba(0, 201, 123, 0.35);
    }
    #calib-banner.active {
      transform: translateX(-50%) translateY(0) scale(1);
      opacity: 1;
    }
    .calib-title {
      color: #00C97B;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .calib-sub {
      color: #94A3B8;
      font-size: 10px;
      font-weight: 600;
      margin-top: 2px;
    }

    #phase-indicator {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(11, 15, 25, 0.92);
      border: 1.5px solid #00C97B;
      border-radius: 24px;
      padding: 6px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      z-index: 10;
      box-shadow: 0 4px 20px rgba(0, 201, 123, 0.25);
      transition: all 0.2s ease;
    }
    #phase-name {
      color: #00C97B;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    #impact-banner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.6);
      background: radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.85) 100%);
      border: 2px solid #FFFFFF;
      border-radius: 16px;
      padding: 12px 28px;
      color: #FFFFFF;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.8);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease;
      z-index: 20;
    }
    #impact-banner.active {
      transform: translate(-50%, -50%) scale(1.05);
      opacity: 1;
    }

    #drag-tip {
      position: absolute;
      bottom: 50px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.45);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      pointer-events: none;
      text-transform: uppercase;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
</head>
<body>
  <div id="overlay-hud">
    <div class="hud-left">
      <div class="badge-pill">
        <div class="badge-dot" id="live-dot" style="background: #94A3B8;"></div>
        <span class="badge-text" id="live-status" style="color: #94A3B8;">HARDWARE OFFLINE</span>
      </div>
      <div class="badge-pill" id="view-mode-pill" style="pointer-events: auto; cursor: pointer; border-color: rgba(56, 189, 248, 0.4);" onclick="toggleViewMode()">
        <span class="badge-text" id="view-mode-text" style="color: #38BDF8;">🏏 BATSMAN STANCE</span>
      </div>
    </div>
    <div class="hud-right">
      <button id="btn-calibrate" class="hud-btn" onclick="calibrateStance()">
        🎯 CALIBRATE STANCE
      </button>
    </div>
  </div>

  <div id="calib-banner">
    <div class="calib-title" id="calib-title">✅ STANCE CALIBRATED!</div>
    <div class="calib-sub">Sensor zeroed to cricket stance • Ready to swing</div>
  </div>

  <div id="impact-banner">⚡ IMPACT! <span id="impact-val">78g</span></div>

  <div id="phase-indicator">
    <span id="phase-name">READY IN STANCE</span>
  </div>

  <div id="drag-tip">Drag to rotate 3D stadium • Swipe to swing • Tap mode to free 3D bat</div>

  <script>
    // --- Audio Synthesis for Bat Impact ---
    var audioCtx = null;
    var soundEnabled = true;
    function initAudio() {
      if (!audioCtx) {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }
    function playImpactSound(intensity) {
      if (!soundEnabled) return;
      try {
        initAudio();
        if (!audioCtx) return;
        var now = audioCtx.currentTime;
        
        // Thwack oscillator (low resonant thud of English Willow)
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
        
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        // Noise burst for leather seam snap
        var bufferSize = audioCtx.sampleRate * 0.06;
        var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.012));
        }
        var noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        var noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseFilter.Q.setValueAtTime(2.0, now);
        
        var noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.85, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);
      } catch(e) {}
    }

    function playChime() {
      if (!soundEnabled) return;
      try {
        initAudio();
        if (!audioCtx) return;
        var now = audioCtx.currentTime;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5 note
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.30);
      } catch(e) {}
    }

    // --- Three.js Scene Variables ---
    var camera, scene, renderer, clock;
    var batsmanGroup, batPivot, batGroup, bladeMesh;
    var rUpperArm, rForearm, lUpperArm, lForearm; // Batsman arm dynamic linkage
    var trailLine, trailGeometry, trailPositions = [], maxTrailPoints = 80;
    var impactLight, impactParticles = [];
    var cameraAngle = 'side';
    var isSwinging = false;
    var swingTime = 0;
    var swingDuration = 0.65; // seconds
    var currentShotParams = {
      type: 'Cover Drive',
      speed: 0,
      lift: 55,
      impactG: 0,
      sweetSpot: 88,
      timing: 92
    };

    // --- STANCE CALIBRATION & QUATERNIONS ---
    // Batsman Crease Stance: bat hangs naturally down to turf, toe near crease, slight back angle towards slips
    var baseStanceEulerBatsman = new THREE.Euler(0.18, -0.15, -0.05, 'YXZ');
    var baseStanceQuatBatsman = new THREE.Quaternion().setFromEuler(baseStanceEulerBatsman);

    // Free 3D Bat Stance: centered upright hanging down with subtle tilt towards camera
    var baseStanceEulerFreeBat = new THREE.Euler(0.08, 0, 0, 'YXZ');
    var baseStanceQuatFreeBat = new THREE.Quaternion().setFromEuler(baseStanceEulerFreeBat);

    function getBaseStanceQuat() {
      return displayMode === 'batsman' ? baseStanceQuatBatsman : baseStanceQuatFreeBat;
    }

    var targetStanceQuat = new THREE.Quaternion().copy(baseStanceQuatBatsman);
    var currentStanceQuat = new THREE.Quaternion().copy(baseStanceQuatBatsman);

    // Sensor Calibration State
    var calibQuat = new THREE.Quaternion(0, 0, 0, 1);
    var calibQuatInv = new THREE.Quaternion(0, 0, 0, 1);
    var isCalibrated = false;
    var calibEuler = { pitch: 0, roll: 0, yaw: 0 };
    var latestRawQuat = new THREE.Quaternion(0, 0, 0, 1);
    var latestRawPitch = 0, latestRawRoll = 0, latestRawYaw = 0;
    var invertPitch = false;
    var invertRoll = false;
    var invertYaw = false;
    var mountingMode = 'spine_up'; // 'spine_up' (standard: vertical on back spine), 'spine_down'

    var orbit = { theta: 0.05, phi: 0.18, radius: 2.20 };
    var drag = { active: false, startX: 0, startY: 0, moved: 0 };
    var lookTarget = new THREE.Vector3(0, 1.05, 0.05);

    var phaseIndicator = document.getElementById('phase-name');
    var impactBanner = document.getElementById('impact-banner');
    var impactValEl = document.getElementById('impact-val');

    var hasLiveHardware = false;
    var displayMode = 'batsman'; // 'batsman' or 'free_bat'
    var lastTipPos = new THREE.Vector3();
    var lastImpactFxTime = 0;
    var liveBatSpeedKmh = 0; // Real-time speed from sensor
    var liveAccelG = 0; // Real-time g-force from sensor

    function calibrateStance() {
      initAudio();
      if (latestRawQuat && (latestRawQuat.w !== 1 || latestRawQuat.x !== 0 || latestRawQuat.y !== 0 || latestRawQuat.z !== 0)) {
        calibQuat.copy(latestRawQuat);
        calibQuatInv.copy(calibQuat).invert();
      } else {
        calibQuat.set(0, 0, 0, 1);
        calibQuatInv.set(0, 0, 0, 1);
      }
      calibEuler.pitch = latestRawPitch;
      calibEuler.roll = latestRawRoll;
      calibEuler.yaw = latestRawYaw;
      isCalibrated = true;

      // Immediately snap bat to cricket batting stance
      var baseQ = getBaseStanceQuat();
      targetStanceQuat.copy(baseQ);
      currentStanceQuat.copy(baseQ);
      if (batPivot) batPivot.quaternion.copy(baseQ);

      // Play pleasant calibration chime
      playChime();

      // Show floating calibration banner
      showCalibBanner('✅ BAT STANCE CALIBRATED!');

      // Update button visual state
      var btn = document.getElementById('btn-calibrate');
      if (btn) {
        btn.textContent = '✅ STANCE ZEROED';
        btn.classList.add('calibrated');
        setTimeout(function() {
          if (btn) btn.textContent = '🎯 CALIBRATE STANCE';
          if (btn) btn.classList.remove('calibrated');
        }, 2500);
      }

      postParentMessage({
        type: 'stanceCalibrated',
        data: { pitch: latestRawPitch, roll: latestRawRoll, yaw: latestRawYaw }
      });
    }

    function showCalibBanner(msg) {
      var banner = document.getElementById('calib-banner');
      var title = document.getElementById('calib-title');
      if (title && msg) title.textContent = msg;
      if (banner) {
        banner.classList.add('active');
        setTimeout(function() {
          banner.classList.remove('active');
        }, 2000);
      }
    }

    function toggleViewMode() {
      displayMode = displayMode === 'batsman' ? 'free_bat' : 'batsman';
      var textEl = document.getElementById('view-mode-text');
      if (displayMode === 'free_bat') {
        if (textEl) {
          textEl.textContent = '🪄 FREE 3D BAT (360°)';
          textEl.style.color = '#00C97B';
        }
        if (batsmanGroup) batsmanGroup.visible = false;
        if (batPivot) {
          batPivot.position.set(0, 0.85, 0);
          batPivot.scale.set(1.25, 1.25, 1.25);
        }
        if (batGroup) {
          batGroup.position.set(0, 0.45, 0); // Center bat around pivot for 360 inspection
        }
        lookTarget.set(0, 0.85, 0);
      } else {
        if (textEl) {
          textEl.textContent = '🏏 BATSMAN STANCE';
          textEl.style.color = '#38BDF8';
        }
        if (batsmanGroup) batsmanGroup.visible = true;
        if (batPivot) {
          batPivot.position.set(0.16, 1.42, 0.22);
          batPivot.scale.set(1.0, 1.0, 1.0);
        }
        if (batGroup) {
          batGroup.position.set(0, 0, 0);
        }
        lookTarget.set(0, 1.05, 0.05);
      }
      // Re-align to appropriate base stance
      var baseQ = getBaseStanceQuat();
      targetStanceQuat.copy(baseQ);
      currentStanceQuat.copy(baseQ);
      if (batPivot) batPivot.quaternion.copy(baseQ);
      updateCameraPosition();
    }

    function init() {
      clock = new THREE.Clock();
      var W = window.innerWidth, H = window.innerHeight;
      
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x08101E);
      scene.fog = new THREE.FogExp2(0x08101E, 0.028);

      camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 150);
      updateCameraPosition();

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.physicallyCorrectLights = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.outputEncoding = THREE.sRGBEncoding;
      document.body.appendChild(renderer.domElement);

      setupLighting();
      buildStadium();
      buildPitchAndStumps();
      buildBatsmanAndBat();
      setupTrail();
      setupImpactFX();
      setupEventListeners();

      animate();
    }

    function setupLighting() {
      // Brighter ambient for skin/kit readability
      var ambient = new THREE.AmbientLight(0xD0E8FF, 0.85);
      scene.add(ambient);

      // Main stadium floodlight (sharp, overhead-angled)
      var flood1 = new THREE.DirectionalLight(0xFFF8EC, 1.8);
      flood1.position.set(3, 10, 5);
      flood1.castShadow = true;
      flood1.shadow.mapSize.width = 2048;
      flood1.shadow.mapSize.height = 2048;
      flood1.shadow.camera.near = 0.5;
      flood1.shadow.camera.far = 30;
      flood1.shadow.camera.left = -5;
      flood1.shadow.camera.right = 5;
      flood1.shadow.camera.top = 5;
      flood1.shadow.camera.bottom = -5;
      flood1.shadow.bias = -0.0003;
      scene.add(flood1);

      // Second floodlight from opposite side (realistic cricket stadium)
      var flood2 = new THREE.DirectionalLight(0xEEF5FF, 1.1);
      flood2.position.set(-4, 8, -2);
      flood2.castShadow = false;
      scene.add(flood2);

      // Cyan brand accent fill (low, from front)
      var fill = new THREE.DirectionalLight(0x00C97B, 0.35);
      fill.position.set(0, 2, 6);
      scene.add(fill);

      // Warm rim light from behind (depth separation)
      var rim = new THREE.PointLight(0xFF9F1C, 1.2, 12);
      rim.position.set(0, 4, -4);
      scene.add(rim);

      // Dynamic impact flash light
      impactLight = new THREE.PointLight(0xFF3300, 0, 6);
      impactLight.position.set(0, 0.8, 0.5);
      scene.add(impactLight);
    }

    function buildStadium() {
      // Grass turf ground
      var turfGeo = new THREE.CircleGeometry(16, 48);
      var turfMat = new THREE.MeshPhongMaterial({
        color: 0x14281D,
        shininess: 8,
      });
      var turf = new THREE.Mesh(turfGeo, turfMat);
      turf.rotation.x = -Math.PI / 2;
      turf.receiveShadow = true;
      scene.add(turf);

      // Glowing outer boundary circle
      var ringGeo = new THREE.RingGeometry(15.6, 15.9, 64);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0x00C97B,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.002;
      scene.add(ring);

      // Stadium boundary perimeter billboard
      var standsGeo = new THREE.CylinderGeometry(18, 18, 4, 48, 1, true);
      var standsMat = new THREE.MeshPhongMaterial({
        color: 0x0F172A,
        side: THREE.BackSide,
        shininess: 12
      });
      var stands = new THREE.Mesh(standsGeo, standsMat);
      stands.position.y = 2;
      scene.add(stands);

      // Decorative stadium lights in distance
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 2) {
        var poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 8);
        var poleMat = new THREE.MeshPhongMaterial({ color: 0x334155 });
        var pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(Math.cos(a) * 16.5, 3.5, Math.sin(a) * 16.5);
        scene.add(pole);

        var lampGeo = new THREE.BoxGeometry(1.2, 0.6, 0.4);
        var lampMat = new THREE.MeshBasicMaterial({ color: 0xE2F1FF });
        var lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(Math.cos(a) * 16.5, 7.2, Math.sin(a) * 16.5);
        lamp.lookAt(0, 1, 0);
        scene.add(lamp);
      }
    }

    function buildPitchAndStumps() {
      // Pitch strip
      var pitchGeo = new THREE.PlaneGeometry(2.4, 7.5);
      var pitchMat = new THREE.MeshPhongMaterial({
        color: 0x2A3528,
        shininess: 10
      });
      var pitch = new THREE.Mesh(pitchGeo, pitchMat);
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.set(0, 0.005, 0.5);
      pitch.receiveShadow = true;
      scene.add(pitch);

      // White crease markings
      var creaseMat = new THREE.MeshBasicMaterial({ color: 0xE2E8F0, transparent: true, opacity: 0.8 });
      // Batting popping crease
      var popGeo = new THREE.PlaneGeometry(2.2, 0.06);
      var pop = new THREE.Mesh(popGeo, creaseMat);
      pop.rotation.x = -Math.PI / 2;
      pop.position.set(0, 0.008, 0.45);
      scene.add(pop);

      // Stumps crease
      var stCreaseGeo = new THREE.PlaneGeometry(1.6, 0.05);
      var stCrease = new THREE.Mesh(stCreaseGeo, creaseMat);
      stCrease.rotation.x = -Math.PI / 2;
      stCrease.position.set(0, 0.008, -0.65);
      scene.add(stCrease);

      // Three Wooden Stumps & Bails
      var woodMat = new THREE.MeshPhongMaterial({ color: 0xD4A373, shininess: 30 });
      var bailMat = new THREE.MeshPhongMaterial({ color: 0xE6CCB2, shininess: 20 });
      var stumpSpacing = 0.11;
      for (var i = -1; i <= 1; i++) {
        var sGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 10);
        var sMesh = new THREE.Mesh(sGeo, woodMat);
        sMesh.position.set(i * stumpSpacing, 0.36, -0.65);
        sMesh.castShadow = true;
        scene.add(sMesh);
      }
      var bailGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8);
      var bail = new THREE.Mesh(bailGeo, bailMat);
      bail.rotation.z = Math.PI / 2;
      bail.position.set(0, 0.73, -0.65);
      scene.add(bail);
    }

    // ─────────────────────────────────────────────────────────
    // CANVAS TEXTURE HELPERS
    // ─────────────────────────────────────────────────────────
    function makeCanvasTex(w, h, drawFn) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      drawFn(ctx, w, h);
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    }

    function makeJerseyTex() {
      return makeCanvasTex(256, 512, function(ctx, w, h) {
        // Deep navy base
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0D2B6B');
        g.addColorStop(0.5, '#0A2255');
        g.addColorStop(1, '#091840');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // Subtle pinstripe
        ctx.strokeStyle = 'rgba(56,189,248,0.18)';
        ctx.lineWidth = 1.5;
        for (var x = 0; x < w; x += 18) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        // Shoulder accent band
        ctx.fillStyle = 'rgba(0,201,123,0.35)';
        ctx.fillRect(0, 0, w, 28);
      });
    }

    function makeSkinTex() {
      return makeCanvasTex(128, 128, function(ctx, w, h) {
        var g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        g.addColorStop(0, '#C68A4A');
        g.addColorStop(0.5, '#B8773C');
        g.addColorStop(1, '#A06830');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    }

    function makePadTex() {
      return makeCanvasTex(128, 256, function(ctx, w, h) {
        ctx.fillStyle = '#EEF3F8';
        ctx.fillRect(0, 0, w, h);
        // pad ridge lines
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 2.5;
        for (var y = 12; y < h; y += 22) {
          ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(w-6, y); ctx.stroke();
        }
        // slight gradient
        var g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, 'rgba(200,210,220,0.25)');
        g.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(200,210,220,0.25)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    }

    function makeWillowTex() {
      return makeCanvasTex(128, 512, function(ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0,   '#C8A05A');
        g.addColorStop(0.3, '#E2C07A');
        g.addColorStop(0.7, '#D4AC60');
        g.addColorStop(1,   '#B88C42');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // Wood grain lines
        ctx.strokeStyle = 'rgba(100,60,0,0.13)';
        ctx.lineWidth = 1;
        for (var y = 0; y < h; y += 8) {
          ctx.beginPath();
          ctx.moveTo(0, y + Math.sin(y*0.3)*2);
          ctx.lineTo(w, y + Math.cos(y*0.25)*2);
          ctx.stroke();
        }
      });
    }

    function makeHelmetTex() {
      return makeCanvasTex(256, 256, function(ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#1A2035');
        g.addColorStop(0.4, '#0D1525');
        g.addColorStop(1, '#060C18');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // Specular highlight stripe
        var s = ctx.createLinearGradient(0, 0, w, 0);
        s.addColorStop(0, 'rgba(255,255,255,0)');
        s.addColorStop(0.35, 'rgba(255,255,255,0.12)');
        s.addColorStop(0.5, 'rgba(255,255,255,0.06)');
        s.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = s;
        ctx.fillRect(0, 0, w, h);
      });
    }

    function buildBatsmanAndBat() {
      batsmanGroup = new THREE.Group();
      batsmanGroup.scale.set(1.40, 1.40, 1.40);
      batsmanGroup.position.set(0, 0, 0.30);
      scene.add(batsmanGroup);

      // ── CANVAS-TEXTURED PBR MATERIALS ──────────────────────
      var jerseyTex  = makeJerseyTex();
      var skinTex    = makeSkinTex();
      var padTex     = makePadTex();
      var willowTex  = makeWillowTex();
      var helmetTex  = makeHelmetTex();

      var jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTex,  roughness: 0.78, metalness: 0.02 });
      var kitMat    = new THREE.MeshStandardMaterial({ color: 0xE0E8F2, roughness: 0.82, metalness: 0.00 });
      var padMat    = new THREE.MeshStandardMaterial({ map: padTex,     roughness: 0.52, metalness: 0.04 });
      var gloveMat  = new THREE.MeshStandardMaterial({ color: 0x054030, roughness: 0.72, metalness: 0.06,
                        bumpScale: 0.005 });
      var skinMat   = new THREE.MeshStandardMaterial({ map: skinTex,    roughness: 0.90, metalness: 0.00 });
      var helmetMat = new THREE.MeshStandardMaterial({ map: helmetTex,  roughness: 0.28, metalness: 0.55 });
      var grillMat  = new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.35, metalness: 0.65, emissive: 0x003050, emissiveIntensity: 0.4 });
      var shoeMat   = new THREE.MeshStandardMaterial({ color: 0xD0D8E2, roughness: 0.65, metalness: 0.10 });
      var soleMat   = new THREE.MeshStandardMaterial({ color: 0x191919, roughness: 0.95, metalness: 0.00 });

      // ═══════════════════════════════════════════════════════
      // REALISTIC CRICKET BATSMAN - PROPER BENT-KNEE STANCE
      // ═══════════════════════════════════════════════════════

      // ── FEET / SHOES (wide base, back foot perpendicular) ──
      // Right foot (back foot, perpendicular to pitch)
      var rShoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.065, 0.28), shoeMat);
      rShoeMesh.position.set(-0.155, 0.032, -0.06);
      rShoeMesh.rotation.y = 0.18;
      batsmanGroup.add(rShoeMesh);
      var rSole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.275), soleMat);
      rSole.position.set(-0.155, 0.012, -0.06);
      rSole.rotation.y = 0.18;
      batsmanGroup.add(rSole);

      // Left foot (front foot, towards bowler)
      var lShoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.065, 0.28), shoeMat);
      lShoeMesh.position.set(0.155, 0.032, 0.14);
      lShoeMesh.rotation.y = -0.12;
      batsmanGroup.add(lShoeMesh);
      var lSole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.275), soleMat);
      lSole.position.set(0.155, 0.012, 0.14);
      lSole.rotation.y = -0.12;
      batsmanGroup.add(lSole);

      // ── RIGHT LEG (back leg, slightly bent knee) ──
      var rShinGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.44, 12);
      var rShin = new THREE.Mesh(rShinGeo, padMat);
      rShin.position.set(-0.155, 0.285, -0.04);
      rShin.rotation.x = 0.06;
      rShin.castShadow = true;
      batsmanGroup.add(rShin);

      var rThighGeo = new THREE.CylinderGeometry(0.095, 0.085, 0.42, 12);
      var rThigh = new THREE.Mesh(rThighGeo, kitMat);
      rThigh.position.set(-0.155, 0.72, -0.03);
      rThigh.rotation.x = -0.10;
      rThigh.castShadow = true;
      batsmanGroup.add(rThigh);

      // Right knee cap
      var rKnee = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), padMat);
      rKnee.scale.set(1.0, 0.75, 0.85);
      rKnee.position.set(-0.155, 0.510, -0.02);
      batsmanGroup.add(rKnee);

      // ── LEFT LEG (front leg, more bent, weight forward) ──
      var lShinGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.44, 12);
      var lShin = new THREE.Mesh(lShinGeo, padMat);
      lShin.position.set(0.155, 0.285, 0.10);
      lShin.rotation.x = -0.10;
      lShin.castShadow = true;
      batsmanGroup.add(lShin);

      var lThighGeo = new THREE.CylinderGeometry(0.095, 0.085, 0.42, 12);
      var lThigh = new THREE.Mesh(lThighGeo, kitMat);
      lThigh.position.set(0.155, 0.72, 0.09);
      lThigh.rotation.x = -0.18;
      lThigh.castShadow = true;
      batsmanGroup.add(lThigh);

      // Left knee cap
      var lKnee = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), padMat);
      lKnee.scale.set(1.0, 0.75, 0.85);
      lKnee.position.set(0.155, 0.510, 0.09);
      batsmanGroup.add(lKnee);

      // ── GROIN / HIP GUARD ──
      var hipGeo = new THREE.CylinderGeometry(0.19, 0.165, 0.18, 14);
      var hipGuard = new THREE.Mesh(hipGeo, kitMat);
      hipGuard.position.set(0, 0.92, 0.03);
      hipGuard.rotation.x = -0.08;
      batsmanGroup.add(hipGuard);

      // ── TORSO (athletic tapered build, slight forward lean) ──
      var torsoGeo = new THREE.CylinderGeometry(0.225, 0.195, 0.58, 16);
      var torso = new THREE.Mesh(torsoGeo, jerseyMat);
      torso.position.set(0, 1.22, 0.04);
      torso.rotation.x = -0.08; // forward lean
      torso.castShadow = true;
      batsmanGroup.add(torso);

      // Chest plate (slightly wider)
      var chestGeo = new THREE.CylinderGeometry(0.235, 0.220, 0.14, 16);
      var chest = new THREE.Mesh(chestGeo, jerseyMat);
      chest.position.set(0, 1.43, 0.04);
      chest.castShadow = true;
      batsmanGroup.add(chest);

      // ── SHOULDERS (broad) ──
      var shoulderBarGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.50, 14);
      var shoulderBar = new THREE.Mesh(shoulderBarGeo, jerseyMat);
      shoulderBar.position.set(0, 1.52, 0.04);
      shoulderBar.rotation.z = Math.PI / 2;
      shoulderBar.castShadow = true;
      batsmanGroup.add(shoulderBar);

      // ── NECK ──
      var neckGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12);
      var neck = new THREE.Mesh(neckGeo, skinMat);
      neck.position.set(0, 1.59, 0.03);
      batsmanGroup.add(neck);

      // ── HEAD (realistic proportions) ──
      var headGeo = new THREE.SphereGeometry(0.165, 24, 20);
      var head = new THREE.Mesh(headGeo, helmetMat);
      head.position.set(0, 1.78, 0.02);
      head.scale.set(1.0, 1.08, 1.0);
      head.castShadow = true;
      batsmanGroup.add(head);

      // Helmet ventilation ridge (top)
      var ridgeGeo = new THREE.BoxGeometry(0.06, 0.04, 0.28);
      var ridge = new THREE.Mesh(ridgeGeo, grillMat);
      ridge.position.set(0, 1.95, 0.02);
      batsmanGroup.add(ridge);

      // Helmet visor peak
      var peakGeo = new THREE.CylinderGeometry(0.175, 0.175, 0.028, 20, 1, false, -Math.PI * 0.55, Math.PI * 0.55);
      var peakMat = new THREE.MeshStandardMaterial({ color: 0x060B14, roughness: 0.30, metalness: 0.50 });
      var peak = new THREE.Mesh(peakGeo, peakMat);
      peak.position.set(0, 1.70, 0.09);
      peak.rotation.x = 0.20;
      batsmanGroup.add(peak);

      // Helmet face guard grille (realistic cage bars)
      var grillGroup = new THREE.Group();
      grillGroup.position.set(0, 1.72, 0.13);
      for (var gi = 0; gi < 5; gi++) {
        var barGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6);
        var bar = new THREE.Mesh(barGeo, grillMat);
        bar.position.set(-0.09 + gi * 0.045, 0, 0);
        bar.rotation.x = Math.PI / 2;
        grillGroup.add(bar);
      }
      for (var gj = 0; gj < 3; gj++) {
        var hBarGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.18, 6);
        var hBar = new THREE.Mesh(hBarGeo, grillMat);
        hBar.position.set(0, -0.04 + gj * 0.04, 0);
        hBar.rotation.z = Math.PI / 2;
        grillGroup.add(hBar);
      }
      batsmanGroup.add(grillGroup);

      // Ear protector dome (left side)
      var earDomeGeo = new THREE.SphereGeometry(0.065, 12, 10, 0, Math.PI);
      var earDome = new THREE.Mesh(earDomeGeo, helmetMat);
      earDome.position.set(-0.168, 1.78, 0.01);
      earDome.rotation.y = -Math.PI / 2;
      batsmanGroup.add(earDome);

      // ── RIGHT ARM (bottom hand – closer to bat, elbow out) ──
      var rUpperArmGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.34, 10);
      rUpperArm = new THREE.Mesh(rUpperArmGeo, jerseyMat);
      rUpperArm.position.set(0.27, 1.40, 0.10);
      rUpperArm.rotation.z = -0.72;
      rUpperArm.rotation.x = 0.25;
      rUpperArm.castShadow = true;
      batsmanGroup.add(rUpperArm);

      var rForearmGeo = new THREE.CylinderGeometry(0.048, 0.040, 0.30, 10);
      rForearm = new THREE.Mesh(rForearmGeo, skinMat);
      rForearm.position.set(0.38, 1.18, 0.18);
      rForearm.rotation.z = -1.10;
      rForearm.rotation.x = 0.35;
      rForearm.castShadow = true;
      batsmanGroup.add(rForearm);

      // ── LEFT ARM (top hand – higher, leading arm) ──
      var lUpperArmGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.34, 10);
      lUpperArm = new THREE.Mesh(lUpperArmGeo, jerseyMat);
      lUpperArm.position.set(0.25, 1.44, 0.13);
      lUpperArm.rotation.z = -0.58;
      lUpperArm.rotation.x = 0.32;
      lUpperArm.castShadow = true;
      batsmanGroup.add(lUpperArm);

      var lForearmGeo = new THREE.CylinderGeometry(0.048, 0.040, 0.30, 10);
      lForearm = new THREE.Mesh(lForearmGeo, skinMat);
      lForearm.position.set(0.33, 1.24, 0.20);
      lForearm.rotation.z = -1.00;
      lForearm.rotation.x = 0.40;
      lForearm.castShadow = true;
      batsmanGroup.add(lForearm);

      // ══════════════════════════════════════════
      // BAT PIVOT positioned at hands grip height
      // ══════════════════════════════════════════
      batPivot = new THREE.Group();
      batPivot.position.set(0.16, 1.42, 0.22);
      scene.add(batPivot);

      batGroup = new THREE.Group();
      batPivot.add(batGroup);

      // ── REALISTIC ENGLISH WILLOW BAT ──
      var willowMat = new THREE.MeshStandardMaterial({ map: willowTex, roughness: 0.22, metalness: 0.03,
                        envMapIntensity: 0.6 });
      var spineMat  = new THREE.MeshStandardMaterial({ color: 0xB07830, roughness: 0.40, metalness: 0.02 });
      var gripMat   = new THREE.MeshStandardMaterial({ color: 0x0A0D18, roughness: 0.90, metalness: 0.00 });
      var stickerMat = new THREE.MeshStandardMaterial({ color: 0x00C97B, roughness: 0.18, metalness: 0.12,
                          emissive: 0x004020, emissiveIntensity: 0.5 });

      // Rubber grip handle (44 cm)
      var handleGeo = new THREE.CylinderGeometry(0.033, 0.037, 0.44, 18);
      var handle = new THREE.Mesh(handleGeo, gripMat);
      handle.position.y = 0.22;
      handle.castShadow = true;
      batGroup.add(handle);

      // Grip chevron rings
      for (var ci = 0; ci < 7; ci++) {
        var chevGeo = new THREE.TorusGeometry(0.035, 0.005, 6, 18);
        var chevMat = new THREE.MeshStandardMaterial({ color: 0x00C97B, roughness: 0.5 });
        var chev = new THREE.Mesh(chevGeo, chevMat);
        chev.position.y = 0.03 + ci * 0.062;
        chev.rotation.x = Math.PI / 2;
        batGroup.add(chev);
      }

      // Gloves at grip position
      var lGlove = new THREE.Mesh(new THREE.SphereGeometry(0.070, 16, 14), gloveMat);
      lGlove.position.set(0, 0.38, 0.01);
      lGlove.scale.set(1.1, 0.9, 1.0);
      batGroup.add(lGlove);
      var rGlove = new THREE.Mesh(new THREE.SphereGeometry(0.070, 16, 14), gloveMat);
      rGlove.position.set(0, 0.14, 0.01);
      rGlove.scale.set(1.1, 0.9, 1.0);
      batGroup.add(rGlove);

      // Splice (handle-to-blade transition)
      var spliceGeo = new THREE.CylinderGeometry(0.037, 0.082, 0.10, 14);
      var splice = new THREE.Mesh(spliceGeo, spineMat);
      splice.position.y = -0.050;
      batGroup.add(splice);

      // FULL MATCH BAT BLADE (108mm wide, 1.05m blade)
      var bladeWidth  = 0.295;
      var bladeLength = 1.12;
      var bladeDepth  = 0.092;
      var bladeGeo = new THREE.BoxGeometry(bladeWidth, bladeLength, bladeDepth);
      bladeMesh = new THREE.Mesh(bladeGeo, willowMat);
      bladeMesh.position.set(0, -0.58, 0);
      bladeMesh.castShadow = true;
      batGroup.add(bladeMesh);

      // Rounded toe at bottom
      var toeGeo = new THREE.CylinderGeometry(0.148, 0.148, bladeDepth, 16, 1, false, 0, Math.PI);
      var toe = new THREE.Mesh(toeGeo, willowMat);
      toe.position.set(0, -1.14, 0);
      toe.rotation.z = Math.PI / 2;
      toe.rotation.y = Math.PI / 2;
      toe.castShadow = true;
      batGroup.add(toe);

      // Blade shoulder bevel (top of blade)
      var shoulderGeo = new THREE.CylinderGeometry(0.082, bladeWidth / 2, 0.10, 10);
      var bladeTop = new THREE.Mesh(shoulderGeo, willowMat);
      bladeTop.position.y = -0.02;
      batGroup.add(bladeTop);

      // Neon brand sticker panel on face (+Z)
      var stickerGeo = new THREE.PlaneGeometry(0.235, 0.72);
      var sticker = new THREE.Mesh(stickerGeo, stickerMat);
      sticker.position.set(0, -0.52, 0.048);
      batGroup.add(sticker);

      // Arched power spine ridge on back (-Z)
      var spineRidgeGeo = new THREE.ConeGeometry(0.15, bladeLength * 0.90, 4);
      var spineRidge = new THREE.Mesh(spineRidgeGeo, spineMat);
      spineRidge.rotation.x = Math.PI;
      spineRidge.rotation.y = Math.PI / 4;
      spineRidge.position.set(0, -0.55, -0.055);
      spineRidge.scale.set(0.82, 1, 0.38);
      batGroup.add(spineRidge);

      // Edge bevel highlights (left and right edges)
      var edgeMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.22, metalness: 0.03 });
      var lEdgeGeo = new THREE.BoxGeometry(0.025, bladeLength, 0.025);
      var lEdge = new THREE.Mesh(lEdgeGeo, edgeMat);
      lEdge.position.set(-bladeWidth / 2 + 0.012, -0.58, 0);
      batGroup.add(lEdge);
      var rEdge = lEdge.clone();
      rEdge.position.x = bladeWidth / 2 - 0.012;
      batGroup.add(rEdge);

      // VectorBat ESP32 Sensor Module on back spine
      var sensorBoxGeo = new THREE.BoxGeometry(0.092, 0.165, 0.044);
      var sensorBoxMat = new THREE.MeshStandardMaterial({ color: 0x0A0D18, roughness: 0.28, metalness: 0.82 });
      var sensorBox = new THREE.Mesh(sensorBoxGeo, sensorBoxMat);
      sensorBox.position.set(0, -0.50, -0.080);
      sensorBox.castShadow = true;
      batGroup.add(sensorBox);

      // Sensor logo strip
      var sDecalGeo = new THREE.PlaneGeometry(0.078, 0.048);
      var sDecalMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });
      var sDecal = new THREE.Mesh(sDecalGeo, sDecalMat);
      sDecal.rotation.y = Math.PI;
      sDecal.position.set(0, -0.46, -0.103);
      batGroup.add(sDecal);

      // Active LED (glowing emerald dot)
      var ledGeo = new THREE.SphereGeometry(0.011, 8, 8);
      var ledMat = new THREE.MeshBasicMaterial({ color: 0x00FF88 });
      var sensorLed = new THREE.Mesh(ledGeo, ledMat);
      sensorLed.position.set(0.034, -0.54, -0.103);
      batGroup.add(sensorLed);

      // Sweet Spot ring on face
      var sweetGeo = new THREE.RingGeometry(0.048, 0.068, 36);
      var sweetMat2 = new THREE.MeshBasicMaterial({ color: 0xFF9F1C, side: THREE.DoubleSide });
      var sweetIndicator = new THREE.Mesh(sweetGeo, sweetMat2);
      sweetIndicator.position.set(0, -0.55, 0.049);
      batGroup.add(sweetIndicator);

      // Initial Stance Orientation
      batPivot.quaternion.copy(currentStanceQuat);
    }

    function setupTrail() {
      // 3D dynamic trajectory ribbon trail
      trailGeometry = new THREE.BufferGeometry();
      var posArray = new Float32Array(maxTrailPoints * 3);
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      
      var trailMat = new THREE.LineBasicMaterial({
        color: 0x00C97B,
        linewidth: 3,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      trailLine = new THREE.Line(trailGeometry, trailMat);
      trailLine.frustumCulled = false;
      scene.add(trailLine);
    }

    function addTrailPoint(vec3) {
      trailPositions.unshift(vec3.clone());
      if (trailPositions.length > maxTrailPoints) {
        trailPositions.pop();
      }
      updateTrailGeometry();
    }

    function updateTrailGeometry() {
      var positions = trailGeometry.attributes.position.array;
      for (var i = 0; i < maxTrailPoints; i++) {
        if (i < trailPositions.length) {
          positions[i * 3] = trailPositions[i].x;
          positions[i * 3 + 1] = trailPositions[i].y;
          positions[i * 3 + 2] = trailPositions[i].z;
        } else if (trailPositions.length > 0) {
          var last = trailPositions[trailPositions.length - 1];
          positions[i * 3] = last.x;
          positions[i * 3 + 1] = last.y;
          positions[i * 3 + 2] = last.z;
        }
      }
      trailGeometry.attributes.position.needsUpdate = true;
    }

    function clearTrail() {
      trailPositions = [];
      updateTrailGeometry();
    }

    function setupImpactFX() {
      // Particle sparks burst at impact
      for (var i = 0; i < 35; i++) {
        var pGeo = new THREE.SphereGeometry(0.016, 6, 6);
        var pMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xFF9F1C : 0xFFFFFF,
          transparent: true,
          opacity: 0
        });
        var pMesh = new THREE.Mesh(pGeo, pMat);
        scene.add(pMesh);
        impactParticles.push({
          mesh: pMesh,
          vel: new THREE.Vector3(),
          life: 0,
          maxLife: 0.4
        });
      }
    }

    function triggerImpactFX(sweetSpotWorldPos) {
      impactLight.position.copy(sweetSpotWorldPos);
      impactLight.intensity = 15;
      
      // Flash blade
      if (bladeMesh) {
        bladeMesh.material.emissive = new THREE.Color(0xFF6600);
        bladeMesh.material.emissiveIntensity = 1.2;
      }

      // Spark particles explosion
      for (var i = 0; i < impactParticles.length; i++) {
        var p = impactParticles[i];
        p.mesh.position.copy(sweetSpotWorldPos);
        p.mesh.visible = true;
        p.life = p.maxLife;
        p.vel.set(
          (Math.random() - 0.5) * 4.5,
          Math.random() * 3.5 + 1.2,
          Math.random() * 5.0 + 1.5
        );
      }

      // Show Impact Banner
      impactValEl.textContent = currentShotParams.impactG + 'g';
      impactBanner.className = 'active';
      setTimeout(function() {
        impactBanner.className = '';
      }, 700);

      // Play authentic bat contact crack sound
      playImpactSound(currentShotParams.impactG);

      // Post message back to parent React Native component
      postParentMessage({
        type: 'swingImpact',
        data: currentShotParams
      });
    }

    function updateImpactFX(dt) {
      if (impactLight.intensity > 0) {
        impactLight.intensity = Math.max(0, impactLight.intensity - dt * 25);
      }
      if (bladeMesh && bladeMesh.material.emissiveIntensity > 0) {
        bladeMesh.material.emissiveIntensity = Math.max(0, bladeMesh.material.emissiveIntensity - dt * 2.5);
      }
      for (var i = 0; i < impactParticles.length; i++) {
        var p = impactParticles[i];
        if (p.life > 0) {
          p.life -= dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.vel.y -= 9.8 * dt * 0.7; // Gravity
          p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
          if (p.life <= 0) p.mesh.visible = false;
        }
      }
    }

    // --- SWING PHYSICS & PROCEDURAL ANIMATION ---
    function triggerSwing(params) {
      if (hasLiveHardware && (!params || !params.forceAnimation)) {
        if (params) {
          currentShotParams = Object.assign(currentShotParams, params);
        }

        // Show Impact / Shot Completed Banner
        var spd = Math.round(currentShotParams.batSpeed || currentShotParams.speed || 0);
        impactValEl.textContent = spd > 0 ? spd + ' km/h' : (currentShotParams.impactG || 1.2) + 'g';
        impactBanner.className = 'active';
        setTimeout(function() {
          impactBanner.className = '';
        }, 900);

        // Update Phase Indicator with detected shot
        phaseIndicator.textContent = '⚡ ' + (currentShotParams.shotType || 'SHOT') + (spd > 0 ? ' • ' + spd + ' KM/H' : '');
        phaseIndicator.style.borderColor = '#00C97B';
        phaseIndicator.style.color = '#00C97B';
        setTimeout(function() {
          if (phaseIndicator && hasLiveHardware && !isSwinging) {
            phaseIndicator.textContent = isCalibrated ? 'CALIBRATED • READY TO SWING' : 'HOLD STANCE & CALIBRATE';
            phaseIndicator.style.borderColor = '#00C97B';
            phaseIndicator.style.color = '#00C97B';
          }
        }, 2400);

        // Flash blade & sweet spot particles
        var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
        batGroup.localToWorld(sweetSpotWorld);
        triggerImpactFX(sweetSpotWorld);

        // Play crisp audio contact sound
        playImpactSound(currentShotParams.impactG || 15);

        postParentMessage({
          type: 'swingComplete',
          data: currentShotParams
        });
        return;
      }

      if (params) {
        currentShotParams = Object.assign(currentShotParams, params);
      }
      isSwinging = true;
      swingTime = 0;
      clearTrail();

      // Configure ribbon trail glow color per stroke preset
      var sType = (currentShotParams.shotType || '').toLowerCase();
      var ribbonColor = 0x00C97B;
      if (sType.indexOf('cover') >= 0) {
        ribbonColor = 0xFFD700; // Gold
      } else if (sType.indexOf('on') >= 0 && sType.indexOf('drive') >= 0) {
        ribbonColor = 0x38BDF8; // Sky Blue
      } else if (sType.indexOf('straight') >= 0) {
        ribbonColor = 0x10B981; // Emerald Green
      } else if (sType.indexOf('pull') >= 0) {
        ribbonColor = 0xEF4444; // Fiery Crimson
      } else if (sType.indexOf('cut') >= 0) {
        ribbonColor = 0xA855F7; // Electric Purple
      } else if (sType.indexOf('defen') >= 0) {
        ribbonColor = 0xE2E8F0; // Pure White Wall
      } else if (sType.indexOf('sweep') >= 0) {
        ribbonColor = 0xF97316; // Radiant Orange
      } else if (sType.indexOf('heli') >= 0) {
        ribbonColor = 0xF43F5E; // Rose Neon
      }

      if (trailLine && trailLine.material) {
        trailLine.material.color.setHex(ribbonColor);
      }
      
      // Set 1.25s cinematic duration for fully visible biomechanical stroke
      swingDuration = 1.25;
    }

    function executeSwingAnimation(dt) {
      swingTime += dt;
      var progress = Math.min(1.0, swingTime / swingDuration);

      var shot = (currentShotParams.shotType || '').toLowerCase();
      // Natural crease stance baseline: bat blade points down to pitch, slight angle back to slips
      var rx = 0.15, ry = -0.15, rz = 0.0;
      var px = 0, py = 0, pz = 0, bodyYaw = 0;
      var handsX = 0.12, handsY = 1.10, handsZ = 0.18;
      var phaseLabel = 'READY';

      if (shot.indexOf('cover') >= 0) {
        // ═══ 1. COVER DRIVE (High elbow backlift, leaning front stride, elegant finish through extra cover) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.75 - 0.15);
          ry = -0.15 + ease * (0.35 - (-0.15));
          rz = 0.0 + ease * 0.20;
          pz = ease * 0.16;
          handsZ = 0.18 + ease * 0.10;
          phaseLabel = 'HIGH BACKLIFT (GULLY)';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = -0.75 + ease * (0.55 - (-0.75));
          ry = 0.35 - ease * 0.10;
          rz = 0.20 - ease * 0.35;
          pz = 0.16 + ease * 0.06;
          handsX = 0.12 + ease * 0.08;
          handsZ = 0.28 + ease * 0.16;
          phaseLabel = 'COVER DOWNSWING';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
        } else if (progress < 0.68) {
          rx = 0.55; ry = 0.25; rz = -0.15;
          pz = 0.22; handsX = 0.20; handsZ = 0.44;
          phaseLabel = '⚡ SWEET SPOT CRACK!';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = 0.55 + ease * 1.25;
          ry = 0.25 + ease * 0.15;
          rz = -0.15 - ease * 0.30;
          pz = 0.22 - ease * 0.04;
          handsY = 1.10 + ease * 0.18;
          handsZ = 0.44 - ease * 0.06;
          phaseLabel = 'HIGH ELBOW FINISH';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 1.80 + ease * (0.15 - 1.80);
          ry = 0.40 + ease * (-0.15 - 0.40);
          rz = -0.45 + ease * (0.0 - (-0.45));
          pz = 0.18 * (1 - ease);
          handsX = 0.12 + 0.08 * (1 - ease);
          handsY = 1.10 + 0.18 * (1 - ease);
          handsZ = 0.18 + 0.20 * (1 - ease);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('on') >= 0 && shot.indexOf('drive') >= 0) {
        // ═══ 2. ON DRIVE (Straight presentation down mid-on corridor with soft hands) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.65 - 0.15);
          ry = -0.15 + ease * 0.15;
          rz = 0.05 * ease;
          pz = ease * 0.14;
          handsZ = 0.18 + ease * 0.10;
          phaseLabel = 'STRAIGHT LIFT';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = -0.65 + ease * (0.60 - (-0.65));
          ry = 0.0 - ease * 0.32;
          rz = 0.05 - ease * 0.15;
          pz = 0.14 + ease * 0.04;
          handsX = 0.12 - ease * 0.08;
          handsZ = 0.28 + ease * 0.14;
          phaseLabel = 'MID-ON DOWNSWING';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
        } else if (progress < 0.68) {
          rx = 0.60; ry = -0.32; rz = -0.10;
          pz = 0.18; handsX = 0.04; handsZ = 0.42;
          phaseLabel = '⚡ MID-ON TIMING!';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = 0.60 + ease * 0.95;
          ry = -0.32 - ease * 0.05;
          rz = -0.10 - ease * 0.15;
          pz = 0.18 - ease * 0.04;
          handsY = 1.10 + ease * 0.12;
          phaseLabel = 'CHECK FOLLOW-THROUGH';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 1.55 + ease * (0.15 - 1.55);
          ry = -0.37 + ease * (-0.15 - (-0.37));
          rz = -0.25 + ease * (0.0 - (-0.25));
          pz = 0.14 * (1 - ease);
          handsX = 0.12 - 0.08 * (1 - ease);
          handsY = 1.10 + 0.12 * (1 - ease);
          handsZ = 0.18 + 0.14 * (1 - ease);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('straight') >= 0) {
        // ═══ 3. STRAIGHT DRIVE (Pure V down the ground towards bowler) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.70 - 0.15);
          ry = -0.15 + ease * 0.15;
          rz = 0.0;
          pz = ease * 0.16;
          handsZ = 0.18 + ease * 0.10;
          phaseLabel = 'PURE VERTICAL LIFT';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = -0.70 + ease * (0.65 - (-0.70));
          ry = 0.0; rz = 0.0;
          pz = 0.16 + ease * 0.06;
          handsZ = 0.28 + ease * 0.16;
          phaseLabel = 'DOWN THE V';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        } else if (progress < 0.68) {
          rx = 0.65; ry = 0.0; rz = 0.0;
          pz = 0.22; handsZ = 0.44;
          phaseLabel = '⚡ MIDDLE OF THE WILLOW!';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = 0.65 + ease * 1.25;
          ry = 0.0; rz = 0.0;
          pz = 0.22 - ease * 0.04;
          handsY = 1.10 + ease * 0.16;
          phaseLabel = 'ICONIC VERTICAL FINISH';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 1.90 + ease * (0.15 - 1.90);
          ry = -0.15 * ease;
          rz = 0.0;
          pz = 0.18 * (1 - ease);
          handsY = 1.10 + 0.16 * (1 - ease);
          handsZ = 0.18 + 0.18 * (1 - ease);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('pull') >= 0) {
        // ═══ 4. PULL SHOT (Rock back onto back foot, swivel torso, horizontal cross-bat swipe) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.85 - 0.15);
          ry = -0.15 + ease * 0.65;
          rz = ease * 0.85;
          pz = -ease * 0.12;
          px = -ease * 0.06;
          handsZ = 0.18 - ease * 0.08;
          handsY = 1.10 + ease * 0.12;
          phaseLabel = 'ROCK BACK ONTO BACK FOOT';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          bodyYaw = ease * 0.85;
          rx = -0.85 + ease * (0.25 - (-0.85));
          ry = 0.50 - ease * 1.95;
          rz = 0.85 - ease * 2.25;
          pz = -0.12 + ease * 0.04;
          handsX = 0.12 - ease * 0.22;
          handsZ = 0.10 + ease * 0.16;
          phaseLabel = 'HORIZONTAL CROSS-BAT SWIPE';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
        } else if (progress < 0.68) {
          rx = 0.25; ry = -1.45; rz = -1.40;
          bodyYaw = 0.85;
          pz = -0.08; px = -0.06;
          handsX = -0.10; handsZ = 0.26;
          phaseLabel = '⚡ POWER PULL IMPACT!';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = 0.25 + ease * 0.50;
          ry = -1.45 - ease * 1.15;
          rz = -1.40 - ease * 0.25;
          bodyYaw = 0.85 + ease * 0.20;
          handsX = -0.10 - ease * 0.05;
          phaseLabel = 'SHOULDER WRAP FINISH';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 0.75 + ease * (0.15 - 0.75);
          ry = -2.60 + ease * (-0.15 - (-2.60));
          rz = -1.65 + ease * (0.0 - (-1.65));
          bodyYaw = 1.05 * (1 - ease);
          pz = -0.08 * (1 - ease);
          px = -0.06 * (1 - ease);
          handsX = -0.15 + ease * (0.12 - (-0.15));
          handsZ = 0.26 + ease * (0.18 - 0.26);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('cut') >= 0) {
        // ═══ 5. SQUARE CUT (Step back & across, high hands descending slash through point) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.80 - 0.15);
          ry = -0.15 + ease * 0.95;
          rz = ease * 0.95;
          px = ease * 0.12;
          pz = -ease * 0.08;
          handsX = 0.12 + ease * 0.10;
          handsY = 1.10 + ease * 0.10;
          phaseLabel = 'BACK & ACROSS SETUP';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = -0.80 + ease * (0.20 - (-0.80));
          ry = 0.80 + ease * 0.45;
          rz = 0.95 + ease * 0.40;
          px = 0.12; pz = -0.08;
          handsX = 0.22 + ease * 0.15;
          handsZ = 0.10 + ease * 0.16;
          phaseLabel = 'DESCENDING SLASH THROUGH POINT';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
        } else if (progress < 0.68) {
          rx = 0.20; ry = 1.25; rz = 1.35;
          px = 0.12; pz = -0.08;
          handsX = 0.37; handsZ = 0.26;
          phaseLabel = '⚡ POINT CUT CRACK!';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = 0.20 + ease * 0.75;
          ry = 1.25 + ease * 0.30;
          rz = 1.35 - ease * 0.55;
          handsX = 0.37 + ease * 0.08;
          phaseLabel = 'FULL EXTENSION PAST POINT';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 0.95 + ease * (0.15 - 0.95);
          ry = 1.55 + ease * (-0.15 - 1.55);
          rz = 0.80 + ease * (0.0 - 0.80);
          px = 0.12 * (1 - ease);
          pz = -0.08 * (1 - ease);
          handsX = 0.45 + ease * (0.12 - 0.45);
          handsZ = 0.26 + ease * (0.18 - 0.26);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('defen') >= 0) {
        // ═══ 6. FORWARD DEFENCE (Solid dead-bat wall right below eyes, soft hands, zero follow-through) ═══
        if (progress < 0.30) {
          var t = progress / 0.30;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.40 - 0.15);
          ry = -0.15 + ease * 0.15;
          rz = 0.0;
          pz = ease * 0.20;
          handsZ = 0.18 + ease * 0.16;
          phaseLabel = 'MEASURED STRIDE FORWARD';
          phaseIndicator.style.borderColor = '#E2E8F0';
          phaseIndicator.style.color = '#E2E8F0';
        } else if (progress < 0.58) {
          var t = (progress - 0.30) / 0.28;
          var ease = t;
          rx = -0.40 + ease * (0.35 - (-0.40));
          ry = 0.0; rz = 0.0;
          pz = 0.20;
          handsY = 1.10 - ease * 0.15;
          handsZ = 0.34 + ease * 0.12;
          phaseLabel = 'SOFT HANDS BELOW EYES';
          phaseIndicator.style.borderColor = '#E2E8F0';
          phaseIndicator.style.color = '#E2E8F0';
        } else if (progress < 0.85) {
          rx = 0.35; ry = 0.0; rz = 0.0;
          pz = 0.20; handsY = 0.95; handsZ = 0.46;
          phaseLabel = '🛡️ SOLID DEFENSIVE WALL';
          phaseIndicator.style.borderColor = '#E2E8F0';
          phaseIndicator.style.color = '#E2E8F0';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else {
          var t = (progress - 0.85) / 0.15;
          var ease = t * t;
          rx = 0.35 + ease * (0.15 - 0.35);
          ry = -0.15 * ease;
          rz = 0.0;
          pz = 0.20 * (1 - ease);
          handsY = 0.95 + 0.15 * ease;
          handsZ = 0.46 + ease * (0.18 - 0.46);
          phaseLabel = 'HOLD & RETURN';
        }
      } else if (shot.indexOf('sweep') >= 0) {
        // ═══ 7. SWEEP SHOT (Kneeling deep lunge skimming turf from off to fine leg) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.45 - 0.15);
          ry = -0.15 + ease * 0.60;
          rz = ease * 0.65;
          py = -ease * 0.25;
          pz = ease * 0.24;
          handsY = 1.10 - ease * 0.38;
          handsZ = 0.18 + ease * 0.18;
          phaseLabel = 'KNEELING ON TURF';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = -0.45 + ease * (0.15 - (-0.45));
          ry = 0.45 - ease * 1.80;
          rz = 0.65 - ease * 2.10;
          py = -0.25; pz = 0.24;
          handsX = 0.12 - ease * 0.14;
          handsZ = 0.36 + ease * 0.10;
          phaseLabel = 'TURF BROOM SWEEP';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
        } else if (progress < 0.68) {
          rx = 0.15; ry = -1.35; rz = -1.45;
          py = -0.25; pz = 0.24;
          handsX = -0.02; handsY = 0.64; handsZ = 0.46;
          phaseLabel = '⚡ FINE LEG SWEEP!';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
          if (swingTime - dt < 0.58 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = 0.15 + ease * 0.40;
          ry = -1.35 - ease * 0.90;
          rz = -1.45 - ease * 0.30;
          py = -0.25 * (1 - ease * 0.6);
          phaseLabel = 'SQUARE LEG FINISH';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 0.55 + ease * (0.15 - 0.55);
          ry = -2.25 + ease * (-0.15 - (-2.25));
          rz = -1.75 + ease * (0.0 - (-1.75));
          py = -0.10 * (1 - ease);
          pz = 0.24 * (1 - ease);
          handsX = -0.02 + ease * (0.12 - (-0.02));
          handsY = 0.64 + ease * (1.10 - 0.64);
          handsZ = 0.46 + ease * (0.18 - 0.46);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('heli') >= 0) {
        // ═══ 8. HELICOPTER SHOT (Digging yorker at toes with explosive 360° overhead propeller whirl!) ═══
        if (progress < 0.24) {
          var t = progress / 0.24;
          var ease = t * (2 - t);
          rx = 0.15 + ease * (-0.55 - 0.15);
          ry = -0.15 + ease * 0.10;
          rz = 0.0;
          py = -ease * 0.08;
          handsY = 1.10 - ease * 0.12;
          phaseLabel = 'YORKER BLOCKHOLE CROUCH';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
        } else if (progress < 0.54) {
          var t = (progress - 0.24) / 0.30;
          var ease = t * t;
          rx = -0.55 + ease * (0.75 - (-0.55));
          ry = -0.05 - ease * 0.30;
          rz = -ease * 0.40;
          handsY = 0.98 - ease * 0.10;
          handsZ = 0.18 + ease * 0.28;
          phaseLabel = 'DIGGING BLOCKHOLE AT TOES';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
        } else if (progress < 0.62) {
          rx = 0.75; ry = -0.35; rz = -0.40;
          handsX = 0.08; handsY = 0.88; handsZ = 0.46;
          phaseLabel = '⚡ WRIST-SNAP EXPLOSION!';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
          if (swingTime - dt < 0.54 * swingDuration) {
            var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
            batGroup.localToWorld(sweetSpotWorld);
            triggerImpactFX(sweetSpotWorld);
          }
        } else if (progress < 0.88) {
          // The 360-degree helicopter whirl overhead!
          var t = (progress - 0.62) / 0.26;
          var ease = t * (2 - t);
          rx = 0.75 + ease * 1.50;
          ry = -0.35 - ease * (Math.PI * 2);
          rz = -0.40 - ease * 0.80;
          handsY = 0.88 + ease * 0.35;
          handsZ = 0.46 - ease * 0.20;
          phaseLabel = '🚁 360° HELICOPTER WHIRL OVERHEAD';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = 2.25 + ease * (0.15 - 2.25);
          ry = (-0.35 - Math.PI * 2) + ease * (-0.15 - (-0.35 - Math.PI * 2));
          rz = -1.20 + ease * (0.0 - (-1.20));
          handsY = 1.23 + ease * (1.10 - 1.23);
          handsZ = 0.26 + ease * (0.18 - 0.26);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else {
        // Fallback generic drive
        var t = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        rx = 0.15 + t * 0.8;
        ry = -0.15 + t * 0.2;
        rz = 0.0;
      }

      phaseIndicator.textContent = phaseLabel + ' (' + Math.round(progress * 100) + '%)';

      // Direct quaternion orientation - 100% reliable Three.js matrix update
      var qSwing = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
      batPivot.quaternion.copy(qSwing);
      currentStanceQuat.copy(qSwing);

      // Dynamically move batPivot hands position with the stroke
      if (displayMode === 'batsman') {
        batPivot.position.set(handsX, handsY, handsZ);
      } else {
        batPivot.position.set(0, 0.85, 0);
      }

      // Dynamic Batsman Arms linkage: forearms follow bat handle orientation
      if (batsmanGroup && batsmanGroup.visible && rUpperArm && lUpperArm) {
        var pitchDiff = Math.max(-1.0, Math.min(1.2, rx - 0.15));
        var rollDiff = Math.max(-1.0, Math.min(1.0, ry - (-0.15)));
        rUpperArm.rotation.x = 0.2 + pitchDiff * 0.45;
        lUpperArm.rotation.x = 0.3 + pitchDiff * 0.45;
        rUpperArm.rotation.z = -0.65 + rollDiff * 0.35;
        lUpperArm.rotation.z = -0.55 + rollDiff * 0.35;
      }

      // Batsman subtle body weight transfer
      if (batsmanGroup) {
        batsmanGroup.rotation.y = bodyYaw;
        batsmanGroup.position.set(px, py, 0.40 + pz);
      }

      // Sample blade tip world position for dynamic swing trajectory trail
      var tipWorld = new THREE.Vector3(0, -1.05, 0);
      batGroup.localToWorld(tipWorld);
      addTrailPoint(tipWorld);

      if (progress >= 1.0) {
        isSwinging = false;
        if (batsmanGroup) {
          batsmanGroup.rotation.y = 0;
          batsmanGroup.position.set(0, 0, 0.30);
        }
        if (displayMode === 'batsman') {
          batPivot.position.set(0.16, 1.42, 0.22);
        }
        var baseQ = getBaseStanceQuat();
        currentStanceQuat.copy(baseQ);
        batPivot.quaternion.copy(baseQ);

        phaseIndicator.textContent = hasLiveHardware ? (isCalibrated ? 'CALIBRATED • READY TO SWING' : 'HOLD STANCE & CALIBRATE') : 'READY IN STANCE';
        phaseIndicator.style.borderColor = '#00C97B';
        phaseIndicator.style.color = '#00C97B';
        postParentMessage({
          type: 'swingComplete',
          data: currentShotParams
        });
      }
    }

    function updateCameraPosition() {
      if (cameraAngle === 'side') {
        orbit.theta = 0.05;
        orbit.phi = 0.18;
        orbit.radius = 2.20;  // tighter — batsman fills frame
      } else if (cameraAngle === 'bowler') {
        orbit.theta = Math.PI / 2 + 0.08;
        orbit.phi = 0.20;
        orbit.radius = 2.60;
      } else if (cameraAngle === 'top') {
        orbit.theta = 0.10;
        orbit.phi = 1.20;
        orbit.radius = 2.80;
      } else if (cameraAngle === 'batsman') {
        orbit.theta = -Math.PI / 2 + 0.22;
        orbit.phi = 0.14;
        orbit.radius = 1.90;
      }

      var cp = new THREE.Vector3(
        orbit.radius * Math.cos(orbit.phi) * Math.sin(orbit.theta),
        orbit.radius * Math.sin(orbit.phi) + 0.65,
        orbit.radius * Math.cos(orbit.phi) * Math.cos(orbit.theta)
      );
      camera.position.copy(cp);
      camera.lookAt(lookTarget);
    }

    function setupEventListeners() {
      var dom = renderer.domElement;

      // Mouse and Touch Drag to Orbit or Swipe to Swing
      function onDown(e) {
        initAudio();
        drag.active = true;
        drag.startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        drag.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        drag.moved = 0;
      }

      function onMove(e) {
        if (!drag.active) return;
        var cx = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        var cy = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        var dx = cx - drag.startX;
        var dy = cy - drag.startY;
        drag.moved += Math.abs(dx) + Math.abs(dy);

        orbit.theta -= dx * 0.007;
        orbit.phi = Math.max(0.05, Math.min(1.4, orbit.phi + dy * 0.007));

        drag.startX = cx;
        drag.startY = cy;

        var cp = new THREE.Vector3(
          orbit.radius * Math.cos(orbit.phi) * Math.sin(orbit.theta),
          orbit.radius * Math.sin(orbit.phi) + 0.65,
          orbit.radius * Math.cos(orbit.phi) * Math.cos(orbit.theta)
        );
        camera.position.copy(cp);
        camera.lookAt(lookTarget);
      }

      function onUp(e) {
        if (drag.active && drag.moved > 90 && !isSwinging) {
          // If rapid swipe gesture detected, trigger swing!
          triggerSwing();
        }
        drag.active = false;
      }

      dom.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      dom.addEventListener('touchstart', onDown, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp, { passive: true });

      window.addEventListener('resize', function() {
        var W = window.innerWidth, H = window.innerHeight;
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      });

      // Spacebar shortcut to swing
      window.addEventListener('keydown', function(e) {
        if (e.code === 'Space' && !isSwinging) {
          e.preventDefault();
          triggerSwing();
        }
      });
    }

    var FIXED_PHYSICS_DT = 1 / 60; // 60Hz fixed physics step
    var physicsAccumulator = 0;

    function physicsStep(dt) {
      if (isSwinging) {
        // Built-in swing stroke / demo animation playing
        executeSwingAnimation(dt);
      } else if (hasLiveHardware) {
        // HARDWARE LIVE: bat is driven 100% by real quaternion stream from BNO085 relative to calibrated stance
        currentStanceQuat.slerp(targetStanceQuat, 0.40);
        batPivot.quaternion.copy(currentStanceQuat);

        // Dynamic Batsman Arms linkage: forearms follow bat handle orientation
        if (batsmanGroup && batsmanGroup.visible && rUpperArm && lUpperArm) {
          var be = new THREE.Euler().setFromQuaternion(batPivot.quaternion, 'YXZ');
          var pitchDiff = Math.max(-0.8, Math.min(0.8, be.x - baseStanceEulerBatsman.x));
          var rollDiff = Math.max(-0.8, Math.min(0.8, be.y - baseStanceEulerBatsman.y));
          rUpperArm.rotation.x = 0.2 + pitchDiff * 0.35;
          lUpperArm.rotation.x = 0.3 + pitchDiff * 0.35;
          rUpperArm.rotation.z = -0.65 + rollDiff * 0.25;
          lUpperArm.rotation.z = -0.55 + rollDiff * 0.25;
        }

        // Update phase indicator with live speed
        if (liveBatSpeedKmh > 5) {
          phaseIndicator.textContent = '⚡ LIVE ' + Math.round(liveBatSpeedKmh) + ' km/h | ' + liveAccelG.toFixed(1) + 'g';
          phaseIndicator.style.borderColor = liveBatSpeedKmh > 60 ? '#EF4444' : '#FF9F1C';
          phaseIndicator.style.color = liveBatSpeedKmh > 60 ? '#EF4444' : '#FF9F1C';
        } else {
          phaseIndicator.textContent = isCalibrated ? 'CALIBRATED • READY TO SWING' : 'HOLD STANCE & CALIBRATE';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        }
      } else {
        // Idle breathing sway when in offline/simulator mode
        var t = clock.getElapsedTime();
        var idleRoll = Math.sin(t * 1.5) * 0.02;
        var idlePitch = Math.cos(t * 1.5) * 0.03;
        currentStanceQuat.slerp(targetStanceQuat, 0.12);
        batPivot.quaternion.copy(currentStanceQuat);
        batPivot.rotation.z += idleRoll;
        batPivot.rotation.x += idlePitch;
      }

      // Real-time blade tip velocity tracking & dynamic trajectory ribbon trail
      if (bladeMesh && batGroup) {
        var tipWorld = new THREE.Vector3(0, -1.05, 0);
        batGroup.localToWorld(tipWorld);
        if (lastTipPos.lengthSq() > 0) {
          var dist = tipWorld.distanceTo(lastTipPos);
          var tipSpeed = dt > 0 ? dist / dt : 0;
          if (tipSpeed > 0.8) {
            addTrailPoint(tipWorld);
          } else if (trailPositions.length > 0) {
            trailPositions.shift();
            trailGeometry.attributes.position.needsUpdate = true;
          }
        }
        lastTipPos.copy(tipWorld);
      }

      updateImpactFX(dt);
    }

    function animate() {
      requestAnimationFrame(animate);
      var rawDelta = clock.getDelta();
      var frameTime = Math.min(rawDelta, 0.1); // prevent spiral on background/stall
      physicsAccumulator += frameTime;

      while (physicsAccumulator >= FIXED_PHYSICS_DT) {
        physicsStep(FIXED_PHYSICS_DT);
        physicsAccumulator -= FIXED_PHYSICS_DT;
      }

      renderer.render(scene, camera);
    }

    // Communication with React Native parent
    function postParentMessage(payload) {
      var str = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(str);
      } else if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(str, '*');
      }
    }

    function handleIncomingMessage(raw) {
      try {
        var msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!msg) return;

        if (msg.type === 'triggerSwing') {
          triggerSwing(msg.params);
        } else if (msg.type === 'setCamera') {
          cameraAngle = msg.view || 'side';
          updateCameraPosition();
        } else if (msg.type === 'setDisplayMode') {
          if (msg.mode && msg.mode !== displayMode) toggleViewMode();
        } else if (msg.type === 'calibrateStance') {
          calibrateStance();
        } else if (msg.type === 'setMountingConfig') {
          if (msg.config) {
            if (msg.config.mountingMode !== undefined) mountingMode = msg.config.mountingMode;
            if (msg.config.invertPitch !== undefined) invertPitch = !!msg.config.invertPitch;
            if (msg.config.invertRoll !== undefined) invertRoll = !!msg.config.invertRoll;
            if (msg.config.invertYaw !== undefined) invertYaw = !!msg.config.invertYaw;
            calibrateStance();
          }
        } else if (msg.type === 'setLiveOrientation') {
          hasLiveHardware = true;
          // Do not cancel isSwinging while a requested demo swing is playing
          
          var liveDot = document.getElementById('live-dot');
          var liveStatus = document.getElementById('live-status');
          if (liveDot && !liveDot.classList.contains('hw-active')) {
            liveDot.classList.add('hw-active');
            liveDot.style.background = '#00C97B';
            if (liveStatus) liveStatus.textContent = 'ESP32 HARDWARE LIVE (50 HZ)';
          }

          // Update live speed/accel for HUD display
          if (msg.liveSpeed !== undefined) liveBatSpeedKmh = Number(msg.liveSpeed) || 0;
          if (msg.liveAccelG !== undefined) liveAccelG = Number(msg.liveAccelG) || 0;

          // Store raw sensor readings
          var hasRawQuat = false;
          if (msg.quat && (msg.quat.qw !== 1 || msg.quat.qx !== 0 || msg.quat.qy !== 0 || msg.quat.qz !== 0)) {
            latestRawQuat.set(msg.quat.qx, msg.quat.qy, msg.quat.qz, msg.quat.qw);
            hasRawQuat = true;
          }
          latestRawPitch = Number(msg.pitch) || 0;
          latestRawRoll = Number(msg.roll) || 0;
          latestRawYaw = Number(msg.yaw) || 0;

          // Auto-calibrate on initial packets if not calibrated yet
          if (!isCalibrated) {
            calibrateStance();
            return;
          }

          var baseQ = getBaseStanceQuat();

          if (hasRawQuat) {
            // RELATIVE SENSOR BODY QUATERNION:
            // Delta in sensor body frame: DeltaQ_sensor = Q_calibInv * Q_raw
            var qDeltaSensor = new THREE.Quaternion().copy(calibQuatInv).multiply(latestRawQuat);

            // Sensor is mounted on back spine (-Z) of bat:
            // Sensor +Y along bat handle (+Y)
            // Sensor +X across bat blade width (+X)
            // Sensor +Z normal away from back spine (-Z)
            var sx = invertPitch ? -1 : 1;
            var sy = invertRoll ? -1 : 1;
            var sz = invertYaw ? -1 : 1;

            if (mountingMode === 'spine_down') {
              sx = -sx;
              sy = -sy;
            }

            // Map sensor body rotation into bat body frame (pure quaternion, no Euler clamp):
            var qDeltaBat = new THREE.Quaternion(
              qDeltaSensor.x * sx,
              qDeltaSensor.y * sy,
              -qDeltaSensor.z * sz,
              qDeltaSensor.w
            );
            qDeltaBat.normalize();

            // Right-multiplication applies body-frame rotation to base stance quaternion:
            targetStanceQuat.copy(baseQ).multiply(qDeltaBat);
          } else {
            // EULER RELATIVE FALLBACK:
            var dPitch = (latestRawPitch - calibEuler.pitch) * (invertPitch ? -1 : 1);
            var dRoll = (latestRawRoll - calibEuler.roll) * (invertRoll ? -1 : 1);
            var dYaw = (latestRawYaw - calibEuler.yaw) * (invertYaw ? -1 : 1);

            if (mountingMode === 'spine_down') {
              dPitch = -dPitch;
              dRoll = -dRoll;
            }

            var pRad = (dPitch * Math.PI) / 180;
            var rRad = (dRoll * Math.PI) / 180;
            var yRad = (dYaw * Math.PI) / 180;

            var qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pRad);
            var qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rRad);
            var qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -yRad);
            var qDeltaBatEuler = new THREE.Quaternion().copy(qYaw).multiply(qPitch).multiply(qRoll);
            targetStanceQuat.copy(baseQ).multiply(qDeltaBatEuler);
          }

          // Real-time impact shock detector from physical ADXL375
          if (msg.accel) {
            var gMag = Math.sqrt(
              Number(msg.accel.ax || 0) ** 2 +
              Number(msg.accel.ay || 0) ** 2 +
              Number(msg.accel.az || 0) ** 2
            );
            var nowMs = Date.now();
            if (gMag > 2.8 && nowMs - lastImpactFxTime > 800) {
              lastImpactFxTime = nowMs;
              currentShotParams.impactG = Math.round(gMag * 10) / 10;
              var sweetSpotWorld = new THREE.Vector3(0, -0.52, 0.045);
              batGroup.localToWorld(sweetSpotWorld);
              triggerImpactFX(sweetSpotWorld);
            }
          }
        } else if (msg.type === 'setSound') {
          soundEnabled = !!msg.enabled;
        }
      } catch(err) {
        console.error('Error handling message in visualizer:', err);
      }
    }

    window.addEventListener('message', function(e) { handleIncomingMessage(e.data); });
    document.addEventListener('message', function(e) { handleIncomingMessage(e.data); });

    init();
  </script>
</body>
</html>`;

export const LiveSwingVisualizer = forwardRef<LiveSwingVisualizerRef, LiveSwingVisualizerProps>(
  ({ onSwingImpact, onSwingComplete, onStanceCalibrated, soundEnabled = true, cameraView = 'side' }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const webViewRef = useRef<WebView | null>(null);

    const postToCanvas = useCallback((msg: object) => {
      const serialized = JSON.stringify(msg);
      if (Platform.OS === 'web') {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(serialized, '*');
        }
      } else if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (typeof handleIncomingMessage === 'function') {
            handleIncomingMessage(${JSON.stringify(serialized)});
          }
          true;
        `);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      triggerSwing: (options) => {
        postToCanvas({ type: 'triggerSwing', params: options || {} });
      },
      setCameraView: (view) => {
        postToCanvas({ type: 'setCamera', view });
      },
      updateLiveOrientation: (pitch, roll, yaw, quat, accel, liveSpeed, liveAccelG) => {
        postToCanvas({ type: 'setLiveOrientation', pitch, roll, yaw, quat, accel, liveSpeed, liveAccelG });
      },
      setSoundEnabled: (enabled) => {
        postToCanvas({ type: 'setSound', enabled });
      },
      setDisplayMode: (mode) => {
        postToCanvas({ type: 'setDisplayMode', mode });
      },
      calibrateStance: () => {
        postToCanvas({ type: 'calibrateStance' });
      },
      setMountingConfig: (config) => {
        postToCanvas({ type: 'setMountingConfig', config });
      },
    }), [postToCanvas]);

    // Update camera angle when prop changes
    useEffect(() => {
      postToCanvas({ type: 'setCamera', view: cameraView });
    }, [cameraView, postToCanvas]);

    // Update sound setting when prop changes
    useEffect(() => {
      postToCanvas({ type: 'setSound', enabled: soundEnabled });
    }, [soundEnabled, postToCanvas]);

    const handleMessageFromCanvas = useCallback((eventData: string) => {
      try {
        const parsed = JSON.parse(eventData);
        if (parsed.type === 'swingImpact') {
          onSwingImpact?.(parsed.data);
        } else if (parsed.type === 'swingComplete') {
          onSwingComplete?.(parsed.data);
        } else if (parsed.type === 'stanceCalibrated') {
          onStanceCalibrated?.(parsed.data);
        }
      } catch (e) {
        // Ignore non-json
      }
    }, [onSwingImpact, onSwingComplete, onStanceCalibrated]);

    useEffect(() => {
      if (Platform.OS === 'web') {
        const onWebMsg = (e: MessageEvent) => {
          if (typeof e.data === 'string') {
            handleMessageFromCanvas(e.data);
          }
        };
        window.addEventListener('message', onWebMsg);
        return () => window.removeEventListener('message', onWebMsg);
      }
    }, [handleMessageFromCanvas]);

    return (
      <View style={styles.container}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            srcDoc={VISUALIZER_HTML}
            style={{ width: '100%', height: '100%', border: 'none', background: '#0B0F19' }}
            title="VectorBat Live 3D Swing Visualizer"
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: VISUALIZER_HTML }}
            style={styles.webview}
            scrollEnabled={false}
            javaScriptEnabled={true}
            onMessage={(e) => handleMessageFromCanvas(e.nativeEvent.data)}
          />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
});
