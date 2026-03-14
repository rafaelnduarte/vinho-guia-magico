

## Diagnosis

The Panda Video `panda_timeupdate` event sends `{ message, currentTime, video }` — it does **NOT** include a `duration` field. The current code expects `data.duration` which is always `undefined`/`0`, so:

1. `duration` state stays at 0 → `pct` formula `currentTime / duration` = 0 → always shows 0%
2. The progress bar and time display fall back to `aula.duracao_segundos` for the denominator text, but the percentage calculation doesn't use it
3. When a previously completed aula is loaded, it shows "Aula concluída!" but 0% because `currentTime` resets to 0 on mount

## Fix Plan — Two files, no DB changes

### 1. `PandaPlayer.tsx`
- Accept a new `totalDuration` prop (seconds from DB)
- In the `handleMessage` callback, pass `totalDuration` as the duration when Panda doesn't provide one: `onProgressRef.current?.(currentTime, totalDuration || 0)`
- Use `totalDuration` for the 90% completion check: `currentTime / totalDuration > 0.9`

### 2. `AulaPage.tsx`
- Pass `aula.duracao_segundos` to PandaPlayer as `totalDuration`
- Fix `pct` calculation: when `completed` is true and duration/currentTime are 0, show 100%
- Use `aula.duracao_segundos` as fallback denominator in pct: `const effectiveDuration = duration || aula.duracao_segundos`

### Summary of root cause
Panda's postMessage events don't include `duration`. The code assumed they did. The fix uses the known duration from the database as the reference for all progress calculations.

