# Repository Guidelines

## Project Structure & Module Organization
- `schema-viewer-react/`: Vite + React + TypeScript app. Source in `src/` (UI in `src/components`, logic in `src/lib`, styles in `src/styles.css`). Build output in `dist/`.
- `nested-tables/`: Standalone static prototype. Open `index.html` (uses `app.js`, `styles.css`).
- `components-viewer/`: Placeholder for future component demos.
- Root data files: `openapi.json`, `json.json` (example inputs/schemas).

## Build, Test, and Development Commands
- React app (run inside `schema-viewer-react/`):
  - `npm install`: install dependencies.
  - `npm run dev`: start Vite dev server.
  - `npm run build`: create production build in `dist/`.
  - `npm run preview`: locally serve the built app.
- Static prototype:
  - Open `nested-tables/index.html` directly, or serve the folder (e.g., `python -m http.server -d nested-tables 5173`).

## Coding Style & Naming Conventions
- TypeScript strict mode; prefer function components and hooks.
- Indentation: 2 spaces; keep lines focused and readable.
- Components: PascalCase files (`Columns.tsx`, `Subtable.tsx`); variables/functions camelCase.
- UI lives in `src/components`; parsing/layout logic in `src/lib`.
- No linter configured; match existing formatting and file organization.

## Testing Guidelines
- No test runner configured yet. When adding tests, colocate `*.test.ts(x)` with source and use Vitest + React Testing Library.
- Cover parsing utilities (`src/lib/*.ts`) and interactive component behavior.
- Ensure `npm run build` succeeds before merging.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- PRs: include a clear description, linked issues, reproduction steps, and screenshots/GIFs for UI changes.
- Keep PRs focused and small; update docs when adding scripts, folders, or notable behaviors.

## Security & Configuration Tips
- Do not commit secrets or proprietary schemas. Keep large example files out of version control when feasible.
- Never edit generated output (`schema-viewer-react/dist/`) by hand; regenerate via `npm run build`.

