

## Fix panda-sync: use select-then-insert for modules instead of upsert

### Root cause
The upsert on `modulos` with `onConflict: "curso_id,titulo"` is unreliable — even with the unique constraint added, the upsert+select pattern can fail. The fix uses a simpler select-first, insert-if-missing approach.

### Changes to `supabase/functions/panda-sync/index.ts`

**PASSO 1 — Curso upsert**: Split into upsert (without `.select()`) + separate `.select().eq().single()` to reliably get the `cursoId`.

**PASSO 2 — Module**: Replace upsert with:
- `SELECT id FROM modulos WHERE curso_id = cursoId ORDER BY sort_order LIMIT 1`
- If not found: `INSERT INTO modulos (curso_id, titulo, sort_order) VALUES (cursoId, 'Módulo 1', 1)` with `.select('id').single()`

**PASSO 3 — Videos**: Use `videos.entries()` for indexed iteration, add `descricao: ""` and `sort_order: index + 1` to each upsert.

**Logs**: Add detailed logging at each step (`cursoId`, `moduloId`, `videos a sincronizar`, per-video status).

### Files changed
1. `supabase/functions/panda-sync/index.ts` — rewrite sync logic

No other files changed.

