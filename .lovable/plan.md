

## Plan: Display Courses Grouped by Trilha on CursosPage

### Changes — `src/pages/CursosPage.tsx` only

**Data fetching redesign**: Instead of fetching all published courses directly, fetch published trilhas (ordered by `sort_order`) with their associated courses via `trilha_cursos` (ordered by `sort_order`).

1. Fetch published `trilhas` ordered by `sort_order`
2. Fetch `trilha_cursos` for those trilha IDs, ordered by `sort_order`
3. Fetch published `cursos` that appear in the trilha_cursos results (only courses linked to trilhas)
4. Fetch `aulas` and `progresso` for progress calculation (same as current)

**New data structure**:
```typescript
interface TrilhaGroup {
  id: string;
  titulo: string;
  cursos: CursoCard[]; // ordered by trilha_cursos.sort_order
}
```

**Rendering**: Replace the flat grid with a loop over trilha groups:
- Each trilha renders its `titulo` as a section label (`h2`)
- Below the label, a grid of course cards (same 500x834 card style) in trilha sort order
- Courses not associated to any trilha are hidden
- Empty state if no trilhas have courses

### Layout
```text
┌──────────────────────────────────┐
│ 🎓 Cursos                       │
│                                  │
│ ── Trilha A ──────────────────── │
│ [Card 1] [Card 2] [Card 3]      │
│                                  │
│ ── Trilha B ──────────────────── │
│ [Card 1] [Card 2]               │
└──────────────────────────────────┘
```

No other files or functionality changed.

