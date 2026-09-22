# crawler-service.ts Analysis Report

## File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\core\crawler-service.ts`

## Dependencies & Imports
*   `../crawler/auth`: Internal module (`MaimaiAuthClient`).
*   `../crawler/scraper`: Internal module (`MaimaiScraper`).
*   `../db/repository`: Internal module (`processScrapedScores`, `updateUserSession`, `getUser`).
*   `cheerio`: External library for parsing HTML.
*   `fs`: Node.js built-in file system module.
*   `path`: Node.js built-in path module.
*   `axios`: External library (imported but unused in this file directly).

## Functions & Classes

### `runCrawlerForUser`
*   **Purpose**: Main service function to crawl a user's maimai DX data. It logs in, updates profile info (name, rating, icon), fetches scores, saves the icon locally, updates the DB, and processes the scores.
*   **Parameters**:
    *   `discordId` (`string`): The user's Discord ID.
*   **Return Type**: `Promise<{ playerName: string, rating: number, totalScraped: number, newRecordsCount: number, improvedRecordsCount: number } | null>`
*   **Calls**:
    *   `getUser`: Fetches user credentials from DB.
    *   `MaimaiAuthClient` constructor, `importCookieString`, `login`, `exportCookieString`: Handles authentication.
    *   `auth.client.get`: Performs HTTP requests (home page, playerData page, icon image).
    *   `cheerio.load`: Parses HTML to extract name, rating, and icon URLs.
    *   `fs.existsSync`, `fs.mkdirSync`, `fs.writeFileSync`: Caches user icon locally.
    *   `updateUserSession`: Updates the database with new cookie, name, rating, and icon URL.
    *   `MaimaiScraper` constructor, `fetchAllScores`: Scrapes score data.
    *   `processScrapedScores`: Compares new scores with DB and saves them.

### `fetchUserCollections`
*   **Purpose**: Scrapes user's titles, nameplates, and frames. (Currently commented out in `runCrawlerForUser` to prevent bans).
*   **Parameters**:
    *   `discordId` (`string`): The user's Discord ID.
    *   `authClient` (`MaimaiAuthClient`): An authenticated client instance.
*   **Return Type**: `Promise<void>`
*   **Calls**:
    *   `authClient.client.get`: Fetches trophy, nameplate, and frame pages.
    *   `cheerio.load`: Parses HTML for collections.
    *   `import('../db/repository.js')`: Dynamically imports DB function.
    *   `updateUserCollections`: Updates the database with collection data.

## Mermaid Logic Diagram
```mermaid
flowchart TD
    A[runCrawlerForUser(discordId)] --> B[getUser(discordId)]
    B --> C{User exists?}
    C -- No --> D[Return null]
    C -- Yes --> E[MaimaiAuthClient.login()]
    E --> F{Login success?}
    F -- No --> G[Return null]
    F -- Yes --> H[Fetch Home Page]
    H --> I[Extract Name, Rating, Icon]
    I --> J{Need fallback for Icon?}
    J -- Yes --> K[Fetch playerData or Chara]
    J -- No --> L[Download Icon Image]
    K --> L
    L --> M[Save Icon to FS]
    M --> N[updateUserSession()]
    N --> O[MaimaiScraper.fetchAllScores()]
    O --> P[processScrapedScores()]
    P --> Q[Return stats object]
```

