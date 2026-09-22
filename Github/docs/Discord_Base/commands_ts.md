# Analysis Report: commands.ts

## 1. File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\discord\commands.ts`

## 2. Dependencies & Imports
- **discord.js**: Imports `SlashCommandBuilder`, `AttachmentBuilder`
- **./client**: Imports `client` instance
- **../db/index**: Imports `db` instance
- **../crawler/intl**: Imports `fetchPlayerData`
- **../render/poster**: Imports `generateB50Poster`

## 3. Functions & Classes

### Variable: `commands`
- **Purpose**: Defines an array of Discord Slash Commands (`bind` and `b50`).
- **Type**: `SlashCommandBuilder[]`

### Function: `registerCommands`
- **Purpose**: Registers an event listener on the Discord client to handle incoming slash command interactions.
- **Parameters**: None
- **Return Type**: `void`
- **Calls**:
  - `client.on('interactionCreate', ...)`
  - **Inside `bind` command**:
    - `interaction.options.getString('cookie', true)`
    - `db.prepare(...)`
    - `stmt.run(...)`
    - `interaction.reply(...)`
  - **Inside `b50` command**:
    - `db.prepare(...)`
    - `stmt.get(...)`
    - `interaction.reply(...)`
    - `interaction.deferReply()`
    - `fetchPlayerData(...)`
    - `generateB50Poster(...)`
    - `AttachmentBuilder(...)`
    - `interaction.editReply(...)`

## 4. Mermaid Logic Diagram
```mermaid
flowchart TD
    A[registerCommands] --> B[client.on interactionCreate]
    B --> C{Is Chat Input Command?}
    C -- No --> D[Return]
    C -- Yes --> E{Command Name}
    
    E -- 'bind' --> F[Get cookie and user id]
    F --> G[Insert/Update user in DB]
    G -- Success --> H[Reply Success]
    G -- Error --> I[Reply Error]
    
    E -- 'b50' --> J[Get user from DB]
    J --> K{Has bound cookie?}
    K -- No --> L[Reply error: not bound]
    K -- Yes --> M[Defer reply]
    M --> N[fetchPlayerData]
    N --> O[generateB50Poster]
    O --> P[AttachmentBuilder]
    P --> Q[Edit reply with image]
    
    N -. Error .-> R[Catch Error]
    O -. Error .-> R
    R --> S[Edit/Reply generic error]
```

