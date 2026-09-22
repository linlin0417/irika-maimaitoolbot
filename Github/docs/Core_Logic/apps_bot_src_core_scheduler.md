# scheduler.ts Analysis Report

## File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\core\scheduler.ts`

## Dependencies & Imports
*   `node-cron`: External library for cron scheduling.
*   `../db/index.js`: Internal module providing the SQLite database connection (`db`).
*   `./crawler-service.js`: Internal module (`runCrawlerForUser`).
*   `./song-db.js`: Internal module (`SongDatabase`).
*   `discord.js`: External library for Discord typings (`Client`).

## Functions & Classes

### `startScheduler`
*   **Purpose**: Initializes background jobs (cron schedules). Includes syncing the song database daily and running the user data crawler periodically.
*   **Parameters**:
    *   `client` (`Client | undefined`): The Discord.js client. Optional.
*   **Return Type**: `void`
*   **Calls**:
    *   `SongDatabase.getInstance()`: Gets the SongDB singleton.
    *   `cron.schedule`: Registers multiple cron jobs.
    *   `songDb.syncFromServer()`: Triggers DB sync immediately and via cron.
    *   **Internal function `crawlAllUsers`**:
        *   `db.prepare(...).all()`: Retrieves all registered users with Sega credentials.
        *   `runCrawlerForUser`: Triggers crawling for each user.
        *   `client.users.fetch`: Fetches a Discord user to send DMs.
        *   `dcUser.send`: Sends a DM if there are new/improved records.
        *   `setTimeout`: Adds a random delay between user crawls to avoid rate limits.

## Mermaid Logic Diagram
```mermaid
flowchart TD
    A[startScheduler(client)] --> B[SongDatabase.getInstance()]
    B --> C[Register Cron: 06:30 Sync SongDB]
    C --> D[Define crawlAllUsers()]
    D --> E[Register Cron: 06:10, 09:10... crawlAllUsers]
    E --> F[Register Cron: 00:50 crawlAllUsers]
    F --> G[songDb.syncFromServer() Initial Sync]
    
    subgraph crawlAllUsers Logic
        H[Fetch all users from DB] --> I{For each user}
        I -->|User| J[runCrawlerForUser(discord_id)]
        J --> K{New or improved records?}
        K -- Yes --> L[client.users.fetch()]
        L --> M[Send DM to user]
        K -- No --> N[Random Sleep 5-15s]
        M --> N
        N --> I
        I -->|Done| O[Finish Batch]
    end
```


