# DMS SOULUTION — Packaging Guide (Developer)

This guide explains how to build and package the application for production.

## 1. Prerequisites
- Node.js (v18 or v20 recommended).
- Windows OS (required for building Windows installer).

## 2. Build Process
Run the following command from the root directory:
```bash
npm run package:windows
```
This command performs:
1. `npm run build`: Compiles all workspaces (Shared, UI, API, Web, Desktop).
2. `npm run dist`: Triggers `electron-builder` in `apps/desktop`.

## 3. Package Structure
The installer includes:
- **Electron Application**: The main executable.
- **API Dist**: Bundled in `resources/api/dist`.
- **Web Dist**: Bundled in `resources/web-dist`.
- **Migrations**: Included in `resources/api/src/db/migrations`.
- **Node Modules**: Production dependencies for the API are bundled.

## 4. Lifecycle Management
In production (`app.isPackaged`), Electron spawns the API as a child process:
- **Runtime**: Uses `process.execPath` (Electron's Node).
- **Entry**: `resources/api/dist/index.js`.
- **Port**: Defaults to `4780`.
- **DB Path**: `C:\DMS\data\dms.db`.

## 5. Persistence Logic
We use a fixed path `C:\DMS` for persistence to ensure that:
1. Database is not deleted when the app is updated (which typically replaces `AppData/Local/Programs/dms-soulution`).
2. Logs and Backups are easily accessible for support.

## 6. Troubleshooting Build
- **Native Modules**: If `better-sqlite3` fails, ensure you run `electron-rebuild` or use the correct Node version.
- **Assets missing**: Check `apps/desktop/electron-builder.json5` paths.
- **Verification**: Run `npm run verify:package` to check assets before packaging.

## 7. Versioning
Update version in:
- `apps/desktop/package.json`
- `apps/api/package.json`
- `apps/web/package.json`
Then rebuild and package.
