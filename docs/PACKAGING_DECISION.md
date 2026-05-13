# DMS SOULUTION — Packaging Architectural Decision

## Decision: Option A — Integrated API (Child Process)

For the initial production packaging of DMS SOULUTION, we have chosen **Option A**.

### Architecture Overview
1. **Host**: Electron Desktop Application.
2. **Lifecycle**: Electron main process spawns the API as a background child process using `node` or a bundled executable.
3. **Database**: SQLite database stored in a persistent user data directory (`C:\DMS\data\dms.db`).
4. **Communication**: Electron Renderer (Web UI) communicates with the local API via `http://localhost:4780`.
5. **Print Agent**: Embedded within the Electron main process, polling the local API.

### Why Option A?
- **Seamless Installation**: Users only need to install one application. No need to manage Windows Services.
- **Dependency Isolation**: All dependencies are bundled. The system does not require pre-installed Node.js.
- **Resource Management**: Closing the app cleanly shuts down the API, preventing ghost processes.
- **Standard POS Workflow**: Most restaurant stations are standalone or primary stations where the UI and API live together.

### Future Transition to Option B
While Option A is default, the build system will be designed to allow the API build to be extracted and run as a standalone Windows Service (Option B) for multi-terminal network setups if required in the future.

### Persistent Data Locations
To ensure data safety during updates:
- **Application**: `C:\Program Files\DMS SOULUTION\`
- **Data**: `C:\DMS\data\`
- **Config**: `C:\DMS\config\dms.config.json`
- **Backups**: `C:\DMS\backups\`
- **Logs**: `C:\DMS\logs\`
