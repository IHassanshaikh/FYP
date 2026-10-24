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
- [ ] Visualizer uses fixed 60Hz physics accumulator loop.
- [ ] Typecheck passes.

### US-005: Post-impact trajectory trail and sweet spot impact indicator
- [ ] 3D ribbon trail and sweet spot glow.
- [ ] Typecheck passes.
