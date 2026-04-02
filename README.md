# Personal Milestones

Foundry VTT v13 module scaffold for per-Actor checklist milestones.

## Current Status
- Repo standards file created in copilot-instructions.md
- TypeScript + esbuild scaffold created
- Module manifest configured for Forge install via GitHub tag URLs
- Milestones now render as a Character sheet tab (legacy + ApplicationV2 hooks)
- Checklist data persists on Actor flags with global and actor-specific milestone sources
- World settings added for top matter markdown, global milestone template JSON, and level requirement JSON
- GM-only actor-specific milestone add/remove controls implemented
- Owners and GMs can toggle milestone checks; uncheck is supported for correction
- Progress counter tracks milestones claimed for the current level and supports reset
- First-time claim auto-grants inspiration when the actor does not already have it
- Check and uncheck actions post formatted chat messages

## Release Status
- Latest release tag: v0.2.0
- Manifest URL: https://raw.githubusercontent.com/ragav-kumar/personal-milestones/v0.2.0/module.json
- Download URL: https://codeload.github.com/ragav-kumar/personal-milestones/zip/refs/tags/v0.2.0

## Forge Testing Workflow
1. Build and type-check locally:
   npm run check
2. Install or update in Forge using the manifest URL above.
3. In test world, verify:
   - Milestones tab appears on character sheets
   - Top matter and section defaults load from module settings
   - Global milestones sync to existing actors after settings edits
   - GM can add/remove actor-specific milestones
   - Owner can check and uncheck milestones
   - Progress counter updates and reset clears only the claimed counter
   - First-time claim grants inspiration only if actor lacks inspiration

## Setup
1. Install dependencies:
   npm install
2. Build module bundle:
   npm run build
3. Rebuild while developing:
   npm run watch
4. Type-check source:
   npm run typecheck
5. Lint source:
   npm run lint
6. Run standard validation (lint + typecheck + build):
   npm run check

## Learning Notes
- See docs/DEVELOPER_GUIDE.md for Foundry-specific architecture and implementation explanations.

## Next Phase
Implement special behavior rules and permission-focused test pass.

## Documentation Maintenance
- Keep this README updated whenever project status changes significantly.
- Update Current Status, Release Status, and workflow notes in the same commit as major feature or deployment changes.
