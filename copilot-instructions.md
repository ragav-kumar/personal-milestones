# Project Standards: Foundry Character Checklist Module

## Purpose
- Build a Foundry VTT v13 module for Forge hosting.
- Add a per-Actor checklist for player characters.
- Keep v1 minimal, stable, and easy to extend.

## Hard Constraints
- Target Foundry VTT v13 only.
- Use TypeScript for all source code.
- Store checklist data on Actor flags.
- Use an Actor sheet button that opens a popup checklist app for v1.
- Prefer generic Actor compatibility and avoid system-specific assumptions.

## Architecture Rules
- Keep checklist logic separated into:
  - Data store layer for reading and writing Actor flags
  - UI layer for popup app and template
  - Optional behavior layer for special rules
- Use stable checklist item IDs and explicit ordering fields.
- Keep migration and defaulting logic centralized in store helpers.

## Coding Standards
- Use strict typing and avoid any unless required by external typings.
- Keep functions small and single-purpose.
- Avoid hidden side effects in UI event handlers.
- Validate user input before persistence.
- Handle missing or malformed flag data safely.

## Permissions and Safety
- Players can edit only owned actors.
- GMs can always view and edit.
- Enforce ownership checks before writes.
- Fail safely with user-facing warnings instead of hard crashes.

## Copilot Workflow Rules
- Plan first, then edit.
- For each phase, ask for a file-by-file change plan before code generation.
- Keep edits bounded to approved files.
- After each edit batch, run diagnostics and request a regression-focused review.
- Commit in small phase-sized increments.

## Testing Expectations
- Verify add, remove, toggle, and reorder checklist behavior.
- Verify persistence after actor close/reopen and world reload.
- Verify GM vs player behavior on owned and unowned actors.
- Verify no TypeScript diagnostics and no runtime console errors in happy paths.

## Out of Scope for v1
- Cross-world analytics
- Cloud sync
- Deep system-specific mechanics integration
- Features beyond checklist core behavior

## Definition of Done for v1
- Actor sheet button opens checklist popup.
- Checklist operations persist to Actor flags.
- Permission rules are enforced.
- Manifest and build output are valid for Forge deployment.
- No blocking TypeScript errors in module source.
