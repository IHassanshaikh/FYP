# Ralph Agent Instructions: Lifelike Cricket Batsman & Authentic Shot Mechanics

You are an autonomous senior graphics & biomechanics engineer working on the **Vector Bat Mobile App** (React Native, Expo v56, TypeScript, Three.js 3D visualizer).

## Your Mission

Transform the 3D cricketer in `components/LiveSwingVisualizer.tsx` from an idealized mannequin into a **lifelike human professional batsman** holding the bat naturally, executing textbook cricket shots with authentic weight transfer, footwork, and willow presentation.

---

## Autonomous Ralph Loop Workflow

1. **Read Task PRD:** Read `docs/tasks/prd.md` and find the first unchecked task `- [ ]` (`US-009`, `US-010`, `US-011`, or `US-012`).
2. **Read Progress Log:** Read `docs/tasks/progress.txt` to understand existing coordinate transforms, camera angles, and Three.js scene hierarchy.
3. **Execute Single Story:** Implement that specific story in `components/LiveSwingVisualizer.tsx`.
4. **Coordinate & Physics Rules (CRITICAL):**
   - **Pitch Orientation:** Bowler is at $+Z$, stumps are at $z = -0.65$, popping crease is at $z = 0.45$.
   - **Bat Geometry:** Bat blade extends along $-Y$. Right-hand rotation around X ($r_x$) moves blade along $z = -y \sin(r_x)$.
     - **Backlift (towards keeper/slips):** $r_x > 0$ (blade tips backward into $-Z$).
     - **Downswing & Impact (towards bowler):** $r_x < 0$ (blade drives forward into $+Z$).
     - **Follow-Through:** $r_x \le -1.5$ (blade sweeps high overhead towards boundary).
   - **Anatomical 2-Handed Bat Grip:**
     - Top hand (left hand for right-hander): grips upper handle tightly with back of hand pointing towards cover/off-side.
     - Bottom hand (right hand): rests lower down the handle with the 'V' between thumb and index finger running directly down the back spine.
     - Glove fingers: segmented sausage rolls curved naturally around the rubber grip, with leather palm wrap.
     - Forearms and elbows must stay mathematically pinned to the gloves/handle coordinates during all swing phases so wrists never disconnect or stretch.
   - **Weight Transfer & Footwork:**
     - Front-foot drives: front knee flexes to 45°, foot plants forward along line of ball, rear heel lifts onto toe with authentic spike scuff on crease.
     - Back-foot pulls/cuts: weight transfers back onto flexed rear leg, torso swivels on the ball of the back foot, front leg stabilizes.
     - Head remains still with horizontal eye-line focused on the contact point ("head over the ball").
5. **Quality Verification:**
   - Run `npx tsc --noEmit` and confirm **0 errors**.
   - Ensure Three.js r134 compatibility (no unsupported r160+ APIs).
6. **Commit Changes:**
   - Commit changes with message: `feat: [Story ID] - [Story Title]`
7. **Update PRD & Progress Log:**
   - Mark the completed story `- [x]` in `docs/tasks/prd.md` and update `scripts/ralph/prd.json` (`passes: true`).
   - Append implementation details to `docs/tasks/progress.txt`.
8. **Loop Continuation:**
   - If there are remaining unchecked stories in `docs/tasks/prd.md`, continue to the next one.
   - If ALL stories are marked `- [x]`, output:
     `<promise>COMPLETE</promise>`

---

## Technical Architecture Checklist

- **File to Edit:** `components/LiveSwingVisualizer.tsx` (contains Three.js scene, batsman mesh groups, materials, and stroke kinematics).
- **Stance Base:** `baseStanceEulerBatsman` set at `(0.05, 0.05, 0.0, 'YXZ')`.
- **Bat Pivot:** Located at `(0.12, 0.94, 0.14)` in ready stance.
- **Tone Mapping:** `ACESFilmicToneMapping` with exposure 1.25.
- **TypeScript:** Strict type compliance; no broken imports or undeclared variables.
