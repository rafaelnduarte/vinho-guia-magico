

## Per-Course Sync and Status Column

Most of the infrastructure already exists (panda-sync, panda-webhook, AdminCursos modal). The main additions are:

### 1. Database Migration

Add two columns to `aulas`:
- `thumbnail_url TEXT` (nullable)
- `status TEXT DEFAULT 'processing'` (values: `processing`, `completed`, `failed`)

Add index on `(curso_id, sort_order)` for efficient modal queries.

### 2. Modify `panda-sync` Edge Function

Accept an optional `folder_id` body parameter. If provided, sync only that folder's videos (skip the full folder loop). If not provided, sync all folders as before. Also populate `thumbnail_url` and map Panda `status` field (`CONVERTED` -> `completed`, else `processing`).

### 3. Update `AdminCursos.tsx`

**Modal header**: Add a "Sincronizar" button next to the publish toggle. It calls `panda-sync` with the selected curso's `panda_folder_id`. Only shown when `selectedCurso.panda_folder_id` exists.

**Table**: Add a "Status" column showing icons:
- `completed` -> green checkmark
- `processing` -> yellow clock/spinner  
- `failed` -> red X

**Aula interface**: Add `thumbnail_url` and `status` fields.

**New state**: `syncingCurso` boolean for the per-course sync loading state.

### 4. Update `panda-webhook` Edge Function

On `video.changeStatus` event, also update the new `status` column (`CONVERTED` -> `completed`, others mapped accordingly).

### Files changed
1. New SQL migration (add columns + index)
2. `supabase/functions/panda-sync/index.ts` — accept optional `folder_id`
3. `supabase/functions/panda-webhook/index.ts` — update `status` column
4. `src/components/admin/AdminCursos.tsx` — sync button in modal + status column

