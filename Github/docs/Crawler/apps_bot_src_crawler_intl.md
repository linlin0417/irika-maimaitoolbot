# Analysis of apps\bot\src\crawler\intl.ts

## 1. File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\crawler\intl.ts`

## 2. Dependencies & Imports
- `axios` from `'axios'`
- `* as cheerio` from `'cheerio'`
- `type { PlayerProfile, Bests, Score, LevelIndex }` from `'@mai-kit/prober'`
- `TaiwanIndependenceDatabase` from `'../db/taiwan-independence'`

## 3. Functions & Classes

### Function: `fetchPlayerData`
- **Purpose**: Fetches player profile and scores from the international maimai site, calculates DX rating using constants from the local database, and returns the top scores (Bests).
- **Parameters**: 
  - `cookie` (type: `string`) - The user's authentication cookie (`userId`).
- **Return Type**: `Promise<{ profile: PlayerProfile, bests: Bests }>`
- **Calls**: 
  - `axios.create` to create an HTTP client with the provided cookie.
  - `client.get` to fetch the home page and score pages.
  - `cheerio.load` to parse HTML.
  - `db.getSongList` to retrieve song constants for rating calculations.
  - Uses `Math.min`, `Math.floor`, `parseFloat`, `parseInt`.

## 4. Mermaid Logic Diagram

```mermaid
flowchart TD
    Start[fetchPlayerData] --> HTTP[Create axios client with cookie]
    HTTP --> Profile[Fetch profile from home page]
    Profile --> Valid{Valid Login?}
    Valid -- No --> ThrowErr[Throw Error]
    Valid -- Yes --> LoopScores[Loop through difficulties 0 to 4]
    LoopScores --> FetchScores[Fetch standard & dx scores]
    FetchScores --> ParseScores[cheerio parses achievements]
    ParseScores --> Next{More Difficulties?}
    Next -- Yes --> LoopScores
    Next -- No --> LoadDB[db.getSongList()]
    LoadDB --> Calculate[Map scores with DB and calculate DX rating]
    Calculate --> Sort[Sort by dx_rating descending]
    Sort --> Return[Return profile and top bests]
```

