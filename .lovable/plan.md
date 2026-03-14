

## Investigation Results

### Root Cause: Iframe Remounting Due to Callback Instability

The `handleMessage` callback in PandaPlayer depends on `onProgress` and `onComplete`. These callbacks are recreated frequently in AulaPage because:
- `handleProgress` depends on `saveProgress` (stable) — OK
- `handleComplete` depends on `completed`, `duration`, `currentTime` (state values that change on every progress tick)

This chain causes:
1. Every `onProgress` call updates `currentTime`/`duration` state in AulaPage
2. `handleComplete` is recreated (depends on `currentTime`, `duration`)
3. PandaPlayer receives a new `onComplete` prop
4. `handleMessage` is recreated (depends on `onComplete`)
5. The `useEffect` re-runs → calls `setReady(false)` → shows loading overlay → re-adds listeners
6. This creates a render loop that disrupts the iframe's display

Additionally, the `embed_html` path uses `dangerouslySetInnerHTML` which **recreates the iframe DOM node** on every React re-render of that div — destroying the video player state entirely.

### Fix Plan — Two files

#### 1. Rewrite `PandaPlayer.tsx`
- Store `onProgress` and `onComplete` in **refs** instead of depending on them in `useCallback`/`useEffect`. This breaks the re-render chain completely.
- Remove `handleMessage` from the `useEffect` dependency array — attach listener once, read latest callbacks from refs.
- Remove `setReady(false)` from the effect (only set ready=false on actual src/html change via a separate check).
- For the `embed_html` path: use a **ref-based approach** — set `innerHTML` imperatively once via `useEffect` + ref, so React never recreates the iframe DOM.
- Add `min-height: 360px` to the container for safety.
- Keep the iframe `src` path stable (memoize `src` properly).

#### 2. Stabilize callbacks in `AulaPage.tsx`
- Make `handleComplete` use refs for `currentTime`/`duration`/`completed` so the callback identity is stable and never changes.
- This prevents unnecessary PandaPlayer re-renders.

### No other files or functionality will be changed.

