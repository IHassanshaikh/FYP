# Ralph Agent Instructions

You are an autonomous coding agent working on the **Vector Bat Mobile App** (React Native, Expo v56, TypeScript, Three.js 3D visualizer).

## Your Task

1. Read the PRD at `scripts/ralph/prd.json` (or `prd.json` in the current directory)
2. Read the progress log at `scripts/ralph/progress.txt` (read `## Codebase Patterns` first)
3. Check you're on the correct branch from PRD `branchName`.
4. Pick the **highest priority** user story where `passes: false`.
5. Implement that single user story.
6. Run quality checks (`npx tsc --noEmit`).
7. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
8. Update `prd.json` to set `passes: true` for the completed story.
9. Append your progress to `progress.txt`.

## Quality Requirements

- Work on ONE story per iteration.
- All TypeScript types must check out cleanly (`npx tsc --noEmit`).
- Do NOT commit broken code.
- Keep changes focused and minimal.

## Stop Condition

If ALL stories in `prd.json` have `passes: true`, reply with:
<promise>COMPLETE</promise>

Otherwise, finish your response normally so the next iteration starts cleanly.
