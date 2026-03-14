

## Plan: Natural Alphabetical Sort for Cursos and Aulas in Admin

### Change — Single file: `src/components/admin/AdminCursos.tsx`

**1. Cursos query**: Replace `.order("created_at", { ascending: true })` with client-side natural sort using `localeCompare` with `{ numeric: true }` after fetching, so folders appear in natural alphabetical order (e.g., "Aula 2" before "Aula 10").

**2. Aulas query**: Replace `.order("sort_order", { ascending: true })` with client-side natural sort by `titulo` using the same `localeCompare` approach.

Both changes apply only to the admin view. No other files or functionality affected.

