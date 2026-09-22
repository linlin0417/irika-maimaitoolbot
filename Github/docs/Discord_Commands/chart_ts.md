# Analysis Report: chart.ts

## 1. File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\discord\commands\chart.ts`

## 2. Dependencies & Imports
- **External Libraries:** `discord.js`
- **Node.js Built-ins:** `path`, `fs`
- **Internal Modules:** `../../db/index`, `../../render/charts`, `../../core/song-db`

## 3. Functions & Classes

### `data`
- Defines the `chart` slash command, with options for `song_name`, `difficulty`, and `debug`.

### `autocomplete`
- Provides autocomplete suggestions for the `song_name` option by querying the `SongDatabase`.

### `execute`
- Handles execution of the `/chart` command. Retrieves score history, ensures enough data points exist, invokes renderer to generate a growth chart, and sends image.

## 4. Mermaid Logic Diagram
```mermaid
flowchart TD
    Start([Start execute]) --> Defer[interaction.deferReply()]
    Defer --> QueryDB[db.prepare: Fetch score_history]
    QueryDB --> CheckLen1{Records < 2?}
    CheckLen1 -- Yes --> BuildDebugNoRec[Build debug info if enabled] --> ReplyNoRec[interaction.editReply] --> End([End])
    CheckLen1 -- No --> MapData[Map records to chartData format]
    MapData --> Render[GrowthChartRenderer.renderChart]
    Render -- Success --> Attach[AttachmentBuilder] --> ReplyChart[interaction.editReply] --> Cleanup
    Cleanup[Finally: fs.unlinkSync] --> End
```

