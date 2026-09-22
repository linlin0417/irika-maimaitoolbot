# Analysis Report: backup.ts

## 1. File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\discord\commands\backup.ts`

## 2. Dependencies & Imports
- **External Libraries:**
  - `discord.js`: `SlashCommandBuilder`, `AttachmentBuilder`, `ChatInputCommandInteraction` (type)
- **Node.js Built-ins:**
  - `fs`, `path`
- **Internal Modules:**
  - `../../db/index.js`: `db`

## 3. Functions & Classes

### `data` (Exported Constant)
- **Purpose**: Defines the Discord slash command configuration for the `backup` command, including an optional `user` argument for administrators.
- **Type**: `SlashCommandBuilder`

### `execute`
- **Purpose**: Gathers a user's entire profile, score, and collection data from the SQLite database, saves it into a JSON file (`.imaidata`), and sends the file to the user via Direct Message (or as an ephemeral reply as fallback). Administrators can specify another user to back up.
- **Parameters**:
  - `interaction` (`ChatInputCommandInteraction`): The user's command interaction.
- **Return Type**: `Promise<void | InteractionResponse>`

## 4. Mermaid Logic Diagram
```mermaid
flowchart TD
    Start([Start execute]) --> Defer[interaction.deferReply(ephemeral)]
    Defer --> CheckArgs[Check optional 'user' argument]
    CheckArgs --> HasUser{Specified user?}
    HasUser -- Yes --> IsAdmin{Is Admin?}
    IsAdmin -- No --> ReplyAdminErr[interaction.editReply: Admin only] --> End([End])
    IsAdmin -- Yes --> SetTarget[targetUser = specifiedUser]
    HasUser -- No --> SetSelf[targetUser = interaction.user]
    SetTarget --> FetchUser[db.prepare: GET user]
    SetSelf --> FetchUser
    FetchUser --> UserExists{User exists?}
    UserExists -- No --> ReplyNoUser[interaction.editReply: Not found] --> End
    UserExists -- Yes --> FetchData[Fetch scores, history, titles, plates, frames]
    FetchData --> BuildJSON[Construct JSON backupData]
    BuildJSON --> WriteFile[fs.writeFileSync to temp file]
    WriteFile --> SendDM[Try: interaction.user.send(Attachment)]
    SendDM -- Success --> ReplySuccess[interaction.editReply: Sent to DM] --> Cleanup
    SendDM -- Fail --> CatchDM[Log error, interaction.editReply: Send file in channel] --> Cleanup
    Cleanup[Finally: delete temp file] --> End
```

