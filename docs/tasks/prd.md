# Product Requirements Document (PRD): Vector Bat Mobile App

## 1. Overview
Vector Bat is a smart cricket bat analysis mobile application that connects to an ESP32 hardware module with IMU sensors (MPU6050 / BNO055 / ADXL375) to provide real-time 3D swing tracking, bat speed, impact shock, sweet spot accuracy, and AI-driven shot classification using Grok and Gemini.

## 2. Core Architecture
- **Framework:** React Native + Expo v56 with Expo Router in `app/`.
- **3D Engine:** Three.js r134 embedded in WebView (`components/LiveSwingVisualizer.tsx`).
- **Telemetry:** WebSocket client connecting to ESP32 at `ws://192.168.1.11:81`.
- **AI Coaching:** Multi-tier service (`services/AiShotPredictionService.ts`): Grok API primary, Gemini 1.5 Flash fallback, local physics heuristic.

## 3. Tasks & User Stories

- [x] **US-001: Procedural PBR textures & realistic proportions for 3D Batsman**
  - [x] Canvas-generated PBR textures for willow bat, jersey, pads, helmet.
  - [x] ACESFilmicToneMapping with realistic lighting.
  - [x] Correct adult Short Handle cricket bat proportions.
  - [x] Typecheck passes.

- [x] **US-002: Real-time AI Shot Prediction with Grok & Gemini APIs**
  - [x] Grok beta API integration with Gemini fallback.
  - [x] Live screen displays AI Coach prediction with provider badge.
  - [x] Typecheck passes.

- [x] **US-003: Strict offline sensor mode without synthetic mock data**
  - [x] Displays OFFLINE badge when hardware WebSocket is disconnected.
  - [x] Metrics show '--' or 0 instead of fake mock values.
  - [x] Typecheck passes.

- [x] **US-004: Fixed timestep animation loop (rAF) in LiveSwingVisualizer**
  - [x] Fixed 60Hz physics accumulator loop (`physicsStep(dt)`).
  - [x] Smooth quaternion/Euler interpolation.
  - [x] Typecheck passes.

- [x] **US-005: 3D trajectory trail and sweet spot impact indicator**
  - [x] Aerodynamic glowing ribbon trail with vertex colors.
  - [x] Radial shockwave ring on bat blade face upon impact with spark particles.
  - [x] Typecheck passes.

- [x] **US-006: Textbook Side-On Batsman Biomechanics & Anatomical Gear**
  - [x] Side-on batting stance (chest facing off-side, front shoulder pointed down pitch).
  - [x] Pro 7-cane bolster batting pads with knee roll wings and ankle wraps.
  - [x] Pro batting gloves with segmented finger rolls and two-handed 'V' grip.
  - [x] Helmet with StemGuard rear neck protector and double-bar titanium grille.
  - [x] Typecheck passes.

- [x] **US-007: Realistic Stadium Pitch, Radial Mown Grass & Floodlights**
  - [x] Clay-loam pitch texture with crease markings and footmark spike scuffs.
  - [x] Outfield with concentric radial lawn mowing stripes and grass flecks.
  - [x] 4 stadium floodlight towers with halo lens flares and contact shadows.
  - [x] Typecheck passes.

- [x] **US-008: Broadcast Camera Angles & Headroom Clearance**
  - [x] Broadcast camera presets: `side` (cover/point replay), `bowler`, `batsman` (POV), `top`.
  - [x] Headroom clearance framing across portrait and widescreen viewports.
  - [x] Typecheck passes.

- [ ] **US-009: Anatomical 2-Handed Glove Grip & Dynamic Forearm/Elbow Kinematics**
  - [ ] Top (left) hand wraps firmly around upper handle with knuckles aligned towards off-side/cover.
  - [ ] Bottom (right) hand holds lower handle with 'V' between thumb and index finger aligned down bat spine.
  - [ ] Batting gloves feature distinct segmented finger sausage rolls, reinforced thumb guards, and leather palm wrap around rubber grip.
  - [ ] Forearms and elbows dynamically track glove positions on the handle throughout all swing phases so wrists never disconnect or stretch unnaturally.
  - [ ] High leading elbow posture maintained during backlift and drive downswing.
  - [ ] Typecheck passes (`npx tsc --noEmit`).

- [ ] **US-010: Authentic Cricket Biomechanics: Footwork, Weight Transfer & Knee Flexion**
  - [ ] Front-Foot Drives (Cover, Straight, On Drive, Defence): Front leg strides forward with 45° bent knee over popping crease; rear foot rises onto toe with heel lifted off turf (authentic back-foot toe drag).
  - [ ] Back-Foot Strokes (Pull Shot, Square Cut): Weight transfers back onto flexed rear knee; torso swivels on ball of rear foot; front leg acts as stabilizing pivot.
  - [ ] Spiked cricket boots remain grounded on turf surface without clipping or floating.
  - [ ] Natural hip tilt, torso spine angle, and shoulder alignment coordinated with swing phase.
  - [ ] Typecheck passes (`npx tsc --noEmit`).

- [ ] **US-011: Head-Over-Ball Balance, Level Eyes & Willow Presentation Accuracy**
  - [ ] Head remains rock-still with level horizontal eye-line focused down pitch at incoming ball throughout stroke.
  - [ ] Bat comes down smoothly on line from 2nd slip corridor, presenting full face of the willow blade to the ball at impact.
  - [ ] Wrist roll-over at contact for grounded drives; iconic high follow-through showing maker's decal to bowler.
  - [ ] Ball impact synchronization: willow crack audio and radial shockwave trigger precisely when sweet spot reaches front pad line.
  - [ ] Typecheck passes (`npx tsc --noEmit`).

- [ ] **US-012: Anatomical Human Musculature, Jersey Cloth Shading & Equipment Polish**
  - [ ] Anatomical shoulder deltoids, defined neck, chest taper, and thigh guard contour under cricket trousers.
  - [ ] PBR fabric roughness and subtle creases on white cricket test jersey and trousers.
  - [ ] High-definition English willow grain, cane spring handle laminations, and embossed holographic decals.
  - [ ] Typecheck passes (`npx tsc --noEmit`).
