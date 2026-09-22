# autobackup.ts Analysis Report

## File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\core\autobackup.ts`

## Dependencies & Imports
*   `node-cron`: External library for cron scheduling.
*   `discord.js`: External library (`AttachmentBuilder`, `Client`, `TextChannel`) for Discord interactions.
*   `fs`: Node.js built-in for file system operations.
*   `path`: Node.js built-in for path manipulations.
*   `adm-zip`: External library for creating zip archives.
*   `./settings.js`: Internal module (`getSettings`) for retrieving bot settings.

## Functions & Classes

### `startAutoBackup`
*   **Purpose**: Initializes a cron job that automatically backs up the SQLite database (and its WAL/SHM files) twice a day (at 00:00 and 12:00) and sends the backup as a ZIP file to a specified Discord channel.
*   **Parameters**:
    *   `client` (`Client`): The Discord.js client instance used to fetch channels and send messages.
*   **Return Type**: `void`
*   **Calls**:
    *   `cron.schedule`: Sets up the cron job.
    *   `getSettings`: Retrieves configuration to find the backup channel ID.
    *   `client.channels.fetch`: Fetches the Discord channel by ID.
    *   `path.resolve`: Resolves paths for the database and backup zip.
    *   `fs.existsSync`, `fs.unlinkSync`: Checks for file existence and deletes temporary files.
    *   `AdmZip` constructor, `addLocalFile`, `writeZip`: Creates and writes the zip archive.
    *   `AttachmentBuilder` constructor: Prepares the Discord attachment.
    *   `(channel as TextChannel).send`: Sends the message with the attachment.

## Mermaid Logic Diagram
```mermaid
flowchart TD
    A[startAutoBackup(client)] --> B[cron.schedule('0 0,12 * * *')]
    B --> C[Cron Job Triggered]
    C --> D[getSettings()]
    D --> E{Has Backup Channel ID?}
    E -- No --> F[Log Warning & Return]
    E -- Yes --> G[client.channels.fetch()]
    G --> H{Is Text Channel Valid?}
    H -- No --> I[Log Warning & Return]
    H -- Yes --> J{Does DB exist?}
    J -- No --> K[Log Warning & Return]
    J -- Yes --> L[Create AdmZip]
    L --> M[zip.addLocalFile(db)]
    M --> N[Check and add WAL/SHM files]
    N --> O[zip.writeZip(zipPath)]
    O --> P[AttachmentBuilder(zipPath)]
    P --> Q[channel.send(attachment)]
    Q --> R[fs.unlinkSync(zipPath)]
    R --> S[Finish]
```

