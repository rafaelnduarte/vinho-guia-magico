

## Plan: Incremental Sync for `panda-sync`

### Problem
Currently `panda-sync` fetches ALL videos from Panda on every run, even if nothing changed. This is slow and wastes API calls.

### Solution
Add an `incremental` mode that reads the last sync timestamp from `panda_videos_index` and only fetches videos updated after that date.

### Changes

**1. Update `supabase/functions/panda-sync/index.ts`**

- Parse optional `incremental: boolean` from request body (default: `false`)
- When `incremental: true`:
  - Query `MAX(synced_at)` from `panda_videos_index` to get `lastSyncAt`
  - For folder video fetches, compare each video's `updated_at` against `lastSyncAt` and skip unchanged ones
  - For PASSO 5 (full catalog index), add `&updated_after=` param if Panda API supports it; otherwise filter client-side by `updated_at > lastSyncAt`
  - Skip orphan cleanup (PASSO 4) during incremental syncs — orphans only cleaned on full sync
- Add `skipped_unchanged` counter to results
- Add `sync_mode: "incremental" | "full"` to response

**2. Update `src/components/admin/AdminCursos.tsx`**

- `handleSync()` (full sync): stays the same, no body change
- `handleSyncCurso()` (per-course sync): add `incremental: true` to body alongside `folder_id`
- Add a new "Sync Incremental" button next to "Sincronizar Panda" that sends `{ incremental: true }`
- Update toast to show skipped count: `"X sincronizados, Y ignorados (sem alteração)"`

### Technical Details

Incremental detection logic in the edge function:
```typescript
// Get last sync timestamp
let lastSyncAt: string | null = null;
if (incremental) {
  const { data } = await supabase
    .from("panda_videos_index")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();
  lastSyncAt = data?.synced_at || null;
}

// In video loop, skip if unchanged
if (incremental && lastSyncAt && video.updated_at) {
  if (new Date(video.updated_at) <= new Date(lastSyncAt)) {
    results.skipped_unchanged++;
    allSyncedVideoIds.push(video.id); // still track for orphan purposes
    continue;
  }
}
```

No database changes needed — uses existing `synced_at` and `updated_at` columns.

