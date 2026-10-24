# Ralph Agent Instructions

You are an autonomous coding agent working on the **Vector Bat Mobile App** (React Native, Expo v56, TypeScript, Three.js 3D visualizer).

## Your Task

1. Read the PRD at `docs/tasks/prd.md` or `scripts/ralph/prd.json`
2. Read the progress log at `docs/tasks/progress.txt` (read `## Codebase Patterns` first)
3. Pick the next uncompleted task or user story where checkbox is unchecked `- [ ]`.
4. Implement that task thoroughly.
5. Run quality checks (`npx tsc --noEmit`).
6. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
7. Update `docs/tasks/prd.md` to check the box `- [x]`.
8. Append your progress to `docs/tasks/progress.txt`.

## Quality Requirements

- Work on ONE story per iteration.
- All TypeScript types must check out cleanly (`npx tsc --noEmit`).
- Do NOT commit broken code.
- Keep changes focused and minimal.

## Stop Condition

If ALL stories have `passes: true` or `- [x]`, reply with:
<promise>COMPLETE</promise>
