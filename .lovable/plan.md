

## Plan: Convert Aulas to Card Layout with Thumbnail in CursoDetailPage

### What Changes
**File: `src/pages/CursoDetailPage.tsx`**

1. **Add `thumbnail_url` to the aulas query** (line 43) — include it in the `select` statement and the `Aula` interface.

2. **Replace the list layout (lines 93-120)** with a responsive card grid similar to the admin layout:
   - Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
   - Each card:
     - Top: `aspect-video` div with `thumbnail_url` as background (fallback to muted bg)
     - Bottom: Info section with lesson name (sanitized, `line-clamp-2`) and duration
     - Completed check icon overlaid on thumbnail corner
     - Entire card is clickable (navigates to aula)

3. **No other pages or functionality changed.** Navigation, progress tracking, sorting all remain identical.

### Card Structure
```text
┌─────────────────────────┐
│   [thumbnail / aspect]  │
│              ✓ (if done)│
├─────────────────────────┤
│  Aula Title             │
│  3:45                   │
└─────────────────────────┘
```

