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
    var rUpperArm, rForearm, lUpperArm, lForearm, rElbow, lElbow; // Batsman arm dynamic linkage
    var lGloveGroup, rGloveGroup, lGloveAnchor, rGloveAnchor; // Pro batting gloves & IK targets
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
    var baseStanceEulerBatsman = new THREE.Euler(0.05, 0.05, 0.0, 'YXZ');
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
          batPivot.position.set(0.12, 0.94, 0.14);
          batPivot.scale.set(1.0, 1.0, 1.0);
        }
        if (batGroup) {
          batGroup.position.set(0, 0, 0);
        }
        lookTarget.set(0.02, 0.88, 0.18);
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

    function makeHaloTex() {
      return makeCanvasTex(128, 128, function(ctx, w, h) {
        var g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        g.addColorStop(0, 'rgba(255, 255, 255, 1)');
        g.addColorStop(0.25, 'rgba(210, 240, 255, 0.65)');
        g.addColorStop(0.60, 'rgba(0, 201, 123, 0.20)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    }

    function makeOutfieldTex() {
      return makeCanvasTex(512, 512, function(ctx, w, h) {
        // Deep emerald outfield base
        ctx.fillStyle = '#0F2617';
        ctx.fillRect(0, 0, w, h);
        // Concentric radial lawn mower rings
        var cx = w / 2, cy = h / 2;
        for (var r = 16; r < w; r += 26) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = ((Math.round(r / 26) % 2) === 0) ? 'rgba(34, 197, 94, 0.16)' : 'rgba(5, 46, 22, 0.30)';
          ctx.lineWidth = 15;
          ctx.stroke();
        }
        // Subtle grass blade flecks
        ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
        for (var i = 0; i < 900; i++) {
          var rx = Math.random() * w, ry = Math.random() * h;
          ctx.fillRect(rx, ry, 2, 3);
        }
      });
    }

    function makePitchTex() {
      return makeCanvasTex(256, 1024, function(ctx, w, h) {
        // Clay-loam cricket pitch base (warm tan-straw color gradient)
        var grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, '#5C4A32');
        grad.addColorStop(0.12, '#8C7352');
        grad.addColorStop(0.50, '#B39870');
        grad.addColorStop(0.88, '#8C7352');
        grad.addColorStop(1, '#5C4A32');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Grass fringe along edges
        ctx.fillStyle = 'rgba(21, 53, 35, 0.45)';
        ctx.fillRect(0, 0, 14, h);
        ctx.fillRect(w - 14, 0, 14, h);

        // Soil texture noise & seam lines
        ctx.strokeStyle = 'rgba(60, 45, 25, 0.22)';
        ctx.lineWidth = 1.2;
        for (var y = 0; y < h; y += 14) {
          ctx.beginPath();
          ctx.moveTo(10, y + (Math.sin(y * 0.1) * 3));
          ctx.lineTo(w - 10, y + (Math.cos(y * 0.12) * 3));
          ctx.stroke();
        }

        // Batsman popping crease footmark scuffs (authentic spike indentation wear patch)
        var scuffGrad = ctx.createRadialGradient(w * 0.48, h * 0.42, 4, w * 0.48, h * 0.42, 52);
        scuffGrad.addColorStop(0, 'rgba(45, 32, 16, 0.65)');
        scuffGrad.addColorStop(0.6, 'rgba(80, 60, 35, 0.35)');
        scuffGrad.addColorStop(1, 'rgba(179, 152, 112, 0)');
        ctx.fillStyle = scuffGrad;
        ctx.beginPath();
        ctx.ellipse(w * 0.48, h * 0.42, 45, 68, 0, 0, Math.PI * 2);
        ctx.fill();

        // White Crease Markings on pitch surface
        ctx.fillStyle = '#FFFFFF';
        // Popping crease line (1.22m in front of bowling crease)
        ctx.fillRect(14, h * 0.40, w - 28, 6);
        // Stumps bowling crease
        ctx.fillRect(28, h * 0.24, w - 56, 4);
        // Return creases
        ctx.fillRect(28, h * 0.24, 4, h * 0.20);
        ctx.fillRect(w - 32, h * 0.24, 4, h * 0.20);
      });
    }

    function buildStadium() {
      // Outfield ground with radial lawn stripes
      var outfieldTex = makeOutfieldTex();
      var turfGeo = new THREE.CircleGeometry(16, 64);
      var turfMat = new THREE.MeshStandardMaterial({
        map: outfieldTex,
        roughness: 0.72,
        metalness: 0.04
      });
      var turf = new THREE.Mesh(turfGeo, turfMat);
      turf.rotation.x = -Math.PI / 2;
      turf.receiveShadow = true;
      scene.add(turf);

      // Glowing outer boundary line with cushions
      var ringGeo = new THREE.RingGeometry(15.5, 15.8, 64);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0x00C97B,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.003;
      scene.add(ring);

      // Stadium boundary perimeter billboard
      var standsGeo = new THREE.CylinderGeometry(18, 18, 5, 48, 1, true);
      var standsMat = new THREE.MeshStandardMaterial({
        color: 0x071120,
        roughness: 0.85,
        metalness: 0.15,
        side: THREE.BackSide
      });
      var stands = new THREE.Mesh(standsGeo, standsMat);
      stands.position.y = 2.5;
      scene.add(stands);

      // 4 Realistic Stadium Floodlight Towers with soft halo flares
      var haloTex = makeHaloTex();
      var towerAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      for (var ti = 0; ti < towerAngles.length; ti++) {
        var a = towerAngles[ti];
        var px = Math.cos(a) * 16.8;
        var pz = Math.sin(a) * 16.8;

        // Lattice Steel Tower Mast
        var poleGeo = new THREE.CylinderGeometry(0.12, 0.22, 8.5, 8);
        var poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
        var pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 4.25, pz);
        scene.add(pole);

        // 6-LED Bank Luminaire Head
        var headGroup = new THREE.Group();
        headGroup.position.set(px, 8.6, pz);
        headGroup.lookAt(0, 1.2, 0);

        var lampFrame = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.8, 0.25),
          new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.4 })
        );
        headGroup.add(lampFrame);

        var lampGlow = new THREE.Mesh(
          new THREE.PlaneGeometry(1.3, 0.7),
          new THREE.MeshBasicMaterial({ color: 0xEEF8FF })
        );
        lampGlow.position.z = 0.13;
        headGroup.add(lampGlow);

        // Soft halo flare sprite
        var spriteMat = new THREE.SpriteMaterial({
          map: haloTex,
          color: 0xFFFFFF,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending
        });
        var flareSprite = new THREE.Sprite(spriteMat);
        flareSprite.scale.set(3.5, 3.5, 1.0);
        flareSprite.position.set(px, 8.6, pz);
        scene.add(flareSprite);

        scene.add(headGroup);
      }
    }

    function buildPitchAndStumps() {
      // Pitch strip with clay-straw canvas texture & crease markings
      var pitchTex = makePitchTex();
      var pitchGeo = new THREE.PlaneGeometry(2.4, 8.0);
      var pitchMat = new THREE.MeshStandardMaterial({
        map: pitchTex,
        roughness: 0.85,
        metalness: 0.02
      });
      var pitch = new THREE.Mesh(pitchGeo, pitchMat);
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.set(0, 0.005, 0.35);
      pitch.receiveShadow = true;
      scene.add(pitch);

      // Three Wooden Stumps & Bails (Ash wood)
      var woodMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.38, metalness: 0.02 });
      var bailMat = new THREE.MeshStandardMaterial({ color: 0xE6CCB2, roughness: 0.42, metalness: 0.01 });
      var stumpSpacing = 0.11;
      for (var i = -1; i <= 1; i++) {
        var sGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 12);
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
      return makeCanvasTex(512, 512, function(ctx, w, h) {
        // Deep midnight navy base
        var g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#0C1C38');
        g.addColorStop(0.5, '#071329');
        g.addColorStop(1, '#050D1C');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Breathable mesh weave
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        for (var x = 0; x < w; x += 10) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (var y = 0; y < h; y += 10) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Teal & Lime angled speed chevrons
        ctx.fillStyle = '#00C97B';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.15);
        ctx.lineTo(w * 0.35, 0);
        ctx.lineTo(w * 0.50, 0);
        ctx.lineTo(0, h * 0.25);
        ctx.closePath();
        ctx.fill();

        // Chest sponsor emblem: "VECTOR"
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VECTOR', w / 2, h * 0.45);
        ctx.fillStyle = '#00C97B';
        ctx.font = '900 12px sans-serif';
        ctx.fillText('SMARTBAT PRO', w / 2, h * 0.52);

        // Player team number "07" on back
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = 'bold 78px sans-serif';
        ctx.fillText('07', w / 2, h * 0.84);
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
      return makeCanvasTex(256, 512, function(ctx, w, h) {
        // Pure cricket white PU leather base
        var bg = ctx.createLinearGradient(0, 0, w, 0);
        bg.addColorStop(0, '#DDE3EA');
        bg.addColorStop(0.2, '#F4F7FB');
        bg.addColorStop(0.8, '#FFFFFF');
        bg.addColorStop(1, '#D5DEE8');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // 7 vertical cane ribs with subtle shading
        var caneWidth = w / 8;
        for (var i = 1; i <= 7; i++) {
          var cx = i * caneWidth;
          var caneGrad = ctx.createLinearGradient(cx - caneWidth/2, 0, cx + caneWidth/2, 0);
          caneGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
          caneGrad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
          caneGrad.addColorStop(0.65, 'rgba(255,255,255,0.9)');
          caneGrad.addColorStop(1, 'rgba(0,0,0,0.18)');
          ctx.fillStyle = caneGrad;
          ctx.fillRect(cx - caneWidth * 0.45, 0, caneWidth * 0.9, h);
        }

        // Horizontal knee roll bolster section (mid-pad)
        var rollY = h * 0.52;
        ctx.fillStyle = 'rgba(0, 201, 123, 0.40)';
        ctx.fillRect(10, rollY - 14, w - 20, 28);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, rollY - 14, w - 20, 28);

        // VectorBat brand logo tag on knee roll
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VECTOR', w / 2, rollY + 4);
      });
    }

    function makeWillowTex() {
      return makeCanvasTex(256, 1024, function(ctx, w, h) {
        // Grade-1 English Willow base
        var bg = ctx.createLinearGradient(0, 0, w, 0);
        bg.addColorStop(0,   '#BA8B4D');
        bg.addColorStop(0.15,'#CE9E5C');
        bg.addColorStop(0.50,'#E5BE7E');
        bg.addColorStop(0.85,'#CF9F5D');
        bg.addColorStop(1,   '#B68646');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Authentic straight willow grain lines (9 grains)
        for (var x = 20; x < w - 15; x += 24) {
          ctx.strokeStyle = 'rgba(88, 52, 14, 0.24)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x + Math.sin(x) * 4, 0);
          ctx.bezierCurveTo(
            x + Math.sin(x * 0.5) * 6, h * 0.35,
            x + Math.cos(x * 0.3) * 5, h * 0.70,
            x + Math.sin(x) * 4, h
          );
          ctx.stroke();
        }

        // Distinct sweet spot node marking (circular wood grain swirl)
        var nodeY = h * 0.58;
        ctx.strokeStyle = 'rgba(110, 68, 20, 0.18)';
        ctx.lineWidth = 1;
        for (var nr = 6; nr < 48; nr += 8) {
          ctx.beginPath();
          ctx.ellipse(w / 2, nodeY, nr * 0.7, nr, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Modern 3D laser bat sticker on front face
        ctx.fillStyle = '#0B0F19';
        ctx.fillRect(w * 0.15, h * 0.22, w * 0.70, h * 0.48);
        ctx.strokeStyle = '#00C97B';
        ctx.lineWidth = 3;
        ctx.strokeRect(w * 0.15, h * 0.22, w * 0.70, h * 0.48);

        // VectorBat brand typography
        ctx.fillStyle = '#00C97B';
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(w / 2, h * 0.44);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('VECTOR BAT', 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('ENGLISH WILLOW • PRO 100', 0, 20);
        ctx.restore();
      });
    }

    function makeGloveTex() {
      return makeCanvasTex(256, 256, function(ctx, w, h) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        // Protective finger segment blocks
        ctx.fillStyle = '#00C97B';
        ctx.fillRect(10, 10, w - 20, 36);
        ctx.fillStyle = '#0A2540';
        ctx.fillRect(10, 56, w - 20, 24);
        // Carbon fiber shield texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (var x = 0; x < w; x += 8) {
          for (var y = 90; y < h; y += 8) {
            ctx.fillRect(x, y, 4, 4);
          }
        }
      });
    }

    function makeHelmetTex() {
      return makeCanvasTex(256, 256, function(ctx, w, h) {
        var g = ctx.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, w / 2);
        g.addColorStop(0, '#1E293B');
        g.addColorStop(0.4, '#0F172A');
        g.addColorStop(1, '#050811');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Carbon weave pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (var x = 0; x < w; x += 6) {
          for (var y = 0; y < h; y += 6) {
            if ((x + y) % 12 === 0) ctx.fillRect(x, y, 3, 3);
          }
        }
      });
    }

    // ═════════════════════════════════════════════════════════
    // US-009: PRO BATTING GLOVES (Textbook 2-Handed 'V' Grip)
    // ═════════════════════════════════════════════════════════
    function buildProCricketGlove(isTopHand, gloveMat, skinMat) {
      var gGroup = new THREE.Group();

      var palmMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.88, metalness: 0.02 }); // Soft Pittards leather
      var cuffMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.95, metalness: 0.00 }); // Navy towel wristband
      var trimMat = new THREE.MeshStandardMaterial({ color: 0x00C97B, roughness: 0.35, metalness: 0.20 }); // VectorBat Emerald trim

      // 1. Elasticated Towel Wristband Cuff with Rubber Pull-Tab
      var cuffGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.038, 16);
      var cuff = new THREE.Mesh(cuffGeo, cuffMat);
      cuff.position.y = 0.022;
      cuff.castShadow = true;
      gGroup.add(cuff);

      var tabGeo = new THREE.BoxGeometry(0.012, 0.020, 0.008);
      var tab = new THREE.Mesh(tabGeo, trimMat);
      tab.position.set(0.026, 0.022, 0);
      gGroup.add(tab);

      // Wrist Anchor Group for Forearm IK targeting
      var wristAnchor = new THREE.Group();
      wristAnchor.position.set(0, 0.036, 0);
      gGroup.add(wristAnchor);

      // 2. Glove Dorsal High-Density Protective Foam Shield
      var shieldGeo = new THREE.BoxGeometry(0.040, 0.052, 0.022);
      var shield = new THREE.Mesh(shieldGeo, gloveMat);
      if (isTopHand) {
        // Top hand: knuckles face towards off-side / cover (+X / +Z)
        shield.position.set(0.018, -0.010, 0.012);
        shield.rotation.y = -0.45;
      } else {
        // Bottom hand: back of hand faces rearward / spine (-Z)
        shield.position.set(0.012, -0.010, -0.018);
        shield.rotation.y = -0.15;
      }
      shield.castShadow = true;
      gGroup.add(shield);

      // 3. Soft White Leather Palm Wrapping Handle
      var palmGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.050, 14, 1, true, 0, Math.PI * 1.35);
      var palm = new THREE.Mesh(palmGeo, palmMat);
      palm.position.y = -0.012;
      palm.rotation.y = isTopHand ? 0.35 : -0.20;
      gGroup.add(palm);

      // 4. 4 Articulated Sausage Finger Rolls Curved Around Handle
      var fingerY = [-0.030, -0.017, -0.004, 0.009];
      var fingerAngle = [-0.35, -0.15, 0.05, 0.25];
      for (var f = 0; f < 4; f++) {
        var fy = fingerY[f];
        var fa = fingerAngle[f];

        // Knuckle sausage block
        var r1Geo = new THREE.CylinderGeometry(0.0075, 0.0070, 0.018, 8);
        var r1 = new THREE.Mesh(r1Geo, gloveMat);
        r1.rotation.z = Math.PI / 2;
        r1.rotation.y = fa;
        r1.position.set(0.022 * Math.cos(fa), fy, 0.022 * Math.sin(fa));
        r1.castShadow = true;
        gGroup.add(r1);

        // Curved fingertip wrap
        var r2Geo = new THREE.CylinderGeometry(0.0065, 0.0060, 0.015, 8);
        var r2 = new THREE.Mesh(r2Geo, gloveMat);
        r2.rotation.z = Math.PI / 2;
        r2.rotation.y = fa + 0.65;
        r2.position.set(0.020 * Math.cos(fa + 0.65), fy, 0.020 * Math.sin(fa + 0.65));
        r2.castShadow = true;
        gGroup.add(r2);
      }

      // 5. Two-Piece Angled Thumb Guard Protection
      var t1Geo = new THREE.BoxGeometry(0.014, 0.024, 0.014);
      var t1 = new THREE.Mesh(t1Geo, gloveMat);
      t1.position.set(-0.016, -0.006, isTopHand ? 0.018 : -0.015);
      t1.rotation.y = isTopHand ? 0.55 : -0.55;
      t1.castShadow = true;
      gGroup.add(t1);

      var t2Geo = new THREE.BoxGeometry(0.011, 0.018, 0.012);
      var t2 = new THREE.Mesh(t2Geo, trimMat);
      t2.position.set(-0.019, 0.012, isTopHand ? 0.014 : -0.012);
      t2.castShadow = true;
      gGroup.add(t2);

      return { group: gGroup, anchor: wristAnchor };
    }

    // ═════════════════════════════════════════════════════════
    // US-009: 2-BONE ARM INVERSE KINEMATICS (IK)
    // Mathematically pins shoulders -> elbows -> wrist cuffs
    // ═════════════════════════════════════════════════════════
    var _vLWorld = new THREE.Vector3();
    var _vRWorld = new THREE.Vector3();
    var _vLWristLocal = new THREE.Vector3();
    var _vRWristLocal = new THREE.Vector3();
    var _vLShoulder = new THREE.Vector3(0.042, 1.30, 0.305);
    var _vRShoulder = new THREE.Vector3(-0.042, 1.30, -0.025);
    var _vBoneDiff = new THREE.Vector3();
    var _vBoneMid = new THREE.Vector3();
    var _vBoneDir = new THREE.Vector3();
    var _qBoneAlign = new THREE.Quaternion();
    var _upArm = new THREE.Vector3(0, 1, 0);

    function alignArmBone(boneMesh, pStart, pEnd) {
      if (!boneMesh) return;
      _vBoneDiff.subVectors(pEnd, pStart);
      var len = _vBoneDiff.length();
      if (len < 0.001) return;
      _vBoneMid.addVectors(pStart, pEnd).multiplyScalar(0.5);
      boneMesh.position.copy(_vBoneMid);
      _vBoneDir.copy(_vBoneDiff).normalize();
      _qBoneAlign.setFromUnitVectors(_upArm, _vBoneDir);
      boneMesh.quaternion.copy(_qBoneAlign);
      // Geometry base height is 1.0, so scaling by len sets height precisely to len!
      boneMesh.scale.set(1, len, 1);
    }

    function updateBatsmanArmIK() {
      if (!batsmanGroup || !lUpperArm || !lForearm || !rUpperArm || !rForearm || !lGloveAnchor || !rGloveAnchor) return;

      // Ensure scene world matrices are updated
      scene.updateMatrixWorld(true);

      // Sample glove wrist anchors in world space
      lGloveAnchor.getWorldPosition(_vLWorld);
      rGloveAnchor.getWorldPosition(_vRWorld);

      // Convert to batsmanGroup local frame
      _vLWristLocal.copy(_vLWorld);
      batsmanGroup.worldToLocal(_vLWristLocal);

      _vRWristLocal.copy(_vRWorld);
      batsmanGroup.worldToLocal(_vRWristLocal);

      var L1 = 0.26, L2 = 0.24;

      // 1. LEFT ARM (Front Arm: High Leading Elbow towards bowler)
      var armVecL = new THREE.Vector3().subVectors(_vLWristLocal, _vLShoulder);
      var dL = Math.max(0.12, Math.min(0.48, armVecL.length()));
      var d1L = (L1 * L1 - L2 * L2 + dL * dL) / (2 * dL);
      var hL = Math.sqrt(Math.max(0.001, L1 * L1 - d1L * d1L));

      var uL = armVecL.clone().normalize();
      var hintL = new THREE.Vector3(0.35, 0.40, 0.20);
      var dotL = hintL.dot(uL);
      var perpL = hintL.sub(uL.clone().multiplyScalar(dotL)).normalize();
      var elbowL = _vLShoulder.clone().add(uL.clone().multiplyScalar(d1L)).add(perpL.multiplyScalar(hL));

      alignArmBone(lUpperArm, _vLShoulder, elbowL);
      if (lElbow) lElbow.position.copy(elbowL);
      alignArmBone(lForearm, elbowL, _vLWristLocal);

      // 2. RIGHT ARM (Rear Arm: Tucked close to ribs, guiding bottom handle)
      var armVecR = new THREE.Vector3().subVectors(_vRWristLocal, _vRShoulder);
      var dR = Math.max(0.12, Math.min(0.48, armVecR.length()));
      var d1R = (L1 * L1 - L2 * L2 + dR * dR) / (2 * dR);
      var hR = Math.sqrt(Math.max(0.001, L1 * L1 - d1R * d1R));

      var uR = armVecR.clone().normalize();
      var hintR = new THREE.Vector3(0.30, -0.25, -0.15);
      var dotR = hintR.dot(uR);
      var perpR = hintR.sub(uR.clone().multiplyScalar(dotR)).normalize();
      var elbowR = _vRShoulder.clone().add(uR.clone().multiplyScalar(d1R)).add(perpR.multiplyScalar(hR));

      alignArmBone(rUpperArm, _vRShoulder, elbowR);
      if (rElbow) rElbow.position.copy(elbowR);
      alignArmBone(rForearm, elbowR, _vRWristLocal);
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
      var gloveTex   = makeGloveTex();

      var jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTex,  roughness: 0.75, metalness: 0.04 });
      var kitMat    = new THREE.MeshStandardMaterial({ color: 0xF2F5F8, roughness: 0.82, metalness: 0.00 });
      var padMat    = new THREE.MeshStandardMaterial({ map: padTex,     roughness: 0.45, metalness: 0.05 });
      var gloveMat  = new THREE.MeshStandardMaterial({ map: gloveTex,   roughness: 0.55, metalness: 0.08 });
      var skinMat   = new THREE.MeshStandardMaterial({ map: skinTex,    roughness: 0.88, metalness: 0.00 });
      var helmetMat = new THREE.MeshStandardMaterial({ map: helmetTex,  roughness: 0.28, metalness: 0.50 });
      var grillMat  = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.25, metalness: 0.85 });
      var shoeMat   = new THREE.MeshStandardMaterial({ color: 0xFAFAFC, roughness: 0.50, metalness: 0.15 });
      var soleMat   = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.90, metalness: 0.00 });

      // ═══════════════════════════════════════════════════════
      // TEXTBOOK SIDE-ON PRO CRICKETER (1.82m Athletic Build)
      // Pitch along Z: Stumps at -0.65, Bowler at +Z
      // Right-handed batsman stands side-on: chest facing +X,
      // Left shoulder pointing down pitch (+Z), head turned to bowler.
      // ═══════════════════════════════════════════════════════

      // ── FEET / CRICKET CLEATS ──
      // Right foot (back foot, grounded across popping crease line near off stump)
      var rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.24), shoeMat);
      rShoe.position.set(-0.02, 0.03, -0.05);
      rShoe.rotation.y = Math.PI / 2 + 0.15; // Pointing sideways towards cover/point
      rShoe.castShadow = true;
      batsmanGroup.add(rShoe);
      var rSole = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.016, 0.235), soleMat);
      rSole.position.set(-0.02, 0.008, -0.05);
      rSole.rotation.y = Math.PI / 2 + 0.15;
      batsmanGroup.add(rSole);

      // Left foot (front foot, planted forward towards mid-off/bowler)
      var lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.24), shoeMat);
      lShoe.position.set(0.02, 0.03, 0.38);
      lShoe.rotation.y = 0.25; // Angled 25° forward towards extra cover
      lShoe.castShadow = true;
      batsmanGroup.add(lShoe);
      var lSole = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.016, 0.235), soleMat);
      lSole.position.set(0.02, 0.008, 0.38);
      lSole.rotation.y = 0.25;
      batsmanGroup.add(lSole);

      // ── BACK LEG (Right leg: weight-bearing, flexed knee) ──
      var rShinGeo = new THREE.CylinderGeometry(0.060, 0.052, 0.42, 14);
      var rShin = new THREE.Mesh(rShinGeo, padMat);
      rShin.position.set(-0.02, 0.25, -0.05);
      rShin.rotation.y = Math.PI / 2;
      rShin.rotation.z = -0.06;
      rShin.castShadow = true;
      batsmanGroup.add(rShin);

      // Back Pad knee roll & wing
      var rKneeRoll = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), padMat);
      rKneeRoll.scale.set(1.1, 0.65, 0.85);
      rKneeRoll.position.set(-0.02, 0.46, -0.05);
      batsmanGroup.add(rKneeRoll);

      var rThighGeo = new THREE.CylinderGeometry(0.078, 0.066, 0.38, 14);
      var rThigh = new THREE.Mesh(rThighGeo, kitMat);
      rThigh.position.set(-0.01, 0.65, -0.02);
      rThigh.rotation.x = -0.10;
      rThigh.rotation.z = -0.08;
      rThigh.castShadow = true;
      batsmanGroup.add(rThigh);

      // ── FRONT LEG (Left leg: bent knee leading towards bowler) ──
      var lShinGeo = new THREE.CylinderGeometry(0.060, 0.052, 0.42, 14);
      var lShin = new THREE.Mesh(lShinGeo, padMat);
      lShin.position.set(0.02, 0.25, 0.36);
      lShin.rotation.x = -0.16;
      lShin.rotation.y = 0.30;
      lShin.castShadow = true;
      batsmanGroup.add(lShin);

      // Front Pad knee roll & protective outer wing
      var lKneeRoll = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), padMat);
      lKneeRoll.scale.set(1.1, 0.65, 0.85);
      lKneeRoll.position.set(0.02, 0.46, 0.34);
      batsmanGroup.add(lKneeRoll);

      var lWingGeo = new THREE.BoxGeometry(0.045, 0.35, 0.025);
      var lWing = new THREE.Mesh(lWingGeo, padMat);
      lWing.position.set(0.07, 0.28, 0.34);
      batsmanGroup.add(lWing);

      var lThighGeo = new THREE.CylinderGeometry(0.078, 0.066, 0.38, 14);
      var lThigh = new THREE.Mesh(lThighGeo, kitMat);
      lThigh.position.set(0.01, 0.65, 0.24);
      lThigh.rotation.x = -0.25;
      lThigh.castShadow = true;
      batsmanGroup.add(lThigh);

      // ── HIPS & PELVIS (Side-on athletic stance) ──
      var hipGeo = new THREE.CylinderGeometry(0.145, 0.130, 0.16, 16);
      var hips = new THREE.Mesh(hipGeo, kitMat);
      hips.position.set(0.00, 0.82, 0.14);
      hips.rotation.y = Math.PI / 2 - 0.20; // Aligned side-on
      hips.rotation.x = -0.08;
      batsmanGroup.add(hips);

      // ── TORSO & ATHLETIC CRICKET JERSEY ──
      var torsoGeo = new THREE.CylinderGeometry(0.170, 0.145, 0.44, 18);
      var torso = new THREE.Mesh(torsoGeo, jerseyMat);
      torso.position.set(0.00, 1.06, 0.14);
      torso.rotation.y = Math.PI / 2 - 0.25; // Side-on chest
      torso.rotation.z = -0.06; // Athletic crouch
      torso.castShadow = true;
      batsmanGroup.add(torso);

      // Upper chest & athletic shoulders
      var chestGeo = new THREE.CylinderGeometry(0.180, 0.165, 0.16, 18);
      var chest = new THREE.Mesh(chestGeo, jerseyMat);
      chest.position.set(0.00, 1.24, 0.14);
      chest.rotation.y = Math.PI / 2 - 0.25;
      chest.castShadow = true;
      batsmanGroup.add(chest);

      // Athletic Shoulder Yoke
      var shoulderGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.38, 14);
      var shoulderBar = new THREE.Mesh(shoulderGeo, jerseyMat);
      shoulderBar.position.set(0.00, 1.32, 0.14);
      shoulderBar.rotation.y = Math.PI / 2 - 0.25;
      shoulderBar.rotation.z = Math.PI / 2;
      shoulderBar.castShadow = true;
      batsmanGroup.add(shoulderBar);

      // Neck
      var neckGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.10, 14);
      var neck = new THREE.Mesh(neckGeo, skinMat);
      neck.position.set(0.01, 1.38, 0.16);
      batsmanGroup.add(neck);

      // ── CRICKET HELMET & HEAD (Turned over left shoulder to bowler at +Z) ──
      var headGroup = new THREE.Group();
      headGroup.position.set(0.01, 1.50, 0.17);
      headGroup.rotation.y = 0.10; // Eyes focused straight down the pitch at +Z
      batsmanGroup.add(headGroup);

      // Pro cricket helmet shell
      var headGeo = new THREE.SphereGeometry(0.125, 24, 20);
      var helmetMesh = new THREE.Mesh(headGeo, helmetMat);
      helmetMesh.scale.set(1.0, 1.05, 1.02);
      helmetMesh.castShadow = true;
      headGroup.add(helmetMesh);

      // Helmet peak / visor
      var peakGeo = new THREE.CylinderGeometry(0.130, 0.130, 0.022, 24, 1, false, -Math.PI * 0.55, Math.PI * 0.55);
      var peakMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.35, metalness: 0.40 });
      var peak = new THREE.Mesh(peakGeo, peakMat);
      peak.position.set(0, -0.04, 0.065);
      peak.rotation.x = 0.20;
      headGroup.add(peak);

      // Titanium face grille (double-bar Masuri pro style)
      var grillGroup = new THREE.Group();
      grillGroup.position.set(0, -0.04, 0.090);
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
      headGroup.add(grillGroup);

      // Rear neck protection: StemGuard
      var stemGeo = new THREE.BoxGeometry(0.14, 0.07, 0.035);
      var stemMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.4 });
      var stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(0, -0.06, -0.11);
      headGroup.add(stem);

      // Athlete face inside grille
      var faceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 14), skinMat);
      faceMesh.position.set(0, -0.02, 0.02);
      faceMesh.scale.set(0.9, 1.05, 1.0);
      headGroup.add(faceMesh);

      // ── ARMS & SHOULDERS (Textbook high-elbow cricket stance with 2-bone IK) ──
      var armGeo = new THREE.CylinderGeometry(0.040, 0.034, 1.0, 14);
      var forearmGeo = new THREE.CylinderGeometry(0.034, 0.028, 1.0, 14);
      var elbowGeo = new THREE.SphereGeometry(0.036, 12, 12);

      // Left arm (Front arm: leads with high elbow pointing towards bowler)
      lUpperArm = new THREE.Mesh(armGeo, jerseyMat);
      lUpperArm.castShadow = true;
      batsmanGroup.add(lUpperArm);

      lElbow = new THREE.Mesh(elbowGeo, jerseyMat);
      lElbow.castShadow = true;
      batsmanGroup.add(lElbow);

      lForearm = new THREE.Mesh(forearmGeo, skinMat);
      lForearm.castShadow = true;
      batsmanGroup.add(lForearm);

      // Right arm (Rear arm: tucked in close to ribs, guiding bottom handle)
      rUpperArm = new THREE.Mesh(armGeo, jerseyMat);
      rUpperArm.castShadow = true;
      batsmanGroup.add(rUpperArm);

      rElbow = new THREE.Mesh(elbowGeo, jerseyMat);
      rElbow.castShadow = true;
      batsmanGroup.add(rElbow);

      rForearm = new THREE.Mesh(forearmGeo, skinMat);
      rForearm.castShadow = true;
      batsmanGroup.add(rForearm);

      // ═══════════════════════════════════════════════════════
      // BAT PIVOT positioned at hands grip height (0.12, 0.94, 0.14)
      // ═══════════════════════════════════════════════════════
      batPivot = new THREE.Group();
      batPivot.position.set(0.12, 0.94, 0.14);
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

      // Pro Cricket Batting Gloves (Two-handed textbook 'V' grip)
      var lGloveRes = buildProCricketGlove(true, gloveMat, skinMat);
      lGloveGroup = lGloveRes.group;
      lGloveAnchor = lGloveRes.anchor;
      lGloveGroup.position.set(0, 0.20, 0);
      batGroup.add(lGloveGroup);

      var rGloveRes = buildProCricketGlove(false, gloveMat, skinMat);
      rGloveGroup = rGloveRes.group;
      rGloveAnchor = rGloveRes.anchor;
      rGloveGroup.position.set(0, 0.075, 0);
      batGroup.add(rGloveGroup);

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

      // Lock arms to glove cuffs in initial stance
      updateBatsmanArmIK();
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
      var rx = 0.05, ry = 0.05, rz = 0.0;
      var px = 0, py = 0, pz = 0, bodyYaw = 0;
      var handsX = 0.12, handsY = 0.94, handsZ = 0.14;
      var phaseLabel = 'READY';

      if (shot.indexOf('cover') >= 0) {
        // ═══ 1. COVER DRIVE (High elbow backlift, leaning front stride, elegant finish through extra cover) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.70; // Backlift: blade lifts backward towards slips/gully
          ry = 0.05 - ease * 0.30;
          rz = -ease * 0.15;
          pz = ease * 0.14; // Front foot steps forward towards bowler
          handsZ = 0.14 + ease * 0.06;
          phaseLabel = 'HIGH BACKLIFT (GULLY)';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = 0.75 - ease * 1.35; // Downswing: blade accelerates FORWARD (+Z) to -0.60
          ry = -0.25 + ease * 0.60; // Face opens towards extra cover (+X)
          rz = -0.15 + ease * 0.40;
          pz = 0.14 + ease * 0.08;
          handsX = 0.12 + ease * 0.08;
          handsZ = 0.20 + ease * 0.24;
          phaseLabel = 'COVER DOWNSWING';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
        } else if (progress < 0.68) {
          rx = -0.60; ry = 0.35; rz = 0.25;
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
          rx = -0.60 - ease * 1.25; // Follow-through: blade arcs UP and FORWARD into cover boundary
          ry = 0.35 + ease * 0.15;
          rz = 0.25 + ease * 0.10;
          pz = 0.22 - ease * 0.04;
          handsY = 0.94 + ease * 0.28;
          handsZ = 0.44 - ease * 0.06;
          phaseLabel = 'HIGH ELBOW FINISH';
          phaseIndicator.style.borderColor = '#FFD700';
          phaseIndicator.style.color = '#FFD700';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -1.85 + ease * (0.05 - (-1.85));
          ry = 0.50 + ease * (0.05 - 0.50);
          rz = 0.35 * (1 - ease);
          pz = 0.18 * (1 - ease);
          handsX = 0.12 + 0.08 * (1 - ease);
          handsY = 0.94 + 0.28 * (1 - ease);
          handsZ = 0.14 + 0.24 * (1 - ease);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('on') >= 0 && shot.indexOf('drive') >= 0) {
        // ═══ 2. ON DRIVE (Straight presentation down mid-on corridor with soft hands) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.65;
          ry = 0.05 - ease * 0.05;
          rz = 0.0;
          pz = ease * 0.14;
          handsZ = 0.14 + ease * 0.06;
          phaseLabel = 'STRAIGHT LIFT';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = 0.70 - ease * 1.30; // Drives forward to -0.60
          ry = 0.0 - ease * 0.32;  // Directs face towards mid-on (-X)
          rz = -ease * 0.15;
          pz = 0.14 + ease * 0.06;
          handsX = 0.12 - ease * 0.06;
          handsZ = 0.20 + ease * 0.22;
          phaseLabel = 'MID-ON DOWNSWING';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
        } else if (progress < 0.68) {
          rx = -0.60; ry = -0.32; rz = -0.15;
          pz = 0.20; handsX = 0.06; handsZ = 0.42;
          phaseLabel = '⚡ MID-ON TIMING!';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
          if (swingTime - dt < 0.58 * swingDuration) {
            triggerImpactFX(getSweetSpotWorldPos());
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = -0.60 - ease * 1.05; // Follow-through: blade extends towards bowler/mid-on
          ry = -0.32 - ease * 0.05;
          rz = -0.15 - ease * 0.10;
          pz = 0.20 - ease * 0.04;
          handsY = 0.94 + ease * 0.22;
          phaseLabel = 'CHECK FOLLOW-THROUGH';
          phaseIndicator.style.borderColor = '#38BDF8';
          phaseIndicator.style.color = '#38BDF8';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -1.65 + ease * (0.05 - (-1.65));
          ry = -0.37 + ease * (0.05 - (-0.37));
          rz = -0.25 * (1 - ease);
          pz = 0.16 * (1 - ease);
          handsX = 0.12 - 0.06 * (1 - ease);
          handsY = 0.94 + 0.22 * (1 - ease);
          handsZ = 0.14 + 0.22 * (1 - ease);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('straight') >= 0) {
        // ═══ 3. STRAIGHT DRIVE (Pure V down the ground towards bowler) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.70; // High vertical backlift
          ry = 0.05 * (1 - ease);
          rz = 0.0;
          pz = ease * 0.16;
          handsZ = 0.14 + ease * 0.06;
          phaseLabel = 'PURE VERTICAL LIFT';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = 0.75 - ease * 1.40; // Accelerates straight down to -0.65 (towards bowler)
          ry = 0.0; rz = 0.0;
          pz = 0.16 + ease * 0.06;
          handsZ = 0.20 + ease * 0.24;
          phaseLabel = 'DOWN THE V';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        } else if (progress < 0.68) {
          rx = -0.65; ry = 0.0; rz = 0.0;
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
          rx = -0.65 - ease * 1.25; // Iconic high vertical finish pointing straight down pitch
          ry = 0.0; rz = 0.0;
          pz = 0.22 - ease * 0.04;
          handsY = 0.94 + ease * 0.26;
          phaseLabel = 'ICONIC VERTICAL FINISH';
          phaseIndicator.style.borderColor = '#00C97B';
          phaseIndicator.style.color = '#00C97B';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -1.90 + ease * (0.05 - (-1.90));
          ry = 0.05 * ease;
          rz = 0.0;
          pz = 0.18 * (1 - ease);
          handsY = 0.94 + 0.26 * (1 - ease);
          handsZ = 0.14 + 0.24 * (1 - ease);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('pull') >= 0) {
        // ═══ 4. PULL SHOT (Rock back onto back foot, swivel torso, horizontal cross-bat swipe) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.80; // High backlift behind rear shoulder
          ry = 0.05 - ease * 0.65;
          rz = -ease * 0.85;
          pz = -ease * 0.12; // Weight shifts back onto rear foot
          px = -ease * 0.06;
          handsZ = 0.14 - ease * 0.06;
          handsY = 0.94 + ease * 0.22;
          phaseLabel = 'ROCK BACK ONTO BACK FOOT';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          bodyYaw = ease * 0.85;
          rx = 0.85 - ease * 1.05; // Whipping forward horizontally
          ry = -0.60 - ease * 1.35;
          rz = -0.85 + ease * 2.25;
          pz = -0.12 + ease * 0.04;
          handsX = 0.12 - ease * 0.22;
          handsZ = 0.08 + ease * 0.22;
          phaseLabel = 'HORIZONTAL CROSS-BAT SWIPE';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
        } else if (progress < 0.68) {
          rx = -0.20; ry = -1.95; rz = 1.40;
          bodyYaw = 0.85;
          pz = -0.08; px = -0.06;
          handsX = -0.10; handsZ = 0.30;
          phaseLabel = '⚡ POWER PULL IMPACT!';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
          if (swingTime - dt < 0.58 * swingDuration) {
            triggerImpactFX(getSweetSpotWorldPos());
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = -0.20 - ease * 0.45;
          ry = -1.95 - ease * 0.85;
          rz = 1.40 + ease * 0.25;
          bodyYaw = 0.85 + ease * 0.20;
          handsX = -0.10 - ease * 0.05;
          phaseLabel = 'SHOULDER WRAP FINISH';
          phaseIndicator.style.borderColor = '#EF4444';
          phaseIndicator.style.color = '#EF4444';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -0.65 + ease * (0.05 - (-0.65));
          ry = -2.80 + ease * (0.05 - (-2.80));
          rz = 1.65 * (1 - ease);
          bodyYaw = 1.05 * (1 - ease);
          pz = -0.08 * (1 - ease);
          px = -0.06 * (1 - ease);
          handsX = -0.15 + ease * (0.12 - (-0.15));
          handsZ = 0.30 + ease * (0.14 - 0.30);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('cut') >= 0) {
        // ═══ 5. SQUARE CUT (Step back & across, high hands descending slash through point) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.80; // High hands setup
          ry = 0.05 + ease * 0.85;
          rz = -ease * 0.90;
          px = ease * 0.12;
          pz = -ease * 0.08;
          handsX = 0.12 + ease * 0.10;
          handsY = 0.94 + ease * 0.20;
          phaseLabel = 'BACK & ACROSS SETUP';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = 0.85 - ease * 1.00; // Slashes down through point (+X)
          ry = 0.90 + ease * 0.45;
          rz = -0.90 + ease * 2.15;
          px = 0.12; pz = -0.08;
          handsX = 0.22 + ease * 0.15;
          handsZ = 0.06 + ease * 0.20;
          phaseLabel = 'DESCENDING SLASH THROUGH POINT';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
        } else if (progress < 0.68) {
          rx = -0.15; ry = 1.35; rz = 1.25;
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
          rx = -0.15 - ease * 0.65;
          ry = 1.35 + ease * 0.20;
          rz = 1.25 - ease * 0.45;
          handsX = 0.37 + ease * 0.08;
          phaseLabel = 'FULL EXTENSION PAST POINT';
          phaseIndicator.style.borderColor = '#A855F7';
          phaseIndicator.style.color = '#A855F7';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -0.80 + ease * (0.05 - (-0.80));
          ry = 1.55 + ease * (0.05 - 1.55);
          rz = 0.80 * (1 - ease);
          px = 0.12 * (1 - ease);
          pz = -0.08 * (1 - ease);
          handsX = 0.45 + ease * (0.12 - 0.45);
          handsZ = 0.26 + ease * (0.14 - 0.26);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('defen') >= 0) {
        // ═══ 6. FORWARD DEFENCE (Solid dead-bat wall right below eyes, soft hands, zero follow-through) ═══
        if (progress < 0.30) {
          var t = progress / 0.30;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.40; // Controlled short backlift
          ry = 0.05 * (1 - ease);
          rz = 0.0;
          pz = ease * 0.20; // Good stride forward
          handsZ = 0.14 + ease * 0.12;
          phaseLabel = 'MEASURED STRIDE FORWARD';
          phaseIndicator.style.borderColor = '#E2E8F0';
          phaseIndicator.style.color = '#E2E8F0';
        } else if (progress < 0.58) {
          var t = (progress - 0.30) / 0.28;
          var ease = t;
          rx = 0.45 - ease * 0.80; // Bat presents dead-bat wall in front of pad to -0.35
          ry = 0.0; rz = 0.0;
          pz = 0.20;
          handsY = 0.94 - ease * 0.10;
          handsZ = 0.26 + ease * 0.18;
          phaseLabel = 'SOFT HANDS BELOW EYES';
          phaseIndicator.style.borderColor = '#E2E8F0';
          phaseIndicator.style.color = '#E2E8F0';
        } else if (progress < 0.85) {
          rx = -0.35; ry = 0.0; rz = 0.0;
          pz = 0.20; handsY = 0.84; handsZ = 0.44;
          phaseLabel = '🛡️ SOLID DEFENSIVE WALL';
          phaseIndicator.style.borderColor = '#E2E8F0';
          phaseIndicator.style.color = '#E2E8F0';
          if (swingTime - dt < 0.58 * swingDuration) {
            triggerImpactFX(getSweetSpotWorldPos());
          }
        } else {
          var t = (progress - 0.85) / 0.15;
          var ease = t * t;
          rx = -0.35 + ease * (0.05 - (-0.35));
          ry = 0.05 * ease;
          rz = 0.0;
          pz = 0.20 * (1 - ease);
          handsY = 0.84 + 0.10 * ease;
          handsZ = 0.44 + ease * (0.14 - 0.44);
          phaseLabel = 'HOLD & RETURN';
        }
      } else if (shot.indexOf('sweep') >= 0) {
        // ═══ 7. SWEEP SHOT (Kneeling deep lunge skimming turf from off to fine leg) ═══
        if (progress < 0.28) {
          var t = progress / 0.28;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.45;
          ry = 0.05 - ease * 0.60;
          rz = -ease * 0.65;
          py = -ease * 0.25;
          pz = ease * 0.24;
          handsY = 0.94 - ease * 0.35;
          handsZ = 0.14 + ease * 0.18;
          phaseLabel = 'KNEELING ON TURF';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
        } else if (progress < 0.58) {
          var t = (progress - 0.28) / 0.30;
          var ease = t * t;
          rx = 0.50 - ease * 0.65;
          ry = -0.55 - ease * 1.30;
          rz = -0.65 + ease * 2.10;
          py = -0.25; pz = 0.24;
          handsX = 0.12 - ease * 0.14;
          handsZ = 0.32 + ease * 0.12;
          phaseLabel = 'TURF BROOM SWEEP';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
        } else if (progress < 0.68) {
          rx = -0.15; ry = -1.85; rz = 1.45;
          py = -0.25; pz = 0.24;
          handsX = -0.02; handsY = 0.59; handsZ = 0.44;
          phaseLabel = '⚡ FINE LEG SWEEP!';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
          if (swingTime - dt < 0.58 * swingDuration) {
            triggerImpactFX(getSweetSpotWorldPos());
          }
        } else if (progress < 0.88) {
          var t = (progress - 0.68) / 0.20;
          var ease = t * (2 - t);
          rx = -0.15 - ease * 0.40;
          ry = -1.85 - ease * 0.85;
          rz = 1.45 + ease * 0.30;
          py = -0.25 * (1 - ease * 0.6);
          phaseLabel = 'SQUARE LEG FINISH';
          phaseIndicator.style.borderColor = '#F97316';
          phaseIndicator.style.color = '#F97316';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -0.55 + ease * (0.05 - (-0.55));
          ry = -2.70 + ease * (0.05 - (-2.70));
          rz = 1.75 * (1 - ease);
          py = -0.10 * (1 - ease);
          pz = 0.24 * (1 - ease);
          handsX = -0.02 + ease * (0.12 - (-0.02));
          handsY = 0.59 + ease * (0.94 - 0.59);
          handsZ = 0.44 + ease * (0.14 - 0.44);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else if (shot.indexOf('heli') >= 0) {
        // ═══ 8. HELICOPTER SHOT (Digging yorker at toes with explosive 360° overhead propeller whirl!) ═══
        if (progress < 0.24) {
          var t = progress / 0.24;
          var ease = t * (2 - t);
          rx = 0.05 + ease * 0.60;
          ry = 0.05 - ease * 0.10;
          rz = 0.0;
          py = -ease * 0.08;
          handsY = 0.94 - ease * 0.10;
          phaseLabel = 'YORKER BLOCKHOLE CROUCH';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
        } else if (progress < 0.54) {
          var t = (progress - 0.24) / 0.30;
          var ease = t * t;
          rx = 0.65 - ease * 1.40; // Digs down to -0.75 in front of toes
          ry = -0.05 + ease * 0.35;
          rz = ease * 0.40;
          handsY = 0.84 - ease * 0.08;
          handsZ = 0.14 + ease * 0.28;
          phaseLabel = 'DIGGING BLOCKHOLE AT TOES';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
        } else if (progress < 0.62) {
          rx = -0.75; ry = 0.30; rz = 0.40;
          handsX = 0.08; handsY = 0.76; handsZ = 0.42;
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
          rx = -0.75 - ease * 1.50; // Whipping bat up and overhead
          ry = 0.30 + ease * (Math.PI * 2);
          rz = 0.40 + ease * 0.80;
          handsY = 0.76 + ease * 0.45;
          handsZ = 0.42 - ease * 0.20;
          phaseLabel = '🚁 360° HELICOPTER WHIRL OVERHEAD';
          phaseIndicator.style.borderColor = '#F43F5E';
          phaseIndicator.style.color = '#F43F5E';
        } else {
          var t = (progress - 0.88) / 0.12;
          var ease = t * t;
          rx = -2.25 + ease * (0.05 - (-2.25));
          ry = (0.30 + Math.PI * 2) + ease * (0.05 - (0.30 + Math.PI * 2));
          rz = 1.20 * (1 - ease);
          handsY = 1.21 + ease * (0.94 - 1.21);
          handsZ = 0.22 + ease * (0.14 - 0.22);
          phaseLabel = 'RETURN TO STANCE';
        }
      } else {
        // Fallback generic drive
        var t = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        rx = 0.05 - t * 0.70;
        ry = 0.0;
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

      // Batsman subtle body weight transfer
      if (batsmanGroup) {
        batsmanGroup.rotation.y = bodyYaw;
        batsmanGroup.position.set(px, py, 0.40 + pz);
      }

      // Dynamic Batsman Arms IK linkage: forearms & elbows continuously lock to batting gloves
      if (batsmanGroup && batsmanGroup.visible) {
        updateBatsmanArmIK();
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
          batPivot.position.set(0.12, 0.94, 0.14);
        }
        var baseQ = getBaseStanceQuat();
        currentStanceQuat.copy(baseQ);
        batPivot.quaternion.copy(baseQ);
        updateBatsmanArmIK();

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
      var distMultiplier = isPortrait ? 1.55 : 1.25;

      var lookHeight = 0.78;
      lookTarget.set(0.02, lookHeight, 0.18);

      if (cameraAngle === 'side') {
        // TV Broadcast Replay angle from off-side (cover/point): full side-on silhouette & swing arc
        orbit.theta = Math.PI / 2 - 0.15;
        orbit.phi = 0.12;
        orbit.radius = 2.85 * distMultiplier;
      } else if (cameraAngle === 'bowler') {
        // Main Broadcast Camera from bowler's end looking down pitch towards batsman & stumps
        orbit.theta = 0.04;
        orbit.phi = 0.14;
        orbit.radius = 3.60 * distMultiplier;
      } else if (cameraAngle === 'top') {
        // Overhead Tactical Bird's-Eye camera looking down on crease
        orbit.theta = 0.10;
        orbit.phi = 1.34;
        orbit.radius = 3.20 * distMultiplier;
        lookTarget.set(0.02, 0.10, 0.18);
      } else if (cameraAngle === 'batsman') {
        // Wicket-keeper / Umpire POV behind stumps looking down pitch to bowler
        orbit.theta = Math.PI - 0.08;
        orbit.phi = 0.16;
        orbit.radius = 2.35 * distMultiplier;
      }

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

        // Dynamic Batsman Arms IK linkage in live hardware mode
        if (batsmanGroup && batsmanGroup.visible) {
          updateBatsmanArmIK();
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

      // Always update arm IK to keep arms naturally locked to bat handle
      if (batsmanGroup && batsmanGroup.visible) {
        updateBatsmanArmIK();
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
            var sx = invertPitch ? 1 : -1;
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

            var qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pRad);
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
