# UX requirements

## Screens

### Protocol selection
- Provide a list of available protocols with version labels and brief descriptions.
- Allow searching and filtering by assay type and last updated date.
- Show a quick preview of required inputs and estimated run time.

### Plan builder
- Build a step-by-step plan with editable stages (sample prep, incubation, wash, readout).
- Allow reordering and duplication of steps for repeated cycles.
- Display required consumables and volumes per step.

### Checklist
- Present a run-ready checklist grouped by step with per-item completion toggles.
- Highlight blockers and missing inputs before run start.
- Persist progress locally for resume.

### Uploads
- Support photo uploads for plates and instrument screens.
- Support CSV uploads for plate maps and measurement data.
- Show upload status, validation results, and retry actions.

### Summary
- Summarize protocol, run parameters, and outcomes.
- Display key metrics and links to uploaded artifacts.
- Provide export options for report and raw data.

## Incubation timers and reminders
- Timers are created per incubation step with clear start/end times.
- Provide reminders 5 minutes before completion and on completion.
- Support pause/resume with automatic adjustment of remaining time.
- Show active timers on all screens and allow quick navigation to the current step.

## Parameter validation
- Validate required fields before run start and before each step.
- Enforce numeric ranges for temperature, time, and volume.
- Validate CSV structure (headers, required columns, and row count).
- Show inline validation messages and a summary of errors.

## Quick start (templates)
- Provide templates for common protocols (e.g., standard ELISA, sandwich ELISA).
- Allow cloning a recent run into a new plan.
- Offer a minimal "guided" template with defaults and tips.

## Offline mode and draft
- Allow drafting a plan and checklist offline with local persistence.
- Queue uploads and sync when connection is restored.
- Indicate offline status and last sync time.
- Protect drafts from accidental loss with explicit discard action.
