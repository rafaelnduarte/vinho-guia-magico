

## Plan: Complete Panda Video Audit & Fix Pipeline

### What Already Exists
- `panda-sync`: fully implemented with normalization
- `panda-audit`: cross-validates Supabase vs Panda, fuzzy matching, config.json validation
- `panda-diagnostics`: has `assign_drm`, `assign_drm_all`, `group_info` actions
- `panda-token`: has fallback via `panda_title_index`
- `PandaPlayer`: has loading/drm_error/hls_fallback states
- `AdminPandaDiagnostics`: has audit UI, DRM assignment, diagnostics

### What Needs to Be Built

**1. Database migration**
- Create `panda_videos_index` table (full Panda video catalog with normalized titles)
- Create `panda_audit_log` table (tracks all fix/assign operations)
- Both with admin-only RLS

**2. New edge function: `panda-fix`**
- Receives array of `{ aula_id, new_video_id }` corrections
- Validates each `new_video_id` exists in Panda before applying
- Updates `aulas.panda_video_id` and `aulas.titulo_normalizado`
- Logs each operation to `panda_audit_log`
- Returns success/failure per item

**3. Update `panda-sync` to populate `panda_videos_index`**
- After fetching all videos from Panda, upsert into `panda_videos_index` (id, title, title_normalized, status, folder_id, synced_at)
- This creates the full catalog for audit matching

**4. Update `panda-audit` to use `panda_videos_index`**
- Instead of re-fetching from Panda API, use `panda_videos_index` for matching (faster, offline)
- Still fetch from API if index is empty (fallback)
- Add confidence score to fuzzy match suggestions

**5. Update `PandaPlayer` error handling**
- When `panda-token` returns error `VIDEO_NOT_FOUND`, show "Este video esta temporariamente indisponivel" instead of DRM error
- Add distinct `error_not_found` state

**6. Update `AdminPandaDiagnostics` UI**
- Add "Aplicar Correção" button per inconsistent row (calls `panda-fix` for single item)
- Add "Corrigir Todos Automaticamente" button (applies all suggestions with confidence > 80)
- Add audit log table at bottom showing fix history
- Add "Última sync" timestamp display

### Technical Details

```sql
CREATE TABLE public.panda_videos_index (
  id text PRIMARY KEY,
  title text NOT NULL,
  title_normalized text NOT NULL,
  status text,
  folder_id text,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX idx_panda_videos_index_normalized ON public.panda_videos_index(title_normalized);

CREATE TABLE public.panda_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid,
  old_video_id text,
  new_video_id text,
  action text NOT NULL,
  result text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

No other functionality is altered.

