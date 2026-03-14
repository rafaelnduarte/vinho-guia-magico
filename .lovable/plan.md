

## Plan: Add Delete Routines for Unpublished Aulas and Cursos

### Scope
Add delete buttons in AdminCursos for:
- **Aulas (videos)**: Trash icon per row in the aulas table, only enabled when `is_published === false`
- **Cursos (folders)**: Trash icon on each curso card, only enabled when `is_published === false`

Both with confirmation dialog before deletion. Deleting a curso also cascade-deletes its aulas (already handled by DB since aulas reference curso_id, but we'll delete aulas first explicitly to be safe).

### Changes — Single file: `src/components/admin/AdminCursos.tsx`

**1. Add imports**: `Trash2` from lucide-react, `AlertDialog` components from ui

**2. Add state**: `deletingAulaId`, `deletingCursoId`, `confirmDeleteAula`, `confirmDeleteCurso` for tracking delete operations and confirmation dialogs

**3. Add `handleDeleteAula(aula)`**:
- Guard: only if `!aula.is_published`
- Delete from `aulas` table by id
- Invalidate queries
- Toast success/error

**4. Add `handleDeleteCurso(curso)`**:
- Guard: only if `!curso.is_published`
- Delete all aulas for this curso first: `DELETE FROM aulas WHERE curso_id = curso.id`
- Delete the curso: `DELETE FROM cursos WHERE id = curso.id`
- Invalidate queries, close modal if it was the selected curso
- Toast success/error

**5. UI — Curso card**: Add a `Trash2` button next to "Ver Videos", disabled/hidden when `is_published === true`. Clicking opens an AlertDialog confirmation.

**6. UI — Aulas table**: Add a new column "Ações" with a `Trash2` icon button per row, disabled/hidden when `is_published === true`. Clicking opens an AlertDialog confirmation.

**7. AlertDialog for confirmation**: Two separate AlertDialogs (one for aula, one for curso) with destructive action button.

### No other files or DB changes needed
- RLS already allows admins full CRUD on both tables
- No new columns or migrations required

