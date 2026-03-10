

## Remove `modulos` layer: simplify to `cursos → aulas`

The `progresso` table also has a `modulo_id` column (NOT NULL with FK to modulos), so it needs to be handled too. However, since there's no application code referencing `progresso.modulo_id` and the table is likely empty, we can clean it up in the same migration.

### 1. Database migration

```sql
-- Remove FK and column from aulas
ALTER TABLE public.aulas DROP COLUMN modulo_id;

-- Remove FK and column from progresso
ALTER TABLE public.progresso DROP COLUMN modulo_id;

-- Drop modulos table (and its unique constraint, FKs cascade automatically)
DROP TABLE IF EXISTS public.modulos;
```

This will also drop the `modulos_curso_id_titulo_key` unique constraint we added earlier.

### 2. Edge Function: `panda-sync/index.ts`

Remove lines 117-145 (entire PASSO 2 module logic). Remove `modulo_id: moduloId` from the aulas upsert (line 164). The simplified flow becomes:

```
For each folder:
  1. Upsert curso → get cursoId
  2. Fetch videos → upsert aulas with curso_id directly
```

### 3. Edge Function: `panda-webhook/index.ts`

In the `video.created` handler (lines 59-88), remove the modulo find-or-create block. Insert aula directly with `curso_id` only (no `modulo_id`).

### 4. Frontend: `AdminCursos.tsx`

No changes needed -- it doesn't reference modulos at all.

### Files changed
1. New migration (drop column + drop table)
2. `supabase/functions/panda-sync/index.ts`
3. `supabase/functions/panda-webhook/index.ts`

