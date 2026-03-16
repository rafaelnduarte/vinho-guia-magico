

## Plan: Update CursosPage Cards to 500x834 with Cover Image

### Changes — `src/pages/CursosPage.tsx`

1. **Add `capa_url` to interface and query**: Add `capa_url: string | null` to `CursoCard` and include it in the `.select()` call (line 29).

2. **Redesign cards to 500x834 portrait format with cover background**:
   - Each card uses `aspect-ratio: 500 / 834` with `capa_url` as `background-image` (cover/center), falling back to muted bg.
   - Title, description, aula count, progress bar overlay at the bottom of the card with a semi-transparent gradient backdrop for readability.
   - All existing functionality (navigation, progress calc, sorting) remains identical.

### Card Structure
```text
┌─────────────────────┐
│                     │
│   [capa_url bg]     │
│   aspect 500:834    │
│                     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← gradient overlay
│ Course Title        │
│ 📖 X aulas    75%  │
│ ████████░░░░  bar   │
└─────────────────────┘
```

No other pages or functionality changed.

