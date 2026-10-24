# PRD: Vector Bat Mobile App Enhancements

## Introduction
Vector Bat is a smart cricket bat analysis application connecting ESP32 MPU6050/BNO055 IMU sensors to provide real-time 3D swing tracking, bat speed, impact power, and AI-driven shot classification using Grok and Gemini.

## Goals
- Deliver high-fidelity, non-cartoonish 3D visual feedback of batsman swing mechanics.
- Real-time shot recommendation and flaw diagnosis using multimodal LLMs.
- Autonomous development and test cycle via the Ralph loop.

## User Stories

### US-001: Procedural PBR textures & realistic proportions for 3D Batsman
- [x] Batsman model uses canvas-generated PBR textures for willow bat, jersey, pads, and helmet.
- [x] Renderer uses ACESFilmicToneMapping with realistic lighting.
- [x] Typecheck passes.

### US-002: Real-time AI Shot Prediction with Grok & Gemini
- [x] Multi-tier AI shot service with Grok primary and Gemini fallback.
- [x] Display AI Coach analysis with provider badge.
- [x] Typecheck passes.

### US-003: Strict offline sensor mode
- [x] Disconnected hardware displays OFFLINE without fake data.
- [x] Typecheck passes.

### US-004: Fixed timestep animation loop (rAF) in visualizer
- [x] Visualizer uses fixed 60Hz physics accumulator loop.
- [x] Typecheck passes.

### US-005: Post-impact trajectory trail and sweet spot impact indicator
- [x] 3D ribbon trail and sweet spot glow.
- [x] Typecheck passes.

### US-006: Textbook side-on batsman stance & anatomical pro gear
- [x] Authentic side-on cricket stance with 7-cane bolster pads, batting gloves with finger rolls, and helmet grille.
- [x] Typecheck passes.

### US-007: Realistic stadium pitch, radial grass outfield & floodlights
- [x] Clay-loam pitch with crease markings and spike scuffs, radial lawn mower pattern, 4 floodlight towers.
- [x] Typecheck passes.

### US-008: Broadcast camera angles & kinematic stroke animations
- [x] Broadcast TV camera presets (`side`, `bowler`, `batsman`, `top`) with clean headroom framing.
- [x] Typecheck passes.

