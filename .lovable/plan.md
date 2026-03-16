

## Plan: Convert Aulas Table to Card Layout with Thumbnail Background

### What Changes
Replace the `<Table>` inside the aulas dialog (lines 388-431) with a responsive grid of cards. Each card uses `aula.thumbnail_url` as a background image.

### Implementation Details

**File: `src/components/admin/AdminCursos.tsx`**

1. **Remove unused Table imports** (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`) — they are only used in the aulas section.

2. **Replace the `<Table>...</Table>` block (lines 388-431)** with a card grid:
   - Grid layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
   - Each card:
     - Has `thumbnail_url` as `backgroundImage` with a dark overlay for text readability
     - Falls back to a solid dark background if no thumbnail
     - Shows: index number, title, duration, status icon, published toggle, delete button
     - Aspect ratio ~16:9 using `aspect-video` class
   - All existing functionality (toggle publish, delete) remains wired to the same handlers

3. **No other files or functionality changed.**

### Card Structure (per aula)
```text
┌──────────────────────────────┐
│  [thumbnail background]       │
│  ┌─ dark overlay ──────────┐ │
│  │ #1  Title               │ │
│  │ 3:45  ● Status          │ │
│  │ [Switch] Published [🗑] │ │
│  └─────────────────────────┘ │
└──────────────────────────────┘
```

