# Database Index Report

**File Path**: `E:\dev\.core\irika-maimaitoolbot\apps\bot\src\db\index.ts`

## Dependencies & Imports
- `better-sqlite3`: `Database` (default import)
- `better-sqlite3`: `Database` (type import as `BetterSqlite3Database`)
- `fs`: Node.js file system module (default import)
- `path`: Node.js path module (default import)
- `url`: Node.js URL module, imports `fileURLToPath`

## Functions & Classes
This file mostly runs scripts sequentially during initialization rather than exporting specific functions/classes (except the default database instance).

- **Script Body**
  - **Purpose**: Initializes a `better-sqlite3` SQLite database instance inside a `data/` directory. Applies schema definitions and schema migrations.
  - **Parameters**: None.
  - **Return type**: None (Exports `db` as default).
  - **Dependencies called**:
    - `fileURLToPath(import.meta.url)`
    - `path.dirname`, `path.resolve`, `path.join`
    - `process.cwd()`
    - `fs.existsSync`, `fs.mkdirSync`, `fs.readFileSync`
    - `new Database()`
    - `db.pragma`, `db.exec`
    - `console.log`

## Mermaid Logic Diagram
```mermaid
flowchart TD
    A[Start Initialization] --> B[Get current directory paths]
    B --> C{data directory exists?}
    C -- No --> D[Create data directory]
    C -- Yes --> E
    D --> E[Initialize better-sqlite3 database]
    E --> F[Set PRAGMA journal_mode = WAL]
    F --> G[Read schema.sql]
    G --> H[Execute schema.sql on DB]
    H --> I[Execute migration: ALTER TABLE users ADD COLUMN icon_url]
    I --> J{Error?}
    J -- Yes --> K[Ignore Error]
    J -- No --> L[Log Success]
    K --> M[Export db instance]
    L --> M
```

