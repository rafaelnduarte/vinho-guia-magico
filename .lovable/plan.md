

## Plan: Integrate Scrappy Normalizer into Panda Sync Pipeline

### Overview
Add title normalization to the existing `panda-sync` edge function so every video and course gets a `titulo_normalizado` field during sync. Also create a `panda_title_index` lookup table and update `panda-token` to use it as a fallback for broken video IDs.

### Changes

**1. Database migration — 2 changes**

Add column `titulo_normalizado` (text, nullable, indexed) to both `aulas` and `cursos` tables.

Create new table `panda_title_index`:
```sql
CREATE TABLE public.panda_title_index (
  panda_video_id text PRIMARY KEY,
  titulo_original text NOT NULL,
  titulo_normalizado text NOT NULL,
  curso_id uuid,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.panda_title_index ENABLE ROW LEVEL SECURITY;
-- Admin-only access
CREATE POLICY "Admins can manage panda_title_index" ON public.panda_title_index
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_panda_title_index_normalized ON public.panda_title_index(titulo_normalizado);

ALTER TABLE public.aulas ADD COLUMN titulo_normalizado text;
CREATE INDEX idx_aulas_titulo_normalizado ON public.aulas(titulo_normalizado);

ALTER TABLE public.cursos ADD COLUMN titulo_normalizado text;
```

**2. Update `supabase/functions/panda-sync/index.ts`**

- Add `normalizeScrappy()` function at top (the exact function from the prompt)
- During curso upsert: add `titulo_normalizado: normalizeScrappy(folder.name)`
- During aula upsert: add `titulo_normalizado: normalizeScrappy(video.title)`
- After upserting all aulas for a folder: upsert rows into `panda_title_index` with `panda_video_id`, `titulo_original`, `titulo_normalizado`, `curso_id`, `last_synced_at`
- On full sync: delete orphan entries from `panda_title_index` that no longer exist in the synced set
- Add `normalized_count` to results

**3. Update `supabase/functions/panda-token/index.ts`**

- Before returning `null` token, add a fallback: if the requested `video_id` doesn't exist in `aulas`, search `panda_title_index` by `titulo_normalizado` to find a valid replacement ID
- Log the resolution for debugging

**4. No UI changes needed** — normalization is fully automatic and transparent during sync

### Technical Details

The `normalizeScrappy` function:
```typescript
function normalizeScrappy(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(mp4|mov|mkv|avi)$/g, "")
    .replace(/modulo\s*\d+/g, "")
    .replace(/\bpp\b/g, "")
    .replace(/\bparte\s*\d+/g, "")
    .replace(/\b\d+\s*-\s*/g, "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

No other functionality is altered.

