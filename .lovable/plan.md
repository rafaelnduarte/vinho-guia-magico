

## Bidirectional cascade publish/unpublish between cursos and aulas

### 1. Database migration — Create trigger on `aulas`

Create `trg_aula_cascata_publicacao()` function + trigger on `aulas.is_published` UPDATE:

- **Publish direction**: When an aula goes `false → true`, if the parent curso is unpublished, auto-publish it. Log to `webhook_logs`.
- **Unpublish direction**: When an aula goes `true → false`, count remaining published aulas. If zero, auto-unpublish the curso. Log to `webhook_logs`.

The function uses `SECURITY DEFINER` to bypass RLS. The existing `trg_cursos_is_published` trigger (curso unpublish → cascade all aulas to false) remains unchanged.

**Important**: The `webhook_logs` INSERT policy blocks client inserts (`WITH CHECK (false)`), but since this trigger runs as `SECURITY DEFINER`, it bypasses RLS and can insert.

### 2. Frontend: `AdminCursos.tsx` — Update `handleToggleAula`

After toggling an aula, re-fetch the curso's current `is_published` state from the database (since the trigger may have changed it), then:
- Update `selectedCurso` state to reflect the new value
- Show contextual toast:
  - "Aula publicada. Curso republicado automaticamente." (if curso was auto-published)
  - "Aula despublicada. Curso despublicado automaticamente." (if curso was auto-unpublished)
  - "Aula publicada!" / "Aula despublicada." (no cascade)
- Invalidate both `admin-cursos` and `admin-aulas` queries

### Files changed
1. New SQL migration (trigger + function)
2. `src/components/admin/AdminCursos.tsx` — update `handleToggleAula` logic

