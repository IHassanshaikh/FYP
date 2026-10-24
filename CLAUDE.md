# Vector Bat Mobile App - Assistant Instructions

@AGENTS.md

## Autonomous Ralph Loop
This repository is configured with the **Ralph Wiggum autonomous agent loop** (`snarktank/ralph`):
- Run on Linux/macOS/Git Bash: `npm run ralph` or `./scripts/ralph/ralph.sh`
- Run on Windows PowerShell: `npm run ralph:win` or `powershell -ExecutionPolicy Bypass -File scripts/ralph/ralph.ps1`
- PRD requirements: `scripts/ralph/prd.json`
- Progress & learnings: `scripts/ralph/progress.txt`
- Loop agent instructions: `scripts/ralph/CLAUDE.md`

## Key Architecture & Constraints
- **Expo Framework:** Expo v56 with Expo Router (`app/`).
- **TypeScript:** Strict types (`npx tsc --noEmit`).
- **3D Visualizer:** Three.js r134 inside WebView (`components/LiveSwingVisualizer.tsx`). Do NOT use `CapsuleGeometry` (r142+); use `CylinderGeometry`.
- **Sensors:** Real-time WebSocket connection to ESP32 (`services/HardwareSensorService.ts`). Never simulate mock data when offline.
- **AI Shot Classification:** Grok primary with Gemini Flash fallback in `services/AiShotPredictionService.ts`.
