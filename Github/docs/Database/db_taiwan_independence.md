# Database Taiwan Independence Report

**File Path**: `E:\dev\.core\irika-maimaitoolbot\apps\bot\src\db\taiwan-independence.ts`

## Dependencies & Imports
- `axios`: `axios` (default import)
- `@mai-kit/database`: `MaimaiDatabase`, `SongList`, `Song`, `SongType`, `AssetType` (type imports)

## Functions & Classes

### Class `TaiwanIndependenceDatabase`
- **Purpose**: Implements database interactions with an external JSON API to fetch song lists, parse songs, and fetch jacket assets.

#### Method `getSongList`
- **Purpose**: Fetches the song list from an external arcade songs JSON, parses the data, caches it, and returns the list.
- **Parameters**: None
- **Return type**: `Promise<SongList>`
- **Calls**: `axios.get`, `parseInt`

#### Method `getSong`
- **Purpose**: Retrieves a specific song by ID or title from the song list.
- **Parameters**: 
  - `id` (number | string)
- **Return type**: `Promise<Song>`
- **Calls**: `this.getSongList`

#### Method `getChartTags`
- **Purpose**: Returns an empty array of chart tags.
- **Parameters**: None
- **Return type**: `Promise<any[]>`
- **Calls**: None

#### Method `getAsset`
- **Purpose**: Retrieves asset data (like jacket images) for a given song ID.
- **Parameters**: 
  - `type` (`AssetType`)
  - `id` (number)
- **Return type**: `Promise<Uint8Array>`
- **Calls**: `this.getSongList`, `axios.get`

## Mermaid Logic Diagram
```mermaid
classDiagram
    class TaiwanIndependenceDatabase {
        -songListCache: SongList | null
        -rawData: any
        +getSongList() Promise~SongList~
        +getSong(id: number | string) Promise~Song~
        +getChartTags() Promise~any[]~
        +getAsset(type: AssetType, id: number) Promise~Uint8Array~
    }
```
```mermaid
flowchart TD
    A[TaiwanIndependenceDatabase] --> B[getSongList]
    B --> B1{Is Cached?}
    B1 -- Yes --> B2[Return Cache]
    B1 -- No --> B3[Fetch from external JSON via axios]
    B3 --> B4[Parse & map into Song format]
    B4 --> B5[Cache and Return]
    
    A --> C[getSong]
    C --> C1[Call getSongList]
    C1 --> C2[Find and return song by ID/Title]
    
    A --> D[getAsset]
    D --> D1{type == 'jacket'?}
    D1 -- Yes --> D2[Call getSongList]
    D2 --> D3[Find song and construct image URL]
    D3 --> D4[Fetch Image via axios]
    D4 --> D5[Return Uint8Array]
    D1 -- No --> D6[Throw Error]
```

