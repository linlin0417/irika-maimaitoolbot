# File Analysis Report: `diagnostic.ts`

## 1. File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\diagnostic.ts`

## 2. Dependencies & Imports
- `axios` from `'axios'`
- `wrapper` from `'axios-cookiejar-support'`
- `CookieJar` from `'tough-cookie'`
- `* as cheerio` from `'cheerio'`

## 3. Functions & Classes

### Function: `diagnose2`
- **Purpose**: A diagnostic script that fetches an authentication page and extracts HTML form and link information to debug or analyze login flow.
- **Parameters**: None.
- **Return Type**: `Promise<void>` (implicitly).
- **Dependencies / Calls**: 
  - `CookieJar()` (from `tough-cookie`)
  - `axios.create()` and `wrapper()` (from `axios` and `axios-cookiejar-support`)
  - `client.get()`
  - `cheerio.load()`
  - `$('form').each()`, `$(el).find('input')`, `attr()` (cheerio methods)
  - `console.log()` and `console.error()`

## 4. Mermaid Logic Diagram

```mermaid
flowchart TD
    A[Start script] --> B[Call diagnose2()]
    B --> C[Create CookieJar]
    C --> D[Initialize Axios client with wrapper & jar]
    D --> E[GET Aime Login Page]
    E -- Success --> F[Load response with Cheerio]
    E -- Error --> Z[Console Error]
    F --> G[Extract and Log all Form tags and Inputs]
    G --> H[Extract and Log 'sega.jp' Links]
    H --> I[End]
    Z --> I
```

