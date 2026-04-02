# Developer Guide (Foundry VTT Notes)

This guide explains the Foundry-specific patterns used by this module so you can reuse them in your own modules.

## 1) Where Module Logic Starts

Entrypoint: src/module.ts

- Foundry runs module code and then fires lifecycle hooks.
- This module uses `Hooks.once("init")` to register settings.
- UI wiring happens on sheet render hooks:
  - `renderActorSheet` for older/legacy sheet render flow.
  - `renderApplicationV2` for newer v13+ flow.

Why both hooks?
- Systems and sheet implementations are not all uniform yet.
- Supporting both makes tab injection more reliable across sheet implementations.

## 2) How Data Is Stored (Actor Flags)

File: src/checklist/store.ts

- Milestone data is saved on each Actor using Foundry flags.
- Pattern used:
  - read: `actor.getFlag(moduleId, key)`
  - write: `actor.setFlag(moduleId, key, value)`

Why Actor flags?
- Per-actor persistence is simple and built into Foundry.
- No external database and no compendium writes required.

## 3) Global vs Actor-Specific Milestones

Files: src/checklist/settings.ts and src/checklist/store.ts

- Global milestone templates come from world settings JSON.
- Actor-specific milestones are stored directly in actor state and only GMs can add/remove them.
- On each state read/write, global templates are merged into actor state.

Important behavior:
- Global milestones are identified by deterministic IDs derived from section + label.
- This preserves completion state even if templates are reloaded.

## 4) Progress Model

File: src/checklist/store.ts

- `progress.claimedIds` tracks milestones claimed for current level progression.
- Completion history remains on each item (`completed`), while claimed counter can be reset.
- When actor level changes, only the claimed counter is reset.

This matches the requirement: reset progression counter without erasing milestone completion history.

## 5) Inspiration + Chat Side Effects

File: src/checklist/store.ts

When a milestone is toggled:
- Post a chat message describing claim/uncheck and current progress.
- If this is the first time that specific milestone was checked and actor has no inspiration,
  grant inspiration.

This side effect logic is centralized in `toggleMilestone`.

## 6) Sheet Tab Injection Pattern

File: src/module.ts

- Find actor sheet navigation and body containers.
- Inject a tab button into nav if missing.
- Inject a tab pane into body if missing.
- Re-render pane HTML from current actor state.
- Bind event listeners after each render.

Why re-bind listeners each render?
- `pane.innerHTML = ...` replaces DOM nodes, which removes old listeners.

## 7) Markdown Rendering in Foundry

File: src/module.ts

- Top matter is stored as markdown in world settings.
- Module uses `TextEditor.enrichHTML(...)` to render markdown into safe HTML.

## 8) TypeScript + Foundry Typings Reality

Files: src/checklist/settings.ts and src/module.ts

You will sometimes see casts around Foundry APIs. Common reasons:
- Typings lag runtime behavior.
- Generic typing for custom settings keys can be narrower than actual usage.

Practical rule:
- Keep casts local and documented.
- Prefer runtime-safe checks before casts.

## 9) Good Next Improvements

If you continue learning from this code, strong next steps are:

1. Move tab markup to a Handlebars template instead of string-building in TS.
2. Add migration helpers for future flag schema versions.
3. Add tests for merge behavior (global templates + actor-specific milestones).
4. Add localization keys for user-facing text (i18n).