# rating.ts Analysis Report

## File Path
`E:\dev\.core\irika-maimaitoolbot\apps\bot\src\core\rating.ts`

## Dependencies & Imports
*   *None*

## Functions & Classes

### `getRank`
*   **Purpose**: Converts an achievement percentage into a rank string (e.g., SSS+, S, AAA).
*   **Parameters**:
    *   `achievement` (`number`): The percentage score (e.g., 100.5).
*   **Return Type**: `string`
*   **Calls**: None.

### `getMultiplier`
*   **Purpose**: Returns the multiplier used in maimai rating calculation based on the achievement percentage.
*   **Parameters**:
    *   `achievement` (`number`): The percentage score.
*   **Return Type**: `number`
*   **Calls**: None.

### `calculateRating`
*   **Purpose**: Calculates the rating value of a track play using the chart's constant and the player's achievement percentage.
*   **Parameters**:
    *   `constant` (`number`): The internal difficulty constant of the chart.
    *   `achievement` (`number`): The percentage score.
*   **Return Type**: `number`
*   **Calls**:
    *   `getMultiplier`
    *   `Math.min`, `Math.floor`

## Mermaid Logic Diagram
```mermaid
flowchart TD
    A[calculateRating(constant, achievement)] --> B[getMultiplier(achievement)]
    B --> C[effectiveAchievement = Math.min(100.5, achievement)]
    C --> D[Result = floor(constant * effectiveAchievement / 100 * multiplier)]
```

