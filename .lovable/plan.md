

## Plan: Remove All Diagnostic/Audit/DRM Infrastructure

### Problem
The project accumulated DRM, audit, diagnostics, and self-healing code that is unnecessary. The player works with simple embed. All this extra infrastructure needs to be removed.

### Changes

**1. Delete Edge Functions (5 functions)**
- `supabase/functions/panda-audit/` — audit logic
- `supabase/functions/panda-diagnostics/` — video diagnostics
- `supabase/functions/panda-fix/` — auto-fix
- `supabase/functions/panda-recovery/` — recovery logic
- `supabase/functions/migrate-drive-urls/` — migration utility (if unused)

Keep only: `panda-sync`, `panda-proxy`, `panda-webhook`

**2. Delete Admin Diagnostics Component**
- Delete `src/components/admin/AdminPandaDiagnostics.tsx`

**3. Update AdminPage.tsx**
- Remove `AdminPandaDiagnostics` import
- Remove "Diagnóstico" tab trigger and tab content

**4. Clean `supabase/config.toml`**
- Remove `[functions.panda-fix]` entry

**5. Drop Auxiliary Tables (migration)**
```sql
DROP TABLE IF EXISTS public.panda_title_index;
DROP TABLE IF EXISTS public.panda_videos_index;
DROP TABLE IF EXISTS public.panda_audit_log;
DROP TABLE IF EXISTS public.recovery_logs;
```

**6. Simplify `panda-sync`**
- Remove `normalizeScrappy` function
- Remove `panda_title_index` upsert (PASSO 3)
- Remove orphan cleanup from `panda_title_index` (PASSO 4)
- Remove `panda_videos_index` population (PASSO 5)
- Remove incremental sync logic (queries `panda_videos_index` which is being dropped)
- Keep: folder sync, video upsert with embed_url, profile assignment

**7. Update AdminCursos.tsx**
- Remove "Sync Rápido" (incremental) button — only keep "Sync Completo" (or rename to "Sincronizar Panda")
- Remove incremental-related code from `handlePandaSync`
- Remove `skipped_unchanged` from toast

**8. No changes to**: PandaPlayer (already embed-only), AulaPage (already clean)

### Technical Notes
- The `titulo_normalizado` column on `aulas` and `cursos` tables will remain (used for display/search), but the normalizer in panda-sync will be simplified to a basic cleanup
- Tables `panda_title_index`, `panda_videos_index`, `panda_audit_log`, `recovery_logs` will be dropped via migration

