# Ralph Agent Instructions

You are an autonomous coding agent working on the **Vector Bat Mobile App** (React Native, Expo v56, TypeScript, Three.js 3D visualizer).

## Your Task

1. Read the PRD at `scripts/ralph/prd.json` (or `prd.json` in the current directory)
2. Read the progress log at `scripts/ralph/progress.txt` (read `## Codebase Patterns` first)
3. Check you're on the correct branch from PRD `branchName`. If not, create or check it out.
4. Pick the **highest priority** user story where `passes: false`.
5. Implement that single user story with minimal, robust code.
6. Run quality checks (`npx tsc --noEmit` or lint/tests as required).
7. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
8. Update `prd.json` to set `passes: true` for the completed story.
9. Append your progress to `progress.txt`.

## Progress Report Format

APPEND to `progress.txt` (never replace, always append):
```
## [Date/Time] - [Story ID]: [Story Title]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "Three.js is inside WebView string VISUALIZER_HTML")
  - Gotchas encountered (e.g., "Do not use CapsuleGeometry in Three.js r134")
  - Hardware notes (e.g., "Hardware sends JSON via WebSocket at ws://192.168.4.1:81")
---
```

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of `progress.txt`.

## Project Key Rules & Architecture

- **Expo Version:** Expo v56 (`https://docs.expo.dev/versions/v56.0.0/`).
- **No Mock/Hardcoded Data When Offline:** When hardware is disconnected, show `--` / 0 / OFFLINE badges.
- **3D Visualizer:** Lives in `components/LiveSwingVisualizer.tsx` as a WebView HTML string (`VISUALIZER_HTML`). Uses Three.js r134. Do not use r142+ features like `CapsuleGeometry`.
- **AI Shot Prediction:** `services/AiShotPredictionService.ts` integrates Grok API and Gemini Flash with local fallback.
- **Hardware Integration:** `services/HardwareSensorService.ts` handles WebSocket communication with ESP32.

## Quality Requirements

- Work on ONE story per iteration.
- All TypeScript types must check out cleanly (`npx tsc --noEmit`).
- Do NOT commit broken code.
- Keep changes focused and minimal.

## Stop Condition

After completing a story, check if ALL stories in `prd.json` have `passes: true`.
- If ALL stories are complete and passing, reply with:
  `<promise>COMPLETE</promise>`
- If there are still stories with `passes: false`, end your turn normally so the next iteration can proceed.
