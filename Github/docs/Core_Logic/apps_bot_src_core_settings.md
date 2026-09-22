# settings.ts Analysis Report

## File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\core\settings.ts`

## Dependencies & Imports
*   `fs`: Node.js built-in file system module.
*   `path`: Node.js built-in path module.

## Functions & Classes

### `getSettings`
*   **Purpose**: Retrieves the bot's settings from `cfg/settings.json`. If the file doesn't exist, it creates the directory and writes default settings before returning them. If JSON parsing fails, it falls back to defaults.
*   **Parameters**: None.
*   **Return Type**: `any` (Returns the parsed JSON object or default settings).
*   **Calls**:
    *   `path.resolve`, `path.dirname`: Manipulate file paths.
    *   `fs.existsSync`, `fs.mkdirSync`, `fs.writeFileSync`, `fs.readFileSync`: File operations.
    *   `JSON.stringify`, `JSON.parse`: JSON serialization/deserialization.

### `saveSettings`
*   **Purpose**: Saves the given settings object back to `cfg/settings.json`.
*   **Parameters**:
    *   `settings` (`any`): The settings object to save.
*   **Return Type**: `void`
*   **Calls**:
    *   `fs.writeFileSync`
    *   `JSON.stringify`

## Mermaid Logic Diagram
```mermaid
flowchart TD
    A[getSettings()] --> B{File exists?}
    B -- No --> C[Create directory]
    C --> D[Write default JSON to file]
    D --> E[Return default settings]
    B -- Yes --> F[Read file content]
    F --> G[Parse JSON]
    G --> H{Parse error?}
    H -- No --> I[Return parsed settings]
    H -- Yes --> J[Return default settings]
    
    K[saveSettings(settings)] --> L[Stringify and write to file]
```

