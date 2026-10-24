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
    var trailCoreLine, trailCoreGeo, trailRibbonMesh, trailRibbonGeo;
    var trailPositions = [], maxTrailPoints = 65;
    var impactLight, impactParticles = [], impactShockwave, sweetSpotIndicator;
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

    var orbit = { theta: 0.06, phi: 0.16, radius: 3.40 };
    var drag = { active: false, startX: 0, startY: 0, moved: 0 };
    var lookTarget = new THREE.Vector3(0, 0.90, 0.05);

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
          batPivot.position.set(0.10, 0.96, 0.15);
          batPivot.scale.set(1.0, 1.0, 1.0);
        }
        if (batGroup) {
          batGroup.position.set(0, 0, 0);
        }
        lookTarget.set(0, 0.90, 0.05);
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
      batsmanGroup.scale.set(1.0, 1.0, 1.0);
      batsmanGroup.position.set(0, 0, 0.15);
      scene.add(batsmanGroup);

      // ── CANVAS-TEXTURED PBR MATERIALS ──────────────────────
      var jerseyTex  = makeJerseyTex();
      var skinTex    = makeSkinTex();
      var padTex     = makePadTex();
      var willowTex  = makeWillowTex();
      var helmetTex  = makeHelmetTex();

      var jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTex,  roughness: 0.75, metalness: 0.04 });
      var kitMat    = new THREE.MeshStandardMaterial({ color: 0xF0F4F8, roughness: 0.85, metalness: 0.00 });
      var padMat    = new THREE.MeshStandardMaterial({ map: padTex,     roughness: 0.50, metalness: 0.05 });
      var gloveMat  = new THREE.MeshStandardMaterial({ color: 0x0A3A2A, roughness: 0.65, metalness: 0.08 });
      var gloveWhiteMat = new THREE.MeshStandardMaterial({ color: 0xFAFAFA, roughness: 0.80, metalness: 0.02 });
      var skinMat   = new THREE.MeshStandardMaterial({ map: skinTex,    roughness: 0.88, metalness: 0.00 });
      var helmetMat = new THREE.MeshStandardMaterial({ map: helmetTex,  roughness: 0.28, metalness: 0.50 });
      var grillMat  = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.25, metalness: 0.85 });
      var shoeMat   = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.60, metalness: 0.12 });
      var soleMat   = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.90, metalness: 0.00 });

      // ═══════════════════════════════════════════════════════
      // REALISTIC 1.82M CRICKET BATSMAN - TEXTBOOK ATHLETIC STANCE
      // ═══════════════════════════════════════════════════════

      // ── FEET / CLEATED CRICKET SHOES ──
      // Right foot (back foot, inside crease line, angled slightly towards point)
      var rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.055, 0.23), shoeMat);
      rShoe.position.set(-0.11, 0.028, -0.06);
      rShoe.rotation.y = 0.22;
      batsmanGroup.add(rShoe);
      var rSole = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.225), soleMat);
      rSole.position.set(-0.11, 0.009, -0.06);
      rSole.rotation.y = 0.22;
      batsmanGroup.add(rSole);

      // Left foot (front foot, slightly forward towards mid-off)
      var lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.055, 0.23), shoeMat);
      lShoe.position.set(0.12, 0.028, 0.10);
      lShoe.rotation.y = -0.15;
      batsmanGroup.add(lShoe);
      var lSole = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.225), soleMat);
      lSole.position.set(0.12, 0.009, 0.10);
      lSole.rotation.y = -0.15;
      batsmanGroup.add(lSole);

      // ── RIGHT LEG (back leg, flexed knee in athletic readiness) ──
      var rShinGeo = new THREE.CylinderGeometry(0.058, 0.050, 0.40, 14);
      var rShin = new THREE.Mesh(rShinGeo, padMat);
      rShin.position.set(-0.11, 0.24, -0.04);
      rShin.rotation.x = 0.08;
      rShin.castShadow = true;
      batsmanGroup.add(rShin);

      // Pad vertical cane ridges (3 embossed lines on face)
      for (var ri = -1; ri <= 1; ri++) {
        var ribGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.38, 8);
        var rib = new THREE.Mesh(ribGeo, padMat);
        rib.position.set(-0.11 + ri * 0.028, 0.24, 0.015);
        rib.rotation.x = 0.08;
        batsmanGroup.add(rib);
      }

      // Pad knee roll
      var rKneeRoll = new THREE.Mesh(new THREE.SphereGeometry(0.060, 12, 10), padMat);
      rKneeRoll.scale.set(1.0, 0.65, 0.85);
      rKneeRoll.position.set(-0.11, 0.44, -0.025);
      batsmanGroup.add(rKneeRoll);

      var rThighGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.38, 14);
      var rThigh = new THREE.Mesh(rThighGeo, kitMat);
      rThigh.position.set(-0.11, 0.63, -0.01);
      rThigh.rotation.x = -0.12;
      rThigh.castShadow = true;
      batsmanGroup.add(rThigh);

      // ── LEFT LEG (front leg, bent knee leading towards bowler) ──
      var lShinGeo = new THREE.CylinderGeometry(0.058, 0.050, 0.40, 14);
      var lShin = new THREE.Mesh(lShinGeo, padMat);
      lShin.position.set(0.12, 0.24, 0.08);
      lShin.rotation.x = -0.14;
      lShin.castShadow = true;
      batsmanGroup.add(lShin);

      for (var li = -1; li <= 1; li++) {
        var lRibGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.38, 8);
        var lRib = new THREE.Mesh(lRibGeo, padMat);
        lRib.position.set(0.12 + li * 0.028, 0.24, 0.135);
        lRib.rotation.x = -0.14;
        batsmanGroup.add(lRib);
      }

      var lKneeRoll = new THREE.Mesh(new THREE.SphereGeometry(0.060, 12, 10), padMat);
      lKneeRoll.scale.set(1.0, 0.65, 0.85);
      lKneeRoll.position.set(0.12, 0.44, 0.06);
      batsmanGroup.add(lKneeRoll);

      var lThighGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.38, 14);
      var lThigh = new THREE.Mesh(lThighGeo, kitMat);
      lThigh.position.set(0.12, 0.63, 0.04);
      lThigh.rotation.x = -0.18;
      lThigh.castShadow = true;
      batsmanGroup.add(lThigh);

      // ── HIPS & WAIST ──
      var hipGeo = new THREE.CylinderGeometry(0.145, 0.130, 0.16, 16);
      var hips = new THREE.Mesh(hipGeo, kitMat);
      hips.position.set(0.005, 0.81, 0.02);
      hips.rotation.x = -0.06;
      batsmanGroup.add(hips);

      // ── TORSO (athletic cricket team jersey, tapered V build) ──
      var torsoGeo = new THREE.CylinderGeometry(0.165, 0.140, 0.44, 18);
      var torso = new THREE.Mesh(torsoGeo, jerseyMat);
      torso.position.set(0.005, 1.05, 0.03);
      torso.rotation.x = -0.08; // athletic forward crouch
      torso.castShadow = true;
      batsmanGroup.add(torso);

      // Chest plate / upper torso
      var chestGeo = new THREE.CylinderGeometry(0.175, 0.160, 0.16, 18);
      var chest = new THREE.Mesh(chestGeo, jerseyMat);
      chest.position.set(0.005, 1.22, 0.03);
      chest.rotation.x = -0.08;
      chest.castShadow = true;
      batsmanGroup.add(chest);

      // Shoulders bar
      var shoulderGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.38, 14);
      var shoulderBar = new THREE.Mesh(shoulderGeo, jerseyMat);
      shoulderBar.position.set(0.005, 1.30, 0.03);
      shoulderBar.rotation.z = Math.PI / 2;
      shoulderBar.castShadow = true;
      batsmanGroup.add(shoulderBar);

      // Neck
      var neckGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.10, 14);
      var neck = new THREE.Mesh(neckGeo, skinMat);
      neck.position.set(0.005, 1.37, 0.02);
      batsmanGroup.add(neck);

      // ── CRICKET HELMET & HEAD (pro Masuri/Shrey style) ──
      var headGeo = new THREE.SphereGeometry(0.125, 24, 20);
      var head = new THREE.Mesh(headGeo, helmetMat);
      head.position.set(0.005, 1.50, 0.015);
      head.scale.set(1.0, 1.06, 1.02);
      head.castShadow = true;
      batsmanGroup.add(head);

      // Helmet visor peak
      var peakGeo = new THREE.CylinderGeometry(0.130, 0.130, 0.022, 24, 1, false, -Math.PI * 0.55, Math.PI * 0.55);
      var peakMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.35, metalness: 0.40 });
      var peak = new THREE.Mesh(peakGeo, peakMat);
      peak.position.set(0.005, 1.45, 0.075);
      peak.rotation.x = 0.22;
      batsmanGroup.add(peak);

      // Helmet face grille (titanium cage bars)
      var grillGroup = new THREE.Group();
      grillGroup.position.set(0.005, 1.46, 0.095);
      for (var gi = 0; gi < 5; gi++) {
        var vBarGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6);
        var vBar = new THREE.Mesh(vBarGeo, grillMat);
        vBar.position.set(-0.055 + gi * 0.028, 0, 0);
        vBar.rotation.x = Math.PI / 2;
        grillGroup.add(vBar);
      }
      for (var gj = 0; gj < 3; gj++) {
        var hBarGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6);
        var hBar = new THREE.Mesh(hBarGeo, grillMat);
        hBar.position.set(0, -0.03 + gj * 0.028, 0);
        hBar.rotation.z = Math.PI / 2;
        grillGroup.add(hBar);
      }
      batsmanGroup.add(grillGroup);

      // Ear dome protector
      var earDomeGeo = new THREE.SphereGeometry(0.045, 12, 10, 0, Math.PI);
      var earDome = new THREE.Mesh(earDomeGeo, helmetMat);
      earDome.position.set(-0.125, 1.50, 0.01);
      earDome.rotation.y = -Math.PI / 2;
      batsmanGroup.add(earDome);

      // ── ARMS & HANDS (holding bat handle at waist/crease) ──
      // Right arm (bottom hand)
      var rUpperArmGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.26, 12);
      rUpperArm = new THREE.Mesh(rUpperArmGeo, jerseyMat);
      rUpperArm.position.set(0.18, 1.22, 0.06);
      rUpperArm.rotation.z = -0.68;
      rUpperArm.rotation.x = 0.28;
      rUpperArm.castShadow = true;
      batsmanGroup.add(rUpperArm);

      var rForearmGeo = new THREE.CylinderGeometry(0.035, 0.030, 0.24, 12);
      rForearm = new THREE.Mesh(rForearmGeo, skinMat);
      rForearm.position.set(0.24, 1.05, 0.12);
      rForearm.rotation.z = -1.05;
      rForearm.rotation.x = 0.38;
      rForearm.castShadow = true;
      batsmanGroup.add(rForearm);

      // Left arm (top hand)
      var lUpperArmGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.26, 12);
      lUpperArm = new THREE.Mesh(lUpperArmGeo, jerseyMat);
      lUpperArm.position.set(0.15, 1.25, 0.09);
      lUpperArm.rotation.z = -0.52;
      lUpperArm.rotation.x = 0.32;
      lUpperArm.castShadow = true;
      batsmanGroup.add(lUpperArm);

      var lForearmGeo = new THREE.CylinderGeometry(0.035, 0.030, 0.24, 12);
      lForearm = new THREE.Mesh(lForearmGeo, skinMat);
      lForearm.position.set(0.20, 1.10, 0.14);
      lForearm.rotation.z = -0.92;
      lForearm.rotation.x = 0.42;
      lForearm.castShadow = true;
      batsmanGroup.add(lForearm);

      // ═══════════════════════════════════════════════════════
      // BAT PIVOT positioned at hands grip height (0.10, 0.96, 0.15)
      // ═══════════════════════════════════════════════════════
      batPivot = new THREE.Group();
      batPivot.position.set(0.10, 0.96, 0.15);
      scene.add(batPivot);

      batGroup = new THREE.Group();
      batPivot.add(batGroup);

      // ── AUTHENTIC ENGLISH WILLOW SHORT-HANDLE (SH) CRICKET BAT ──
      var willowMat = new THREE.MeshStandardMaterial({
        map: willowTex,
        roughness: 0.28,
        metalness: 0.02
      });
      var spineMat = new THREE.MeshStandardMaterial({ color: 0xB57E38, roughness: 0.45, metalness: 0.02 });
      var gripMat  = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.92, metalness: 0.00 });
      var stickerMat = new THREE.MeshStandardMaterial({
        color: 0x00C97B,
        roughness: 0.20,
        metalness: 0.15,
        emissive: 0x003318,
        emissiveIntensity: 0.4
      });

      // Rubber Chevron Handle (length 27 cm)
      var handleGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.27, 18);
      var handle = new THREE.Mesh(handleGeo, gripMat);
      handle.position.y = 0.135;
      handle.castShadow = true;
      batGroup.add(handle);

      // Chevron grip rings
      for (var ci = 0; ci < 6; ci++) {
        var chevGeo = new THREE.TorusGeometry(0.017, 0.0028, 6, 16);
        var chevMat = new THREE.MeshStandardMaterial({ color: 0x00C97B, roughness: 0.5 });
        var chev = new THREE.Mesh(chevGeo, chevMat);
        chev.position.y = 0.02 + ci * 0.042;
        chev.rotation.x = Math.PI / 2;
        batGroup.add(chev);
      }

      // Padded Batting Gloves gripping the handle
      // Top Hand (Left)
      var lGlove = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 12), gloveMat);
      lGlove.position.set(0, 0.22, 0.008);
      lGlove.scale.set(1.15, 0.85, 1.0);
      batGroup.add(lGlove);
      // Bottom Hand (Right)
      var rGlove = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 12), gloveMat);
      rGlove.position.set(0, 0.08, 0.008);
      rGlove.scale.set(1.15, 0.85, 1.0);
      batGroup.add(rGlove);

      // Splice transition
      var spliceGeo = new THREE.CylinderGeometry(0.018, 0.042, 0.06, 14);
      var splice = new THREE.Mesh(spliceGeo, spineMat);
      splice.position.y = -0.030;
      batGroup.add(splice);

      // ADULT CRICKET BAT BLADE (width 10.8 cm, length 58 cm, depth 5.2 cm)
      var bladeWidth  = 0.108;
      var bladeLength = 0.58;
      var bladeDepth  = 0.052;
      var bladeGeo = new THREE.BoxGeometry(bladeWidth, bladeLength, bladeDepth);
      bladeMesh = new THREE.Mesh(bladeGeo, willowMat);
      bladeMesh.position.set(0, -0.32, 0);
      bladeMesh.castShadow = true;
      batGroup.add(bladeMesh);

      // Curved wooden toe at bottom of blade
      var toeGeo = new THREE.CylinderGeometry(0.054, 0.054, bladeDepth, 16, 1, false, 0, Math.PI);
      var toe = new THREE.Mesh(toeGeo, willowMat);
      toe.position.set(0, -0.61, 0);
      toe.rotation.z = Math.PI / 2;
      toe.rotation.y = Math.PI / 2;
      toe.castShadow = true;
      batGroup.add(toe);

      // Blade shoulder bevel (top of blade)
      var shoulderGeo = new THREE.CylinderGeometry(0.042, bladeWidth / 2, 0.05, 12);
      var bladeTop = new THREE.Mesh(shoulderGeo, willowMat);
      bladeTop.position.y = -0.015;
      batGroup.add(bladeTop);

      // Holographic Brand Sticker on face (+Z)
      var stickerGeo = new THREE.PlaneGeometry(0.088, 0.38);
      var sticker = new THREE.Mesh(stickerGeo, stickerMat);
      sticker.position.set(0, -0.30, 0.027);
      batGroup.add(sticker);

      // Power Spine ridge on back (-Z)
      var spineRidgeGeo = new THREE.ConeGeometry(0.062, bladeLength * 0.90, 4);
      var spineRidge = new THREE.Mesh(spineRidgeGeo, spineMat);
      spineRidge.rotation.x = Math.PI;
      spineRidge.rotation.y = Math.PI / 4;
      spineRidge.position.set(0, -0.31, -0.032);
      spineRidge.scale.set(0.85, 1, 0.36);
      batGroup.add(spineRidge);

      // VectorBat ESP32 Sensor Pod on back spine
      var sensorBoxGeo = new THREE.BoxGeometry(0.048, 0.088, 0.024);
      var sensorBoxMat = new THREE.MeshStandardMaterial({ color: 0x0B0F19, roughness: 0.25, metalness: 0.85 });
      var sensorBox = new THREE.Mesh(sensorBoxGeo, sensorBoxMat);
      sensorBox.position.set(0, -0.28, -0.046);
      sensorBox.castShadow = true;
      batGroup.add(sensorBox);

      // Sensor Active Emerald LED
      var ledGeo = new THREE.SphereGeometry(0.006, 8, 8);
      var ledMat = new THREE.MeshBasicMaterial({ color: 0x00FF88 });
      var sensorLed = new THREE.Mesh(ledGeo, ledMat);
      sensorLed.position.set(0.016, -0.30, -0.059);
      batGroup.add(sensorLed);

      // Sweet Spot target reticle on face (+Z)
      var sweetGeo = new THREE.RingGeometry(0.022, 0.034, 32);
      var sweetMat = new THREE.MeshBasicMaterial({ color: 0x00C97B, side: THREE.DoubleSide });
      sweetSpotIndicator = new THREE.Mesh(sweetGeo, sweetMat);
      sweetSpotIndicator.position.set(0, -0.36, 0.028);
      batGroup.add(sweetSpotIndicator);

      // Initial Stance Orientation
      batPivot.quaternion.copy(currentStanceQuat);
    }

    // ─────────────────────────────────────────────────────────
    // US-005: 3D DYNAMIC TRAJECTORY RIBBON TRAIL
    // ─────────────────────────────────────────────────────────
    function setupTrail() {
      // 1. Central laser-fine core line
      trailCoreGeo = new THREE.BufferGeometry();
      var corePos = new Float32Array(maxTrailPoints * 3);
      trailCoreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
      var coreMat = new THREE.LineBasicMaterial({
        color: 0x00FFB0,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      trailCoreLine = new THREE.Line(trailCoreGeo, coreMat);
      trailCoreLine.frustumCulled = false;
      scene.add(trailCoreLine);

      // 2. 3D Glowing Aerodynamic Ribbon Mesh (quad strip along blade normal)
      trailRibbonGeo = new THREE.BufferGeometry();
      var ribbonVerts = new Float32Array(maxTrailPoints * 2 * 3);
      var ribbonColors = new Float32Array(maxTrailPoints * 2 * 4); // RGBA
      var ribbonIndices = [];

      for (var i = 0; i < maxTrailPoints - 1; i++) {
        var v0 = i * 2;
        var v1 = i * 2 + 1;
        var v2 = (i + 1) * 2;
        var v3 = (i + 1) * 2 + 1;
        ribbonIndices.push(v0, v1, v2);
        ribbonIndices.push(v1, v3, v2);
      }

      trailRibbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonVerts, 3));
      trailRibbonGeo.setAttribute('color', new THREE.BufferAttribute(ribbonColors, 4));
      trailRibbonGeo.setIndex(ribbonIndices);

      var ribbonMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      trailRibbonMesh = new THREE.Mesh(trailRibbonGeo, ribbonMat);
      trailRibbonMesh.frustumCulled = false;
      scene.add(trailRibbonMesh);
    }

    function addTrailPoint(vec3) {
      // Compute blade normal for 3D ribbon width
      var bladeNormal = new THREE.Vector3(1, 0, 0);
      if (batGroup) {
        bladeNormal.applyQuaternion(batPivot.quaternion).normalize();
      }

      trailPositions.unshift({
        pos: vec3.clone(),
        norm: bladeNormal.clone()
      });

      if (trailPositions.length > maxTrailPoints) {
        trailPositions.pop();
      }
      updateTrailGeometry();
    }

    function updateTrailGeometry() {
      if (!trailCoreGeo || !trailRibbonGeo) return;

      var corePos = trailCoreGeo.attributes.position.array;
      var ribbonPos = trailRibbonGeo.attributes.position.array;
      var ribbonColors = trailRibbonGeo.attributes.color.array;
      var count = trailPositions.length;

      var halfWidth = 0.038; // 7.6 cm ribbon width

      for (var i = 0; i < maxTrailPoints; i++) {
        var idx = i * 3;
        var rIdx0 = (i * 2) * 3;
        var rIdx1 = (i * 2 + 1) * 3;
        var cIdx0 = (i * 2) * 4;
        var cIdx1 = (i * 2 + 1) * 4;

        if (i < count) {
          var p = trailPositions[i].pos;
          var n = trailPositions[i].norm;
          var fade = 1.0 - (i / count);
          var alpha = fade * fade * 0.85;

          // Core line position
          corePos[idx]     = p.x;
          corePos[idx + 1] = p.y;
          corePos[idx + 2] = p.z;

          // Ribbon left & right vertices
          ribbonPos[rIdx0]     = p.x - n.x * halfWidth * fade;
          ribbonPos[rIdx0 + 1] = p.y - n.y * halfWidth * fade;
          ribbonPos[rIdx0 + 2] = p.z - n.z * halfWidth * fade;

          ribbonPos[rIdx1]     = p.x + n.x * halfWidth * fade;
          ribbonPos[rIdx1 + 1] = p.y + n.y * halfWidth * fade;
          ribbonPos[rIdx1 + 2] = p.z + n.z * halfWidth * fade;

          // Color gradient: white-hot tip -> vibrant teal -> dark fade
          var r = i < 3 ? 1.0 : (1.0 - fade) * 0.1;
          var g = i < 3 ? 1.0 : 0.85 * fade;
          var b = i < 3 ? 1.0 : 0.65;

          ribbonColors[cIdx0]     = r;
          ribbonColors[cIdx0 + 1] = g;
          ribbonColors[cIdx0 + 2] = b;
          ribbonColors[cIdx0 + 3] = alpha;

          ribbonColors[cIdx1]     = r;
          ribbonColors[cIdx1 + 1] = g;
          ribbonColors[cIdx1 + 2] = b;
          ribbonColors[cIdx1 + 3] = alpha;
        } else if (count > 0) {
          var last = trailPositions[count - 1].pos;
          corePos[idx]     = last.x;
          corePos[idx + 1] = last.y;
          corePos[idx + 2] = last.z;

          ribbonPos[rIdx0]     = last.x;
          ribbonPos[rIdx0 + 1] = last.y;
          ribbonPos[rIdx0 + 2] = last.z;
          ribbonPos[rIdx1]     = last.x;
          ribbonPos[rIdx1 + 1] = last.y;
          ribbonPos[rIdx1 + 2] = last.z;

          ribbonColors[cIdx0 + 3] = 0;
          ribbonColors[cIdx1 + 3] = 0;
        }
      }

      trailCoreGeo.attributes.position.needsUpdate = true;
      trailRibbonGeo.attributes.position.needsUpdate = true;
      trailRibbonGeo.attributes.color.needsUpdate = true;
    }

    function clearTrail() {
      trailPositions = [];
      updateTrailGeometry();
    }

    function getSweetSpotWorldPos() {
      var pos = new THREE.Vector3(0, -0.36, 0.028);
      if (batGroup) batGroup.localToWorld(pos);
      return pos;
    }

    // ─────────────────────────────────────────────────────────
    // US-005: SWEET SPOT IMPACT FX & CONTACT CRACK
    // ─────────────────────────────────────────────────────────
    function setupImpactFX() {
      // 1. Expanding radial shockwave ring on bat blade face
      var ringGeo = new THREE.RingGeometry(0.016, 0.026, 32);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0x00FF88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
      impactShockwave = new THREE.Mesh(ringGeo, ringMat);
      impactShockwave.position.set(0, -0.36, 0.030);
      impactShockwave.visible = false;
      batGroup.add(impactShockwave);

      // 2. High-energy spark particles
      for (var i = 0; i < 40; i++) {
        var pGeo = new THREE.SphereGeometry(0.012, 6, 6);
        var pMat = new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xFFFFFF : (i % 3 === 1 ? 0x00FF88 : 0xFF9F1C),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending
        });
        var pMesh = new THREE.Mesh(pGeo, pMat);
        scene.add(pMesh);
        impactParticles.push({
          mesh: pMesh,
          vel: new THREE.Vector3(),
          life: 0,
          maxLife: 0.45
        });
      }
    }

    function triggerImpactFX(sweetSpotWorldPos) {
      impactLight.position.copy(sweetSpotWorldPos);
      impactLight.intensity = 18;

      // Flash blade
      if (bladeMesh) {
        bladeMesh.material.emissive = new THREE.Color(0x00FF88);
        bladeMesh.material.emissiveIntensity = 1.0;
      }

      // Trigger expanding shockwave ripple
      if (impactShockwave) {
        impactShockwave.visible = true;
        impactShockwave.scale.set(1, 1, 1);
        impactShockwave.material.opacity = 1.0;
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
      impactValEl.textContent = (currentShotParams.impactG || 1.2) + 'g';
      impactBanner.className = 'active';
      setTimeout(function() {
        impactBanner.className = '';
      }, 750);

      // Play authentic bat contact crack sound
      playImpactSound(currentShotParams.impactG || 15);

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
      if (impactShockwave && impactShockwave.visible) {
        impactShockwave.scale.addScalar(dt * 7.0);
        impactShockwave.material.opacity = Math.max(0, impactShockwave.material.opacity - dt * 3.2);
        if (impactShockwave.material.opacity <= 0.02) {
          impactShockwave.visible = false;
        }
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
        triggerImpactFX(getSweetSpotWorldPos());

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

      if (trailCoreLine && trailCoreLine.material) {
        trailCoreLine.material.color.setHex(ribbonColor);
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
      var handsX = 0.10, handsY = 0.96, handsZ = 0.15;
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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
            triggerImpactFX(getSweetSpotWorldPos());
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

      // Sample bat sweet spot world position for dynamic swing trajectory trail
      var sweetWorld = new THREE.Vector3(0, -0.36, 0.028);
      batGroup.localToWorld(sweetWorld);
      addTrailPoint(sweetWorld);

      if (progress >= 1.0) {
        isSwinging = false;
        if (batsmanGroup) {
          batsmanGroup.rotation.y = 0;
          batsmanGroup.position.set(0, 0, 0.15);
        }
        if (displayMode === 'batsman') {
          batPivot.position.set(0.10, 0.96, 0.15);
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
      var isPortrait = window.innerWidth < window.innerHeight;
      var distMultiplier = isPortrait ? 1.55 : 1.0;

      if (cameraAngle === 'side') {
        orbit.theta = 0.06;
        orbit.phi = 0.16;
        orbit.radius = 2.40 * distMultiplier;
      } else if (cameraAngle === 'bowler') {
        orbit.theta = Math.PI / 2 + 0.06;
        orbit.phi = 0.18;
        orbit.radius = 2.80 * distMultiplier;
      } else if (cameraAngle === 'top') {
        orbit.theta = 0.10;
        orbit.phi = 1.15;
        orbit.radius = 3.00 * distMultiplier;
      } else if (cameraAngle === 'batsman') {
        orbit.theta = -Math.PI / 2 + 0.22;
        orbit.phi = 0.14;
        orbit.radius = 2.20 * distMultiplier;
      }

      var lookHeight = 0.88;
      lookTarget.set(0, lookHeight, 0.05);

      var cp = new THREE.Vector3(
        orbit.radius * Math.cos(orbit.phi) * Math.sin(orbit.theta),
        orbit.radius * Math.sin(orbit.phi) + lookHeight,
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
          orbit.radius * Math.sin(orbit.phi) + 0.88,
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
        camera.fov = W < H ? 46 : 38;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
        updateCameraPosition();
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

      // Real-time sweet spot velocity tracking & dynamic trajectory ribbon trail
      if (bladeMesh && batGroup) {
        var sweetWorld = new THREE.Vector3(0, -0.36, 0.028);
        batGroup.localToWorld(sweetWorld);
        if (lastTipPos.lengthSq() > 0) {
          var dist = sweetWorld.distanceTo(lastTipPos);
          var tipSpeed = dt > 0 ? dist / dt : 0;
          if (tipSpeed > 0.5) {
            addTrailPoint(sweetWorld);
          } else if (trailPositions.length > 0) {
            trailPositions.pop();
            updateTrailGeometry();
          }
        }
        lastTipPos.copy(sweetWorld);
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
              triggerImpactFX(getSweetSpotWorldPos());
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
