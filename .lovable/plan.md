

## Plan: Hide Panda Logo During Video Load

**Problem**: The loader overlay disappears after a fixed 500ms timeout, but the Panda iframe hasn't finished loading yet. During this gap, the Panda player splash screen (with logo) is visible.

**Fix** — Single file: `src/components/cursos/PandaPlayer.tsx`

1. **Remove the 500ms timer shortcut** — currently `setTimeout(() => setReady(true), 500)` forces the overlay away too early.

2. **For the iframe `src` path** (line 136-144): Already has `onLoad` — just removing the timer is sufficient.

3. **For the `embedHtml` path** (line 119-123): The `onLoad` on a `<div>` doesn't fire for inner content. Instead, use a `MutationObserver` or `useEffect` to find the injected iframe and attach an `onload` listener to it.

4. **Add Panda `ready` postMessage listener** — listen for `panda_ready` or `panda_play` events as an additional signal to set `ready = true`, ensuring the overlay stays until the player is truly ready (not just the iframe shell).

This keeps the loading spinner visible until the video player is fully initialized, hiding the Panda logo splash entirely.

