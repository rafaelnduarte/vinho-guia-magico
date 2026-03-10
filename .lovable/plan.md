

## Bidirectional Cascade — Complete Implementation

### Problem
Current triggers only handle: curso unpublish → aulas off, and aula toggle → curso auto-publish/unpublish. Missing: **curso publish → all aulas ON**.

Also, the frontend manually does the aula cascade in `handleToggleCurso` (line 116-118), which is redundant with triggers and should be removed.

### 1. Database Migration

Drop existing triggers/functions and create two new ones:

- **Drop**: `sync_curso_unpublish` function + its trigger, `trg_aula_cascata_publicacao` function + `trg_aulas_cascata_bidirecional` trigger
- **Create `trg_curso_cascata_aulas()`**: On cursos UPDATE of is_published — publish all aulas when curso published, unpublish all when curso unpublished. Logs to webhook_logs.
- **Create `trg_aula_cascata_curso()`**: On aulas UPDATE of is_published — auto-publish curso when first aula published, auto-unpublish when last aula unpublished. Logs to webhook_logs.

Both use `SECURITY DEFINER` to bypass RLS for webhook_logs inserts. The WHERE clauses (`AND is_published = false/true`) prevent infinite trigger recursion.

### 2. Frontend: `AdminCursos.tsx`

**`handleToggleCurso`** (lines 110-132):
- Remove manual aula cascade code (lines 116-118) — triggers handle it now
- Update toast messages:
  - ON: "Curso publicado. Todas as aulas foram publicadas."
  - OFF: "Curso despublicado. Todas as aulas foram despublicadas."
- Invalidate `admin-aulas` query to refresh modal if open

**`handleToggleAula`** — no changes needed, already handles trigger-driven curso state changes.

### Files changed
1. New SQL migration (drop old triggers/functions, create 2 new ones)
2. `src/components/admin/AdminCursos.tsx` — simplify `handleToggleCurso`

