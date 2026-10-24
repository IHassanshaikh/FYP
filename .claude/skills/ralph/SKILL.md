---
name: ralph
description: "Convert PRDs to prd.json format for the Ralph autonomous agent system. Use when you have an existing PRD and need to convert it to Ralph's JSON format. Triggers on: convert this prd, turn this into ralph format, create prd.json from this, ralph json."
user-invocable: true
---

# Ralph PRD Converter

Converts existing PRDs to the `scripts/ralph/prd.json` format that Ralph uses for autonomous execution.

---

## The Job

Take a PRD (markdown file or text) and convert it to `scripts/ralph/prd.json` in your repository.

---

## Output Format

```json
{
  "project": "[Project Name]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[Feature description from PRD title/intro]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Story title]",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Criterion 1",
        "Criterion 2",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Story Size Rule

Each story must be completable in ONE iteration (one clean context window):
- Right-sized: Add one feature, component, API endpoint, or fix.
- Always include `"Typecheck passes"` in `acceptanceCriteria`.
- Order stories by dependencies first (core/types -> logic -> UI).
