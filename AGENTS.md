# AGENTS

## Naming standards
- Use PascalCase for class names, React/Vue components, and TypeScript/JavaScript types/interfaces.
- Use camelCase for variables, functions, methods, and file names where applicable.

## UI conventions (Telegram WebApp components)
- Prefer Telegram WebApp UI elements (MainButton, BackButton, HapticFeedback, theme-aware colors).
- Respect Telegram theme variables for backgrounds, text, and accent colors.
- Avoid custom UI patterns when a Telegram WebApp component exists for the same purpose.

## Experiment step logging
- Log each experiment step with a clear, structured message.
- Include step name, timestamp, and status (started/finished/failed) in logs.

## Protocol formats
- Protocols must be defined as JSON Schema documents.
- Schemas should include versioning and required fields.

## File storage approach
- Store images in `images/` and tabular data in `csv/`.
- Keep raw and processed artifacts separated when applicable.

## Minimum checks before PR
- Run unit tests for touched modules.
- Run linting/formatting checks if configured.
- Verify JSON Schema validity for any protocol changes.
