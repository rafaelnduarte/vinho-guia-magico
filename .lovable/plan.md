

## Fix: Video sync failing due to missing unique constraint on `modulos`

### Root Cause
The `panda-sync` function tries to upsert into `modulos` with `onConflict: "curso_id,titulo"`, but **no unique constraint exists** on those columns. This causes the upsert to fail, the fallback query finds nothing (table is empty), and the function skips all videos for that folder via `continue`.

Evidence:
- `cursos`: 4 rows (synced correctly)
- `modulos`: 0 rows (upsert failed silently)
- `aulas`: 0 rows (skipped because no modulo_id)

### Changes

#### 1. Migration: Add unique constraint on `modulos(curso_id, titulo)`
```sql
ALTER TABLE modulos ADD CONSTRAINT modulos_curso_id_titulo_key UNIQUE (curso_id, titulo);
```

#### 2. Update `supabase/functions/panda-sync/index.ts`
- Remove `ignoreDuplicates: true` from the modulos upsert (it prevents `.select()` from returning data)
- Add debug logs for the video sync loop to capture any remaining errors
- Keep the fallback fetch logic as safety net

### Files changed
1. New migration (unique constraint)
2. `supabase/functions/panda-sync/index.ts` (fix modulo upsert + add debug logs)

No other files changed.

