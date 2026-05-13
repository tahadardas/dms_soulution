# DMS SOULUTION Monorepo

This project is a monorepo containing the following components:

- **`apps/web`**: React + Vite + TypeScript (Presentation Layer)
- **`apps/api`**: Node.js + Fastify + TypeScript (SQLite Backend)
- **`apps/desktop`**: Electron + TypeScript (Desktop Wrapper)
- **`packages/shared`**: Shared Zod schemas and types
- **`packages/ui`**: Shared UI components and design tokens

## Prerequisites

- Node.js (v18+)
- NPM (v9+)

## Setup

1. Install dependencies (from root):
   ```bash
   npm install
   ```

## Development

Run all applications simultaneously (API, Web, Desktop):

```bash
npm run dev
```

Or run individually:

- **API**: `npm run dev:api` (Port 3000)
- **Web**: `npm run dev:web` (Port 5173)
- **Desktop**: `npm run dev:desktop`

## Authentication (Local Dev)

For a fresh database, a default admin user is seeded:

- **Username**: `admin`
- **Password**: `admin123`

The default admin is marked as `must_change_password` and must change the password after first login. Production startup is blocked if the database contains the default `admin/admin123` credential.

For a fresh production database, set `DMS_BOOTSTRAP_ADMIN_PASSWORD` to create the initial admin account. That password is treated as temporary and must be changed after first login.

## Tests

Run API integration tests:

```bash
npm run test --workspace=@dms/api
```

## Environment

Copy `.env.example` and configure:

- `DMS_DB_PATH`: database path. Use `:memory:` for tests.
- `JWT_SECRET`: required in production; must not be the development default.
- `REFRESH_SECRET`: required in production; must not be the development default.
- `DMS_CORS_ORIGINS`: required in production; comma-separated explicit origins. `*` is rejected.
- `DMS_BOOTSTRAP_ADMIN_PASSWORD`: required only when bootstrapping the first production admin.
- `DMS_HOST` / `DMS_PORT`: API bind host and port.

## LAN Usage

To access the application from other devices on the LAN:
1. Ensure the API host is set to `0.0.0.0` (Already configured in `apps/api/src/index.ts`).
2. Access via `http://YOUR_PC_IP:5173`.
3. Note: The Web app requires the API to be reachable. The Vite proxy works for local development. For LAN, set the API base URL in **POS → Station Settings** to `http://YOUR_PC_IP:3000`.

## Architecture

- **SQLite**: The database file `dms.db` is located in the root directory (or configured path). Only `apps/api` writes to it.
- **Shared Code**: Schemas and UI components are shared via standard npm packages within the workspaces.
